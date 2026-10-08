# Diseño aprobado de reconstrucción del esquema SaaS

## Alcance y límites

El esquema PostgreSQL actual se usa como baseline funcional y permanece de solo lectura. Los registros de desarrollo no se migrarán. El destino será una base PostgreSQL vacía creada con Flyway; no se ejecutará DDL en la base actual ni se alterarán datos, Alembic, FastAPI o React.

Fuentes contrastadas:

- `schema.sql`: dump estructural PostgreSQL 16.15; 30 tablas funcionales y `alembic_version`.
- `backend/fastapi_app/infrastructure/models.py`: modelos ORM actuales.
- `backend/migrations/schema_v2.py` y revisiones Alembic: metadata congelada e historial declarativo.
- `docs/architecture/database/erd.md`: documentación del modelo; `catalog_audit_events` fue agregado al diagrama.
- Servicios/repositorios FastAPI: evidencia de reglas ejecutadas al escribir y consultar.

El dump define el catálogo observado; no demuestra por sí solo que todas las reglas de negocio estén expresadas como constraints. Alembic no se toma como comparación exhaustiva del estado activo: `0005_complete_potoquitos_schema` crea objetos faltantes, pero no reconcilia todas las propiedades de objetos ya existentes.

## Modelo relacional de destino

- `tenants`: plataforma, UUID generado, `slug` único y estado.
- `plans`: catálogo de plataforma, código global único. No se inventan precios ni límites.
- `subscriptions`: relación de plataforma con `tenant_id` y plan; no se limita a una suscripción vigente sin regla aprobada.
- `users`: identidad global con credenciales y estado; no tiene `tenant_id`.
- `tenant_memberships`: puente entre usuario global y tenant; clave única `(tenant_id,user_id)`.
- `roles`: roles tenant-scoped.
- `permissions`: catálogo global.
- `user_roles`: asignación tenant-scoped entre membership y role.
- `role_permissions`: relación tenant-scoped entre role y permiso global.
- Las entidades operativas llevan `tenant_id NOT NULL`, UUID generado por el tenant y clave candidata `(tenant_id,id)`.
- Las PK técnicas `id` continúan globalmente únicas. No se reutilizan secuencias entre tenants.

Potoquitos se crea como registro ordinario usando UUID generado y slug `potoquitos` desde configuración/provisionamiento. No se fija un ID y no hay condición especial en lógica empresarial.

## Matriz de destino, tabla por tabla

| Tabla actual | Scope destino | Cambio de esquema |
|---|---|---|
| `alembic_version` | PLATFORM legado | Excluir del destino: es estado del gestor Alembic, no tabla funcional. Se conserva intacta en la base actual. |
| `users` | GLOBAL | Sin `tenant_id`; mantener email y username globalmente únicos inicialmente. La autorización pasa por membresía. |
| `roles` | TENANT-SCOPED | Agregar `tenant_id`; cambiar unicidad de nombre a `(tenant_id,name)` y habilitar clave candidata `(tenant_id,id)`. |
| `permissions` | GLOBAL | Sin `tenant_id`; conservar codename globalmente único. |
| `user_roles` | TENANT-SCOPED | Agregar `tenant_id`; PK y FKs compuestas a membership `(tenant_id,user_id)` y role `(tenant_id,role_id)`. |
| `role_permissions` | TENANT-SCOPED | Agregar `tenant_id`; PK/FK compuesta a role y FK global a permission. |
| `audit_events` | TENANT-SCOPED | Agregar `tenant_id`; conservar actor/target, action, details y timestamp; referencias de actores se validan contra membresía según nulabilidad. |
| `catalog_audit_events` | TENANT-SCOPED | Agregar `tenant_id`; `actor_user_id NOT NULL` conforme al dump y schema_v2. Conservar la referencia polimórfica `entity_type/entity_id`, validada en servicio. |
| `catalog_categories` | TENANT-SCOPED | Agregar `tenant_id`; nombre único normalizado por tenant. |
| `catalog_products` | TENANT-SCOPED | Agregar `tenant_id`; código único normalizado por tenant; FK compuesta a categoría; conservar precio, versión, moneda, disponibilidad e imagen actual. |
| `catalog_product_images` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta al producto; unicidad parcial de imagen actual por `(tenant_id,product_id)`. |
| `catalog_product_price_history` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a producto; `changed_by NOT NULL` según dump y schema_v2; versión única por tenant/producto. |
| `dining_tables` | TENANT-SCOPED | Agregar `tenant_id`; número único por tenant. |
| `table_sessions` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a mesa; índice parcial de sesión abierta por tenant/mesa. |
| `orders` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a sesión y validación tenant del mesero. |
| `order_lines` | TENANT-SCOPED | Agregar `tenant_id`; FKs compuestas a pedido y producto; conservar snapshot de nombre/precio/cantidad. |
| `order_cancellations` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a pedido y actor perteneciente al tenant. |
| `ingredients` | TENANT-SCOPED | Agregar `tenant_id`; nombre único normalizado por tenant; conservar unidades, cantidades y costos. |
| `recipes` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a producto y unicidad tenant/producto. |
| `recipe_items` | TENANT-SCOPED | Agregar `tenant_id`; FKs compuestas a receta e ingrediente. |
| `inventory_movements` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a ingrediente; validar responsable por membresía. |
| `kardex_entries` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a ingrediente; conservar cantidades, balances y ledger. |
| `cash_registers` | TENANT-SCOPED | Agregar `tenant_id`; nombre único por tenant. |
| `cash_sessions` | TENANT-SCOPED | Agregar `tenant_id`; FKs compuestas a caja y membership de cajero; sesión abierta única por tenant/caja. |
| `payments` | TENANT-SCOPED | Agregar `tenant_id`; FKs compuestas a sesión de mesa y sesión de caja; validar cajero por membership. |
| `payment_details` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a pago. |
| `invoices` | TENANT-SCOPED | Agregar `tenant_id`; mantener temporalmente unicidad global actual de `invoice_number` y unicidad de payment. Revisar serie/establecimiento fiscal antes de relajarla. |
| `invoice_lines` | TENANT-SCOPED | Agregar `tenant_id`; FK compuesta a factura. Mantener `product_id` como ID snapshot sin crear FK a producto mutable. |
| `expense_categories` | TENANT-SCOPED | Agregar `tenant_id`; nombre único por tenant. |
| `expenses` | TENANT-SCOPED | Agregar `tenant_id`; FKs compuestas a categoría; validar responsable por membership. |
| `restaurant_settings` | TENANT-SCOPED | Agregar `tenant_id`; clave única `(tenant_id,key)`. |

Tablas nuevas: `tenants`, `plans`, `subscriptions` y `tenant_memberships`. Reports y analytics son consultas/proyecciones, no tablas actuales; cada consulta nueva debe restringirse por `tenant_id`.

## Constraints, relaciones e índices

Se conservan checks de dominio, PK globales, columnas, tipos, precisión monetaria, nulabilidad que coincida con el dump y reglas funcionales observadas. Los cambios de constraints se limitan a los requeridos por el nuevo alcance:

- Unique natural de categorías, productos e ingredientes: mantener expresiones `lower(trim(...))` / `upper(trim(...))`, añadiendo `tenant_id`.
- Nombre de roles, mesas, cajas, categorías de gastos y `restaurant_settings.key`: pasar a único por tenant.
- `uq_current_product_image`: parcial por `(tenant_id,product_id)` donde `is_current`.
- `uq_history_product_version`: `(tenant_id,product_id,price_version)`.
- `uq_open_table_session` y `uq_open_cash_session`: índices parciales con tenant y padre.
- `users.email`, `users.username` y `permissions.codename`: globales en el primer diseño para preservar el contrato actual de login y RBAC.
- `invoice_number`: global en el primer diseño por conservación de la regla actual; cambiar a tenant/serie solo tras confirmar la política fiscal.
- Agregar clave candidata `(tenant_id,id)` en cada padre tenant-scoped usado por una FK compuesta. Las relaciones padre/hijo tenant-scoped deben referenciar `(tenant_id,id)`; FKs a usuarios deben pasar por membership donde se exija pertenencia.
- La FK cíclica producto/imagen actual se crea al final de ambas tablas y lleva tenant.
- Las relaciones actuales con `ON DELETE CASCADE` se conservan solo donde ya están definidas y no destruyen snapshots o ledger. Las columnas de actor que el dump declara `NOT NULL` no usan `SET NULL`.

El catálogo final se debe validar contra todos los índices del dump (incluidos índices de expresión/parciales), constraints declaradas aparte, defaults de secuencias y claves foráneas; no basta el conteo de “15 unique indexes”. El dump observado no declara funciones, triggers, extensiones ni schemas extra; mantener esa conclusión limitada a ese dump.

## Discrepancias que afectan la fuente de verdad

| Tabla/columna | Dump PostgreSQL | SQLAlchemy actual | Alembic schema_v2 | Resolución destino |
|---|---|---|---|---|
| `catalog_audit_events.actor_user_id` | `NOT NULL`; FK sin `ON DELETE SET NULL`. | Nullable; declara `ondelete="SET NULL"`. | `NOT NULL`; FK simple. | Obligatoria; conservar atribución. No intentar anularla al borrar usuario. |
| `catalog_product_price_history.changed_by` | `NOT NULL`; FK sin `ON DELETE SET NULL`. | Nullable; declara `ondelete="SET NULL"`. | `NOT NULL`; FK simple. | Obligatoria; cada cambio de precio identifica actor. Para automatización futura, usar actor de sistema auditable, no `NULL`. |

Los servicios de catálogo actuales exigen actor autenticado y lo pasan al registrar auditoría y crear/cambiar precios. El modelo nullable no convierte esos flujos en anónimos y no prevalece sobre el DDL observado ni schema_v2 para el baseline. Alinear los modelos FastAPI se difiere mientras el usuario exige mantenerlos intactos.

## Tenant isolation

Mecanismo principal: `TenantContext` request-scoped desde JWT validado, repositorios tenant-aware y FKs compuestas. El tenant nunca se toma como autoridad de parámetros o headers del cliente. No activar Hibernate filters ni RLS en el primer baseline. JPA Specifications podrán ayudar en filtros de búsqueda, pero siempre detrás de APIs repository que exijan tenant.

## Flyway y recreación

La base destino debe ser vacía y creada desde cero por migraciones versionadas. El baseline consolidado debe:

1. Crear entidades de plataforma y membership.
2. Crear tablas funcionales conservando el esquema de referencia, excluyendo solamente `alembic_version`.
3. Incluir `tenant_id NOT NULL` desde la creación en las entidades tenant-scoped.
4. Crear claves candidatas y FKs compuestas sin dejar relaciones operativas que admitan cruces de tenant.
5. Crear índices únicos tenant-scoped y conservar unicidades globales justificadas.
6. Proveer seeds idempotentes solo para catálogo global necesario; tenants y usuarios iniciales se aprovisionan con UUID generado/configuración, no IDs fijos.
7. Aplicarse en PostgreSQL 16 efímero y probar arranque, conexión, Flyway, health, integridad referencial y consultas tenant-aware.

## Estado de las migraciones y validación

- `V1__create_platform_foundation.sql` crea `tenants`, `plans` y `subscriptions`.
- `V2__create_tenant_scoped_business_schema.sql` contiene la reconstrucción propuesta de las tablas funcionales del dump, excluye `alembic_version`, agrega el membership y define las relaciones y unicidades tenant-scoped. No copia filas del dump.
- El empaquetado Maven de Spring Boot pasa (`mvn -DskipTests package`) y pasan las cuatro pruebas unitarias del conversor JWT.
- La suite de PostgreSQL con Testcontainers no pudo arrancar: la conexión del daemon Docker devuelve HTTP 400 con metadatos de servidor vacíos. Por lo tanto, V2 no ha sido aplicada ni se ha validado su sintaxis/ejecución en PostgreSQL; tampoco se han validado el arranque con DB, Flyway ni `/actuator/health`.

V2 es todavía un baseline propuesto y no validado. Antes de habilitar Flyway en cualquier entorno persistente, debe aplicarse y probarse íntegramente en PostgreSQL 16 efímero y debe verificarse que JPA valida contra él. Flyway permanece deshabilitado por defecto. Ninguna migración de este plan debe ejecutarse contra la base actual.

## Compatibilidad y rollback

FastAPI actual no fija ni filtra tenant. Por ello no puede compartir el esquema SaaS multi-tenant con múltiples organizaciones sin adaptar sus accesos. Mantener FastAPI y su PostgreSQL actual separados e intactos hasta una decisión de cutover posterior.

En validación, rollback significa descartar únicamente la base efímera. No se define downgrade destructivo de datos ni de tablas funcionales. El proceso de cutover, eventual convivencia, actualización de FastAPI o cambio de endpoint queda fuera de este diseño y requiere autorización posterior.
