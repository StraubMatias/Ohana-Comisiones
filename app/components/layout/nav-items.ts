export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/repartos", label: "Hoja de Ruta" },
  { href: "/remitos", label: "Remitos" },
  { href: "/vehiculos", label: "Vehículos" },
  { href: "/facturacion", label: "Facturación" },
  { href: "/gastos", label: "Gastos" },
];

export function esRutaActiva(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
