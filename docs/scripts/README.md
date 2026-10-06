# Scripts de documentación (solo desarrollo local)

Estos scripts **no se usan en producción**. Solo operan sobre `file:local.db` y abortan si `TURSO_DATABASE_URLL` está definida.

## Regenerar capturas

```bash
npm run db:seed-demo          # datos + usuario capturas-docs en local.db
npm run dev:local             # app apuntando a SQLite (otra terminal)
npm install -D playwright-core
node docs/scripts/capture-screenshots.mjs
```

Credenciales locales de capturas: usuario `capturas-docs`, contraseña `capturas-docs` (solo en `local.db`).

## Limpiar usuario de demo en Turso (si se creó por error)

En el panel de Turso o con un cliente SQL:

```sql
DELETE FROM usuarios WHERE nombre = 'capturas-docs';
```
