"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EstadoAction, EstadoCuenta } from "@/app/actions/estado";
import { exigirAdmin } from "@/lib/auth";
import { obtenerUsuarioPorNombre, actualizarPassword } from "@/lib/data/usuarios";
import type { Usuario } from "@/lib/types";
import {
  crearCookieSesion,
  NOMBRE_COOKIE_SESION,
} from "@/lib/sesion";
import { hashearPassword, verificarPassword } from "@/lib/passwords";
import {
  limpiarIntentosDeLogin,
  puedeIntentarLogin,
  registrarIntentoFallido,
} from "@/lib/seguridad";
import { texto } from "@/lib/formulario";

/**
 * IP del cliente que inicia sesión (para el control de fuerza bruta).
 * En Vercel viene de `x-forwarded-for` (puede traer varias, tomamos la
 * primera) o `x-real-ip`.
 */
async function ipDeRequerimiento(): Promise<string> {
  try {
    const encabezados = await headers();
    const fwd = encabezados.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const real = encabezados.get("x-real-ip");
    return real?.trim() ?? "desconocida";
  } catch {
    return "desconocida";
  }
}

/**
 * La cookie de sesión debe marcarse `Secure` solo cuando la conexión es
 * realmente HTTPS (ej: Vercel). Si se hostea con `next start` por http
 * (localhost o red local) y la marcamos Secure, el navegador no la guarda y
 * el login "no encuentra la página" tras entrar.
 */
async function esConexionSegura(): Promise<boolean> {
  const encabezados = await headers();
  const proto = (encabezados.get("x-forwarded-proto") ?? "").toLowerCase();
  const ssl = (encabezados.get("x-forwarded-ssl") ?? "").toLowerCase();
  return proto === "https" || ssl === "on";
}

// ----------------------------------------------------------------------------
// Iniciar sesión
// ----------------------------------------------------------------------------
export async function iniciarSesionAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  const nombre = texto(formData, "nombre");
  const password = texto(formData, "password");

  if (!nombre || !password) {
    return { error: "Ingresá tu usuario y contraseña." };
  }

  // Control de fuerza bruta: bloquear usuario e IP que superaron el límite
  // de intentos fallidos dentro de la ventana.
  const ip = await ipDeRequerimiento();
  const [permiteUsuario, permiteIp] = await Promise.all([
    puedeIntentarLogin("usuario", nombre),
    puedeIntentarLogin("ip", ip),
  ]);
  if (!permiteUsuario || !permiteIp) {
    return {
      error:
        "Demasiados intentos fallidos. Esperá 10 minutos y volvé a intentar.",
    };
  }

  let usuario: Usuario | null;
  try {
    usuario = await obtenerUsuarioPorNombre(nombre);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[auth] login: error de base de datos");
    return {
      error:
        "No se pudo conectar con la base de datos (Turso). " +
        "Revisá las variables TURSO_DATABASE_URLL / TURSO_AUTH_TOKENN en Vercel " +
        "e intentá de nuevo.",
    };
  }

  if (!usuario || !verificarPassword(password, usuario.passwordHash)) {
    await registrarIntentoFallido("usuario", nombre);
    await registrarIntentoFallido("ip", ip);
    return { error: "Usuario o contraseña incorrectos." };
  }

  // Login correcto: liberar los intentos acumulados de ese usuario e IP.
  await limpiarIntentosDeLogin("usuario", nombre);
  await limpiarIntentosDeLogin("ip", ip);

  const cookieStore = await cookies();
  try {
    cookieStore.set(NOMBRE_COOKIE_SESION, crearCookieSesion(usuario.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" && (await esConexionSegura()),
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
  } catch (error) {
    // Por ejemplo si falta SESSION_SECRET en producción (Vercel).
    console.error("[auth] login: error al crear la cookie de sesión:", error);
    return {
      error:
        "No se pudo iniciar sesión: falta SESSION_SECRET en el entorno de " +
        "deploy (Vercel). Configurala y reintentá.",
    };
  }

  redirect("/");
}

// ----------------------------------------------------------------------------
// Cerrar sesión
// ----------------------------------------------------------------------------
export async function cerrarSesionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NOMBRE_COOKIE_SESION);
  // Refuerzo adicional: si por algún motivo el delete no se propagó en algún
  // cliente, seteamos la cookie con expiración inmediata.
  cookieStore.set(NOMBRE_COOKIE_SESION, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  redirect("/login");
}

// ----------------------------------------------------------------------------
// Cambiar contraseña (anterior + nueva)
// ----------------------------------------------------------------------------
export async function cambiarPasswordAction(
  _estado: EstadoCuenta,
  formData: FormData,
): Promise<EstadoCuenta> {
  const usuario = await exigirAdmin();

  const anterior = texto(formData, "password_anterior");
  const nueva = texto(formData, "password_nueva");

  if (!anterior || !nueva) {
    return { error: "Completá la contraseña anterior y la nueva.", ok: false };
  }
  if (nueva.length < 8) {
    return { error: "La contraseña nueva debe tener al menos 8 caracteres.", ok: false };
  }
  // Validar complejidad: al menos una mayúscula, una minúscula y un número
  const tieneMayuscula = /[A-Z]/.test(nueva);
  const tieneMinuscula = /[a-z]/.test(nueva);
  const tieneNumero = /[0-9]/.test(nueva);
  if (!tieneMayuscula || !tieneMinuscula || !tieneNumero) {
    return { 
      error: "La contraseña debe tener al menos una mayúscula, una minúscula y un número.", 
      ok: false 
    };
  }
  if (nueva === anterior) {
    return { error: "La contraseña nueva debe ser distinta a la anterior.", ok: false };
  }

  const enDB = await obtenerUsuarioPorNombre(usuario.nombre);
  if (!enDB || !verificarPassword(anterior, enDB.passwordHash)) {
    return { error: "La contraseña anterior no es correcta.", ok: false };
  }

  try {
    await actualizarPassword(usuario.id, hashearPassword(nueva));
  } catch {
    // No exponer detalles del error al usuario
    console.error("[auth] error al cambiar password");
    return { error: "No se pudo actualizar la contraseña. Intentá de nuevo.", ok: false };
  }

  return { error: null, ok: true };
}