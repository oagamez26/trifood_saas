# Trifood — handoff para el siguiente agente

**Corte documental:** 2026-10-07  
**Propósito:** entregar contexto, evidencia y límites de trabajo a otro agente.  
**Alcance de este handoff:** documentación únicamente. No modifica código de
aplicación, base de datos, migraciones ni arquitectura.

## 1. Objetivo del proyecto

Trifood es la evolución SaaS multi-tenant del POS existente de Potoquitos. No es
un POS genérico desarrollado desde cero: se deben migrar gradualmente sus flujos
y reglas de negocio, añadiendo aislamiento por tenant y capacidades de
plataforma.

Potoquitos será solamente el primer tenant. Debe usar las mismas reglas de
negocio que los demás tenants. No puede haber ramas del tipo
`if tenant == "Potoquitos"` ni reglas equivalentes basadas en nombre, slug o ID.
Las diferencias propias de cada restaurante se resuelven mediante datos y
configuración del tenant.

El dato de desarrollo actual puede descartarse para el destino nuevo. Eso no
autoriza a descartar ni simplificar el esquema, relaciones, restricciones,
historiales o reglas funcionales del POS vigente. La estructura destino y su
comportamiento deben preservar el contrato funcional observado; cualquier
cambio intencional debe quedar identificado y aprobado.

## 2. Stack

### Stack actual del POS

- React + TypeScript.
- Python + FastAPI.
- PostgreSQL.
- SQLAlchemy.
- Alembic.
- Docker/Docker Compose en desarrollo y despliegue actual.

### Stack objetivo Trifood

- Angular + TypeScript.
- Java 21.
- Spring Boot 3.
- PostgreSQL.
- Spring Data JPA/Hibernate.
- Flyway.
- Spring Security y JWT.
- OpenAPI.
- JUnit, Mockito y Testcontainers.
- Docker.
- CI/CD.

En el backend nuevo, el POM declara Spring Boot 3.5.6, Java 21 y springdoc
2.8.13. La presencia de dependencias o estructura no implica que cada ruta o
módulo objetivo esté implementado ni que su integración esté validada.

## 3. Arquitectura y principios no negociables

- Modular monolith; no introducir microservicios.
- Shared database / shared schema para el objetivo inicial.
- Las tablas operativas tenant-scoped llevan `tenant_id`.
- `TenantContext` se deriva de identidad autenticada validada.
- JWT identifica usuario y tenant; no es una fuente confiable de permisos.
- RBAC efectivo se obtiene del modelo persistido de memberships, roles y
  permisos.
- Repositorios y relaciones deben ser tenant-aware. Las FKs compuestas
  `(tenant_id, id)` se usan para impedir relaciones entre tenants.
- Nunca confiar en `tenant_id` enviado por el frontend, query string o header.
- Mantener lógica, estados, validaciones, transacciones, cálculos e historial del
  POS actual. No reemplazarlos por CRUDs genéricos.
- FastAPI, React, Alembic y la base actual permanecen separados e intactos
  hasta que exista una decisión de cutover aprobada.

Ver también [ADR-001](../adr/ADR-001-multi-tenant-shared-schema.md),
[ADR-002](../adr/ADR-002-tenant-isolation-strategy.md) y
[tenant-isolation.md](../architecture/tenant-isolation.md).

## 4. Estado del backend Spring y de V1, V2 y V3

El backend nuevo está en `backend/springboot/`, separado del FastAPI. Flyway
permanece deshabilitado por defecto (`FLYWAY_ENABLED=true` es opt-in), Hibernate
usa `ddl-auto=none` y el datasource de ejemplo no debe apuntar a `potoquitos`.
V1–V3 son para una base SaaS nueva y vacía.

| Migración | Contenido implementado en el repositorio | Evidencia de validación disponible | Pendiente |
|---|---|---|---|
| V1 `V1__create_platform_foundation.sql` | `tenants`, `plans` y `subscriptions`. | La documentación de estado con fecha 2026-10-07 registra ejecución directa de V1 mediante `psql` contra PostgreSQL 16.15 en la base aislada `trifood_v2_validation`. | Ejecución y detección por el motor Flyway de Spring Boot; prueba de arranque conectada a PostgreSQL. |
| V2 `V2__create_tenant_scoped_business_schema.sql` | Reconstrucción tenant-scoped de las tablas funcionales; incluye `tenant_id`, memberships, constraints e índices; excluye `alembic_version`; no copia datos. | La documentación de estado registra ejecución directa de V2 mediante `psql` en la misma base aislada, tras corregir el orden de dos FK. Registra verificación de PK, FK, `NOT NULL`, UNIQUE, índices y restricciones de actores. Esto valida DDL contra PostgreSQL, **no** Flyway de Spring Boot. | Ejecutar por Flyway desde Spring Boot contra base limpia; verificar mapping/JPA, arranque y health. |
| V3 `V3__identity_access_and_refresh_sessions.sql` | Añade nombres visibles tenant-locales, `refresh_sessions` con hash, expiración/familia/reemplazo y permisos base. | El SQL está presente en el repositorio y descrito por la documentación de arquitectura. No se encontró evidencia de que V3 se haya aplicado a PostgreSQL ni ejecutado mediante Flyway. | Validar sintaxis y aplicación a PostgreSQL desechable, constraints, integración de login/rotación/revocación con V3 y arranque completo. |

La base `trifood_v2_validation` se usó para la validación DDL descrita y fue
eliminada al terminar, según el registro documental. `potoquitos` no se modificó.
No se debe asumir que la base de validación aún existe.

**Pendiente obligatorio antes del despliegue:** validar Flyway + Spring Boot +
PostgreSQL limpio, detección/aplicación de todas las migraciones requeridas,
integridad JPA, inicio de la aplicación y `/actuator/health` con estado `UP`.
Esta tarea no debe bloquear el desarrollo de módulos. No intentar resolverla
mediante recreación repetida de contenedores ni cambios al PostgreSQL existente.

**No validado:** aplicación/detección de V1–V3 por Flyway desde Spring Boot,
arranque de Spring Boot conectado a PostgreSQL, validación JPA sobre el esquema
aplicado por Flyway, `/actuator/health = UP` y pruebas de integración
PostgreSQL/Testcontainers. Las pruebas Testcontainers no se completaron: tuvieron
bloqueos de infraestructura Docker. No afirmar que Testcontainers está
funcionando ni que la integración está aprobada.

### Conflicto de documentación a tener presente

`docs/database/tenant-schema-rebuild.md` conserva un texto histórico que dice
que V2 no fue validada y que el empaquetado pasó con solo cuatro pruebas del
conversor JWT. `docs/architecture/backend-foundation.md`, con sección de estado
fechada 2026-10-07, registra después la validación DDL aislada V1/V2 y que 42
pruebas focalizadas pasaron, pero también confirma que Spring Boot/Flyway,
PostgreSQL/Testcontainers y `/actuator/health` no se validaron juntos.

Tomar como estado más reciente el segundo registro para la validación DDL y las
42 pruebas; conservar explícitamente el límite de integración pendiente. Los
recuentos anteriores de 4 y 17 pruebas corresponden a hitos/suites anteriores,
no son un fallo de las 42 posteriores. Este handoff no volvió a ejecutar Maven,
JUnit ni Testcontainers: la cifra 42 se reporta como evidencia documentada, no
como resultado repetido en esta tarea.

Las 42 pruebas focalizadas son evidencia de las suites unitarias/MVC descritas;
no incluyen una integración PostgreSQL/Testcontainers exitosa ni demuestran
Flyway, el arranque conectado a la base o health.

## 5. Estado de autenticación y autorización

La implementación documentada y presente en `backend/springboot` incluye:

- **Login:** `POST /api/auth/login`. Valida credenciales, estado global del
  usuario, tenant y membership. Un `tenantSlug` opcional solo selecciona una
  membership candidata que el servidor vuelve a validar. Si no se indica y hay
  más de una membership activa, requiere selección. Las respuestas de
  credenciales/estados inválidos no deben revelar cuál condición falló.
- **Access JWT:** HS256, con identidad (`sub`, `user_id`), `tenant_id` validado,
  `token_version`, issuer, emisión y expiración. No contiene contraseña, hash,
  refresh token ni permisos autorizantes. El conversor no concede authorities
  desde claims `roles`.
- **Refresh:** `POST /api/auth/refresh`. El token de refresh es opaco y
  aleatorio; se entrega en cookie `HttpOnly`, `SameSite=Strict`, limitada a
  `/api/auth`. En la base se almacena SHA-256, no el secreto en claro; incluye
  expiración, familia y relación a membership. La rotación bloquea la sesión
  actual con `SELECT ... FOR UPDATE`, revoca y reemplaza transaccionalmente.
  Reutilizar un token revocado invalida su familia.
- **CSRF:** cookie de doble envío `trifood-csrf`, header `X-CSRF-TOKEN`, igualdad
  de valores y validación exacta de `Origin` contra `CORS_ALLOWED_ORIGINS` para
  refresh. La cookie de refresh usa `Secure` por configuración; en producción
  se debe activar `AUTH_COOKIE_SECURE=true`.
- **Logout:** `POST /api/auth/logout`; revoca la familia asociada y limpia las
  cookies. Si existe cookie de refresh, logout también exige CSRF válido.
- **Usuario actual:** `GET /api/auth/me`; devuelve user ID, tenant ID, roles y
  permisos efectivos.
- **Spring Security:** valida firma/expiración/claims, usuario y estados activos
  de tenant y membership en cada request protegida. El filtro recalcula las
  authorities desde la base de datos.
- **TenantContext:** request-scoped, copiado del principal autenticado por
  interceptor. Las rutas públicas de autenticación se excluyen; las rutas de
  negocio requieren principal. Los servicios usan `TenantContext` para fijar el
  tenant y actor.
- **RBAC:** permissions globales; roles, grants y memberships asociados al
  tenant según el diseño actual. Authorities efectivas salen de
  `tenant_memberships`, `user_roles`, `roles`, `role_permissions` y
  `permissions`. Los roles/permissions incluidos por el cliente o JWT no son
  autoridad.
- **Contraseñas:** BCrypt; respuestas DTO no devuelven hashes.

### Endpoints existentes en el backend nuevo

**Autenticación**

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Usuarios y memberships**

- `GET /api/users`, `GET /api/users/{userId}`
- `POST /api/users`
- `GET /api/tenant-memberships`, `GET /api/tenant-memberships/{userId}`
- `POST /api/tenant-memberships`
- `PATCH /api/tenant-memberships/{userId}`
- `DELETE /api/tenant-memberships/{userId}` (revocación)

**Roles y permisos**

- `GET /api/roles`, `POST /api/roles`
- `GET /api/permissions`
- `PUT /api/roles/{roleId}/permissions`
- `PUT /api/users/{userId}/roles/{roleId}`
- `DELETE /api/users/{userId}/roles/{roleId}`

Los endpoints administrativos tienen permisos explícitos (`users.read`,
`users.create`, `users.update`, `users.memberships.manage`,
`users.roles.assign`, `roles.read`, `roles.manage`). El servicio filtra por
tenant del contexto y valida que target user/membership y role pertenecen al
mismo tenant. Cambios que puedan dejar el tenant sin administrador se
serializan/rechazan si retirarían el último `roles.manage`.

**Catálogo Spring implementado hasta ahora**

- `GET /api/catalog/categories`, protegido por
  `catalog.categories.read`, usa `TenantContext` y `TenantScopedRepository`.
- Es solo una lectura de ejemplo. No equivale a migrar el módulo de catálogo ni
  implementa su CRUD/reglas completas.
- No se implementaron todavía los endpoints Spring equivalentes a creación y
  edición de productos/categorías, disponibilidad, precios, imágenes, menú
  público, recetas o auditoría funcional completa.

## 6. Estado de multi-tenancy y autorización

Implementado/documentado en el backend nuevo:

- `TenantContext` request-scoped.
- Tenant resuelto a partir de JWT validado y membership activa; nunca de un
  `tenant_id` suministrado por el cliente.
- `TenantScopedRepository` no expone `findById` ni `findAll` genéricos sin
  tenant; las operaciones requieren tenant e ID o tenant para listar.
- `tenant_memberships`, validación de usuario/tenant/membership activos.
- Authorities leídas desde RBAC persistido en cada request.
- Administración de usuarios/memberships y asignación/revocación de roles dentro
  del tenant autenticado.
- Constraints compuestas tenant-aware en V2 para proteger relaciones además de
  los filtros de aplicación.

La prueba automatizada de dos tenants en PostgreSQL/Testcontainers y la
validación end-to-end de esas constraints con la aplicación siguen pendientes.
Las pruebas focalizadas unitarias/MVC reportadas demuestran comportamiento de
servicios/filtros, no sustituyen la prueba relacional en PostgreSQL.

No asumir que `TenantContext` garantiza por sí solo aislamiento: revisar cada
consulta nueva, flujo async, acceso por ID, relaciones y escritura; la base debe
ser una segunda barrera con FKs compuestas.

## 7. Estado de la migración del catálogo

La migración funcional Spring del catálogo **no está implementada**. Existe un
análisis preliminar y el documento
[potoquitos-postgres-catalog-baseline.md](./potoquitos-postgres-catalog-baseline.md)
con procedencia, matriz de fuentes, reglas observadas y decisiones pendientes.
Antes de diseño/implementación debe usarse evidencia nueva de PostgreSQL y
reconfirmar la matriz con las fuentes vivas.

Reglas y hechos conocidos que el módulo destino debe conservar:

- **Categorías:** nombre normalizado (`lower(trim(name))`) único en la base
  legacy; descripción, `is_active`, `display_order` y timestamps. Se
  desactivan; no se observó borrado físico por endpoint. Producto nuevo o cambio
  de categoría requiere categoría activa.
- **Productos:** código interno, nombre, descripción, precio COP, categoría,
  porciones recomendadas opcionales, `is_active`, `is_available`, imagen actual,
  timestamps y versión de precio. Código se recorta y normaliza a mayúsculas;
  unicidad normalizada `upper(trim(internal_code))`. La UI impide editarlo en el
  flujo normal, pero el schema FastAPI permite actualizarlo: no declarar
  inmutabilidad hasta resolver la discrepancia.
- **Precio:** `numeric(12,2)`, no negativo, moneda COP y versión positiva. El
  primer precio registra versión 1 con precio previo nulo. El cambio usa
  `expected_price_version`; el mismo precio no crea versión nueva y una versión
  obsoleta produce conflicto. Actualización, historial y auditoría forman una
  operación atómica.
- **Historial:** único por `(product_id, price_version)` en el POS legacy;
  incluye precio anterior/nuevo, currency, actor y fecha.
- **Disponibilidad:** `is_active` e `is_available` son diferentes. Para pedidos
  se requiere producto activo/disponible y categoría activa. La ruta del menú
  público filtra activo/categoría activa pero puede incluir `is_available=false`;
  la UI actual muestra una insignia “Disponible” fija. No añadir una bandera
  “publicado” nueva sin requisito.
- **Imágenes:** referencia de archivo, no blob; máximo una imagen actual por
  producto con índice único parcial. Validación del servidor de JPEG/PNG/WebP,
  tamaño/dimensiones y rechazo de animación; si falla SQL, se compensa el
  archivo cargado. Hay discrepancia entre cascadas del ORM y FKs del dump vivo.
- **Auditoría:** `catalog_audit_events.actor_user_id` es `NOT NULL` en la base
  viva; evento incluye tipo/ID de entidad, acción, details opcional y timestamp.
  La referencia polimórfica de entidad no tiene FK directa.
- **Actores:** `catalog_product_price_history.changed_by` también es `NOT NULL`
  en PostgreSQL vivo. Ambos FKs de actor no declaran `ON DELETE SET NULL`, en
  contraste con SQLAlchemy activo.
- **Menú público:** inclusión actual basada en producto activo y categoría
  activa, distinta del estado de disponibilidad. La marca Potoquitos de React
  debe convertirse en configuración de tenant, no en lógica.
- **Recetas/inventario:** receta uno-a-uno con producto, recipe items conectan
  ingredientes; movimientos/kardex son registros de inventario. El guardado
  secundario de receta desde React puede ocultar errores; el nuevo flujo debe
  reportar el resultado real.
- **Snapshots de pedidos:** `order_lines` conservan nombre/precio y no tienen FK
  a producto en la base observada. No destruir esa semántica histórica
  introduciendo una FK/borrado sin decisión explícita.

En Trifood la unicidad natural del catálogo será tenant-scoped como adaptación
SaaS deliberada, pero el comportamiento de normalización debe continuar.

## 8. Discrepancias abiertas: no resolver por intuición

La evidencia comparada en el baseline incluye PostgreSQL vivo, Alembic,
SQLAlchemy, FastAPI, React y documentación. No se debe elegir arbitrariamente
una fuente para cerrar contradicciones:

| Tema | Diferencia observada | Tratamiento |
|---|---|---|
| Procedencia del `schema.sql` anterior | Su versión PostgreSQL/pg_dump es 16.15, pero no prueba base, contenedor ni fecha exactos. El archivo presente no contiene `tenant_id`; esa afirmación previa quedó corregida en el baseline. | No atribuirle vigencia/origen no demostrado. Obtener evidencia directa nueva. |
| `tenant_id` | El PostgreSQL vivo y los modelos legacy son single-tenant; los esquemas de reconstrucción Trifood añaden `tenant_id`. | Entenderlo como extensión objetivo SaaS, no como estructura legacy. |
| `actor_user_id` / `changed_by` | PostgreSQL y snapshot Alembic V4 los requieren y sus FKs no son `SET NULL`; SQLAlchemy activo permite null y declara `SET NULL`. | Registrar ambas versiones y determinar la decisión con evidencia; no cambiar Alembic, ORM ni esquema en esta fase de handoff. |
| Cascadas de imágenes/historial | SQLAlchemy indica cascada hacia imágenes e historial y `SET NULL` para algunos actores; las FKs vivas no reflejan esas acciones. | No inferir intención de borrado físico; el flujo API usa baja lógica. |
| Vigencia de Alembic | La base mostró revisión `0005`; V4/V5 son reconciliaciones parciales y no cambian todas las propiedades existentes. | La revisión por sí sola no prueba equivalencia de schema. Comparar objeto por objeto. |
| Código de producto | FastAPI permite cambiarlo; React lo presenta como no editable. | Confirmar contrato funcional antes de migrar. |
| Publicación/disponibilidad | Menú API y badge React no representan de igual forma `is_available`; no hay bandera persistida de publicación confirmada. | Determinar el comportamiento deseado desde código/flujo y validar con dueño funcional. |
| DDL y documentos antiguos | Algunos documentos anteriores indican “V2 no validado”; documentos posteriores registran V1/V2 DDL validado por `psql` pero Flyway pendiente. | Seguir el registro más reciente con fechas y límites explícitos; no borrar el historial de afirmaciones conflictivas sin evidencia. |

Clasificaciones y análisis más amplios están en el baseline del catálogo. Una
discrepancia solo se cierra con evidencia verificable y decisión documentada,
nunca con una simplificación de implementación.

## 9. Riesgos conocidos

- Fuga cross-tenant por consultas sin contexto, acceso por ID, tareas async o
  relaciones mal formadas.
- Creer que claims JWT o rol recibido del cliente conceden permisos.
- Constraints del ORM que no coinciden con las reales o con el nuevo DDL.
- Ejecutar Flyway por error contra `potoquitos`, mezclar historial Alembic/Flyway
  o habilitar Flyway con destino no aislado.
- Romper flujos financieros, inventario/Kardex, cierres de caja, auditoría,
  snapshots o concurrencia al portar solo el esquema superficial.
- Perder el actor en auditoría/historial o elegir reglas de cascada equivocadas.
- Implementar una lectura de catálogo genérica y asumir equivalencia funcional.
- Sobrestimar pruebas unitarias como prueba de PostgreSQL/Flyway/arranque.
- React y FastAPI no son tenant-aware y no pueden compartir de forma segura una
  base multi-tenant con varios clientes sin cambios coordinados; mantenerlos
  aislados hasta cutover aprobado.
- Docker/Testcontainers ha bloqueado validaciones de integración anteriormente.
  No permitir que esta limitación congele todo el desarrollo.

## 10. Qué NO debe hacer el siguiente agente

1. No modificar la base `potoquitos`, sus datos, estructura, usuarios, permisos
   ni configuración.
2. No ejecutar Alembic/Flyway ni DDL/DML contra la base legacy.
3. No alterar FastAPI, React, SQLAlchemy o Alembic mientras el alcance sea solo
   preparar evidencia o handoff.
4. No hacer cambios de aplicación ni empezar catálogo Spring antes de cerrar la
   línea base y obtener revisión.
5. No asumir procedencia o vigencia de `schema.sql` por su nombre, fecha del
   archivo o versión de PostgreSQL.
6. No corregir contradicciones de `actor_user_id`, `changed_by`, cascadas,
   código, disponibilidad o menú sin evidencia/decisión.
7. No hardcodear Potoquitos ni incluir lógica especial para ese tenant.
8. No crear un CRUD genérico de catálogo ni sustituir estados, transacciones,
   historial, auditoría o snapshots del POS.
9. No confiar en `tenant_id`, roles ni permisos enviados por el cliente.
10. No introducir microservicios, cambiar la arquitectura o migrar producción.
11. No iniciar loops de Docker, reiniciar Docker Desktop, recrear contenedores,
    publicar puertos ni instalar Java dentro de contenedores para resolver el
    gate pendiente.
12. No considerar la validación DDL directa como integración Flyway/Spring Boot.
13. No avanzar al despliegue hasta cerrar la integración Flyway/Spring Boot y
    health en una base nueva aislada.

## 11. Siguiente paso recomendado

Primero confirmar la evidencia física vigente con un dump `--schema-only`
directamente desde la base PostgreSQL actual de Potoquitos, en modo solo lectura.
Compararlo con Alembic, SQLAlchemy, FastAPI, React y documentación, completar o
actualizar la matriz de discrepancias y solicitar revisión antes de implementar
el catálogo. La exportación directa del 2026-10-07 está guardada en
`docs/database/potoquitos-live-schema-2026-10-07.sql`; el siguiente agente debe
verificar si sigue siendo actual para su tarea y generar una nueva exportación
siempre que se requiera evidencia del estado actual.

Después de aprobar la matriz, estudiar el flujo funcional del catálogo de punta
a punta y diseñar la equivalencia Spring/JPA y las pruebas de paridad e
aislamiento. En paralelo, mantener el gate de Flyway + Spring Boot + PostgreSQL
limpio como requisito obligatorio previo a despliegue, sin bloquear el trabajo
funcional que no dependa de ese gate.

## NEXT ACTION

Generar un fresh schema-only dump directamente desde la base de datos actual de Potoquitos y comparar PostgreSQL, Alembic, SQLAlchemy, FastAPI y React antes de implementar la migración del catálogo.
