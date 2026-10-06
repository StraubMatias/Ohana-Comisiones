/**
 * Datos de demostración para capturas (SOLO SQLite local).
 *
 *   npm run db:seed-demo
 */
import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crearClienteLocal, exigirEntornoLocal } from "./_solo-db-local.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const HOY = new Date().toISOString().slice(0, 10);
const DOCS_USER = "capturas-docs";
const DOCS_PASS = "capturas-docs";

function hashear(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function migrarLocal() {
  const env = { ...process.env };
  delete env.TURSO_DATABASE_URLL;
  delete env.TURSO_AUTH_TOKENN;
  const resultado = spawnSync(
    "node",
    ["scripts/migrate.mjs"],
    { cwd: root, env, stdio: "inherit" },
  );
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}

async function count(db, tabla) {
  const r = await db.execute(`SELECT COUNT(*) AS n FROM ${tabla}`);
  return Number(r.rows[0].n);
}

async function main() {
  exigirEntornoLocal();
  migrarLocal();

  const db = crearClienteLocal();

  await db.execute({
    sql: `INSERT INTO usuarios (nombre, password_hash, rol)
          VALUES (?, ?, 'admin')
          ON CONFLICT(nombre) DO UPDATE SET password_hash = excluded.password_hash`,
    args: [DOCS_USER, hashear(DOCS_PASS)],
  });
  console.log(`Usuario local de capturas: ${DOCS_USER}`);

  if ((await count(db, "clientes")) >= 3) {
    console.log("Ya hay datos de demo en local.db; omitiendo tablas.");
    db.close();
    return;
  }

  console.log("Sembrando datos de demostración en local.db…");

  await db.execute({
    sql: `INSERT INTO clientes (nombre, cuit, direccion, localidad, telefono, email, es_cuenta_corriente, numero)
          VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`,
    args: [
      "Ferretería El Tornillo",
      "20-30111222-3",
      "Av. Mitre 450",
      "San Nicolás",
      "3364-112233",
      "ventas@eltornillo.com",
    ],
  });
  const cliente1 = Number(
    (await db.execute("SELECT last_insert_rowid() AS id")).rows[0].id,
  );
  await db.execute("UPDATE clientes SET numero = ? WHERE id = ?", [
    cliente1,
    cliente1,
  ]);

  await db.execute({
    sql: `INSERT INTO clientes (nombre, cuit, localidad, telefono, es_cuenta_corriente, numero)
          VALUES (?, ?, ?, ?, 1, NULL)`,
    args: ["Distribuidora Sur", "27-28444555-6", "Ramallo", "3407-998877"],
  });
  const cliente2 = Number(
    (await db.execute("SELECT last_insert_rowid() AS id")).rows[0].id,
  );
  await db.execute("UPDATE clientes SET numero = ? WHERE id = ?", [
    cliente2,
    cliente2,
  ]);

  await db.execute({
    sql: `INSERT INTO repartos (fecha, cliente_id, cobrado, forma_pago, chofer, vehiculo)
          VALUES (?, ?, 1, 'contado', ?, ?)`,
    args: [HOY, cliente1, "Expreso Norte", "Furgón Kangoo"],
  });
  const repartoCobrado = Number(
    (await db.execute("SELECT last_insert_rowid() AS id")).rows[0].id,
  );

  await db.execute({
    sql: `INSERT INTO repartos (fecha, cliente_id, cobrado, chofer, vehiculo)
          VALUES (?, ?, 0, ?, ?)`,
    args: [HOY, cliente2, "Expreso Norte", "Furgón Kangoo"],
  });
  const repartoPendiente = Number(
    (await db.execute("SELECT last_insert_rowid() AS id")).rows[0].id,
  );

  await db.execute({
    sql: `INSERT INTO reparto_items (reparto_id, descripcion, cantidad, precio_unitario_centavos)
          VALUES (?, ?, ?, ?)`,
    args: [repartoPendiente, "Caja herramientas 12 pzas", 2, 4500000],
  });

  await db.execute({
    sql: `INSERT INTO remitos (numero, reparto_id, fecha) VALUES (?, ?, ?)`,
    args: [1001, repartoCobrado, HOY],
  });
  const remitoId = Number(
    (await db.execute("SELECT last_insert_rowid() AS id")).rows[0].id,
  );
  await db.execute({
    sql: `INSERT INTO remito_items (remito_id, descripcion, cantidad, precio_unitario_centavos)
          VALUES (?, ?, ?, ?)`,
    args: [remitoId, "Tornillos autoroscantes x100", 5, 120000],
  });

  await db.execute({
    sql: `INSERT INTO remitos (numero, reparto_id, fecha) VALUES (?, NULL, ?)`,
    args: [1002, HOY],
  });

  await db.execute({
    sql: `INSERT INTO gastos (fecha, categoria, descripcion, proveedor, monto_centavos)
          VALUES (?, 'combustible', ?, ?, ?)`,
    args: [HOY, "Nafta súper", "YPF", 8500000],
  });
  await db.execute({
    sql: `INSERT INTO gastos (fecha, categoria, descripcion, monto_centavos)
          VALUES (?, 'otros', ?, ?)`,
    args: [HOY, "Peaje Ruta 9", 350000],
  });

  await db.execute({
    sql: `INSERT INTO vehiculos (nombre, patente, marca, modelo, anio, kilometros, km_proximo_service)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: ["Furgón Kangoo", "AB 123 CD", "Renault", "Kangoo", 2020, 84500, 95000],
  });

  console.log("Listo: clientes, repartos, remitos, gastos y vehículo de demo.");
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
