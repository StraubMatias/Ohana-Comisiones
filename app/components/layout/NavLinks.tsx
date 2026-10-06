"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  esRutaActiva,
  type NavItem,
} from "@/app/components/layout/nav-items";

export function NavLinks({ links }: { links: NavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const activo = esRutaActiva(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 font-medium transition-colors ${
              activo
                ? "bg-emerald-500 text-zinc-950"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}