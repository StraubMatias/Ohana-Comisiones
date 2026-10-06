"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAction } from "@/app/actions/estado";
import { exigirAdmin } from "@/lib/auth";
import { obtenerClientePorNombre, obtenerOCrearClientePorNombre } from "@/lib/data/clientes";
import {
  actualizarFormaPagoReparto,
  asignarRemitosAReparto,
  crearReparto,
  eliminarReparto,
  obtenerPartesReparto,
} from "@/lib/data/repartos";
import { crearRemito, proximoNumeroRemito } from "@/lib/data/remitos";
import { FORMAS_PAGO } from "@/lib/types";
import type { FormaPago } from "@/lib/types";
import { puedeEjecutarAccionSensible } from "@/lib/seguridad";
import { lineasDesdeFormData, texto, textoOpcional } from "@/lib/formulario";

function esFormaPago(valor: string): valor is FormaPago {
  return (FORMAS_PAGO as readonly string[]).includes(valor);
}

function itemsDelFormulario(formData: FormData) {
  return lineasDesdeFormData(formData, {
    descripcion: "item_descripcion",
    cantidad: "item_cantidad",
    precio: "item_precio",
  });
}

function itemsRepartoDelFormulario(formData: FormData) {
  return lineasDesdeFormData(formData, {
    descripcion: "reparto_item_descripcion",
    cantidad: "reparto_item_cantidad",
    precio: "reparto_item_precio",
  });
}

// ----------------------------------------------------------------------------
// Alta de reparto
// ----------------------------------------------------------------------------
export async function crearRepartoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  const usuario = await exigirAdmin();

  // SEGURIDAD: rate limiting para crear repartos
  const puedeCrear = await puedeEjecutarAccionSensible("usuario", usuario.nombre);
  if (!puedeCrear) {
    return { 
      error: "Demasiadas solicitudes recientes. Esperá un momento e intentá de nuevo.",
    };
  }

  const fecha = texto(formData, "fecha");
  if (!fecha) {
    return { error: "La fecha del reparto es obligatoria." };
  }

  const nombreEnvia = texto(formData, "enviado_por");
  if (!nombreEnvia) {
    return { error: "Completá el Flete Origen (quién envía el reparto)." };
  }

  const llevaRemito = formData.get("lleva_remito") !== null;
  // Dejá la forma de pago vacía si el reparto todavía no se cobró: recién se
  // elige cuando efectivamente se cobra.
  const formaPagoValor = texto(formData, "forma_pago");
  const formaPago: FormaPago | null =
    formaPagoValor && esFormaPago(formaPagoValor) ? formaPagoValor : null;
  if (formaPagoValor && !esFormaPago(formaPagoValor)) {
    return { error: "Forma de pago inválida." };
  }

  // Si el reparto lleva remito, validamos los items antes de crear cualquier cosa.
  const itemsRemito = llevaRemito ? itemsDelFormulario(formData) : [];
  if (llevaRemito && itemsRemito.length === 0) {
    return {
      error:
        "Si el reparto lleva remito, cargá al menos una línea con descripción y cantidad mayor a 0.",
    };
  }

  try {
    // El Flete Origen se elige con el buscador de clientes (trae `cliente_id`)
    // o por nombre. Con forma de pago "Cuenta corriente" se elige CUÁL de las
    // dos puntas es el cliente que se registra (se crea si no está cargado):
    // el Flete Origen (quién envía) o el Flete Destino (quién recibe). En ese
    // caso el cliente de la base SIEMPRE queda vinculado al reparto. Con el
    // resto de las formas el reparto se guarda igual aunque el cliente no esté
    // en la lista (queda el nombre en el Flete Origen, sin crear nada).
    const clienteIdEnviado = Number(formData.get("cliente_id"));
    const idExplicito =
      Number.isInteger(clienteIdEnviado) && clienteIdEnviado > 0
        ? clienteIdEnviado
        : null;

    let clienteId = idExplicito;
    if (formaPago === "cuenta_corriente") {
      const lado = texto(formData, "cliente_cc_lado") || "origen";
      const nombreCliente =
        lado === "destino" ? texto(formData, "recibido_por") : nombreEnvia;
      if (!nombreCliente) {
        return {
          error:
            "Con «Cuenta corriente» el cliente es el Flete Origen o el Flete Destino: completá el nombre del lado elegido.",
        };
      }
      clienteId = await obtenerOCrearClientePorNombre(nombreCliente);
    } else if (clienteId == null) {
      clienteId = await obtenerClientePorNombre(nombreEnvia);
    }

    // El remito ya no se emite a nombre de un cliente: queda asociado al
    // reparto y el cliente sale del reparto. Por eso un reparto puede llevar
    // remito aunque el cliente (Envía) no esté en la lista, sin crear nada.
    const repartoId = await crearReparto({
      fecha,
      clienteId,
      enviadoPor: nombreEnvia,
      recibidoPor: textoOpcional(formData, "recibido_por"),
      observaciones: textoOpcional(formData, "observaciones"),
      llevaRemito,
      formaPago,
      // Mercadería directa: varias líneas (descripción, cantidad y valor).
      // Se guarda siempre en reparto_items, incluso si el reparto lleva remito.
      itemsMercaderia: itemsRepartoDelFormulario(formData),
    });

    // Si lleva remito, lo emitimos en el mismo alta y queda asociado al reparto
    // (el cliente se resuelve a través del reparto). El N° se puede escribir a
    // mano (`remito_numero`); si no se carga, sigue la correlativa automática.
    if (llevaRemito && repartoId) {
      const numeroManual = Number(texto(formData, "remito_numero"));
      const numero =
        Number.isInteger(numeroManual) && numeroManual > 0
          ? numeroManual
          : await proximoNumeroRemito();
      await crearRemito({
        numero,
        fecha,
        repartoId,
        observaciones: textoOpcional(formData, "remito_observaciones"),
        items: itemsRemito,
      });
    }

    // Remitos pendientes ya existentes seleccionados en el formulario.
    const remitosSeleccionados = formData
      .getAll("remito_id")
      .map((valor) => Number(valor))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (repartoId && remitosSeleccionados.length > 0) {
      await asignarRemitosAReparto(repartoId, remitosSeleccionados);
    }
  } catch {
    // No exponer detalles del error al usuario
    console.error("[repartos] error al crear");
    return { error: "No se pudo guardar el reparto. Intentá de nuevo." };
  }

  revalidatePath("/repartos");
  updateTag("repartos");
  updateTag("remitos");
  updateTag("clientes");
  redirect("/repartos");
}

// ----------------------------------------------------------------------------
// Forma de pago (desplegable inline en el listado)
// ----------------------------------------------------------------------------
export async function actualizarFormaPagoRepartoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const id = Number(formData.get("id"));
  const formaPagoValor = texto(formData, "forma_pago");

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Reparto inválido." };
  }
  if (formaPagoValor && !esFormaPago(formaPagoValor)) {
    return { error: "Forma de pago inválida." };
  }

  try {
    // La opción vacía ("Por cobrar") vuelve a dejar el reparto sin cobrar.
    const formaPago: FormaPago | null =
      formaPagoValor && esFormaPago(formaPagoValor) ? formaPagoValor : null;

    // Al cobrar en cuenta corriente, el reparto queda vinculado a un cliente
    // registrado. Si viene `cliente_cc_lado` (elegido en el desplegable inline)
    // se registra/reutiliza el cliente de ESE lado —el Flete Origen (quién
    // envía) o el Flete Destino (quién recibe)—, creándolo con ese nombre si
    // todavía no está cargado. Sin lado explícito se conserva el cliente ya
    // vinculado y, si no lo hay, se registra el del Flete Origen; a falta de
    // él, el del Flete Destino.
    if (formaPago === "cuenta_corriente") {
      const reparto = await obtenerPartesReparto(id);
      if (!reparto) {
        return { error: "Reparto inválido." };
      }

      const lado = texto(formData, "cliente_cc_lado");
      let clienteId = reparto.clienteId;

      if (lado === "origen" || lado === "destino") {
        const nombre =
          lado === "origen" ? reparto.enviadoPor : reparto.recibidoPor;
        if (!nombre) {
          return {
            error: `El reparto no tiene ${
              lado === "origen" ? "Flete Origen" : "Flete Destino"
            } para registrar en cuenta corriente.`,
          };
        }
        clienteId = await obtenerOCrearClientePorNombre(nombre);
      } else if (clienteId == null) {
        const nombre = reparto.enviadoPor ?? reparto.recibidoPor;
        if (!nombre) {
          return {
            error:
              "El reparto no tiene un Flete Origen ni un Flete Destino para registrar en cuenta corriente.",
          };
        }
        clienteId = await obtenerOCrearClientePorNombre(nombre);
      }

      if (clienteId == null) {
        return {
          error:
            "No se pudo determinar el cliente en cuenta corriente de este reparto.",
        };
      }
      await actualizarFormaPagoReparto(id, formaPago, clienteId);
    } else {
      await actualizarFormaPagoReparto(id, formaPago);
    }
  } catch {
    // No exponer detalles del error al usuario
    console.error("[repartos] error al actualizar forma de pago");
    return { error: "No se pudo actualizar la forma de pago." };
  }

  revalidatePath(`/repartos/${id}`);
  revalidatePath("/repartos");
  updateTag("repartos");
  updateTag("remitos");
  updateTag("clientes");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Asignación de remitos a un reparto
// ----------------------------------------------------------------------------
export async function asignarRemitosAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const repartoId = Number(formData.get("reparto_id"));
  if (!Number.isInteger(repartoId) || repartoId <= 0) {
    return { error: "Reparto inválido." };
  }

  const remitosSeleccionados = formData
    .getAll("remito_id")
    .map((valor) => Number(valor))
    .filter((id) => Number.isInteger(id) && id > 0);

  try {
    await asignarRemitosAReparto(repartoId, remitosSeleccionados);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[repartos] error al asignar remitos");
    return { error: "No se pudieron asignar los remitos." };
  }

  revalidatePath(`/repartos/${repartoId}`);
  revalidatePath("/repartos");
  updateTag("repartos");
  updateTag("remitos");
  updateTag("clientes");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Eliminación de reparto
// ----------------------------------------------------------------------------
export async function eliminarRepartoAction(
  _estado: EstadoAction,
  formData: FormData,
): Promise<EstadoAction> {
  await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Reparto inválido." };
  }

  try {
    await eliminarReparto(id);
  } catch {
    // No exponer detalles del error al usuario
    console.error("[repartos] error al eliminar");
    return { error: "No se pudo eliminar el reparto." };
  }

  revalidatePath("/repartos");
  updateTag("repartos");
  updateTag("remitos");
  updateTag("clientes");
  redirect("/repartos");
}