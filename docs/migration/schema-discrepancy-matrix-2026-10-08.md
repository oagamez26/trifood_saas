# Matriz de discrepancias PostgreSQL / Alembic / SQLAlchemy / FastAPI / React — 2026-10-08

**Estado:** evidencia de solo lectura del 2026-10-08, **decisiones D-01 a
D-12 aprobadas el 2026-10-08** (sección 6) y **D-13 a D-15 aprobadas el
2026-10-09** (sección 6.3), todas por el responsable del proyecto.
Las decisiones fijan el contrato objetivo de Trifood; no modifican el POS
legacy ni autorizan por sí mismas implementar el catálogo, cambiar pruebas o
reescribir historial Git.
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
Sus diferencias son adaptaciones SaaS. Con las decisiones del 2026-10-08,
D-09 (actores vía membership) queda aprobada tal como está en V2; D-08
(`invoice_number`) queda aprobada en dirección (tenant + serie/establecimiento)
pero V2 aún no la expresa completamente (ver D-08). Que el DDL haya corrido con
`psql` no sustituye la validación Flyway/Spring Boot pendiente.

## 3. Clasificación

Se reutiliza la del baseline: **A** técnica; **B** regla de negocio
confirmada; **C** código/migración no alineado; **D** esquema desactualizado;
**E** información insuficiente.

## 4. Matriz

Filas 1–8 provienen del baseline del 2026-10-07 y se reconfirmaron contra el
código actual (sin cambios en FastAPI/React desde el commit `367b797`). Filas
9–17 son hallazgos nuevos del 2026-10-08. La columna **Decisión** refleja lo
aprobado el 2026-10-08; el detalle está en la sección 6.

| # | Elemento | PostgreSQL actual | Alembic | SQLAlchemy | FastAPI | React | Regla funcional | Decisión |
|---|---|---|---|---|---|---|---|---|
| 1 | Actores de auditoría e historial de precio | `catalog_audit_events.actor_user_id` y `catalog_product_price_history.changed_by` `NOT NULL`; FK a `users` sin `ON DELETE`. | `schema_v2.py` (V4): `NOT NULL`, FK simple. V4/V5 no reconcilian columnas existentes. | `models.py:83,160,170`: `nullable=True`, `ondelete="SET NULL"`. | Siempre pasa el actor autenticado. | No interviene. | Toda mutación de catálogo y cambio de precio identifica al actor. | **D-01 aprobada (a):** `NOT NULL`, sin `SET NULL`. SQLAlchemy legacy queda como fuente no alineada (C). |
| 2 | Cascadas de imágenes e historial | Sin `ON DELETE` en `catalog_product_images.product_id` ni en historial. | V4 sin cascada; V5 no altera FKs existentes. | `ProductImage.product_id` `CASCADE`; `uploaded_by` `SET NULL` (`models.py:146`). | No hay borrado físico de producto/categoría. | Solo baja lógica. | Baja lógica; no existe flujo de borrado físico. | **D-02 aprobada (a):** solo baja lógica, sin cascadas nuevas. |
| 3 | `internal_code` editable | `NOT NULL`; únicos exacto y `upper(trim())`. | V4 normaliza y protege colisiones. | `unique=True`. | `ProductUpdate.internal_code` aceptado; se aplica `text(...,80).upper()`. | `readOnly={editing !== "new"}` (`CatalogProductsPage.tsx:1168`); el PATCH de edición no lo envía. | Unicidad normalizada confirmada. | **D-03 aprobada (c):** inmutable tras crear; generado por backend si no se indica. |
| 4 | Menú público y `is_available` | Sin columna de publicación. | Sin migración de publicación. | Sin `is_published`. | `public_menu` devuelve productos activos de categorías activas e incluye `is_available`. | Insignia "Disponible" fija (`PublicMenuPage.tsx:302`). | Inclusión pública = activo + categoría activa. | **D-04 aprobada (a):** se muestran marcados "No disponible". |
| 5 | Límite de descripción | `text`. | Sin límite. | `Text`. | Hasta 10.000 caracteres (schema y `strip()[:10000]`). | `maxLength={300}` (`CatalogProductsPage.tsx:1207`). | — | **D-05 aprobada (a):** 300 caracteres como regla de dominio. |
| 6 | Receta guardada desde el editor de producto | `recipes.product_id` único, `CASCADE` desde producto; `recipe_items` `CASCADE` desde receta. | V5 crea desde metadata. | 1:1 producto–receta. | `PUT /inventory/recipes/{id}`. | Llamada secundaria con `.catch(() => {})` (`:411`) y notas forzadas a `"Receta para <nombre>"`. Muestra éxito aunque falle. | La receta vincula producto con insumos. | **D-06 aprobada (a):** endpoints separados; todo error se reporta. Relación **B**: preservar. |
| 7 | Snapshots en pedidos y facturas | `order_lines.product_id` e `invoice_lines.product_id` sin FK; nombre/precio guardados. | Igual. | Entero sin FK. | Valida producto/categoría al crear y persiste snapshot. | Historial no relee el catálogo. | Snapshot histórico. | **B. Preservar** (V2 lo preserva). |
| 8 | `tenant_id` | No existe. | No existe. | No existe. | Sin contexto tenant. | Single-tenant, marca Potoquitos en ~10 pantallas. | Tenant es extensión SaaS deliberada. | **B.** Diseño SaaS; marca → configuración del tenant. |
| 9 | Quitar imagen de producto | `catalog_product_images` con `is_current`, `replaced_at`; único parcial actual. | V4. | `ProductImage`. | `DELETE /catalog/products/{id}/image` (permiso `product.update`) → `replace_image(id, None)`: marca `is_current=False`, `replaced_at=now()`, `current_image_id=NULL`, audita `IMAGE_REMOVED`. No borra fila ni archivo. | `catalogApi.deleteImage` desde el editor. | **Retiro lógico**; historial de imágenes conservado. | **B. Preservar.** Coherente con D-02 (a). La retención/limpieza de archivos no se define ahora. |
| 10 | Permisos de estado vía `PATCH` genérico | `is_active`, `is_available` `NOT NULL`. | — | — | `save_product` exige solo `product.update`, pero `ProductUpdate` acepta `is_active` e `is_available`. Las rutas dedicadas exigen `product.disable` y `product.change_availability`. | El PATCH de edición envía ambos campos; luego llama a `/availability` con `.catch(() => {})` (`:365`). | Existen permisos separados para desactivar y cambiar disponibilidad. | **D-07 aprobada (a):** estado solo por rutas dedicadas con su permiso. |
| 11 | Código autogenerado al crear producto | `internal_code NOT NULL`. | — | — | `ProductCreate.internal_code` obligatorio (`min_length=1`). | Si el campo está vacío genera `PRD-<últimos 6 dígitos de Date.now()>` (`:326`). | — | **D-03 aprobada (c):** la generación pasa al backend; el formato queda por definir en el diseño del catálogo. |
| 12 | Guardado de edición no atómico | — | — | — | Endpoints independientes: PATCH, availability, price, image, recipe, cada uno con su propia transacción. | Hasta 5 peticiones secuenciales; un fallo intermedio deja cambios parciales y algunas fallas se silencian. | Cada operación del backend es atómica; la composición en UI no. | **D-06 aprobada (a).** |
| 13 | `invoice_number` | Índice UNIQUE global `ix_invoices_invoice_number`. | Tabla creada por V5 desde `Base.metadata`; no figura en `schema_v2.py`. | `unique=True, index=True` (`models.py:426`). | `FAC-{count(*)+1:06d}` (`repositories.py:1446`): conteo global, sin bloqueo. | Muestra/descarga el número (`{invoice_number}.pdf`). | Numeración consecutiva visible `FAC-NNNNNN`. | **D-08 aprobada (c) en dirección:** tenant + serie/establecimiento y generación concurrente segura. Definición fiscal detallada pendiente para el módulo de facturación. |
| 14 | Referencias a usuarios (actores) | 16 FK a `users(id)`: auditorías, `uploaded_by`, `changed_by`, cajero/mesero en sesiones, pedidos, pagos y facturas, responsables de inventario/Kardex/gastos, `cancelled_by`, `user_roles`. | FK a `users`. | FK a `users`. | Usa el usuario autenticado. | — | Identifica al actor. | **D-09 aprobada (a):** FK a `tenant_memberships(tenant_id, user_id)`, como en V2; memberships nunca se borran físicamente. |
| 15 | Catálogo de permisos y roles | Tablas `roles`, `permissions`, `user_roles`, `role_permissions` (contenido no inspeccionado: solo esquema). | No siembra permisos. | Modelos RBAC. | `seed.py`: 4 roles y **47** codenames; se siembra vía `cli.py`. | Rutas protegidas por rol. | Matriz rol→permiso del POS. | **D-10 aprobada (b):** nomenclatura Trifood con equivalencia explícita que conserva los 47 permisos (sección 6.1). |
| 16 | Credenciales de desarrollo en el repositorio | — | — | — | `seed.py` contiene usuarios y contraseñas en claro para desarrollo. | — | CLAUDE.md prohíbe secretos en el repositorio. | **D-11 aprobada (a):** variables de entorno y rotación; pendiente de tarea de seguridad separada. No se reproducen aquí. |
| 17 | Prueba de integración Flyway | — | — | — | — | — | `SaasApiApplicationTests.java:71` espera versión Flyway `"2"`; V3 existe. | **D-12 aprobada (b):** comprobar la última migración disponible; se aplica dentro del gate de integración. |
| 18 | Rol administrador inicial | Tabla `roles` (contenido no inspeccionado). | No siembra roles. | Modelo `Role`. | `seed.py`: rol `ADMINISTRADOR` con los 47 permisos (`ROLE_PERMISSIONS_MAP`). | — | El administrador tiene acceso total. | **D-13 aprobada (a + i):** el bootstrap Trifood crea `ADMINISTRADOR` (no `TENANT_ADMIN`); cada migración que agregue permisos los concede al rol administrador de sistema de todos los tenants. `TenantBootstrapService` hoy crea `TENANT_ADMIN` con los permisos existentes en ese momento: cambio pendiente. |
| 19 | Protección del rol administrador y del último administrador | Sin marca de rol de sistema; `roles.name` único. | — | — | `update_role` rechaza cambiar nombre/permisos del rol llamado `ADMINISTRADOR` (`PROTECTED_ROLE`); `_protect_last_admin` exige un usuario activo con `ADMINISTRADOR` al desactivar o quitar el rol, con `lock_administration()`. | — | El administrador conserva sus permisos y nunca falta un administrador activo. | **D-14 aprobada (c):** rol administrador de sistema con identificador estable (no el nombre visible); permisos e identificador inmutables; nombre visible renombrable por tenant; se mantiene la regla del último titular activo de `roles.manage`. Spring hoy no tiene roles protegidos: cambio pendiente. Requiere migración aditiva futura. |
| 20 | Cambio de roles y escalada de privilegios | `user_roles` admite varios roles por usuario. | — | — | `PATCH /users/{id}` cambia roles con solo `user.update` y sin incrementar `token_version`; `POST/DELETE /users/{id}/roles` exige `role.assign` e incrementa `token_version`; `create_user` con roles exige `role.assign`. Ninguna ruta impide asignar un rol con más permisos que el asignador. | `UsersPage.tsx` cambia roles por PATCH con `roles: [role]` (un rol por usuario en la UI). | Asignación de roles controlada por permiso. | **D-15 aprobada (c):** separación estricta (`users.update` no cambia roles; asignar/revocar exige `users.roles.assign`) más protección contra escalada; un usuario no puede modificar sus propios roles. Se mantienen varios roles por usuario. Spring hoy no tiene la protección anti-escalada ni el bloqueo de auto-modificación: cambio pendiente. |

## 5. Documentación inconsistente (registrada, no corregida)

| Documento | Afirmación | Evidencia contraria / estado |
|---|---|---|
| `docs/adr/ADR-002-tenant-isolation-strategy.md` | "Aún no existe login ni emisión de JWT"; extraer "roles validados" del JWT. | Login/JWT implementados; roles del JWT ignorados (`SaasJwtAuthenticationConverter`). |
| `docs/architecture/tenant-isolation.md` | 17 pruebas unitarias/MVC. | 42 `@Test` unitarias/MVC en el repositorio. |
| `docs/database/tenant-schema-rebuild.md` | `order_lines`: "FKs compuestas a pedido y producto". | V2 y el vivo no tienen FK a producto (correcto según baseline). |
| `docs/database/tenant-schema-rebuild.md` | `invoice_number` global en el primer diseño; "V2 no validado". | Superado por D-08 (c); DDL V2 validado con `psql` según registro posterior. |
| `docs/architecture/architecture-overview.md` | 45 permisos; 21 tablas en `models.py`. | `seed.py` tiene 47 codenames; dump con 30 tablas de aplicación. |
| `docs/migration/migration-matrix.md`, `tenant-model.md` | Backfill de datos de Potoquitos; `users.tenant_id/role_id`. | Diseño vigente: reconstrucción sin copia de datos y `tenant_memberships`. |

| `docs/architecture/authentication-and-authorization.md` | El bootstrap crea el rol `TENANT_ADMIN`. | Describe el código actual; superado como diseño por D-13 (a). |

Estos documentos no se modifican en esta tarea; este documento prevalece para
los temas D-01 a D-15.

## 6. Decisiones aprobadas (2026-10-08)

Aprobadas por el responsable del proyecto. Fijan el contrato objetivo de
Trifood; el POS legacy (FastAPI, React, SQLAlchemy, Alembic y su base) no se
modifica. Se aplican a cada tenant por igual, sin reglas especiales por
Potoquitos.

| ID | Opción | Decisión | Consecuencias para el diseño | Pendiente / cuándo se aplica |
|---|---|---|---|---|
| D-01 | (a) | `catalog_audit_events.actor_user_id` y `catalog_product_price_history.changed_by` son `NOT NULL`, sin `ON DELETE SET NULL`. | Toda mutación de catálogo y todo cambio de precio registran actor autenticado. V2 ya lo expresa. El mapping JPA debe declararlos obligatorios. Un futuro actor de sistema requiere decisión aparte. | Diseño del catálogo Spring. |
| D-02 | (a) | Producto, categoría, imágenes e historial de precio solo admiten baja lógica; sin cascadas de borrado nuevas. | No exponer borrado físico. Conservar las 5 cascadas existentes del esquema vivo (receta, ítems de receta, detalles de pago, líneas de factura) tal como están. Quitar imagen sigue siendo retiro lógico (fila 9). | Diseño del catálogo Spring. Retención/limpieza de archivos de imagen: no definida. |
| D-03 | (c) | `internal_code` es inmutable después de crear el producto. Si no se indica al crear, lo genera el backend. | Se mantienen trim, mayúsculas y unicidad normalizada por tenant (`upper(trim())`). La API de actualización no acepta el campo. La generación debe ser tenant-scoped y segura ante concurrencia. | Formato del código generado (el `PRD-…` actual es solo de React) por definir en el diseño del catálogo. |
| D-04 | (a) | El menú público incluye productos activos de categorías activas, también los no disponibles, y los marca "No disponible". | Se preserva el criterio de inclusión de la API; la presentación refleja `is_available`. No se añade bandera de publicación. | Diseño del menú público y frontend Angular. |
| D-05 | (a) | La descripción de producto tiene un máximo de 300 caracteres como regla de dominio. | El backend la valida; frontend y backend usan el mismo valor. | Diseño del catálogo Spring. |
| D-06 | (a) | Se mantienen operaciones separadas (datos, disponibilidad, precio, imagen, receta), cada una atómica y con su permiso; el cliente reporta el resultado real de cada una. | Prohibido silenciar errores. El protocolo de precio con `expected_price_version` se conserva. La UI debe informar éxito parcial cuando ocurra. | Diseño del catálogo Spring y frontend Angular. |
| D-07 | (a) | `is_active` e `is_available` solo cambian por sus rutas dedicadas: activar/desactivar con su permiso de estado y disponibilidad con su permiso específico. | El endpoint de edición general no acepta esos campos. Equivalencias de permisos en 6.1. | Diseño del catálogo Spring. |
| D-08 | (c) | La numeración de facturas será por tenant y por serie/establecimiento, con generación concurrente segura. | El diseño debe soportar: (1) unicidad por `tenant_id` + serie/establecimiento + número; (2) generación sin `count(*)+1`, con un mecanismo transaccional que no colisione bajo concurrencia; (3) conservar el número emitido como dato histórico. V2 actual solo tiene `UNIQUE (tenant_id, invoice_number)`: insuficiente para la decisión; se ajustará en el módulo de facturación. | **Definición fiscal detallada pendiente** (series, prefijos, resoluciones, establecimientos) para el módulo de facturación. No bloquea el catálogo. |
| D-09 | (a) | Las referencias a actores apuntan a `tenant_memberships(tenant_id, user_id)`, como en V2. | Regla obligatoria: las memberships **nunca se borran físicamente**; revocar/suspender es cambio de estado. Un actor histórico con membership revocada sigue siendo válido como referencia. | Aplica a todos los módulos. V2 ya lo expresa. |
| D-10 | (b) | Nomenclatura Trifood `<dominio>.<recurso>.<acción>` con equivalencia explícita que conserva la granularidad de los 47 permisos legacy. | Ver 6.1 y 6.2. | Los códigos se siembran con cada módulo; V3 ya contiene 8. |
| D-11 | (a) | Las credenciales de desarrollo de `seed.py` deben salir del repositorio hacia variables de entorno y rotarse si se usaron en algún entorno accesible. | No se reescribe ni limpia historial Git en esta etapa. | **Pendiente de tarea de seguridad separada** con autorización explícita (implica tocar el legacy). |
| D-12 | (b) | `SaasApiApplicationTests` debe verificar que Flyway aplicó la última migración disponible, no una versión fija. | Evita que la prueba se rompa con cada migración. | **Anotado para el gate de integración** Flyway/Spring Boot/PostgreSQL. No se implementa ahora. |

### 6.1 Equivalencia de permisos legacy → Trifood (D-10)

Fuente legacy: `backend/fastapi_app/infrastructure/seed.py` (`BASE_PERMISSIONS`,
47 codenames). "Protege" resume los usos observados en FastAPI. Códigos marcados
**V3** ya están sembrados en `V3__identity_access_and_refresh_sessions.sql`; el
resto es nomenclatura aprobada que se sembrará con su módulo.

Regla de conservación: cada permiso legacy tiene al menos un código Trifood
propio y ningún código Trifood agrupa dos permisos legacy distintos.

| # | Legacy | Trifood | Protege en el POS legacy |
|---|---|---|---|
| 1 | `user.view` | `users.read` **V3** | Consultar usuarios. |
| 2 | `user.create` | `users.create` **V3** | Crear usuario. |
| 3 | `user.update` | `users.update` **V3** + `users.memberships.manage` **V3** | Editar perfil/email; activar/desactivar (con protección del último administrador e incremento de `token_version`). En Trifood el estado vive en la membership (ver 6.2). |
| 4 | `role.view` | `roles.read` **V3** | Listar roles; consultar rol y permisos. |
| 5 | `role.assign` | `users.roles.assign` **V3** | Asignar/retirar rol a usuario; asignar roles al crear usuario. |
| 6 | `role.update` | `roles.manage` **V3** | Editar nombre y permisos de un rol. |
| 7 | `audit.view` | `audit.events.read` | Auditoría general y auditoría de catálogo. |
| 8 | `category.view` | `catalog.categories.read` **V3** | Listar/consultar categorías. |
| 9 | `category.create` | `catalog.categories.create` | Crear categoría. |
| 10 | `category.update` | `catalog.categories.update` | Editar categoría. |
| 11 | `category.disable` | `catalog.categories.disable` | Desactivar categoría. |
| 12 | `product.view` | `catalog.products.read` | Listar/consultar productos e historial de precio. |
| 13 | `product.create` | `catalog.products.create` | Crear producto (incluye precio inicial, versión 1). |
| 14 | `product.update` | `catalog.products.update` | Editar datos de producto; cargar/quitar imagen; activar producto. |
| 15 | `product.disable` | `catalog.products.disable` | Desactivar producto. |
| 16 | `product.change_price` | `catalog.products.change_price` | Cambiar precio con versión esperada. |
| 17 | `product.change_availability` | `catalog.products.change_availability` | Cambiar disponibilidad. |
| 18 | `table.view` | `tables.read` | Ver mesas; solicitar cuenta. |
| 19 | `table.create` | `tables.create` | Crear mesa. |
| 20 | `table.update` | `tables.update` | Editar y eliminar mesa. |
| 21 | `table.open` | `tables.sessions.open` | Abrir sesión de mesa. |
| 22 | `table.close` | `tables.sessions.close` | Cerrar sesión de mesa. |
| 23 | `order.view` | `orders.read` | Ver pedidos; resumen de pago de mesa. |
| 24 | `order.create` | `orders.create` | Crear pedido; consultar ítems de menú para pedir. |
| 25 | `order.update_draft` | `orders.drafts.update` | Editar pedido en borrador. |
| 26 | `order.confirm` | `orders.confirm` | Transición de confirmación. |
| 27 | `order.cancel` | `orders.cancel` | Cancelar pedido. |
| 28 | `order.deliver` | `orders.deliver` | Marcar entregado. |
| 29 | `order.prepare` | `orders.prepare` | Transiciones de preparación. |
| 30 | `kitchen.view` | `kitchen.queue.read` | Cola de cocina. |
| 31 | `kitchen.advance` | `kitchen.orders.advance` | Iniciar preparación; marcar listo. |
| 32 | `inventory.view` | `inventory.read` | Ingredientes, movimientos y Kardex. |
| 33 | `inventory.adjust` | `inventory.adjust` | Crear/editar ingrediente; registrar movimiento. |
| 34 | `recipe.view` | `inventory.recipes.read` | Consultar recetas y capacidad. |
| 35 | `recipe.update` | `inventory.recipes.update` | Guardar receta. |
| 36 | `cash.view` | `cash.read` | Cajas, sesión activa, historial y reporte PDF de sesión. |
| 37 | `cash.open` | `cash.sessions.open` | Abrir turno de caja. |
| 38 | `cash.close` | `cash.sessions.close` | Cerrar turno de caja. |
| 39 | `payment.view` | `payments.read` | Resumen de pagos de mesa. |
| 40 | `payment.process` | `payments.process` | Registrar pago. |
| 41 | `invoice.view` | `invoices.read` | Listar/consultar facturas y PDF. |
| 42 | `expense.view` | `expenses.read` | Listar gastos y categorías de gasto. |
| 43 | `expense.create` | `expenses.create` | Crear gasto y categoría de gasto. |
| 44 | `report.view` | `reports.read` | Dashboard, resultados y exportaciones Excel/PDF/XML. |
| 45 | `prediction.view` | `analytics.predictions.read` | Alertas predictivas. |
| 46 | `settings.view` | `settings.read` | Consultar configuración. |
| 47 | `settings.update` | `settings.update` | Actualizar configuración. |

### 6.2 Notas de equivalencia y roles base (D-10)

1. **`user.update` → dos códigos.** En el legacy un mismo permiso edita el
   perfil y activa/desactiva la cuenta global. En Trifood el estado es de la
   membership del tenant (`users.memberships.manage`) y el perfil es
   tenant-local (`users.update`). Quien tenga `user.update` en el legacy recibe
   ambos. Es una división más fina, no una pérdida de granularidad.
2. **Roles vía `PATCH /users/{id}`.** El legacy permite cambiar roles dentro de
   `update_user` con `user.update`; en Trifood la asignación exige
   `users.roles.assign` (decidido en D-15). No altera la equivalencia
   `role.assign` → `users.roles.assign`.
3. **`roles.manage` incluye crear roles.** El legacy no tiene endpoint de
   creación de roles (solo `PATCH /roles/{id}`); Trifood sí (`POST /api/roles`).
   Es una capacidad SaaS nueva cubierta por el equivalente de `role.update`.
4. **Protección del administrador.** El legacy protege el rol por nombre
   (`ADMINISTRADOR` no cambia nombre ni permisos) y al último administrador.
   Trifood protege al último titular de `roles.manage`, sin depender del nombre.
   La protección del rol administrador se decide en D-14 (sección 6.3).
5. **Roles base.** `ADMINISTRADOR`, `MESERO`, `COCINA` y `CAJERO`, con su matriz
   `ROLE_PERMISSIONS_MAP` traducida por esta tabla, se sembrarán **por tenant
   como datos**, sin lógica especial por nombre de tenant. La relación con
   `TENANT_ADMIN` se decide en D-13 (sección 6.3).
6. **Códigos solo Trifood.** `users.memberships.manage` no tiene equivalente
   propio en el legacy (deriva del punto 1).

### 6.3 Decisiones de administración de acceso (aprobadas 2026-10-09)

Evidencia revisada: `backend/fastapi_app/modules/auth/application/service.py`
(`create_user`, `update_user`, `_protect_last_admin`, `assign_role`,
`update_role`), `backend/fastapi_app/presentation/auth_routes.py` y
`schemas.py`, `backend/fastapi_app/infrastructure/seed.py`,
`frontend/src/features/users/UsersPage.tsx`,
`backend/springboot/.../users/TenantBootstrapService.java`,
`TenantAccessManagementService.java`, `TenantAccessManagementRepository.java`
y V3.

| ID | Opción | Decisión | Consecuencias para el diseño | Pendiente / cuándo se aplica |
|---|---|---|---|---|
| D-13 | (a) + (i) | Existe un único rol administrador por tenant: `ADMINISTRADOR`. El bootstrap lo crea en lugar de `TENANT_ADMIN`, con todos los permisos Trifood equivalentes (6.1). Cada migración que agregue permisos los concede, en la misma migración, al rol administrador de sistema de **todos** los tenants. | El rol se identifica por su identificador de sistema (D-14), nunca por el nombre ni por el tenant: sin lógica especial por Potoquitos. Ningún tenant pierde acceso al desplegar módulos nuevos. `TENANT_ADMIN` desaparece del diseño. | Cambiar `TenantBootstrapService` y las pruebas/documentación asociadas cuando se autorice código. Hoy el bootstrap concede las filas de `permissions` existentes al ejecutarse (8 con V3). |
| D-14 | (c) | El rol administrador es un **rol de sistema** con identificador estable, distinto de su nombre visible. Sus permisos y su identificador son inmutables; no puede eliminarse. Se mantiene la regla vigente: el tenant debe conservar al menos una membership activa (usuario y tenant activos) con `roles.manage`, verificada con bloqueo del tenant al suspender/revocar membership, revocar rol o reemplazar permisos de un rol. | Requiere migración **aditiva** futura sobre `roles` para el identificador de sistema (V1–V3 no se reescriben). `replaceRolePermissions` debe rechazar cambios sobre el rol de sistema. Habilita D-13 (i). Solo el rol administrador es de sistema; `MESERO`, `COCINA` y `CAJERO` son roles base ordinarios sembrados como datos. | Migración y código cuando se autoricen. **Sub-punto aprobado (2026-10-09):** el nombre visible del rol de sistema **puede** cambiarse por tenant; su identificador de sistema y sus permisos no. Diferencia deliberada con el legacy, que prohíbe renombrar `ADMINISTRADOR`. Spring hoy no tiene endpoint de renombrado. |
| D-15 | (c) | **Separación estricta:** `users.update` solo modifica el perfil/estado tenant-local y nunca roles; asignar y revocar roles exige `users.roles.assign`. **Protección contra escalada:** asignar un rol que contenga `roles.manage`, o permisos que el asignador no posee, exige además que el asignador tenga `roles.manage`. Se mantienen **varios roles por usuario**; los permisos efectivos son la unión de sus roles. | Regla nueva respecto del legacy, aprobada como mejora de seguridad. Spring ya cumple la separación estricta; la protección anti-escalada no existe aún en `TenantAccessManagementService.assignRole`. La UI Angular debe mostrar los permisos efectivos resultantes de varios roles y usar llamadas separadas para perfil y roles, reportando cada resultado (D-06). | Código y pruebas cuando se autoricen. **Sub-punto aprobado (2026-10-09):** un usuario **no puede** asignarse ni revocarse sus propios roles, aunque tenga `users.roles.assign` o `roles.manage`. Spring hoy no lo impide. |

Diferencias legacy registradas por estas decisiones (no se corrigen en el POS):

- El legacy cambia roles por `PATCH /users/{id}` con solo `user.update` y sin
  incrementar `token_version`; la ruta dedicada exige `role.assign` y sí lo
  incrementa. Trifood recalcula authorities por request, por lo que no depende
  de `token_version` para reflejar cambios de rol.
- La UI legacy asigna un solo rol por usuario; Trifood conserva varios.
- El legacy no impide asignar `ADMINISTRADOR` con `role.assign` (ni con
  `user.update` vía PATCH); D-15 cierra esa escalada en Trifood.

## 7. Alcance de estas tareas

- 2026-10-08, evidencia: `pg_dump` y `SELECT` en sesión `read_only`; ningún
  DDL/DML sobre la base de Potoquitos.
- 2026-10-08, decisiones D-01 a D-12: actualización documental únicamente.
- 2026-10-09, decisiones D-13 a D-15: actualización documental únicamente.
- Sin cambios en Alembic, SQLAlchemy, FastAPI, React, Spring Boot, pruebas,
  Docker, puertos, contenedores ni historial Git. Catálogo no implementado.
