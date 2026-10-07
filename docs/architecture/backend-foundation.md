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

El login y la emisión/rotación de tokens, el flujo refresh-cookie y la administración de usuarios quedan fuera de este incremento. Si se incorpora refresh por cookie posteriormente, debe habilitarse protección CSRF para esa operación, siguiendo el patrón existente de FastAPI.

## Repositorios y acceso a datos por tenant

`TenantScopedRepository<T, ID>` no hereda `CrudRepository`/`JpaRepository` y por ello no expone lecturas genéricas por ID ni listados sin tenant. Sus métodos requieren `tenant_id` junto con la clave (`findByIdAndTenantId`, `findAllByTenantId`). Los servicios obtienen ese valor mediante `TenantContext`; no deben recibirlo de DTOs. `CatalogCategoryService` aplica el patrón y sus operaciones requieren además el permiso de lectura del catálogo. Las escrituras de futuras entidades deben fijar el tenant desde `TenantContext`, comprobar tenant inmutable y conservar las FK compuestas del DDL.

El incremento se verificó con 17 pruebas unitarias y MVC focalizadas (JWT, endpoint protegido, membresía, roles/permisos y selección tenant-aware), todas aprobadas. `SaasApiApplicationTests` contiene pruebas HTTP con PostgreSQL/Testcontainers para la integración real de JWT, roles/permisos y aislamiento de categorías; no se ejecutaron para evitar crear contenedores. Esta diferencia de evidencia se conserva como gate predespliegue, junto con Flyway, inicio de Spring Boot y `/actuator/health`.

## Flyway y seguridad operacional

`V1__create_platform_foundation.sql` crea las tablas `tenants`, `plans` y `subscriptions`. `V2__create_tenant_scoped_business_schema.sql` define el esquema funcional reconstruido con tenancy desde su creación, excluyendo únicamente `alembic_version`; no copia datos del dump. Ambas migraciones se destinan a una base vacía. La configuración activa `clean-disabled=true` y `baseline-on-migrate=false`.

### Estado de validación — 2026-10-07

**DDL V2 VALIDADO — integración Flyway/Spring Boot pendiente por infraestructura.**

V1 y V2 se ejecutaron directamente con `psql` en PostgreSQL 16.15, dentro de la base aislada `trifood_v2_validation`. Tras corregir el orden de declaración de dos FK, ambas terminaron correctamente. Se verificaron PK, FK, `NOT NULL`, UNIQUE, índices y las restricciones de actor por tenant. La base de validación aislada fue eliminada al terminar; `potoquitos` no fue modificada.

En esta comprobación se confirmó que Java 21.0.11 y Maven 3.9.16 están disponibles localmente. `mvn -DskipTests package` terminó con `BUILD SUCCESS` y `SaasJwtAuthenticationConverterTests` pasó sus 4 pruebas (0 fallos). No se ejecutó la prueba de integración `SaasApiApplicationTests`: usa Testcontainers y esta validación no debe crear ni recrear contenedores. La conexión directa local a `127.0.0.1:5432` tampoco está disponible para la aplicación: PostgreSQL respondió `fe_sendauth: no password supplied`; además, el contenedor PostgreSQL existente no publica el puerto 5432 al host. No se intentó resolverlo mediante operaciones Docker ni se usaron credenciales almacenadas.

Por lo tanto, **no se afirma** que Flyway haya detectado/aplicado V1 y V2 mediante Spring Boot, que Spring Boot haya arrancado conectado a PostgreSQL ni que `/actuator/health` haya respondido `UP`. La prueba de integración con Flyway y PostgreSQL limpio sigue siendo un requisito pendiente antes de despliegue. La prueba de esquema espera ahora 30 columnas `tenant_id NOT NULL`, consistente con el inventario validado (incluida `subscriptions.tenant_id`).

Una instalación local debe crear y configurar una base de desarrollo SaaS distinta. No se debe habilitar Flyway apuntando a `potoquitos`; cualquier estrategia de migración de la base actual se diseña y aprueba separadamente. La integración de Spring Boot + Flyway sobre PostgreSQL limpio y el health endpoint sigue siendo un gate pendiente obligatorio antes del despliegue, pero no bloquea el desarrollo local de módulos.

## Construcción

`backend/springboot/Dockerfile` construye un JAR con Maven y Java 21 en una etapa builder y lo ejecuta con una imagen JRE como usuario no privilegiado. La composición Docker actual no se modifica en esta fase.
