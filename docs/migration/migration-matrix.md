# Matriz de migración y fases

## Visión general

La migración propuesta tiene un carácter incremental, con foco en mantener el sistema actual operativo y transformarlo paso a paso hacia un modelo SaaS multi-tenant.

## Fase 0 — Auditoría y arquitectura

Objetivo:
- entender el estado actual
- mapear módulos y riesgos
- definir tenant y políticas de seguridad

Resultado esperado:
- documentos de arquitectura y auditoría
- definición del modelo de tenancy
- base para la implementación segura

## Fase 1 — Base de tenant y seguridad

Objetivo:
- introducir `Tenant`
- enlazar usuarios al tenant
- resolver tenant desde autenticación
- asegurar validación por tenant en todas las operaciones

Cambios esperados:
- tabla `tenants`
- `tenant_id` en entidades operativas
- middleware / interceptor de contexto
- políticas de acceso por tenant

## Fase 2 — Datos y migración de esquema

Objetivo:
- asegurar migración de esquema con Flyway / Alembic
- migrar el sistema actual a tenant inicial (`Potoquitos`)
- dejar la base migratable para múltiples clientes

Cambios esperados:
- migraciones versionadas
- seed inicial del first tenant
- backfill de `tenant_id`
- validación de integridad y consistencia

## Fase 3 — Backend foundation (Java 21 / Spring Boot 3)

Objetivo:
- crear la base del nuevo backend en el stack objetivo
- reutilizar el dominio del restaurante
- implementar seguridad JWT + Spring Security
- conectar con PostgreSQL y Flyway

Cambios esperados:
- módulos por dominio
- autenticación multitenant
- tenant context
- contratos y DTOs

## Fase 4 — Frontend Angular

Objetivo:
- migrar la capa de UI a Angular + TypeScript
- mantener rutas, roles y seguridad del negocio
- conectar con backend multi-tenant

Cambios esperados:
- routing por roles
- guard de sesión y autorización por tenant
- módulos funcionales por dominio

## Fase 5 — Validación y rollout

Objetivo:
- pruebas de regresión
- pruebas de aislamiento multi-tenant
- rollout controlado por tenant

Criterios de salida:
- sin pérdida de operación para Potoquitos
- aislamiento de tenant funcional
- trazabilidad y auditoría completos

## Riesgos por fase

| Fase | Riesgo | Impacto | Mitigación |
|---|---|---:|---|
| 0 | Desconocimiento del dominio actual | Alto | auditoría y mapeo de módulos |
| 1 | Fuga de datos entre tenants | Crítico | validación centralizada de tenant |
| 2 | Migración masiva de datos con inconsistencias | Alto | backfill controlado y pruebas |
| 3 | Reescritura de la lógica sin compatibilidad | Alto | mantener dominio actual y adaptar paso a paso |
| 4 | UI y seguridad desacopladas | Medio | guards + validación backend |
| 5 | Incidentes operativos durante rollout | Medio | despliegue gradual y rollback |

## Recomendación general

La recomendación es mover primero el modelo de negocio y seguridad hacia un contexto de tenant explícito, y luego reestructurar la capa de aplicación y frontend. Esto permite reducir peligros de integración y mantener la continuidad del negocio.
