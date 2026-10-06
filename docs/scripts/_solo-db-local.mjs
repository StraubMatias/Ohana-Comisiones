/**
 * Utilidad compartida: scripts de documentación SOLO contra SQLite local.
 * Nunca debe ejecutarse contra Turso/producción.
 */
import { createClient } from "@libsql/client";

const LOCAL_URL = process.env.LOCAL_DB_FILE?.trim() || "file:local.db";

export function exigirEntornoLocal() {
  const turso = process.env.TURSO_DATABASE_URLL?.trim();
  if (turso) {
    console.error(
      "Abortado: TURSO_DATABASE_URLL está definida. Estos scripts solo usan SQLite local.",
    );
    console.error(
      "Ejemplo: env -u TURSO_DATABASE_URLL -u TURSO_AUTH_TOKENN npm run db:seed-demo",
    );
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    console.error("Abortado: no ejecutar scripts de demo en NODE_ENV=production.");
    process.exit(1);
  }
}

export function crearClienteLocal() {
  exigirEntornoLocal();
  return createClient({ url: LOCAL_URL });
}
