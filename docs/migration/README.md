# Migración a SaaS multi-tenant

Este directorio recoge la documentación de la fase de auditoría y arquitectura del proyecto POTOQUITOS durante la transformación del monolito actual hacia un modelo SaaS multi-tenant, respetando la regla de negocio central: no romper el sistema actual ni su operación diaria.

## Objetivo

Preparar una ruta segura desde el sistema actual (FastAPI + React + PostgreSQL monolítico, con una sola instancia operacional) hacia una plataforma multi-tenant, manteniendo a Potoquitos como el primer tenant y dejando la base para la reimplementación posterior en Angular + Java 21 + Spring Boot 3.

## Alcance

- Auditar el sistema actual y sus límites de negocio.
- Identificar qué datos y módulos deben volverse tenant-aware.
- Definir el modelo de aislamiento: shared database / shared schema con `tenant_id`.
- Documentar riesgos, dependencias y plan de migración incremental.
- Preparar la base para la fase de implementación del backend y la nueva capa de seguridad.

## Documentos

- [phase-0-audit.md](./phase-0-audit.md): resumen ejecutivo de la auditoría actual.
- [tenant-model.md](./tenant-model.md): diseño del modelo de tenants, usuarios y aislamiento.
- [migration-matrix.md](./migration-matrix.md): fases, dependencias y riesgo de la migración.
- [risks.md](./risks.md): riesgos técnicos, operativos y de negocio.

## Principios de la migración

1. No romper el sistema actual.
2. Mantener la lógica de negocio y el flujo operativo intactos durante la transición.
3. Potoquitos será el primer tenant del sistema, no un caso especial “fuera del modelo”.
4. El `tenant_id` nunca se toma del cliente; se deriva desde la autenticación y el contexto backend.
5. La capa de seguridad debe aplicar aislamiento y autorizaciones de tenant a nivel de cada consulta y acción.
6. Cada migración de esquema y de datos debe ser reversible o al menos auditable.

## Estado actual

El repositorio ya presenta una arquitectura monolítica modular claramente organizada en capas y un conjunto de docs de arquitectura del estado actual. La migración SaaS debe aprovechar esa base y añadir el contexto multi-tenant sin destruir la solución existente.
