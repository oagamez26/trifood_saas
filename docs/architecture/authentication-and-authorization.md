# Autenticación y autorización SaaS

## Identidad y tenant

`POST /api/auth/login` acepta username, contraseña y, opcionalmente, `tenantSlug`. Las credenciales se comprueban antes de resolver memberships. Si no se especifica tenant, el servidor infiere el tenant solo cuando existe exactamente una membership activa; cuando hay más de una, devuelve `400 tenant_selection_required`. El slug es un selector no confiable: la aplicación consulta la relación activa en PostgreSQL y solo entonces emite el token. Credenciales incorrectas, usuario inactivo, tenant inactivo o falta de membership no revelan cuál condición falló.

El JWT HS256 contiene identidad, no autorización:

```json
{
  "iss": "trifood",
  "sub": "123",
  "user_id": 123,
  "tenant_id": "UUID validado",
  "token_version": 0,
  "iat": "emisión",
  "exp": "expiración"
}
```

No contiene contraseña, hash, refresh token ni permisos confiables. En cada petición bearer se valida firma/expiración, correspondencia `sub`/`user_id`, estado activo de usuario/tenant/membership y la versión del token. Después, authorities efectivas se consultan desde `tenant_memberships`, `user_roles`, `roles`, `role_permissions` y `permissions`. Ninguna autoridad `ROLE_*` o `PERMISSION_*` del JWT concede acceso.

## Access y refresh

El access token se devuelve en JSON; su vigencia se configura en `ACCESS_TOKEN_TTL` (15 minutos por defecto). El refresh token es opaco, aleatorio y se entrega en cookie `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`. En PostgreSQL se conserva solo su SHA-256, con expiración, familia y relación a `(tenant_id, user_id)` de la membership.

`POST /api/auth/refresh` requiere:

1. Cookie de refresh válida y no expirada.
2. Cookie legible `trifood-csrf` y header `X-CSRF-TOKEN` con valores iguales.
3. `Origin` exacto incluido en `CORS_ALLOWED_ORIGINS`.
4. Usuario, tenant y membership todavía activos.

La sesión actual se bloquea con `SELECT ... FOR UPDATE`, se revoca y se reemplaza de forma transaccional. El mismo refresh token no puede utilizarse dos veces: al detectar reutilización se revoca toda su familia. La expiración/revocación devuelve una respuesta genérica `401` y limpia cookies. `POST /api/auth/logout` revoca la familia asociada y limpia cookies. Ajustar `AUTH_COOKIE_SECURE=true` en producción; solo usar `false` para desarrollo local HTTP.

## TenantContext, memberships y RBAC

El filtro de Spring Security recalcula roles y permisos antes de la ejecución MVC. El interceptor copia ese principal autorizado a un `TenantContext` request-scoped, y los servicios de administración obtienen de ahí el tenant y actor. Las rutas públicas `/api/auth/login`, `/api/auth/refresh` y `/api/auth/logout` se excluyen deliberadamente del interceptor porque no requieren un tenant autenticado; `/api/auth/me` sí lo requiere.

Las identidades de `users` son globales y username/email se crean normalizados a minúsculas. El perfil visible y la activación administrable desde esta API son propios de `tenant_memberships`; no se modifica el perfil global ni se permite que una organización active/desactive la identidad en los demás tenants. Los hashes de BCrypt nunca se incluyen en DTOs.

| Operación | Permiso |
|---|---|
| `GET /api/users`, `GET /api/users/{userId}`, `GET /api/tenant-memberships[/{userId}]` | `users.read` |
| `POST /api/users` | `users.create` |
| `POST /api/tenant-memberships` | `users.memberships.manage` |
| `PATCH /api/tenant-memberships/{userId}` | `users.update` |
| `DELETE /api/tenant-memberships/{userId}` | `users.memberships.manage` |
| `GET /api/roles`, `GET /api/permissions` | `roles.read` |
| `POST /api/roles`, `PUT /api/roles/{roleId}/permissions` | `roles.manage` |
| `PUT/DELETE /api/users/{userId}/roles/{roleId}` | `users.roles.assign` |

Todas las operaciones tenant-scoped consultan con el tenant del contexto; ni payloads ni query parameters pueden seleccionar otro tenant. Antes de asignar roles se comprueba que usuario y rol pertenezcan al tenant actual y las FK compuestas de PostgreSQL vuelven a imponer esa relación.

Las operaciones que podrían retirar el permiso `roles.manage` serializan los cambios por fila de tenant y se rechazan con `409` si dejarían al tenant sin un usuario/membership activo que conserve ese permiso. Esto aplica a suspender/revocar una membership, revocar su role grant y reemplazar permisos de un rol.

## Bootstrap inicial

La clase `com.potoquitos.saas.users.BootstrapTenantApplication` ofrece un proceso CLI de una sola ejecución para una base SaaS nueva. Flyway se habilita durante el arranque; el comando crea tenant, identidad del primer administrador, membership, rol `TENANT_ADMIN` y grants para el catálogo de permisos dentro de una transacción. Falla si ya hay tenants o usuarios, valida el destino PostgreSQL y rechaza explícitamente una base cuyo nombre sea `potoquitos`. Los valores se pasan mediante `TRIFOOD_BOOTSTRAP_TENANT_SLUG`, `TRIFOOD_BOOTSTRAP_TENANT_NAME`, `TRIFOOD_BOOTSTRAP_USERNAME`, `TRIFOOD_BOOTSTRAP_EMAIL`, `TRIFOOD_BOOTSTRAP_PASSWORD`, `TRIFOOD_BOOTSTRAP_FIRST_NAME` y `TRIFOOD_BOOTSTRAP_LAST_NAME`. Proveerlos desde un gestor de secretos o entorno protegido; nunca guardar credenciales reales en `.env.example`.

## Evidencia y límite actual

Hay una suite focalizada de 42 pruebas aprobadas que cubre login, emisión/expiración JWT, rotación/expiración/reutilización de refresh, BCrypt, CSRF, aislamiento de operaciones por contexto tenant, control de permisos MVC y protección del destino de bootstrap. La suite con PostgreSQL/Testcontainers y la integración del motor Flyway con Spring Boot aún no se ejecutaron. El bootstrap, las migraciones y `/actuator/health` requieren validación real en una base SaaS aislada antes del despliegue.
