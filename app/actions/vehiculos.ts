"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAction } from "@/app/actions/estado";
import { exigirAdmin } from "@/lib/auth";
import {
  actualizarVehiculo,
  crearVehiculo,
  eliminarVehiculo as eliminarVehiculoDb,
} from "@/lib/data/vehiculos";
import type { DatosNuevoVehiculo } from "@/lib/data/vehiculos";
import { texto, textoOpcional } from "@/lib/formulario";

/** Lee un entero >= 0 opcional; devuelve undefined si está vacío o inválido. */
function enteroOpcional(formData: FormData, campo: string): number | undefined {
  const valor = texto(formData, campo);
  if (!valor) return undefined;
  const numero = Number(valor.replace(/\D/g, ""));
  return Number.isInteger(numero) && numero >= 0 ? numero : undefined;
}

/** Valida el nombre y arma los datos comunes del vehículo desde el form. */
function leerDatosVehiculo(
  formData: FormData,
): { error: string | null; datos?: DatosNuevoVehiculo } {
  const nombre = texto(formData, "nombre");
  if (!nombre) return { error: "El nombre del vehículo es obligatorio." };

  const fechaService = textoOpcional(formData, "fecha_ultimo_service");
  if (
    fechaService &&
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaService)
  ) {
    return { error: "La fecha del último service tiene un formato inválido." };
  }

  return {
    error: null,
    datos: {
      nombre,
      patente: textoOpcional(formData, "patente"),
      marca: textoOpcional(formData, "marca"),
      modelo: textoOpcional(formData, "modelo"),
      anio: enteroOpcional(formData, "anio"),
      kilometros: enteroOpcional(formData, "kilometros"),
      kmProximoService: enteroOpcional(formData, "km_proximo_service"),
      fechaUltimoService: fechaService,
      notas: textoOpcional(formData, "notas"),
    },
  };
}

// ----------------------------------------------------------------------------
// Alta de vehículo
// ----------------------------------------------------------------------------
export async function crearVehiculoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const { error, datos } = leerDatosVehiculo(formData);
  if (error || !datos) return { error };

  try {
    await crearVehiculo(datos);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[vehiculos] error al crear");
    return {
      error: "No se pudo guardar el vehículo. Revisá los datos e intentá de nuevo.",
    };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/");
  updateTag("vehiculos");
  redirect("/vehiculos");
}

// ----------------------------------------------------------------------------
// Modificación de vehículo
// ----------------------------------------------------------------------------
export async function actualizarVehiculoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Vehículo inválido." };
  }

  const { error, datos } = leerDatosVehiculo(formData);
  if (error || !datos) return { error };

  try {
    await actualizarVehiculo(id, datos);
  } catch (error) {
    console.error("[vehiculos] error al actualizar:", error);
    return {
      error: "No se pudo actualizar el vehículo. Intentá de nuevo.",
    };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/vehiculos/" + id);
  revalidatePath("/");
  updateTag("vehiculos");
  redirect("/vehiculos");
}

// ----------------------------------------------------------------------------
// Eliminación de vehículo
// ----------------------------------------------------------------------------
export async function eliminarVehiculoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Vehículo inválido." };
  }

  try {
    await eliminarVehiculoDb(id);
  } catch (error) {
    console.error("[vehiculos] error al eliminar:", error);
    return { error: "No se pudo eliminar el vehículo. Intentá de nuevo." };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/");
  updateTag("vehiculos");
  redirect("/vehiculos");
}