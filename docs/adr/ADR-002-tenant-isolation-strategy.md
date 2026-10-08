# ADR-002: Aislamiento multi-tenant por contexto request-scoped y repositorios explícitos

- Estado: Propuesto para Fase 1
- Fecha: 2026-10-05

## Contexto

El esquema PostgreSQL 16.15 activo es mono-tenant, no contiene tenants ni `tenant_id`, y conserva 30 tablas de aplicación más `alembic_version`. FastAPI comparte esa base hoy y no establece contexto de tenant. Por lo tanto, RLS inmediata o una migración in-place antes de adaptar todos los escritores puede interrumpir Potoquitos y exponer datos.

## Decisión

Para el backend Java nuevo:

1. Validar JWT con Spring Security Resource Server.
2. Extraer `user_id`, UUID `tenant_id` y roles validados en un principal tipado.
3. Exponer `TenantContext` como bean request-scoped, inicializado desde autenticación por interceptor MVC.
4. Exigir tenant explícito en repositorios/servicios y filtrar ID+tenant en cada operación.
5. Añadir tenant directo a filas operativas y constraints/FKs compuestas para proteger relaciones.
6. No confiar en parámetros ni headers de Angular para determinar el tenant.
7. No habilitar Hibernate filters ni PostgreSQL RLS como mecanismos paralelos en esta etapa.

## Razones

- Las condiciones de tenant son visibles en cada acceso a datos y revisables en código.
- La request scope evita contaminación de un `ThreadLocal` entre solicitudes síncronas.
- Las FKs compuestas imponen invariantes incluso ante un error en una consulta.
- El esquema compartido sigue soportado sin acoplar la app a filtros mágicos.
- La app nueva se separa de FastAPI y de la base actual hasta un cutover aprobado.

## Opciones descartadas o diferidas

- **Hibernate filters:** implícitos y fáciles de omitir con SQL nativo o rutas de carga especiales.
- **JPA Specifications como aislamiento:** sirven para búsquedas dinámicas pero no garantizan la presencia del tenant.
- **RLS ahora:** FastAPI no fija contexto DB; activar políticas podría romper lecturas/escrituras. Reconsiderar cuando todos los writers usen roles DB no-owner, transacciones con `SET LOCAL`, y pruebas específicas de pooling.
- **Header `X-Tenant-ID` confiable:** rechazado; un selector de tenant solo puede usarse antes de autenticación y siempre se verifica contra membresía en servidor.

## Consecuencias

- Cada método repository de negocio debe incluir tenant como parámetro.
- Tests de integración deben intentar lecturas, escrituras y relaciones cross-tenant.
- Procesos async deben transportar tenant explícitamente y volver a autorizar.
- Aún no existe login ni emisión de JWT; se construye solamente la validación y el contexto.
- Requiere migración de datos y autorización posterior antes de soportar el segundo tenant.

## Criterios para reconsiderar RLS

Reevaluar cuando FastAPI ya no escriba en el esquema compartido, todos los clientes DB tengan mínimo privilegio, cada transacción fije y limpie tenant de forma segura, y los tests de pool/reutilización y bypass estén automatizados.
