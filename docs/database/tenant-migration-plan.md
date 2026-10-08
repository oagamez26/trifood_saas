# Plan de migración del esquema a multi-tenant

> **Estado:** reemplazado como diseño vigente por [tenant-schema-rebuild.md](tenant-schema-rebuild.md). Este plan histórico contiene un enfoque anterior de backfill/cutover orientado a conservar datos; esos pasos quedan obsoletos porque los registros de desarrollo no requieren preservarse. No ejecutar sus pasos operacionales.

## Fuente y estado verificado

Fuente de esquema revisada: `schema.sql`, exportado con `pg_dump --schema-only --no-owner --no-privileges`; PostgreSQL 16.15; versión confirmada de Alembic `0005_complete_potoquitos_schema`.

El dump contiene 31 tablas en `public`: 30 tablas de aplicación/modelo y `alembic_version`. Las 30 tablas de aplicación están representadas por modelos/association tables de SQLAlchemy. No se encontraron tablas `tenants`, `plans`, `subscriptions` ni columnas `tenant_id`. El dump contiene 15 índices UNIQUE, secuencias de IDs y constraints relacionales. No se encontraron funciones, triggers, tipos de usuario, schemas adicionales ni declaraciones CREATE EXTENSION.

La base operativa no se modificó. Este documento es un plan; ninguna sentencia aquí se ejecuta automáticamente.

## Comparación PostgreSQL ↔ Alembic ↔ SQLAlchemy ↔ ERD

| Tabla / objeto | Problema | Esperado | Actual | Impacto | Recomendación | Severidad |
|---|---|---|---|---|---|---|
| `alembic_version` | No es tabla de negocio y no debe incorporarse a Flyway. | Mantener exclusivamente el estado del backend legado. | Presente con `0005_complete_potoquitos_schema` según versión proporcionada. | Mezclar gestores podría invalidar historial o intentar reaplicar cambios. | Mantener esquema Flyway del backend nuevo independiente y no importar ni modificar Alembic. | SIN DISCREPANCIA |
| `catalog_audit_events.actor_user_id` | Nullability difiere entre ORM y dump. | Acordar si la auditoría admite conservar evento después de eliminar actor. | Dump: `NOT NULL`; SQLAlchemy: nullable; `0005` no fuerza reconciliación de nullability. | Inserciones ORM pueden asumir una semántica que el esquema rechaza; pérdida de auditabilidad por deletes. | Resolver la política antes de adaptar el modelo en una fase autorizada; mantener evento histórico con actor anonimizado o usuario retenido. No cambiar BD aquí. | ALTA |
| `catalog_product_price_history.changed_by` | Nullability difiere entre ORM y dump. | Decidir tratamiento de cambios de precio del sistema/importación sin usuario. | Dump: `NOT NULL`; SQLAlchemy: nullable; `schema_v2` también exige NOT NULL. | Integraciones podrían fallar al insertar una fila sin actor; discrepancia impide confiar en metadata ORM para migraciones. | Confirmar si cada cambio exige actor; reconciliar modelo y esquema en un cambio de aplicación coordinado, no en esta fase. | MEDIA |
| `catalog_audit_events` en ERD | La revisión inicial encontró la tabla ausente del ERD y un conteo documental obsoleto. | ERD que represente las 30 tablas de aplicación del dump. | Tabla añadida al ERD y al README de arquitectura; su pertenencia tenant está reflejada en la matriz. | El desajuste habría omitido auditoría del diseño de aislamiento. | Corregido en documentación; no requiere cambio de base de datos. | SIN DISCREPANCIA |
| `users`, `roles`, `user_roles` | El modelo de permisos actual es global y mono-tenant. | Identidad global; membresías y roles separados por tenant. | Usuario y roles con unicidad global; `user_roles` sin tenant. | No permite el mismo alias/rol personalizado en múltiples tenants; grants ambiguos. | Introducir membresía y scoped role model antes de activar tenants adicionales. | ALTA |
| Claves foráneas tenant-aware | Las FKs actuales enlazan por IDs sin tenant. | Constraints compuestas `(tenant_id, id)` para relaciones operativas. | Las FKs existentes no tienen `tenant_id`. | Relación entre filas de tenants distintos no queda impedida por el esquema. | Añadir columnas/backfill y composite constraints en migración posterior validada. | CRÍTICA |
| Índices UNIQUE de negocio | Índices naturales actuales son globales. | Únicos por tenant cuando representan datos locales. | 15 índices unique; tabla detallada más abajo. | Una copia del catálogo por cliente puede quedar impedida; soltar índices demasiado pronto abre duplicados. | Crear índices tenant-aware antes de retirar las restricciones legacy, tras backfill y análisis de colisiones. | ALTA |

La declaración de `0005` crea tablas faltantes y agrega columnas faltantes, pero no es un diff exhaustivo que pruebe paridad de nullability, defaults, constraints e índices existentes. El dump es la autoridad de producción; no debe suponerse equivalencia por el número de revisión.

### Índices únicos del dump y destino recomendado

| Índice actual | Alcance actual | Decisión futura |
|---|---|---|
| `ix_catalog_categories_name` | `catalog_categories(name)` | Reemplazar con normalización por tenant. |
| `uq_category_normalized_name` | `lower(trim(name))` | Mantener normalización, agregar `tenant_id`. |
| `ix_catalog_products_internal_code` | `catalog_products(internal_code)` | Reemplazar con código único por tenant. |
| `uq_product_normalized_code` | `upper(trim(internal_code))` | Mantener normalización, agregar `tenant_id`. |
| `ix_ingredients_name` | `ingredients(name)` | Reemplazar con nombre único por tenant. |
| `uq_ingredient_normalized_name` | `lower(trim(name))` | Mantener normalización, agregar `tenant_id`. |
| `ix_users_email` | `users(email)` | Mantener global para login por identidad; revisar normalización/colación. |
| `ix_users_username` | `users(username)` | Mover alias a `tenant_memberships` si username es tenant-local; unique compuesto allí. |
| `ix_permissions_codename` | `permissions(codename)` | Mantener global. |
| `ix_invoices_invoice_number` | `invoices(invoice_number)` | Cambiar a tenant-scoped, salvo que numeración fiscal exija otra identidad global. |
| `ix_restaurant_settings_key` | `restaurant_settings(key)` | Cambiar a `(tenant_id,key)`. |
| `uq_current_product_image` | parcial por `product_id` actual | Parcial unique `(tenant_id,product_id)` donde `is_current`. |
| `uq_history_product_version` | `(product_id,price_version)` | `(tenant_id,product_id,price_version)`. |
| `uq_open_table_session` | parcial por `table_id` abierta | Parcial unique `(tenant_id,table_id)` para OPEN. |
| `uq_open_cash_session` | parcial por `cash_register_id` abierta | Parcial unique `(tenant_id,cash_register_id)` para OPEN. |

Otros UNIQUE/PK de la estructura incluyen IDs primarios y relaciones RBAC. No se deben soltar ciegamente: las entidades internas conservan ID global y las relaciones tenant-aware añaden la clave compuesta indicada.

## Modelo objetivo

- `tenants`: PLATFORM, UUID PK, slug estable unique, nombre visible, estado y timestamps.
- `plans`: PLATFORM, UUID PK, código estable unique, nombre y estado.
- `subscriptions`: PLATFORM, `tenant_id` obligatorio, `plan_id`, status y período de vigencia; conservar histórico y no usarlo como tenant context.
- `users`: identidad GLOBAL con email global único; credenciales BCrypt, recuperación y revocación de identidad. No contiene `tenant_id`.
- `tenant_memberships`: MIXED, `tenant_id + user_id`, alias local opcional, estado y fechas; unique `(tenant_id,user_id)` y alias único por tenant.
- `roles`: TENANT-SCOPED, `tenant_id` directo y nombre único por tenant.
- `permissions`: GLOBAL, código de permiso estable.
- `user_roles`: puente TENANT-SCOPED con tenant explícito y referencias compuestas a membresía y rol.
- `role_permissions`: TENANT-SCOPED con tenant explícito, role compuesto y permission global.

El catálogo actual de roles base se sembrará por tenant como roles normales, sin rama especial para Potoquitos. El primer tenant se crea por seed/configuración operativa con slug `potoquitos`; la aplicación no compara nombre de restaurante ni fija un ID.

## Alcance de `tenant_id`

La matriz completa de las 31 tablas actuales está en [tenant-isolation.md](../architecture/tenant-isolation.md). Se propone añadir tenant directo a todas las entidades operativas y tablas puente tenant-scoped, incluidas hijas, auditorías y snapshots. Aunque algunas hijas podrían derivarlo por FK, el valor explícito permite composite FKs, filtros claros y políticas futuras de RLS. No reciben tenant directo: `alembic_version`, identidades globales (`users`), permisos globales (`permissions`) y catálogo de planes (`plans`). `subscriptions` y `tenant_memberships` son relaciones explícitas con `tenant_id`.

## Plan por fases, sin ejecución

Cada paso implica una migración futura propuesta; ninguno se ejecuta en esta fase.

| Tabla / conjunto | Cambio propuesto | Impacto | Datos existentes | Estrategia | Rollback |
|---|---|---|---|---|---|
| `tenants` | Crear tabla PLATFORM y unique slug. | Nuevo objeto; no afecta consultas legacy. | Vacía inicialmente. | Crear con UUID, checks de estado, timestamps e índices; no codificar ID. | `DROP TABLE` solo si está vacía y aún no tiene referencias, mediante migración aprobada. |
| `plans` | Crear catálogo PLATFORM. | Nuevo objeto. | Vacía inicialmente. | Crear códigos estables y constraints. No añadir precio/feature model hasta definir cobro. | Rollback solo antes de subscriptions referenciadas. |
| `subscriptions` | Crear tabla PLATFORM por tenant y plan. | Nuevo objeto de facturación/entitlements. | No hay suscripciones legacy. | Crear como historial de estado; definir índice de suscripción vigente tras confirmar reglas de negocio. | Retener filas; rollback lógico por desactivar feature, no borrar historial. |
| `tenant_memberships` | Añadir tabla de pertenencia GLOBAL user ↔ tenant. | Nuevo camino de autenticación/autorización. | Mapear cada usuario actual a Potoquitos; sin copiar contraseñas ni reiniciar IDs. | Crear tabla; poblar después de resolver la semántica de login y usuarios compartidos. | Eliminar membresías de ensayo tras respaldo; una vez usadas, rollback requiere export de grants y ventana coordinada. |
| `users` | Mantener identidad; decidir alias global/local. | Puede cambiar login existente. | Emails/usernames actuales son únicos globalmente. | Mantener email global, mover alias local solo tras compatibilidad de auth; preserve hash/password, token_version y reset state. | Rollback antes de cambiar login; después restaurar snapshot de columnas/índices y código compatible. |
| `roles`, `user_roles`, `role_permissions`, `permissions` | Convertir roles/grants a scoping por tenant; permisos permanecen globales. | Cambios RBAC sensibles. | Roles existentes son globales y están asignados por `user_roles`. | Copiar roles y grants al tenant inicial; agregar tenant nullable, backfill por membresía, agregar FKs/UNIQUE compuestos, validar y luego NOT NULL. | No eliminar tablas/grants legacy hasta reconciliar permisos y validar; restaurar backup más versión app compatible. |
| `audit_events`, `catalog_audit_events` | Agregar tenant a cada evento. | Auditoría y retención. | Eventos históricos pertenecen implícitamente a Potoquitos. | Backfill con tenant inicial; preservar actor/target; validar polimórficos manualmente. | Restaurar desde backup; no perder eventos históricos ni downgrade destructivo. |
| `catalog_categories`, `catalog_products`, imágenes e historial de precio | Agregar tenant y compuestos categoría/producto. | Catálogo aislado y constraints por tenant. | Catálogo completo se asigna a Potoquitos. | Expandir nullable; backfill; crear índices concurrentes normalizados; validar FKs; cambiar unicidad global solo al final. Resolver nullability divergente del historial de precios. | Mantener índices globales hasta aprobar; rollback de código y columnas nullable sin borrar nuevos registros. |
| `dining_tables`, `table_sessions`, `orders`, líneas y cancelaciones | Agregar tenant y FKs compuestas de sesión/mesa/pedido. | Flujos operativos transaccionales. | Filas existentes pertenecen a Potoquitos. | Backfill por cadena de padres y comparar los tenants; migrar índices parciales de sesiones abiertas. | No revertir claves mientras existan referencias; restauración coordinada verificada. |
| ingredientes, recetas, `recipe_items`, movimientos y Kardex | Agregar tenant a existencias, definición y ledger. | Riesgo alto de saldos mezclados. | Todo el inventario pertenece a Potoquitos; preservar balances e historia. | Backfill; reconciliar que receta/producto/ingrediente y cada asiento tienen tenant coherente; proteger ledger con FK compuestas. | Ledger inmutable: no borrar ni recalcular silenciosamente; restaurar snapshot y verificar saldos. |
| cajas, sesiones, pagos, detalles, facturas y líneas | Agregar tenant a todos; ajustar constraints por tenant. | Riesgo financiero/fiscal alto. | Todos los hechos financieros actuales de Potoquitos. | Backfill por cadena de sesión/caja/pago/factura; comparar totales y cierres; usar unique tenant para factura después de confirmar política fiscal. | Restauración y conciliación financiera; nunca rollback mediante borrado de transacciones. |
| categorías de gastos y gastos | Agregar tenant y FKs compuestas categoría/usuario. | Reportes contables tenant-scoped. | Registros actuales se asignan al tenant inicial. | Backfill y comparar totales por período; índice `(tenant_id,name)`. | Restaurar backup y validar agregados. |
| `restaurant_settings` | Agregar tenant y unique `(tenant_id,key)`. | Parámetros específicos del local. | Copiar configuración actual al tenant Potoquitos. | Backfill con tenant actual; defaults solo para tenants nuevos. | Conservar snapshot; no eliminar claves legacy hasta validar lectura/escritura. |
| secuencias, índices y constraints | Mantener secuencias globales; crear nuevos índices composites y FK. | Mayor uso temporal de almacenamiento y locks. | Secuencias del dump son independientes por tabla. | Índices `CONCURRENTLY` fuera de transacción; FKs `NOT VALID` y luego validar; no reutilizar secuencias por tenant. | Retirar solo índices/constraints nuevos si no se usan; no resetear secuencias. |

### Secuencia operacional recomendada

1. Probar la migración en una restauración desechable del dump y en un snapshot con datos representativos; no en la base activa.
2. Hacer respaldo probado y medir tamaño, locks y duración.
3. Crear tenant Potoquitos por slug consultado/configurado; no fijar `id=1`.
4. Aplicar cambios expand-only nullable y backfill por lotes, verificando conteos y cadenas FK.
5. Mantener índices y restricciones globales durante la compatibilidad; comprobar colisiones por normalización dentro y entre tenants.
6. Desplegar escritores/lectores tenant-aware antes de imponer `NOT NULL`, reemplazar uniqueness global o habilitar cualquier RLS.
7. Validar reporte de paridad, saldos financieros, Kardex, conteos e intentos de acceso cruzado.
8. Solo con ventana aprobada, ejecutar fase de cutover. Mantener FastAPI en la base original o congelar escrituras de forma coordinada; no permitir que una FastAPI mono-tenant lea filas de otros tenants.

### Compatibilidad / continuidad

Agregar columnas nullable no basta para habilitar multi-tenant: FastAPI actual no manda ni filtra `tenant_id`. Mientras convivan contra la misma base, solo se puede operar un tenant seguro o limitar FastAPI a la base original. Recomendación: mantener la base activa actual intacta y preparar una base SaaS destino; copiar mediante proceso posterior validado, probar el nuevo backend y realizar cutover explícito. La sincronización/corte de escrituras requiere decisión de negocio en Fase 2.

## Flyway del nuevo backend

El backend Spring Boot incluye una migración `V1` para una base SaaS nueva, con `tenants`, `plans` y `subscriptions` solamente. No adopta ni actualiza el historial Alembic. Flyway está deshabilitado por defecto y no debe apuntarse a `potoquitos`. Las pruebas lo ejecutan contra PostgreSQL 16 efímero.

## Rollback global

No existe rollback seguro de datos solo con `downgrade()` después de admitir escrituras tenant-aware. La reversión operacional debe restaurar snapshot verificado y volver a una versión de app compatible. No se permite `DROP`, renumerar IDs ni reconstruir saldos financieros como rollback automático.
