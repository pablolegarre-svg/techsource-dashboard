# TechSource Solutions — Documento Técnico y de Producto

> **Audiencia:** Product Owner, equipo de desarrollo, stakeholders técnicos  
> **Fecha:** Abril 2026  
> **Estado:** Producción

---

## 1. Descripción del sistema

**TechSource Solutions** es una plataforma web de **Supplier Sync & Smart Pricing**. Permite sincronizar precios de proveedores externos, generar cotizaciones para clientes y gestionar todo el ciclo de vida de una solicitud de compra.

**URL de producción:** Desplegado en Vercel + Supabase (PostgreSQL)

---

## 2. Stack tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend | Vite + React 18 | SPA, sin SSR |
| Routing | react-router-dom v6 | Client-side routing |
| Base de datos | Supabase (PostgreSQL) | Auth + datos |
| Automatización | N8N (self-hosted) | Webhooks y flujos de email |
| PDF | jsPDF + jspdf-autotable | Generación en el cliente |
| Estilos | CSS plano con variables | Sin Tailwind ni CSS Modules |
| Deploy | Vercel (frontend) | CI/CD automático desde Git |

---

## 3. Roles y accesos

### 3.1 Cliente (público)

- Accede por `/login` — solo requiere **email** (sin contraseña)
- El sistema busca el email en la tabla `clientes`
- Si no existe → pantalla "Sin registros, solicitá una cotización"
- Si `activo = false` → pantalla "Usuario inactivo, contactá al administrador"
- Si existe y está activo → ingresa sin contraseña
- La sesión se guarda en `sessionStorage` (clave `ts_cliente`), no en Supabase Auth

#### Páginas del cliente

| Ruta | Página | Auth requerida |
|------|--------|----------------|
| `/catalogo` | Catálogo público | No |
| `/cotizar` | Solicitar cotización | No (mejor con sesión) |
| `/mis-cotizaciones` | Historial propio | Sí (clienteSession) |

---

### 3.2 Administrador

- Accede por `/ts-panel/auth` — **enlace oculto** en el footer (clic en el copyright)
- Requiere usuario en Supabase Auth + registro en tabla `user_roles` con `role = 'admin'`
- La verificación de rol se hace contra la tabla `user_roles`, NO contra `user_metadata`

#### Páginas del admin

| Ruta | Página | Función principal |
|------|--------|-------------------|
| `/dashboard` | Dashboard | KPIs, últimos cambios de precio, estado de cotizaciones |
| `/admin/catalogo` | Catálogo admin | Ver todos los productos (vigentes e inactivos), activar/desactivar |
| `/proveedores` | Proveedores | Lista de proveedores con cantidad de productos por estado |
| `/historial` | Historial de precios | Registro de cambios detectados, gráfico de evolución |
| `/cotizaciones` | Cotizaciones | Todas las cotizaciones, cambio de estado, búsqueda por email/nombre/ID |
| `/clientes` | Clientes | Lista de clientes, activar/desactivar acceso |

---

## 4. Base de datos — Tablas

### `catalogo_proveedores`
Catálogo principal de productos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `sku` | text | Código único del producto |
| `nombre` | text | Nombre del producto |
| `descripcion` | text | Descripción larga |
| `categoria` | text | Categoría (Laptops, Almacenamiento, etc.) |
| `precio` | numeric | Precio costo |
| `precio_venta` | numeric | Precio de venta al cliente |
| `moneda` | text | USD por defecto |
| `proveedor` | text | Nombre del proveedor |
| `idproveedor` | uuid/int | FK a tabla `proveedores` |
| `stock` | int | Unidades disponibles |
| `vigente` | boolean | Si está activo para la venta |
| `fecha_sync` | timestamp | Última sincronización de precio |
| `imagen_url` | text | URL de imagen del producto |

---

### `proveedores`
Datos de los proveedores.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idproveedor` | uuid/int | PK |
| `nombre` | text | Nombre del proveedor |
| `email` | text | Email de contacto |
| `detalles` | text | Notas adicionales |
| `creado` | timestamp | Fecha de alta |

---

### `cotizaciones`
Todas las cotizaciones del sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `nombre_cliente` | text | Nombre del cliente |
| `email_cliente` | text | Email del cliente |
| `cliente_id` | uuid | FK a `clientes` (opcional) |
| `productos` | jsonb | Array de productos cotizados |
| `total` | numeric | Total en USD |
| `estado` | text | `emitida` \| `en_espera` \| `aprobada` \| `rechazada` \| `vencida` |
| `precios_vigentes` | boolean | Si todos los precios tenían < 48hs al crear |
| `fecha_creacion` | timestamp | Fecha de creación |

**Estructura del campo `productos` (JSONB):**
```json
[
  {
    "nombre": "Laptop X",
    "cantidad": 2,
    "precio_unitario": 1200,
    "subtotal": 2400,
    "categoria": "Laptops",
    "proveedor": "DummyJSON",
    "producto_id": "abc-123",
    "moneda": "USD",
    "precio_vigente": true
  }
]
```

---

### `clientes`
Clientes registrados en el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `nombre_completo` | text | Nombre del cliente |
| `email` | text | Email (único, login) |
| `telefono` | text | Teléfono |
| `activo` | boolean | Si puede iniciar sesión |
| `created_at` | timestamp | Fecha de registro |

---

### `historial_precios`
Registro de cada cambio de precio detectado por la sincronización.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `sku` | text | SKU del producto |
| `nombre` | text | Nombre del producto |
| `source` | text | Fuente del dato |
| `proveedor` | text | Nombre del proveedor |
| `precio_anterior` | numeric | Precio antes del cambio |
| `precio_nuevo` | numeric | Precio después del cambio |
| `fecha_cambio` | timestamp | Cuándo se detectó el cambio |

---

### `user_roles`
Roles de usuarios admin.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | uuid | FK a Supabase Auth `users` |
| `role` | text | `'admin'` |

> Para dar acceso admin a un usuario: INSERT en esta tabla con su UUID y `role = 'admin'`.

---

## 5. Vistas de Supabase (read-only)

| Vista | Tablas que une | Uso |
|-------|---------------|-----|
| `vista_catalogo_proveedores` | `catalogo_proveedores` + `proveedores` | Catálogo público y cotizaciones (solo `vigente = true`) |
| `vista_cotizaciones_clientes` | `cotizaciones` + `clientes` | Panel de cliente: solo sus cotizaciones |

> **Importante:** Las vistas son de solo lectura. Todo INSERT/UPDATE/DELETE va a las tablas originales.

---

## 6. Integración N8N (Webhooks)

N8N está self-hosted en `n8n.srv1164728.hstgr.cloud`. Gestiona los flujos de email y automatización.

### Flujos activos

| Flujo | Trigger | Qué hace |
|-------|---------|----------|
| `generar-cotizacion` | POST desde frontend `/cotizar` | Guarda cotización en Supabase, envía email al cliente y al equipo de ventas |
| `cliente-acepta` | Link en email del cliente | Actualiza estado de cotización a `aprobada` |
| `cliente-cancela` | Link en email del cliente | Actualiza estado de cotización a `rechazada` |
| `ventas-aprueba` | Acción interna de ventas | Actualiza estado en `gestion_cotizaciones` |
| `recordatorio` | Cron / trigger temporal | Envía recordatorio al cliente si no respondió |
| `vencimiento` | Cron | Marca cotizaciones como `vencida` tras X días |

### Variable de entorno requerida

```
VITE_N8N_WEBHOOK_COTIZACION=https://n8n.srv1164728.hstgr.cloud/webhook/generar-cotizacion
```

> El frontend hace POST con el payload completo de la cotización. N8N responde con 200 vacío (noData). El frontend construye el estado de éxito localmente.

---

## 7. Flujo completo de una cotización

```
1. Cliente entra a /catalogo → explora productos
2. Va a /cotizar → agrega productos al carrito
3. Completa sus datos o inicia sesión
4. Hace clic en "Solicitar cotización"
5. Frontend hace POST al webhook N8N
6. N8N guarda en tabla cotizaciones (estado: "emitida")
7. N8N envía email al cliente con links aceptar/rechazar
8. N8N notifica al equipo de ventas
9. Cliente acepta o rechaza desde el email (N8N actualiza estado)
10. Admin puede ver y cambiar estado desde /cotizaciones
11. Admin o cliente descarga PDF
```

---

## 8. Sistema de precios — Regla de vigencia

Un precio se considera **desactualizado** si `fecha_sync` tiene más de **48 horas**.

- El sistema muestra advertencias visuales en el carrito, en el resumen y en el PDF
- El campo `precios_vigentes` en la cotización registra si al momento de crearse todos los precios eran vigentes
- La sincronización de precios es externa (N8N leyendo de DummyJSON, Google Sheets, Mockaroo)

---

## 9. Generación de PDFs

Los PDFs se generan **en el cliente** (browser) con jsPDF, sin pasar por servidor.

**Diferencia por rol:**
- **Cliente:** PDF sin columna Proveedor
- **Admin:** PDF con columna Proveedor y badges de color por proveedor

```js
generateCotizacionPdf(cotizacion)           // cliente
generateCotizacionPdf(cotizacion, { isAdmin: true })  // admin
```

---

## 10. Seguridad

### Autenticación y autorización

| Aspecto | Implementación |
|---------|----------------|
| Auth admin | Supabase Auth (email + contraseña) |
| Auth cliente | Sin contraseña — solo email lookup en tabla `clientes` |
| Sesión cliente | `sessionStorage` (no persiste al cerrar el tab) |
| Verificación de rol admin | Consulta tabla `user_roles` en cada sesión |
| Guards de ruta | `RequireAdmin` y `RequireCliente` en App.jsx |
| URL panel admin | Oculta (`/ts-panel/auth`), sin enlace visible en la UI |

### Consideraciones importantes

- **RLS (Row Level Security):** Verificar que esté configurado en Supabase para todas las tablas. La vista `vista_cotizaciones_clientes` filtra por email del cliente.
- **Anon Key expuesta:** La `VITE_SUPABASE_ANON_KEY` es pública (visible en el bundle). Es el comportamiento esperado de Supabase; la seguridad real depende de las políticas RLS.
- **Clientes inactivos:** Si `activo = false` en tabla `clientes`, el login muestra error y no permite acceso.
- **N8N webhook:** URL de producción sin autenticación adicional. Considerar agregar un header secreto si se requiere mayor seguridad.

---

## 11. Configuración de entorno

### Variables `.env.local` (y en Vercel)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_N8N_WEBHOOK_COTIZACION

### Vercel

- `vercel.json` configurado con rewrite `/* → /index.html` para SPA routing
- `vite.config.js` con `manualChunks` para separar vendor/supabase/pdf (mejor performance)

---

## 12. Estructura de carpetas

```
src/
├── supabase.js              ← cliente Supabase
├── App.jsx                  ← routing, layouts, guards de autenticación
├── main.jsx
├── styles/global.css        ← todo el CSS (sin archivos adicionales)
├── components/
│   ├── PublicNavbar.jsx     ← topbar público (con sync pill)
│   ├── AdminNavbar.jsx      ← topbar admin con menú hamburguesa móvil
│   ├── Table.jsx            ← tabla reutilizable
│   ├── Modal.jsx            ← modal genérico
│   ├── QuoteModal.jsx       ← modal nueva cotización (admin)
│   ├── ClientModal.jsx      ← modal edición de cliente
│   ├── Pagination.jsx       ← paginación + función paginate()
│   ├── LineChart.jsx        ← gráfico SVG sin librería externa
│   ├── Card.jsx
│   └── Footer.jsx
├── pages/
│   ├── LoginCliente.jsx     ← login por email sin contraseña
│   ├── LoginAdmin.jsx       ← login con Supabase Auth
│   ├── Dashboard.jsx        ← KPIs y resumen admin
│   ├── Catalogo.jsx         ← catálogo admin (todas las tablas directas)
│   ├── CatalogoPublico.jsx  ← catálogo cliente (vista, solo vigentes)
│   ├── Historial.jsx        ← historial de cambios de precio
│   ├── Cotizaciones.jsx     ← gestión de cotizaciones admin
│   ├── MisCotizaciones.jsx  ← cotizaciones del cliente logueado
│   ├── Cotizar.jsx          ← formulario de cotización pública
│   ├── Clientes.jsx         ← gestión de clientes admin
│   └── Proveedores.jsx      ← lista de proveedores admin
└── utils/
    ├── generatePdf.js       ← generateCotizacionPdf(cot, { isAdmin })
    └── helpers.js           ← shortId, formatearMoneda, formatearFecha, esPrecioVigente
```

---

## 13. Decisiones de diseño relevantes

| Decisión | Razón |
|----------|-------|
| Login cliente sin contraseña | UX simplificada para clientes B2B que no quieren gestionar credenciales |
| Aceptar/rechazar desde email (N8N) | Reduce fricción: el cliente actúa desde el email sin necesidad de loguearse |
| PDF generado en el cliente | Sin necesidad de servidor PDF; reduce costos y latencia |
| vistas de Supabase para clientes | Separa lo que el cliente puede leer de los datos internos (precio costo, proveedor, etc.) |
| Admin lee de tablas directas | Necesita ver todos los registros (incluyendo inactivos) sin restricciones de la vista |
| sessionStorage para sesión cliente | La sesión expira al cerrar el tab; más seguro que localStorage para datos de cliente |

---

*Documento generado en base al código fuente del proyecto. Última revisión: Abril 2026.*
