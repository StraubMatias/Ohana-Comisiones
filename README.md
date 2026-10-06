# Ohana Comisiones

Sistema web de gestión operativa para comercios de distribución y comisiones: clientes en cuenta corriente, hoja de ruta diaria, remitos, gastos y flota. Desarrollado como aplicación privada con acceso autenticado, base de datos en la nube y despliegue serverless.

**Repositorio:** [github.com/Matute2004/sistema-repartos-facturacion](https://github.com/Matute2004/sistema-repartos-facturacion)

**Documentación de negocio y alcance del proyecto:** [docs/DOCUMENTACION.md](./docs/DOCUMENTACION.md)

---

## Resumen

| Aspecto | Detalle |
|--------|---------|
| **Stack** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Base de datos** | Turso (libSQL) en producción; SQLite local en desarrollo |
| **Autenticación** | Sesión firmada (HMAC), contraseñas con scrypt |
| **Pruebas** | Vitest — 101 tests (unitarios + integración de datos) |
| **CI** | GitHub Actions: lint, test y build en cada push/PR a `main` |

---

## Módulos funcionales

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Métricas del día y del mes (clientes, vehículos, gastos, repartos sin cobrar, remitos). |
| **Clientes** | Alta, edición, ficha con historial de repartos, deuda calculada, importación masiva desde Excel/CSV. |
| **Hoja de ruta** | Vista por fecha con calendario, repartos del día, cobranza, gastos del día y “rinde” (cobrado − gastos). |
| **Remitos** | Numeración correlativa, ítems, impresión/PDF desde el navegador, asignación a repartos. |
| **Gastos** | Registro por categoría y mes (combustible, mecánico, insumos, otros). |
| **Vehículos** | Flota con patente, kilometraje y datos de service. |
| **Facturación** | Atajos al portal AFIP (no integración de factura electrónica dentro del sistema). |
| **Cuenta** | Cambio de contraseña del usuario autenticado. |

---

## Requisitos

- **Node.js** 20 LTS (recomendado; CI usa 20)
- Cuenta en [Turso](https://turso.tech) para producción (opcional en local)
- `openssl` o similar para generar `SESSION_SECRET`

---

## Desarrollo local

```bash
git clone https://github.com/Matute2004/sistema-repartos-facturacion.git
cd sistema-repartos-facturacion
npm ci
cp .env.example .env.local
# Completar variables (ver abajo). Sin Turso, se usa file:local.db
npm run db:migrate
npm run dev
```

La aplicación queda en `http://localhost:3000`.

### Primer acceso

Tras `npm run db:migrate`, si la tabla `usuarios` está vacía, el script crea cuentas **administradoras** iniciales (semilla en `scripts/migrate.mjs`). En el **primer ingreso**, cambiá las contraseñas desde **Cuenta**.

### Variables de entorno

Copiá `.env.example` a `.env.local`. Los nombres son los usados en Vercel:

| Variable | Uso |
|----------|-----|
| `TURSO_DATABASE_URLL` | URL libSQL remota (`libsql://…`) |
| `TURSO_AUTH_TOKENN` | Token de la base Turso |
| `SESSION_SECRET` | Secreto para firmar cookies de sesión (`openssl rand -hex 32`) |

Sin `TURSO_*` en desarrollo, `getDb()` usa `file:local.db` (ignorado por git).

### Base de datos

```bash
npm run db:migrate
```

Ejecuta `scripts/migrate.mjs`, que aplica `lib/schema.sql` y migraciones idempotentes (columnas y reconstrucciones de tablas legacy). La misma lógica existe en `lib/migrate.ts` para uso desde el servidor (por ejemplo, al eliminar clientes en bases antiguas).

---

## Scripts

| Comando | Acción |
|---------|--------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor tras `build` |
| `npm run clean` | Elimina `.next` (libera ~1 GB de caché de dev) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (una pasada) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run db:migrate` | Migraciones contra Turso o SQLite local |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador  →  proxy.ts (cookie HMAC)  →  App Router         │
│                    │                                         │
│                    ▼                                         │
│  Server Components + Server Actions (app/actions/*)          │
│                    │                                         │
│                    ▼                                         │
│  Capa de datos (lib/data/*)  →  getDb()  →  Turso / SQLite   │
└─────────────────────────────────────────────────────────────┘
```

- **`app/(app)/`**: rutas protegidas (layout exige admin vía `exigirAdmin`).
- **`app/actions/`**: mutaciones (crear/editar/eliminar, login, importación).
- **`lib/data/`**: consultas SQL y reglas de dominio (deuda, hoja de ruta en batch, etc.).
- **`lib/`**: auth, sesión, tipos, importación, seguridad (rate limit login y acciones sensibles).
- **`proxy.ts`**: gate de autenticación global (Next.js 16; equivalente a middleware).

### Rendimiento y caché

- Consultas consolidadas en **batch** hacia Turso (dashboard, hoja de ruta del día) para reducir latencia.
- **Cache Components** (`"use cache"`, `cacheTag`, `revalidateTag`) en listados de clientes, gastos, remitos y métricas.
- Zona horaria de negocio: **America/Argentina/Buenos_Aires** (`ZONA_HORARIA` en `lib/types.ts`).

### Seguridad

- Contraseñas: **scrypt** (`lib/passwords.ts`).
- Cookies de sesión: **HMAC-SHA256**, 30 días (`lib/sesion.ts`).
- Anti fuerza bruta en login y límite de acciones sensibles (crear/importar) (`lib/seguridad.ts`).
- Cabeceras CSP, HSTS (prod), `X-Frame-Options`, etc. (`next.config.ts`).
- `GET /api/health`: solo con cookie de sesión válida.

---

## Estructura del proyecto

```
app/
  (app)/          # Páginas autenticadas (dashboard, clientes, repartos, …)
  actions/        # Server Actions
  api/            # Route handlers (health, remito JSON)
  components/     # UI por dominio + ui/ compartido
  login/          # Login público
lib/
  data/           # Acceso a datos por entidad
  schema.sql      # Esquema canónico
  migrate.ts      # Migraciones programáticas
scripts/
  migrate.mjs     # CLI de migración
  reset_clientes.mjs  # Utilidad operativa (opcional)
```

---

## Pruebas y calidad

```bash
npm test
```

Incluye tests de sesión, contraseñas, importación, tipos, acciones de repartos/remitos y **`lib/data/integration.test.ts`** (flujos sobre SQLite temporal).

El workflow [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) requiere secrets de Turso y `SESSION_SECRET` para el paso de build.

---

## Despliegue

Pensado para **Vercel** + **Turso**:

1. Configurar `TURSO_DATABASE_URLL`, `TURSO_AUTH_TOKENN` y `SESSION_SECRET` en el proyecto Vercel.
2. Ejecutar `npm run db:migrate` contra la base remota (local o CI).
3. Conectar el repositorio y desplegar `main`.

El cliente HTTP de Turso (`@libsql/client/http`) evita dependencias nativas en serverless.

---

## Licencia y uso

Proyecto **privado** (`"private": true` en `package.json`). Uso restringido al titular del negocio y desarrolladores autorizados.

---

## Créditos

**Ohana Comisiones** — sistema a medida para la operación diaria de distribución y cobranza.
