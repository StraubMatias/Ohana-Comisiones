import { pesosACentavos } from "@/lib/types";

/** Valor de texto trimmeado de un campo del formulario. */
export function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

/** Igual que `texto`, pero `undefined` si quedó vacío. */
export function textoOpcional(
  formData: FormData,
  campo: string,
): string | undefined {
  const valor = texto(formData, campo);
  return valor.length > 0 ? valor : undefined;
}

export interface LineaItemFormulario {
  descripcion: string;
  cantidad: number;
  precioUnitarioCentavos: number;
}

/** Arma líneas de ítems descartando filas sin descripción o cantidad inválida. */
export function lineasDesdeCampos(
  descripciones: string[],
  cantidades: number[],
  preciosCentavos: number[],
): LineaItemFormulario[] {
  const items: LineaItemFormulario[] = [];
  for (let i = 0; i < descripciones.length; i += 1) {
    const descripcion = descripciones[i];
    const cantidad = cantidades[i] ?? 0;
    if (!descripcion || !Number.isFinite(cantidad) || cantidad <= 0) continue;
    items.push({
      descripcion,
      cantidad,
      precioUnitarioCentavos: Math.max(0, preciosCentavos[i] ?? 0),
    });
  }
  return items;
}

/** Lee líneas repetidas del formulario (remitos, mercadería de reparto, etc.). */
export function lineasDesdeFormData(
  formData: FormData,
  nombres: { descripcion: string; cantidad: string; precio: string },
): LineaItemFormulario[] {
  const descripciones = formData
    .getAll(nombres.descripcion)
    .map((valor) => String(valor).trim());
  const cantidades = formData
    .getAll(nombres.cantidad)
    .map((valor) => Number(String(valor).replace(",", ".")));
  const precios = formData
    .getAll(nombres.precio)
    .map((valor) => pesosACentavos(String(valor)));

  return lineasDesdeCampos(descripciones, cantidades, precios);
}
