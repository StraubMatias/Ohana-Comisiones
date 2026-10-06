import { describe, expect, it } from "vitest";
import { lineasDesdeFormData, texto, textoOpcional } from "@/lib/formulario";

describe("formulario", () => {
  it("lee texto y opcional", () => {
    const fd = new FormData();
    fd.set("a", "  hola ");
    fd.set("b", "");
    expect(texto(fd, "a")).toBe("hola");
    expect(textoOpcional(fd, "b")).toBeUndefined();
  });

  it("arma líneas válidas del formulario", () => {
    const fd = new FormData();
    fd.append("item_descripcion", "Tornillos");
    fd.append("item_cantidad", "2");
    fd.append("item_precio", "100,50");
    fd.append("item_descripcion", "");
    fd.append("item_cantidad", "1");

    const lineas = lineasDesdeFormData(fd, {
      descripcion: "item_descripcion",
      cantidad: "item_cantidad",
      precio: "item_precio",
    });
    expect(lineas).toHaveLength(1);
    expect(lineas[0].precioUnitarioCentavos).toBe(10050);
  });
});
