# Matriz de discrepancias PostgreSQL / Alembic / SQLAlchemy / FastAPI / React — 2026-10-08

**Estado:** análisis de solo lectura. Registra evidencia y decisiones abiertas;
**no resuelve ninguna discrepancia** ni autoriza implementar el catálogo.
Complementa —no reemplaza— a
[potoquitos-postgres-catalog-baseline.md](./potoquitos-postgres-catalog-baseline.md).

## 1. Evidencia física vigente

| Hecho | Valor observado el 2026-10-08 |
|---|---|
| Contenedor | `potoquitos_atg-db-1`, ID `ef63451bceb1`, `postgres:16-alpine`, `healthy`. Mismo ID que en el baseline del 2026-10-07. |
| Servidor | PostgreSQL 16.15; arranque `2026-10-07 15:27:28.605217+00` (sin reinicio desde el baseline). |
| Revisión Alembic | `0005_complete_potoquitos_schema`. |
| Sesión de lectura | `PGOPTIONS='-c default_transaction_read_only=on'`; `SHOW transaction_read_only` = `on`. Solo `pg_dump` y `SELECT`. |
| Dump nuevo | [potoquitos-live-schema-2026-10-08.sql](../database/potoquitos-live-schema-2026-10-08.sql): `pg_dump -U potoquitos --schema-only --no-owner --no-privileges --dbname=potoquitos`; 2.125 líneas; 54.016 bytes; SHA-256 `97d0600cc0d6394c402779522d134a00cb4cfc130ccb5d4d928ab6c9605000c7`. |
| Inventario | 31 tablas (30 de aplicación + `alembic_version`), 28 secuencias, 31 PK, 41 FK, 8 UNIQUE constraints, 10 CHECK, 15 índices UNIQUE, 15 índices no únicos, 5 cláusulas `ON DELETE`; sin funciones, triggers, extensiones, tipos ni schemas adicionales. |

### Comparación de dumps

| Comparación | Resultado |
|---|---|
| 2026-10-08 vs [2026-10-07](../database/potoquitos-live-schema-2026-10-07.sql) | **Idénticos.** Única diferencia: token aleatorio `\restrict`/`\unrestrict` (líneas 5 y 2124) que `pg_dump` 16.15 genera por ejecución. |
| 2026-10-08 vs `schema.sql` (UTF-16LE → UTF-8, CRLF → LF) | **Idénticos**, con la misma salvedad del token. La procedencia histórica de `schema.sql` sigue sin demostrarse (clase E), pero su contenido coincide con la base viva. |

No hay tablas, columnas, tipos, PK, FK, UNIQUE, índices, `NOT NULL`, CHECK,
defaults ni cascadas nuevas, eliminadas o cambiadas.

## 2. V2 Trifood frente al esquema vivo

V2 (`backend/springboot/src/main/resources/db/migration/V2__create_tenant_scoped_business_schema.sql`)
fue generado por `backend/springboot/generate-schema.js` desde `schema.sql`,
idéntico al esquema vivo. Comparación estructural automatizada (script de
análisis fuera del repositorio):

| Aspecto | Resultado |
|---|---|
| Tablas | Las 30 tablas de aplicación están en V2. Solo en vivo: `alembic_version` (excluida deliberadamente). Solo en V2: `tenant_memberships` (V1/V3 añaden `tenants`, `plans`, `subscriptions`, `refresh_sessions`). |
| Columnas, tipos, `NOT NULL`, defaults, CHECK | **Idénticos** en las 30 tablas, salvo la columna añadida `tenant_id uuid NOT NULL`. `actor_user_id` y `changed_by` del catálogo conservan `NOT NULL` del vivo. |
| Índices | Los 30 índices vivos existen en V2 con `tenant_id` antepuesto; V2 añade 40 índices auxiliares `(tenant_id, fk)`. |
| PK | Iguales salvo puentes RBAC: `user_roles (tenant_id, user_id, role_id)`, `role_permissions (tenant_id, role_id, permission_id)`. |
| UNIQUE pasados a tenant | Constraints: `cash_registers.name`, `dining_tables.number`, `expense_categories.name`, `recipes.product_id`, `roles.name`, `uq_price_history_version`. Índices: `ix_catalog_categories_name`, `ix_catalog_products_internal_code`, `ix_ingredients_name`, **`ix_invoices_invoice_number`**, `ix_restaurant_settings_key`, `uq_category_normalized_name`, `uq_current_product_image`, `uq_history_product_version`, `uq_ingredient_normalized_name`, `uq_open_cash_session`, `uq_open_table_session`, `uq_product_normalized_code`. |
| UNIQUE que siguen globales | `users.email`, `users.username`, `permissions.codename`, `invoices_payment_id_key UNIQUE (payment_id)`, `order_cancellations_order_id_key UNIQUE (order_id)` (iguales al vivo; los IDs técnicos son globales). |
| FK | Todas las FK vivas existen en forma compuesta `(tenant_id, x)`. **Las 16 FK vivas hacia `users(id)` apuntan en V2 a `tenant_memberships(tenant_id, user_id)`** (ver D-09). V2 añade FKs `fk_*_tenant` hacia `tenants`. |
| Cascadas | Las 5 cascadas vivas se conservan: `invoice_lines.invoice_id CASCADE`, `invoice_lines.order_line_id SET NULL` (en V2 `SET NULL (order_line_id)` para no anular `tenant_id`), `payment_details.payment_id CASCADE`, `recipe_items.recipe_id CASCADE`, `recipes.product_id CASCADE`. No se añaden cascadas. |
| `order_lines.product_id` / `invoice_lines.product_id` | Sin FK a producto, igual que en vivo. |

**Conclusión:** V2 sigue representando el esquema vivo como base estructural.
Sus diferencias son adaptaciones SaaS; la mayoría están documentadas, pero
D-08 (`invoice_number`) y D-09 (actores vía membership) no tienen decisión
aprobada. Que el DDL haya corrido con `psql` no convierte esas adaptaciones en
decisiones validadas.

## 3. Clasificación

Se reutiliza la del baseline: **A** técnica; **B** regla de negocio
confirmada; **C** código/migración no alineado; **D** esquema desactualizado;
**E** información insuficiente.

## 4. Matriz

Filas 1–8 provienen del baseline del 2026-10-07 y se reconfirmaron contra el
código actual (sin cambios en FastAPI/React desde el commit `367b797`). Filas
9–17 son hallazgos nuevos del 2026-10-08.

| # | Elemento | PostgreSQL actual | Alembic | SQLAlchemy | FastAPI | React | Regla funcional | Decisión |
|---|---|---|---|---|---|---|---|---|
| 1 | Actores de auditoría e historial de precio | `catalog_audit_events.actor_user_id` y `catalog_product_price_history.changed_by` `NOT NULL`; FK a `users` sin `ON DELETE`. | `schema_v2.py` (V4): `NOT NULL`, FK simple. V4/V5 no reconcilian columnas existentes. | `models.py:83,160,170`: `nullable=True`, `ondelete="SET NULL"`. | Siempre pasa el actor autenticado. | No interviene. | Toda mutación de catálogo y cambio de precio identifica al actor. | **C/E. Abierta — D-01.** |
| 2 | Cascadas de imágenes e historial | Sin `ON DELETE` en `catalog_product_images.product_id` ni en historial. | V4 sin cascada; V5 no altera FKs existentes. | `ProductImage.product_id` `CASCADE`; `uploaded_by` `SET NULL` (`models.py:146`). | No hay borrado físico de producto/categoría. | Solo baja lógica. | Baja lógica; no existe flujo de borrado físico. | **C/E. Abierta — D-02.** |
| 3 | `internal_code` editable | `NOT NULL`; únicos exacto y `upper(trim())`. | V4 normaliza y protege colisiones. | `unique=True`. | `ProductUpdate.internal_code` aceptado; se aplica `text(...,80).upper()`. | `readOnly={editing !== "new"}` (`CatalogProductsPage.tsx:1168`); el PATCH de edición no lo envía. | Unicidad normalizada confirmada; inmutabilidad no impuesta por API. | **B** (normalización) / **E** (inmutabilidad). **Abierta — D-03.** |
| 4 | Menú público y `is_available` | Sin columna de publicación. | Sin migración de publicación. | Sin `is_published`. | `public_menu` devuelve productos activos de categorías activas e incluye `is_available`. | Insignia "Disponible" fija (`PublicMenuPage.tsx:302`). | Inclusión pública = activo + categoría activa. | **B** (API) / **E** (presentación). **Abierta — D-04.** |
| 5 | Límite de descripción | `text`. | Sin límite. | `Text`. | Hasta 10.000 caracteres (schema y `strip()[:10000]`). | `maxLength={300}` (`CatalogProductsPage.tsx:1207`). | No confirmado. | **A/E. Abierta — D-05.** |
| 6 | Receta guardada desde el editor de producto | `recipes.product_id` único, `CASCADE` desde producto; `recipe_items` `CASCADE` desde receta. | V5 crea desde metadata. | 1:1 producto–receta. | `PUT /inventory/recipes/{id}`. | Llamada secundaria con `.catch(() => {})` (`:411`) y notas forzadas a `"Receta para <nombre>"`. Muestra éxito aunque falle. | La receta vincula producto con insumos. | **B** (relación) / **E** (UX). **Abierta — D-06.** |
| 7 | Snapshots en pedidos y facturas | `order_lines.product_id` e `invoice_lines.product_id` sin FK; nombre/precio guardados. | Igual. | Entero sin FK. | Valida producto/categoría al crear y persiste snapshot. | Historial no relee el catálogo. | Snapshot histórico. | **B. Preservar** (V2 lo preserva). |
| 8 | `tenant_id` | No existe. | No existe. | No existe. | Sin contexto tenant. | Single-tenant, marca Potoquitos en ~10 pantallas. | Tenant es extensión SaaS deliberada. | **B.** Diseño SaaS; marca → configuración del tenant. |
| 9 | Quitar imagen de producto | `catalog_product_images` con `is_current`, `replaced_at`; único parcial actual. | V4. | `ProductImage`. | `DELETE /catalog/products/{id}/image` (permiso `product.update`) → `replace_image(id, None)`: marca `is_current=False`, `replaced_at=now()`, `current_image_id=NULL`, audita `IMAGE_REMOVED`. No borra fila ni archivo. | `catalogApi.deleteImage` desde el editor. | **Retiro lógico**; historial de imágenes conservado. | **B. Hecho confirmado; preservar.** Retención/limpieza de archivos queda en D-02. |
| 10 | Permisos de estado vía `PATCH` genérico | `is_active`, `is_available` `NOT NULL`. | — | — | `save_product` exige solo `product.update`, pero `ProductUpdate` acepta `is_active` e `is_available`. Las rutas dedicadas exigen `product.disable` (desactivar) y `product.change_availability`. | El PATCH de edición envía ambos campos; luego, si cambió la disponibilidad, llama a `/availability` con `.catch(() => {})` (`:365`). Si falta `product.change_availability`, el cambio ya fue aplicado por el PATCH y el error se silencia. | Existen permisos separados para desactivar y cambiar disponibilidad. | **C/E. Abierta — D-07.** El baseline solo registraba `is_active`; se amplía a `is_available`. |
| 11 | Código autogenerado al crear producto | `internal_code NOT NULL`. | — | — | `ProductCreate.internal_code` obligatorio (`min_length=1`). | Si el campo está vacío genera `PRD-<últimos 6 dígitos de Date.now()>` (`:326`). | No confirmado: la API no genera códigos. | **E. Abierta — D-03** (se agrega a la decisión del código). |
| 12 | Guardado de edición no atómico | — | — | — | Endpoints independientes: PATCH, availability, price, image, recipe, cada uno con su propia transacción. | Hasta 5 peticiones secuenciales; un fallo intermedio deja cambios parciales y algunas fallas se silencian. | Cada operación del backend es atómica; la composición en UI no. | **E. Abierta — D-06** (ampliada). |
| 13 | `invoice_number` | Índice UNIQUE global `ix_invoices_invoice_number`. | Tabla creada por V5 desde `Base.metadata`; no figura en `schema_v2.py`. | `unique=True, index=True` (`models.py:426`). | `FAC-{count(*)+1:06d}` (`repositories.py:1446`): secuencia por conteo global, sin bloqueo. | Muestra/descarga el número (`{invoice_number}.pdf`). | Numeración consecutiva visible `FAC-NNNNNN`. Alcance (global/tenant/serie fiscal) no confirmado. | **E. Abierta — D-08.** V2 usa `(tenant_id, invoice_number)`; `tenant-schema-rebuild.md` dice mantenerlo global. Riesgo técnico registrado: `count+1` puede colisionar bajo concurrencia. |
| 14 | Referencias a usuarios (actores) | 16 FK a `users(id)`: auditorías, `uploaded_by`, `changed_by`, cajero/mesero en sesiones, pedidos, pagos y facturas, responsables de inventario/Kardex/gastos, `cancelled_by`, `user_roles`. | FK a `users`. | FK a `users`. | Usa el usuario autenticado. | — | Identifica al actor. | **E. Abierta — D-09.** V2 las referencia a `tenant_memberships(tenant_id, user_id)`; exige membership en el tenant. La revocación es lógica (`REVOKED`), por lo que no rompe historia, pero no hay decisión registrada. |
| 15 | Catálogo de permisos y roles | Tablas `roles`, `permissions`, `user_roles`, `role_permissions` (contenido no inspeccionado: solo esquema). | No siembra permisos. | Modelos RBAC. | `seed.py`: 4 roles (`ADMINISTRADOR`, `MESERO`, `COCINA`, `CAJERO`) y **47** codenames (`product.update`, `product.change_price`…); se siembra vía `cli.py`. | Rutas protegidas por rol. | Matriz rol→permiso del POS. | **D/E. Abierta — D-10.** V3 siembra 8 codenames con otra nomenclatura (`catalog.categories.read`, `users.read`…); bootstrap crea solo `TENANT_ADMIN`. `architecture-overview.md` afirma 45 permisos. |
| 16 | Credenciales de desarrollo en el repositorio | — | — | — | `seed.py` contiene usuarios y contraseñas en claro para desarrollo. | — | CLAUDE.md prohíbe secretos en el repositorio. | **Riesgo registrado. Abierta — D-11.** No se reproducen aquí. |
| 17 | Prueba de integración Flyway | — | — | — | — | — | `SaasApiApplicationTests.java:71` espera versión Flyway `"2"`; V3 existe. | **C. Abierta — D-12** (pertenece al gate Flyway/Spring Boot). |

## 5. Documentación inconsistente (registrada, no corregida)

| Documento | Afirmación | Evidencia contraria |
|---|---|---|
| `docs/adr/ADR-002-tenant-isolation-strategy.md` | "Aún no existe login ni emisión de JWT"; extraer "roles validados" del JWT. | Login/JWT implementados; roles del JWT ignorados (`SaasJwtAuthenticationConverter`). |
| `docs/architecture/tenant-isolation.md` | 17 pruebas unitarias/MVC. | 42 `@Test` unitarias/MVC en el repositorio. |
| `docs/database/tenant-schema-rebuild.md` | `order_lines`: "FKs compuestas a pedido y producto". | V2 y el vivo no tienen FK a producto (correcto según baseline). |
| `docs/database/tenant-schema-rebuild.md` | `invoice_number` global en el primer diseño; "V2 no validado". | V2 lo hace por tenant; registro posterior de DDL validado con `psql`. |
| `docs/architecture/architecture-overview.md` | 45 permisos; 21 tablas en `models.py`. | `seed.py` tiene 47 codenames; dump con 30 tablas de aplicación. |
| `docs/migration/migration-matrix.md`, `tenant-model.md` | Backfill de datos de Potoquitos; `users.tenant_id/role_id`. | Diseño vigente: reconstrucción sin copia de datos y `tenant_memberships`. |

## 6. Decisiones abiertas

| ID | Decisión | Fuentes en conflicto |
|---|---|---|
| D-01 | Nulabilidad y `ON DELETE` de `actor_user_id` / `changed_by`. | PostgreSQL + `schema_v2` + V2 vs SQLAlchemy. |
| D-02 | Política de borrado físico de producto, imágenes e historial; retención de archivos de imagen retirados. | SQLAlchemy vs PostgreSQL; ausencia de flujo. |
| D-03 | `internal_code`: ¿inmutable tras crear? ¿generación automática (`PRD-…`) es regla o solo UX? | FastAPI vs React. |
| D-04 | Presentación de `is_available` en menú público. | FastAPI vs React. |
| D-05 | Límite de descripción (300 vs 10.000). | FastAPI vs React. |
| D-06 | Guardado compuesto de producto (receta, disponibilidad, precio, imagen): atomicidad y reporte de errores. | React vs servicios FastAPI. |
| D-07 | ¿`product.update` puede cambiar `is_active` / `is_available`, o se exigen `product.disable` / `product.change_availability`? | FastAPI (PATCH vs rutas dedicadas) y React. |
| D-08 | Alcance y generación de `invoice_number` (global, por tenant o por serie fiscal; concurrencia). | PostgreSQL + SQLAlchemy vs V2 vs `tenant-schema-rebuild.md`. |
| D-09 | Actores referenciados vía `tenant_memberships` en V2. | PostgreSQL/SQLAlchemy vs V2. |
| D-10 | Mapeo de los 47 permisos y 4 roles legacy al RBAC Trifood (nomenclatura, seeds por tenant). | `seed.py` vs V3/bootstrap vs documentación. |
| D-11 | Tratamiento de credenciales de desarrollo en `seed.py`. | `seed.py` vs CLAUDE.md. |
| D-12 | Actualizar `SaasApiApplicationTests` a la versión Flyway vigente dentro del gate de integración. | Prueba vs migraciones. |

Ninguna se resuelve en este documento. Las que afectan al catálogo (D-01 a
D-07, D-09, D-10) deben decidirse antes de diseñar el módulo Spring.

## 7. Alcance de esta tarea

- Lectura: `pg_dump` y `SELECT` en sesión `read_only`; ningún DDL/DML.
- Sin cambios en Alembic, SQLAlchemy, FastAPI, React, Spring Boot, Docker,
  puertos ni contenedores. Catálogo no implementado.
