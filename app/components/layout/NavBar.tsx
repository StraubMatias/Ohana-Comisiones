import Link from "next/link";
import Image from "next/image";
import { NavLinks } from "@/app/components/layout/NavLinks";
import { NAV_ITEMS } from "@/app/components/layout/nav-items";
import { cerrarSesionAction } from "@/app/actions/auth";
import type { UsuarioSesion } from "@/lib/types";

/**
 * Navegación principal. Sidebar fija en desktop, barra horizontal en mobile.
 * Recibe el usuario autenticado para mostrar quién está logueado.
 */
export function NavBar({ usuario }: { usuario: UsuarioSesion }) {
  return (
    <aside className="bg-zinc-900 text-zinc-100 lg:min-h-screen lg:sticky lg:top-0 lg:self-start">
      <div className="flex items-center gap-2 px-4 py-4 lg:px-5 lg:py-6">
        <Image
          src="/ohana.jpeg"
          alt="Logo Ohana Comisiones"
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-zinc-800"
        />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Ohana Comisiones</p>
          <p className="text-[11px] text-zinc-400">Gestión del negocio</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6">
        <NavLinks links={NAV_ITEMS} />

        <div className="mt-4 border-t border-zinc-800 pt-4 lg:mt-6">
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sesión
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="truncate text-sm font-medium text-zinc-200">
                {usuario.nombre}
              </span>
            </div>
            <Link
              href="/cuenta"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Cambiar contraseña
            </Link>
            <form action={cerrarSesionAction}>
              <button
                type="submit"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-red-950 hover:text-red-200"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </nav>
    </aside>
  );
}