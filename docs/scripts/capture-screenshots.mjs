/**
 * Captura pantallas para docs/DOCUMENTACION.md
 * Requiere: `npm run dev` en otra terminal y Chromium (Playwright lo descarga).
 *
 * Uso:
 *   npm install -D playwright-core
 *   npm run dev
 *   node --env-file-if-exists=.env.local docs/scripts/seed-demo-docs.mjs
 *   node docs/scripts/capture-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(BASE)) {
  console.error("Las capturas solo pueden apuntar a localhost.");
  process.exit(1);
}
const OUT = join(process.cwd(), "docs", "screenshots");
const USER = process.env.SCREENSHOT_USER ?? "capturas-docs";
const PASS = process.env.SCREENSHOT_PASS ?? "capturas-docs";

const ROUTES = [
  { path: "/login", file: "01-login.png", public: true },
  { path: "/", file: "02-dashboard.png" },
  { path: "/clientes", file: "03-clientes.png" },
  { path: "/repartos", file: "04-hoja-de-ruta.png" },
  { path: "/remitos", file: "05-remitos.png" },
  { path: "/gastos", file: "06-gastos.png" },
  { path: "/vehiculos", file: "07-vehiculos.png" },
  { path: "/facturacion", file: "08-facturacion.png" },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#nombre").fill(USER);
  await page.locator("#password").fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15000,
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ??
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      "/usr/bin/chromium",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const loginRoute = ROUTES.find((r) => r.public);
  if (loginRoute) {
    await page.goto(`${BASE}${loginRoute.path}`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(OUT, loginRoute.file),
      fullPage: true,
    });
    console.log("✓", loginRoute.file);
  }

  await login(page);
  for (const route of ROUTES.filter((r) => !r.public)) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: join(OUT, route.file),
      fullPage: true,
    });
    console.log("✓", route.file);
  }

  await browser.close();
  console.log(`\nCapturas guardadas en ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
