# Ohana Comisiones — Documentación del sistema

**Versión del documento:** 1.0  
**Producto:** Plataforma web de gestión operativa  
**Repositorio:** [sistema-repartos-facturacion](https://github.com/Matute2004/sistema-repartos-facturacion)

---

## 1. Resumen ejecutivo

**Ohana Comisiones** es un sistema web privado que centraliza la operación de un negocio de distribución y comisiones: quién es cada cliente, qué se reparte cada día, cuánto corresponde cobrar, qué remitos se emitieron, cuánto se gastó en la calle y cómo está la flota de vehículos.

Antes, esta información suele repartirse entre cuadernos, planillas de Excel, mensajes y memoria. El sistema unifica esos procesos en un solo lugar, accesible desde navegador (escritorio o celular), con usuarios identificados y datos persistentes en base remota.

No reemplaza al contador ni emite facturas electrónicas por sí solo: **integra la operación del día a día** y ofrece enlaces rápidos a los servicios de AFIP cuando hay que facturar afuera del sistema.

---

## 2. Problema de negocio

### Situación típica sin sistema

| Dolor | Consecuencia |
|-------|----------------|
| Deuda dispersa | No se sabe con claridad cuánto debe cada cliente fijo. |
| Hoja de ruta en papel o Excel | Difícil ver el día completo: repartos, cobros y gastos juntos. |
| Remitos desordenados | Numeración manual, riesgo de duplicados o pérdida de trazabilidad con el reparto. |
| Gastos “en la cabeza” | No se contrasta fácilmente cuánto se cobró vs. cuánto se gastó en el día. |
| Datos de clientes repetidos | Carga manual lenta al arrancar o al migrar desde planillas. |
| Sin acceso controlado | Cualquiera con un archivo compartido ve o modifica todo. |

### Objetivo del proyecto

Ofrecer una **única fuente de verdad operativa**: registrar, consultar y actuar sobre clientes, entregas, cobranza, comprobantes y gastos, con reglas de negocio coherentes (por ejemplo, deuda por repartos no cobrados) y sin depender de una sola computadora.

---

## 3. Solución implementada

### Qué es

- Aplicación **web responsive** con login.
- Base de datos **en la nube** (Turso / libSQL), sincronizada para todos los dispositivos que usen el sistema.
- Módulos integrados: un reparto afecta cobranza, remitos y, indirectamente, la deuda del cliente.
- **Importación masiva** de clientes desde archivos Excel o CSV.
- **Impresión de remitos** desde el navegador (guardar como PDF).
- **Dashboard** con indicadores del día y del mes.

### Qué no es (límites explícitos)

| Expectativa | Realidad en el sistema |
|-------------|-------------------------|
| “Facturación electrónica integrada” | Módulo **Facturación** = atajos al portal AFIP, Monotributo y comprobantes en línea. La emisión fiscal se hace en AFIP. |
| App móvil nativa | Sitio web optimizado para móvil; no hay app en stores. |
| Multi-sucursal / multi-empresa | Diseño para **un negocio**, un esquema de datos. |
| Roles operador vs. administrador en uso diario | Modelo simplificado: acceso **administrador** para operar el sistema. |

---

## 4. Usuarios y acceso

- **Usuario administrador:** acceso completo a todos los módulos.
- **Login:** nombre de usuario y contraseña; sesión persistente (cookie firmada, duración prolongada).
- **Seguridad:**
  - Bloqueo temporal tras intentos fallidos de login (por usuario e IP).
  - Límite de frecuencia en acciones sensibles (alta masiva de clientes, importaciones).
  - Rutas internas y APIs protegidas; sin sesión válida se redirige al login.
  - Cambio de contraseña desde **Cuenta**.

- **Puesta en marcha:** la primera ejecución de migraciones puede crear usuarios administradores por defecto si la base está vacía. Se recomienda **cambiar las contraseñas** en el primer uso (instrucciones técnicas en el README del repositorio).

---

## 5. Módulos y funcionalidades

### 5.1 Dashboard

**Problema que resuelve:** “¿Cómo está el negocio hoy sin entrar a cada pantalla?”

**Qué muestra:**

- Cantidad de clientes y vehículos registrados.
- Gastos acumulados del **mes en curso**.
- Repartos del **día actual** y cuántos faltan cobrar (hoy y en total).
- Remitos emitidos hoy y remitos **sin reparto asignado**.

Cada tarjeta enlaza al módulo correspondiente. Las fechas respetan la zona horaria de **Argentina (Buenos Aires)**.

---

### 5.2 Clientes

**Problema que resuelve:** base ordenada de clientes fijos, con deuda visible y carga inicial rápida.

**Funcionalidades:**

| Función | Detalle |
|---------|---------|
| Listado | Búsqueda en tiempo real por número, nombre, CUIT, dirección, localidad, teléfono, email. |
| Deuda | Columna **Debe**: suma de repartos **no cobrados** (ítems de remitos asignados + mercadería directa del reparto). Orden opcional por deuda. |
| Alta / edición | Datos de contacto, CUIT, notas. El **número de cliente** se asigna automáticamente (coincide con el identificador interno). |
| Cuenta corriente | Todos los clientes registrados operan como **clientes fijos en cuenta corriente**. |
| Ficha | Detalle del cliente, repartos vinculados, forma de pago, acceso a remitos asociados. |
| Importación | Archivo `.xlsx`, `.xls` o `.csv`: detección de columnas (nombre, CUIT, dirección, etc.), vista previa y carga en lote con resumen (importados, filas sin nombre, errores). |
| Baja | Eliminación con confirmación; repartos quedan desvinculados sin bloquear por remitos antiguos (modelo actual: el cliente se asocia vía reparto, no en el remito). |

---

### 5.3 Hoja de ruta (Repartos)

**Problema que resuelve:** operar **un día de trabajo** — qué salió, qué se cobró, qué gastó la ruta y si “rinde”.

**Funcionalidades:**

| Función | Detalle |
|---------|---------|
| Calendario | Navegación por fecha; días con repartos marcados. |
| Repartos del día | Listado con búsqueda, valor del reparto, remitos asociados, estado de cobro. |
| Alta de reparto | Cliente, envía/recibe (texto operativo), ítems de mercadería, opción de remito, forma de pago al cobrar. |
| Cobranza | Marcar reparto como cobrado y registrar forma de pago (contado, cuenta corriente, transferencia, cheque). |
| Gastos del día | Gastos registrados en la **misma fecha** visibles en la hoja. |
| Resumen financiero del día | Total de la hoja, monto cobrado, gastos del día e indicador **Rinde** (cobrado − gastos). |
| Detalle | Asignar remitos existentes al reparto, ver ítems, eliminar reparto (los remitos quedan sin reparto). |

**Regla de negocio clave:** no existe un “estado entregado” separado; lo relevante es si el reparto **ya se cobró** (`cobrado` + forma de pago) o sigue pendiente.

---

### 5.4 Remitos

**Problema que resuelve:** comprobante numerado de lo entregado, alineado al reparto.

**Funcionalidades:**

- Numeración **correlativa** automática.
- Líneas de detalle (descripción, cantidad, precio).
- Vínculo al **reparto** (el cliente se deduce del reparto o del texto operativo).
- Listado general y detalle con datos para imprimir.
- **Imprimir / guardar PDF** desde el navegador.
- Alta desde flujo de reparto o módulo dedicado; eliminación con confirmación.

---

### 5.5 Gastos

**Problema que resuelve:** control de costos operativos (combustible, taller, insumos).

**Funcionalidades:**

- Registro por fecha, categoría, descripción, proveedor opcional y monto.
- Vista por **mes** con total del período y navegación entre meses.
- Eliminación desde el listado.
- Los gastos del **día** aparecen integrados en la hoja de ruta de esa fecha.

**Categorías:** combustible, mecánico, insumos, otros.

---

### 5.6 Vehículos

**Problema que resuelve:** registro de la flota y datos de mantenimiento.

**Funcionalidades:**

- Nombre/alias, patente, marca, modelo, año.
- Kilometraje actual, km del próximo service, fecha del último service.
- Notas libres.
- Alta, edición, ficha y baja.

---

### 5.7 Facturación (enlaces AFIP)

**Problema que resuelve:** acceso rápido a facturar sin buscar URLs.

**Contenido:** tarjetas con enlaces externos a Portal AFIP, Monotributo y comprobantes en línea.  
**No incluye:** generación de CAE, integración con webservices AFIP ni archivo de comprobantes dentro del sistema.

---

## 6. Reglas de negocio importantes

### Dinero

- Todos los importes se almacenan en **centavos** (enteros) para evitar errores de redondeo.

### Deuda del cliente

- Se calcula a partir de **repartos no cobrados** del cliente:
  - Suma de ítems de remitos asignados a esos repartos.
  - Más ítems de mercadería cargados directamente en el reparto.

### Remitos y clientes

- El remito **no guarda un cliente propio**: depende del reparto. Así, al eliminar o desvincular un cliente no quedan remitos “colgados” por una clave foránea al cliente.

### Migraciones de datos

- El sistema incluye **migraciones idempotentes** para bases creadas en versiones anteriores del esquema (por ejemplo, cuando los remitos tenían `cliente_id` obligatorio). Esto protege datos históricos al evolucionar el producto.

---

## 7. Fundamentos técnicos (visión no especializada)

| Capa | Rol |
|------|-----|
| **Interfaz web** | Pantallas claras, tablas con búsqueda, formularios con validación y mensajes de error en español. |
| **Servidor de aplicación** | Lógica y permisos en el servidor; el navegador no accede directo a la base. |
| **Base de datos** | Turso (SQLite distribuido): respaldo en la nube, adecuado para despliegue serverless. |
| **Hosting** | Orientado a Vercel (build automático desde GitHub). |
| **Calidad** | Más de **100 pruebas automáticas** y pipeline de integración continua en GitHub. |

### Optimizaciones relevantes para el uso real

- Consultas agrupadas en **una sola comunicación** con la base en la hoja de ruta y el dashboard (menos espera con internet móvil).
- Caché breve en listados frecuentes, invalidada al crear o modificar datos.
- Cabeceras de seguridad HTTP en producción.

---

## 8. Flujo operativo sugerido (día tipo)

1. **Mañana:** entrar al **Dashboard** y abrir **Hoja de ruta** (fecha de hoy).
2. Cargar **repartos** del día (o revisar los ya cargados) y asociar **remitos** si corresponde.
3. En la calle: marcar **cobranza** y forma de pago al confirmar cada cobro.
4. Registrar **gastos** del día (combustible, peajes, etc.).
5. Revisar **Rinde** en la hoja de ruta (cobrado vs. gastos).
6. **Clientes:** consultar **Debe** para seguimiento de cuenta corriente.
7. Si hace falta facturar en AFIP, usar **Facturación** como punto de entrada.

---

## 9. Entregables del proyecto de software

| Entregable | Descripción |
|------------|-------------|
| Código fuente | Repositorio Git con historial de desarrollo. |
| Aplicación desplegable | Build de Next.js listo para Vercel + Turso. |
| Esquema y migraciones | `lib/schema.sql`, `scripts/migrate.mjs`, `lib/migrate.ts`. |
| Documentación | Este documento y README técnico en la raíz del repositorio. |
| Pruebas | Suite Vitest (dominio, seguridad, integración de datos). |
| CI | Workflow de GitHub Actions (lint, test, build). |

---

## 10. Mantenimiento y evolución

**Tareas habituales del operador / dueño:**

- Usar el sistema en el día a día; no requiere comandos técnicos.
- Cambiar contraseña desde **Cuenta** cuando corresponda.

**Tareas del responsable técnico:**

- Variables de entorno en el hosting (`TURSO_*`, `SESSION_SECRET`).
- Ejecutar `npm run db:migrate` tras actualizaciones que cambien el esquema.
- Monitorear despliegues y el workflow de CI en GitHub.
- Opcional: `npm run clean` en desarrollo si la carpeta `.next` crece mucho (caché local de Next.js).

**Posibles líneas de evolución** (no incluidas en el alcance actual):

- Integración real con facturación electrónica AFIP.
- Roles diferenciados (solo lectura, repartidor, etc.).
- Exportación de reportes (PDF/Excel) desde el sistema.
- Notificaciones (email/WhatsApp) de deuda o recordatorios.

---

## 11. Glosario

| Término | Significado en Ohana Comisiones |
|---------|----------------------------------|
| **Reparto** | Una operación de entrega/comisión en una fecha, con valor y estado de cobro. |
| **Hoja de ruta** | Conjunto de repartos y gastos de **un día**. |
| **Remito** | Comprobante numerado de mercadería, ligado a un reparto. |
| **Cobrado** | El reparto ya tiene forma de pago registrada. |
| **Debe** | Deuda del cliente por repartos aún no cobrados. |
| **Rinde** | En la hoja del día: dinero cobrado menos gastos del mismo día. |

---

## 12. Contacto y soporte

Para incidencias de **uso del negocio** (cómo cargar un reparto, interpretar la deuda, etc.), contactar al administrador del sistema.

Para **incidencias técnicas** (acceso, despliegue, migraciones), contactar al desarrollador responsable del repositorio.

---

*Documento generado para describir el estado funcional y técnico del sistema Ohana Comisiones según el código en el repositorio `sistema-repartos-facturacion`.*
