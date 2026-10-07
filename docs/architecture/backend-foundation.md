# Fundación del backend SaaS — Spring Boot

## Alcance y coexistencia

La implementación nueva vive en `backend/springboot/`. No comparte proceso, artefactos de build ni rutas con `backend/fastapi_app/`; el backend FastAPI y el frontend React permanecen intactos. No se migra ningún endpoint o flujo de negocio en esta fase.

La nueva aplicación usa por defecto una base de desarrollo separada (`potoquitos_saas`) y Flyway permanece deshabilitado por defecto. Las migraciones `V1` y `V2` están destinadas exclusivamente a una base nueva; nunca se deben ejecutar sobre la base operativa `potoquitos`.

## Stack fijado

| Componente | Selección |
|---|---|
| Java | 21 |
| Spring Boot | 3.5.6 |
| Web | Spring MVC |
| Persistencia | Spring Data JPA / Hibernate |
| Seguridad | Spring Security Resource Server, JWT HS256 |
| Hash de contraseñas | BCrypt |
| Base de datos | PostgreSQL |
| Versionado | Flyway |
| Validación | Jakarta Bean Validation |
| OpenAPI | springdoc-openapi 2.8.13 |
| Health/metrics | Spring Boot Actuator |
| Pruebas PostgreSQL | JUnit 5 + Testcontainers |

## Módulos y límites

El package raíz es `com.potoquitos.saas`. Los paquetes `shared`, `platform`, `auth`, `users`, `catalog`, `tables`, `orders`, `kitchen`, `inventory`, `cash`, `payments`, `expenses`, `reports`, `analytics` y `settings` establecen límites funcionales. `shared`, `platform` y `auth` alojan la infraestructura transversal; `catalog` contiene una lectura inicial de categorías como ejemplo concreto del patrón tenant-aware. Los demás módulos permanecen reservados, sin lógica de negocio.

La capa `shared` aloja contexto request-scoped, principal autenticado, configuración común y errores transversales. `platform` aloja entidades de tenant, planes y suscripciones. `auth` configura JWT, BCrypt, CORS, membresías y Spring Security. `catalog` sirve de ejemplo de consulta protegida por permiso y aislamiento en el repositorio.

## Configuración

La configuración se externaliza mediante variables de entorno documentadas en `backend/springboot/.env.example`. No se versionan secretos reales. Hibernate tiene `ddl-auto=none`; Flyway requiere habilitación explícita (`FLYWAY_ENABLED=true`). El datasource por defecto no apunta a la base actual.

Actuator expone health solamente. En una conexión de PostgreSQL, el indicador de salud incluye el check JDBC de Spring Boot.

## Flujo JWT y tenant

El Resource Server valida firma HS256, expiración y formato de claims. El contrato de identidad es:

- `user_id`: entero positivo
- `tenant_id`: UUID de un tenant
- `sub`: identificador de sujeto compatible con `user_id`

`sub` debe coincidir con `user_id`. No incluir contraseña, hash, correo, refresh token, secretos o detalles de autorización innecesarios. El conversor no concede authorities a partir del token. Después de validar la firma, el filtro consulta `tenant_memberships`, `users` y `tenants` y exige que la membresía, el usuario y el tenant estén activos. Las roles y permissions efectivas se cargan desde `user_roles`, `roles`, `role_permissions` y `permissions`; los claims `roles` del JWT se ignoran para autorizar. Cada petición ve revocaciones y cambios de permisos en la siguiente solicitud.

Las autoridades usan los prefijos `ROLE_` y `PERMISSION_`. Spring Security protege toda ruta salvo health y documentación OpenAPI; la seguridad de método está habilitada. `GET /api/auth/me` demuestra identidad, tenant y authorities autenticados. `GET /api/catalog/categories` exige `PERMISSION_catalog.categories.read` y filtra las filas con el tenant resuelto. El tenant nunca se toma de headers, query parameters ni payloads.

## Inicio de sesión, sesiones y administración de acceso

El detalle de protocolo, endpoints y modelo de amenaza está en [Autenticación y autorización SaaS](./authentication-and-authorization.md).

`POST /api/auth/login` valida username/password y selecciona un tenant solo entre las memberships activas del usuario. Si hay más de una membership y no se envía un `tenantSlug` selector, responde `400 tenant_selection_required`; el slug no es autoridad y se vuelve a validar en PostgreSQL. El usuario inactivo, el tenant suspendido, la membership inactiva o las credenciales incorrectas producen una respuesta genérica `401`.

El access token HS256 incluye únicamente `sub`, `user_id`, `tenant_id`, `token_version`, `iat`, `exp` e `iss`. No incluye permisos como fuente de autorización. En cada petición bearer, el filtro vuelve a validar usuario/tenant/membership y carga los permisos actuales desde las tablas RBAC.

La respuesta entrega el access token JSON y coloca el refresh token opaco en cookie `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`; la cookie CSRF de doble envío es legible por el frontend. `POST /api/auth/refresh` requiere la cookie CSRF, el header `X-CSRF-TOKEN` coincidente y un `Origin` permitido. Los refresh tokens se persisten únicamente como SHA-256, expiran según `REFRESH_TOKEN_TTL` y se rotan con bloqueo de fila; el uso repetido revoca la familia completa. `POST /api/auth/logout` revoca la familia y limpia ambas cookies. La cookie `Secure` se controla con `AUTH_COOKIE_SECURE` (deshabilitarlo solo en desarrollo local).

La migración aditiva V3 incorpora perfil visible por membership y `refresh_sessions`; no modifica V1/V2 ni copia datos. Los endpoints `/api/users`, `/api/tenant-memberships`, `/api/roles` y `/api/permissions` realizan consultas acotadas al `TenantContext`. El perfil y activación administrables son los de la membership: no se cambia la identidad global ni el estado global de un usuario desde otro tenant. Los usernames/emails nuevos se normalizan a minúsculas; las contraseñas se almacenan con BCrypt y no se exponen en respuestas.

Los endpoints administrativos exigen authorities explícitas: `users.read`, `users.create`, `users.update`, `users.memberships.manage`, `users.roles.assign`, `roles.read` y `roles.manage`. Las concesiones provienen de `user_roles`, `roles`, `role_permissions` y `permissions` del tenant autenticado. Los IDs de usuario/rol de la ruta se verifican dentro de ese tenant, y el cliente nunca proporciona un `tenant_id` para seleccionar el ámbito.

Para evitar dejar un tenant sin administrador, cambios de permisos que puedan retirar `roles.manage` bloquean y serializan la fila del tenant; se rechaza suspender/revocar la última membership administradora, quitar su único grant de rol o eliminar `roles.manage` del último rol activo.

El bootstrap inicial se realiza una sola vez mediante `com.potoquitos.saas.users.BootstrapTenantApplication`, que habilita Flyway, crea tenant, primer usuario, membership, rol administrador y grants en una transacción, y se niega a correr si ya hay usuarios o tenants. Sus valores se suministran por variables `TRIFOOD_BOOTSTRAP_*`; no se crea un endpoint de bootstrap ni se imprimen credenciales. Ejecutarlo únicamente en una base SaaS nueva, nunca en `potoquitos`.

## Repositorios y acceso a datos por tenant

`TenantScopedRepository<T, ID>` no hereda `CrudRepository`/`JpaRepository` y por ello no expone lecturas genéricas por ID ni listados sin tenant. Sus métodos requieren `tenant_id` junto con la clave (`findByIdAndTenantId`, `findAllByTenantId`). Los servicios obtienen ese valor mediante `TenantContext`; no deben recibirlo de DTOs. `CatalogCategoryService` aplica el patrón y sus operaciones requieren además el permiso de lectura del catálogo. Las escrituras de futuras entidades deben fijar el tenant desde `TenantContext`, comprobar tenant inmutable y conservar las FK compuestas del DDL.

La suite focalizada del incremento de identidad contiene 42 pruebas aprobadas: login, emisión/expiración JWT, refresh (rotación, expiración y reutilización), hash de contraseña, CSRF, aislamiento tenant-aware, protección por permisos y regresiones de TenantContext/JWT/catálogo. `SaasApiApplicationTests` requiere PostgreSQL/Testcontainers y no se ejecutó; tampoco se inició Spring Boot conectado a base. Estos puntos no se afirman como validados.

## Flyway y seguridad operacional

`V1__create_platform_foundation.sql` crea las tablas `tenants`, `plans` y `subscriptions`. `V2__create_tenant_scoped_business_schema.sql` define el esquema funcional reconstruido con tenancy desde su creación, excluyendo únicamente `alembic_version`; no copia datos del dump. `V3__identity_access_and_refresh_sessions.sql` añade soporte de perfil tenant-local y refresh rotatorio. Las migraciones se destinan a una base SaaS nueva. La configuración activa `clean-disabled=true` y `baseline-on-migrate=false`.

### Estado de validación — 2026-10-07

**DDL V2 VALIDADO — integración Flyway/Spring Boot pendiente por infraestructura.**

V1 y V2 se ejecutaron directamente con `psql` en PostgreSQL 16.15, dentro de la base aislada `trifood_v2_validation`. Tras corregir el orden de declaración de dos FK, ambas terminaron correctamente. Se verificaron PK, FK, `NOT NULL`, UNIQUE, índices y las restricciones de actor por tenant. La base de validación aislada fue eliminada al terminar; `potoquitos` no fue modificada.

En esta comprobación se confirmó que Java 21.0.11 y Maven 3.9.16 están disponibles localmente. `mvn -DskipTests package` terminó con `BUILD SUCCESS` y `SaasJwtAuthenticationConverterTests` pasó sus 4 pruebas (0 fallos). No se ejecutó la prueba de integración `SaasApiApplicationTests`: usa Testcontainers y esta validación no debe crear ni recrear contenedores. La conexión directa local a `127.0.0.1:5432` tampoco está disponible para la aplicación: PostgreSQL respondió `fe_sendauth: no password supplied`; además, el contenedor PostgreSQL existente no publica el puerto 5432 al host. No se intentó resolverlo mediante operaciones Docker ni se usaron credenciales almacenadas.

Por lo tanto, **no se afirma** que Flyway haya detectado/aplicado V1, V2 o V3 mediante Spring Boot, que Spring Boot haya arrancado conectado a PostgreSQL ni que `/actuator/health` haya respondido `UP`. La prueba de integración con Flyway y PostgreSQL limpio sigue siendo un requisito pendiente obligatorio antes del despliegue. La prueba de esquema espera ahora 30 columnas `tenant_id NOT NULL`, consistente con el inventario validado (incluida `subscriptions.tenant_id`).

Una instalación local debe crear y configurar una base de desarrollo SaaS distinta. No se debe habilitar Flyway apuntando a `potoquitos`; cualquier estrategia de migración de la base actual se diseña y aprueba separadamente. La integración de Spring Boot + Flyway sobre PostgreSQL limpio y el health endpoint sigue siendo un gate pendiente obligatorio antes del despliegue, pero no bloquea el desarrollo local de módulos.

## Construcción

`backend/springboot/Dockerfile` construye un JAR con Maven y Java 21 en una etapa builder y lo ejecuta con una imagen JRE como usuario no privilegiado. La composición Docker actual no se modifica en esta fase.
