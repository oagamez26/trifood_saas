# Diseño de tenant isolation

## Decisión

Mecanismo primario: **TenantContext request-scoped + repositorios tenant-aware + claves foráneas compuestas tenant-aware**.

Cada lectura o mutación de una entidad tenant-scoped debe incluir el tenant resuelto desde autenticación. Para búsquedas por ID se usa tenant e ID a la vez (`findByIdAndTenantId`); `TenantScopedRepository` no hereda el API CRUD genérico de Spring Data y no expone `findById` ni `findAll` sin tenant. Los listados siempre comienzan desde el tenant actual. Los writes fijan `tenant_id` desde el contexto, no desde el DTO.

En PostgreSQL, las relaciones entre filas tenant-scoped se protegerán con claves foráneas compuestas, por ejemplo `(tenant_id, category_id)` hacia `(tenant_id, id)`. Esto previene enlaces entre tenants aunque un ID válido exista en el tenant equivocado.

## Opciones consideradas

| Mecanismo | Evaluación |
|---|---|
| Repositorios tenant-aware | Elegido. Explicita el tenant en cada operación, es sencillo de revisar y funciona con JPA y SQL ordinario. Se complementa con constraints compuestas. |
| Hibernate filters | No elegido como control principal. Filtros implícitos pueden omitirse en consultas nativas, cargas por ID, relaciones o sesiones no configuradas; son difíciles de auditar como única barrera. |
| JPA Specifications | Útiles para filtros de búsqueda combinables, pero no garantizan por sí mismas que cada consulta incluya tenant. Se podrán usar detrás de repositorios tenant-aware, nunca en sustitución del control. |
| PostgreSQL Row Level Security | No se habilita ahora. FastAPI comparte hoy la base y no fija un tenant por transacción; activar RLS en sus tablas podría bloquear la app o producir filtrados inconsistentes. RLS requeriría roles DB no propietarios, `SET LOCAL` seguro por transacción y una migración coordinada de todos los escritores. |

No se añade un segundo mecanismo de filtro ORM ni RLS en esta etapa. Constraints compuestas son invariantes relacionales, no una capa de filtrado oculta.

## TenantContext

```text
Bearer JWT
  -> Spring Security verifica firma/expiración y claims
  -> principal autenticado (user_id, tenant_id)
  -> membership activa resuelve roles/permissions desde PostgreSQL
  -> interceptor MVC carga TenantContext request-scoped
  -> servicio requiere tenant_id
  -> repositorio filtra tenant_id
  -> FK compuesta protege enlaces
```

El tenant no se acepta desde Angular como autoridad. Si la experiencia de login necesita escoger entre varios tenants, el cliente podrá enviar un slug como selector no confiable únicamente a un endpoint de autenticación; el servidor verificará la membresía y emitirá un token con el UUID validado. Nunca se cambia el tenant de una petición ya autenticada usando un header.

`TenantContext` request-scoped evita estado estático global y contaminación entre hilos de peticiones síncronas. Trabajos asíncronos deben recibir el tenant explícitamente como parámetro de comando confiable, y volver a verificar pertenencia; no se propaga el contexto implícitamente.

## Formato de identidad y autorización

- `user_id`: identificador de identidad global.
- `tenant_id`: UUID del tenant validado.
- `roles`: los claims de roles del JWT no autorizan; se recalculan desde `user_roles` y `roles` para la membresía activa.
- `permissions`: se resuelven desde `role_permissions` y el catálogo global `permissions`.
- Las authorities usan `ROLE_<nombre>` y `PERMISSION_<codename>`, verificadas en backend y dentro del tenant.
- La identidad global y membresía no implican autorización para cualquier tenant.
- Las rutas de health y documentación OpenAPI son públicas; los endpoints de negocio futuros requerirán autenticación por defecto.

## Implementación actual

- `TenantMembershipAuthorizationFilter` valida en cada request que usuario, tenant y membresía estén activos. La ausencia de membresía para el `tenant_id` firmado produce `403`; no se acepta un tenant alterno desde el cliente.
- `TenantContext` es request-scoped y se inicializa desde el principal autenticado en el interceptor MVC para `/api/**`.
- `GET /api/auth/me` devuelve el usuario, tenant y authorities calculadas.
- `GET /api/catalog/categories` exige `PERMISSION_catalog.categories.read`; el servicio obtiene el tenant desde `TenantContext` antes de consultar su `TenantScopedRepository`.
- `POST /api/auth/login` excluye las rutas públicas de login/refresh/logout del interceptor de TenantContext. El login valida una membership seleccionada antes de emitir el JWT; las demás rutas API siguen requiriendo principal autenticado.
- `GET/POST/PATCH /api/users` y `/api/tenant-memberships` seleccionan/escriben mediante el UUID del `TenantContext`; los campos tenant-scoped de perfil y estado viven en membership. Ningún DTO de administración acepta `tenant_id`.
- `/api/roles`, `/api/permissions` y las asignaciones `user_roles` validan que tanto el usuario como el rol existan bajo el mismo tenant antes de modificar grants.
- `refresh_sessions` referencia `(tenant_id, user_id)` de `tenant_memberships`; la rotación vuelve a comprobar membership/tenant/usuario activos y revoca la familia al detectar reutilización.
- Las 17 pruebas unitarias/MVC focalizadas cubren la resolución del contexto, autorización de endpoints, reemplazo de roles del token por roles/permissions de membresía, falta de membresía y tenant entregado al repositorio.
- Las pruebas HTTP/PostgreSQL de `SaasApiApplicationTests` verifican Flyway, membresía real y aislamiento por tenant, pero aún no se ejecutaron. Se mantienen pendientes antes del despliegue; no bloquean continuar con módulos.

## Login, permisos y sesiones

El `tenantSlug` enviado al login solo sirve para elegir una membership que el servidor consulta como activa; nunca se conserva directamente como claim. Si la cuenta tiene varias memberships activas se requiere elección explícita. El JWT identifica a una persona y un tenant ya validados, no concede permisos. Las autoridades se recalculan en cada request desde RBAC.

Las identidades y credenciales (`users`) son globales; nombre visible, apellido visible y estado de pertenencia (`tenant_memberships`) son tenant-locales. Esto permite a cada organización administrar su perfil de usuario sin alterar cómo esa persona aparece o inicia sesión en otros tenants. Las operaciones de asignación/revocación de roles validan por separado la membership objetivo y el rol local, y dejan que las FK compuestas sean una segunda barrera.

Los refresh tokens son secretos opacos generados aleatoriamente; solo se almacena su hash SHA-256. Cada refresh rota el token dentro de la misma familia bajo `SELECT ... FOR UPDATE`; un token revocado que se presenta de nuevo provoca revocación de la familia. El refresh se transporta en cookie HttpOnly y se protege con cookie/header CSRF de doble envío y validación de Origin. La cookie se limita a `/api/auth`, se configura Secure por entorno y no se devuelve en JSON.

## Invariantes de datos

1. Toda entidad operacional, incluidas auditorías y líneas hijas, lleva `tenant_id` explícito.
2. Toda referencia entre entidades tenant-scoped valida igualdad de tenant mediante FK compuesta.
3. Los IDs primarios continúan globalmente únicos; se añade unicidad `(tenant_id, id)` para las FKs compuestas.
4. Consultas polimórficas de auditoría incluyen tenant explícito y se validan en el servicio porque `entity_id` no tiene una FK relacional.
5. Las líneas de factura conservan sus datos históricos de producto como snapshot; su pertenencia se valida mediante su factura y tenant.
6. Roles personalizados son tenant-scoped; el catálogo de permisos es global.

## Clasificación del esquema PostgreSQL activo

El inventario se deriva de `schema.sql` (pg_dump de esquema, PostgreSQL 16.15) y se compara con `models.py` y Alembic. `tenant_id requerido` se refiere al modelo SaaS objetivo, no a la base actual.

Se mantiene el vocabulario `GLOBAL`, `TENANT-SCOPED`, `DERIVED/INDIRECT` y `PLATFORM`. No se clasifica ninguna tabla operacional actual como `DERIVED/INDIRECT`: incluso las tablas hijas que podrían inferir tenant por su padre reciben tenant directo para hacer verificables las FKs compuestas. `MIXED` se usa para la nueva tabla de membresías que une identidad global con tenant.

| Tabla | Scope objetivo | `tenant_id` | Motivo / relación | Riesgo de aislamiento |
|---|---|---:|---|---|
| `alembic_version` | PLATFORM | No | Estado de migraciones del backend legado, no dato de negocio. | Bajo; mantener separado del historial Flyway. |
| `users` | GLOBAL | No | Identidad y credenciales únicas globalmente; pertenencia por `tenant_memberships`. | Alto si se interpreta como membresía o se filtra por nombre desde UI. |
| `roles` | TENANT-SCOPED | Sí | Roles personalizados por cliente; composite key con tenant. El modelo actual los guarda globales. | Alto mientras los roles legacy no se reasignen. |
| `permissions` | GLOBAL | No | Catálogo de codenames de permisos de plataforma. | Bajo; no almacenar concesiones de usuario aquí. |
| `user_roles` | TENANT-SCOPED | Sí | Puente legacy que se migra a membresía+rol; cada grant queda ligado a tenant y rol. | Crítico si se conserva solo `(user_id, role_id)` al permitir roles por tenant. |
| `role_permissions` | TENANT-SCOPED | Sí | Concesiones de un rol tenant a permisos globales. | Alto si el rol no se valida en el mismo tenant. |
| `audit_events` | TENANT-SCOPED | Sí | Auditoría de acciones de usuarios y objetivos; tenant explícito. | Crítico: búsquedas globales o actor/target de otra membresía. |
| `catalog_audit_events` | TENANT-SCOPED | Sí | Auditoría polimórfica de cambios de catálogo; `entity_id` no tiene FK. | Crítico: IDs polimórficos colisionan/mezclan clientes. |
| `catalog_categories` | TENANT-SCOPED | Sí | Categorías pertenecen al menú del restaurante. | Alto; nombre debe ser único dentro del tenant, no global. |
| `catalog_products` | TENANT-SCOPED | Sí | Producto, categoría, precio y código pertenecen al tenant. | Crítico; validar categoría con FK compuesta. |
| `catalog_product_images` | TENANT-SCOPED | Sí | Imagen hereda producto; tenant directo facilita filtrado y FK compuesta. | Alto; validar imagen/producto mismo tenant y proteger referencias de archivo. |
| `catalog_product_price_history` | TENANT-SCOPED | Sí | Historial de precio pertenece al producto/tenant. | Alto; secuencia de versión debe ser por producto y tenant. |
| `dining_tables` | TENANT-SCOPED | Sí | Numeración y estado del salón son locales al restaurante. | Alto; nombre/número no global. |
| `table_sessions` | TENANT-SCOPED | Sí | Sesión transaccional ligada a mesa y mesero del tenant. | Crítico; índice de sesión OPEN debe incluir tenant. |
| `orders` | TENANT-SCOPED | Sí | Comandas ligadas a sesión de mesa y usuario. | Crítico; composite FKs con sesión/usuario. |
| `order_lines` | TENANT-SCOPED | Sí | Detalles hijos; conserva snapshot de producto pero referencia order tenant. | Crítico si el padre o producto es de otro tenant. |
| `order_cancellations` | TENANT-SCOPED | Sí | Anulación ligada a pedido y usuario responsable. | Alto; validar pedido y usuario del mismo tenant. |
| `ingredients` | TENANT-SCOPED | Sí | Existencias, costo y unidad son inventario del restaurante. | Crítico; no compartir balances. |
| `recipes` | TENANT-SCOPED | Sí | Receta y producto pertenecen al menú/inventario del tenant. | Alto; composite FK a producto. |
| `recipe_items` | TENANT-SCOPED | Sí | Composición de receta con ingrediente del mismo tenant. | Crítico; composite FKs a receta e ingrediente. |
| `inventory_movements` | TENANT-SCOPED | Sí | Movimiento físico trazable por ingrediente y usuario del tenant. | Crítico; cada referencia debe quedar en el tenant del ingrediente. |
| `kardex_entries` | TENANT-SCOPED | Sí | Libro histórico de movimientos del ingrediente. | Crítico; no permitir mezcla de saldos entre clientes. |
| `cash_registers` | TENANT-SCOPED | Sí | Caja y nombre operan en cada restaurante. | Alto; nombre único por tenant. |
| `cash_sessions` | TENANT-SCOPED | Sí | Turno depende de caja y cajero del tenant. | Crítico; índice de caja OPEN debe ser por tenant. |
| `payments` | TENANT-SCOPED | Sí | Pago depende de sesión de mesa, turno y cajero. | Crítico; las tres referencias deben coincidir en tenant. |
| `payment_details` | TENANT-SCOPED | Sí | Desglose monetario hijo del pago. | Alto; FK compuesta con pago. |
| `invoices` | TENANT-SCOPED | Sí | Factura, numeración y pago son del restaurante. | Crítico; número único por tenant y referencias compuestas. |
| `invoice_lines` | TENANT-SCOPED | Sí | Snapshot histórico ligado a factura; `product_id` actual no tiene FK. | Alto; validar tenant por factura, preservar snapshot. |
| `expense_categories` | TENANT-SCOPED | Sí | Catálogo de egresos local a tenant. | Medio; nombre único por tenant. |
| `expenses` | TENANT-SCOPED | Sí | Egreso y responsable pertenecen al tenant. | Alto; validar categoría/responsable por tenant. |
| `restaurant_settings` | TENANT-SCOPED | Sí | Configuración de restaurante; no configuración global de SaaS. | Alto; `key` debe ser único dentro del tenant. |

## Tablas nuevas objetivo

| Tabla | Clasificación | `tenant_id` | Regla |
|---|---|---:|---|
| `tenants` | PLATFORM | No | Registro raíz, `id` UUID, slug único, nombre y estado. |
| `plans` | PLATFORM | No | Catálogo global de planes/capacidades. |
| `subscriptions` | PLATFORM | Sí | Suscripción de plataforma para un tenant; no se usa como autorización de acceso a sus datos. |
| `tenant_memberships` | MIXED | Sí | Puente de usuario global a tenant: unique `(tenant_id,user_id)`, alias tenant-local y estado. |

Las entidades de reportes/analytics no son tablas actuales; son proyecciones y consultas tenant-scoped. Deben derivar el tenant del contexto y agregarlo a cada query.
