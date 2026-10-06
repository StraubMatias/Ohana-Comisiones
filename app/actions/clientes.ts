"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAction, EstadoImportacion } from "@/app/actions/estado";
import { exigirAdmin } from "@/lib/auth";
import {
  actualizarCliente,
  crearCliente,
  crearClientesEnLote,
  eliminarCliente as eliminarClienteDb,
} from "@/lib/data/clientes";
import {
  LIMITE_FILAS_IMPORTACION,
  normalizarFilaImportacion,
  type FilaClienteImportada,
} from "@/lib/importacion";
import {
  puedeEjecutarAccionSensible,
  registrarAccionSensible,
} from "@/lib/seguridad";
import { texto, textoOpcional } from "@/lib/formulario";

function normalizarCuit(cuit: string): string {
  return cuit.replace(/[^0-9-]/g, "").slice(0, 13);
}

// ----------------------------------------------------------------------------
// Alta de cliente
// ----------------------------------------------------------------------------
export async function crearClienteAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  const usuario = await exigirAdmin();

  // SEGURIDAD: rate limiting para crear clientes
  const puedeCrear = await puedeEjecutarAccionSensible("usuario", usuario.nombre);
  if (!puedeCrear) {
    return { 
      error: "Demasiadas solicitudes recientes. Esperá un momento e intentá de nuevo.",
    };
  }

  const nombre = texto(formData, "nombre");
  if (!nombre) {
    return { error: "El nombre del cliente es obligatorio." };
  }

  try {
    // El N° del cliente se asigna solo (es el id de la base): no se ingresa.
    await crearCliente({
      nombre,
      cuit: normalizarCuit(textoOpcional(formData, "cuit") ?? ""),
      direccion: textoOpcional(formData, "direccion"),
      localidad: textoOpcional(formData, "localidad"),
      telefono: textoOpcional(formData, "telefono"),
      email: textoOpcional(formData, "email"),
      notas: textoOpcional(formData, "notas"),
    });
    await registrarAccionSensible("usuario", usuario.nombre);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[clientes] error al crear");
    return {
      error: "No se pudo guardar el cliente. Revisá los datos e intentá de nuevo.",
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  updateTag("clientes");
  redirect("/clientes");
}

// ----------------------------------------------------------------------------
// Modificación de cliente
// ----------------------------------------------------------------------------
export async function actualizarClienteAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const id = Number(formData.get("id"));
  const nombre = texto(formData, "nombre");

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Cliente inválido." };
  }
  if (!nombre) {
    return { error: "El nombre del cliente es obligatorio." };
  }

  try {
    // El N° no se edita: siempre es igual al id (ver `actualizarCliente`).
    await actualizarCliente(id, {
      nombre,
      cuit: normalizarCuit(textoOpcional(formData, "cuit") ?? ""),
      direccion: textoOpcional(formData, "direccion"),
      localidad: textoOpcional(formData, "localidad"),
      telefono: textoOpcional(formData, "telefono"),
      email: textoOpcional(formData, "email"),
      notas: textoOpcional(formData, "notas"),
    });
  } catch (error) {
    console.error("[clientes] error al actualizar:", error);
    return {
      error: "No se pudo actualizar el cliente. Intentá de nuevo.",
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  updateTag("clientes");
  redirect("/clientes");
}

// ----------------------------------------------------------------------------
// Eliminación de cliente
// ----------------------------------------------------------------------------
export async function eliminarClienteAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  const usuario = await exigirAdmin();

  // SEGURIDAD: rate limiting para eliminar clientes
  const puedeEliminar = await puedeEjecutarAccionSensible("usuario", usuario.nombre);
  if (!puedeEliminar) {
    return { 
      error: "Demasiadas solicitudes recientes. Esperá un momento e intentá de nuevo.",
    };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Cliente inválido." };
  }

  try {
    await eliminarClienteDb(id);
    await registrarAccionSensible("usuario", usuario.nombre);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[clientes] error al eliminar");
    return {
      error: "No se pudo eliminar el cliente. Intentá de nuevo.",
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  updateTag("clientes");
  redirect("/clientes");
}

// ----------------------------------------------------------------------------
// Importación masiva de clientes desde planilla Excel/CSV
// ----------------------------------------------------------------------------

/**
 * Importa clientes en lote. Recibe por FormData un JSON con un array de filas
 * { numero?, nombre, cuit?, direccion?, localidad?, telefono?, email?, notas? }
 * ya parseadas en el navegador (xlsx).
 * 
 * SEGURIDAD: incluye rate limiting para prevenir abuso.
 */
export async function importarClientesAction(
  _estado: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  const usuario = await exigirAdmin();

  // SEGURIDAD: rate limiting para importaciones masivas
  const puedeImportar = await puedeEjecutarAccionSensible("usuario", usuario.nombre);
  if (!puedeImportar) {
    return { 
      error: "Demasiadas importaciones recientes. Esperá un momento e intentá de nuevo.",
      resumen: null
    };
  }

  const filasJson = String(formData.get("filas") ?? "").trim();
  if (!filasJson) {
    return { error: "No se recibieron filas para importar.", resumen: null };
  }

  let filas: unknown;
  try {
    filas = JSON.parse(filasJson);
  } catch {
    // No exponer detalles del parsing al usuario
    console.error("[clientes] JSON inválido en importación");
    return { error: "Los datos del archivo no se pudieron interpretar.", resumen: null };
  }

  if (!Array.isArray(filas)) {
    return { error: "Los datos del archivo tienen un formato inesperado.", resumen: null };
  }
  if (filas.length === 0) {
    return { error: "El archivo no tiene filas para importar.", resumen: null };
  }
  if (filas.length > LIMITE_FILAS_IMPORTACION) {
    return {
      error: `El archivo tiene ${filas.length} filas. El máximo permitido por importación es ${LIMITE_FILAS_IMPORTACION}.`,
      resumen: null,
    };
  }

  // Validar y normalizar todas las filas ANTES de tocar la base. Así un JSON
  // con campos gigantes o malformados no llega a insertarse.
  const filasValidas: FilaClienteImportada[] = [];
  for (const bruta of filas) {
    const fila = normalizarFilaImportacion(bruta);
    if (fila) filasValidas.push(fila);
  }

  const sinNombre = filas.length - filasValidas.length;
  if (filasValidas.length === 0) {
    return { error: "Ninguna fila tiene nombre para importar.", resumen: null };
  }

  let importados = 0;
  let errores = 0;
  try {
    const resultado = await crearClientesEnLote(filasValidas);
    importados = resultado.importados;
    errores = resultado.errores;

    // SEGURIDAD: registrar acción exitosa para rate limiting
    await registrarAccionSensible("usuario", usuario.nombre);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[clientes] error al importar lote");
    return {
      error: "No se pudo importar el archivo. Intentá de nuevo.",
      resumen: null,
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  updateTag("clientes");

  // Ir a la lista de clientes con un resumen en la URL. La página de /clientes
  // muestra el banner con los resultados de la importación.
  redirect(`/clientes?importado=${importados}&sinNombre=${sinNombre}&errores=${errores}`);
}