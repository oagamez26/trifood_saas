# Trifood

## Propósito

Trifood es la evolución SaaS multi-tenant del POS de Potoquitos. Potoquitos es
únicamente el primer tenant: no debe existir lógica especial ni hardcodeada por
su nombre, slug o ID.

## Regla principal

**No reconstruir el POS desde cero.** Antes de implementar un módulo, estudiar
sus modelos, migraciones, servicios, endpoints, validaciones y flujos de UI
actuales. Preservar sus reglas de negocio, relaciones, restricciones,
transacciones, historial y comportamiento funcional. No inventar reglas ni
eliminar funcionalidades; documentar diferencias antes de decidir cambios.

## Arquitectura

- Modular monolith; no introducir microservicios.
- Shared database y shared schema para el objetivo SaaS inicial.
- `tenant_id` en datos tenant-scoped; relaciones protegidas también por
  constraints/FKs tenant-aware.
- `TenantContext` obtenido de la identidad autenticada.
- JWT para identidad y RBAC para autorización efectiva.

## Stack

**Actual:** React + TypeScript; Python + FastAPI; PostgreSQL; SQLAlchemy;
Alembic.

**Objetivo:** Angular + TypeScript; Java 21; Spring Boot 3; PostgreSQL; Spring
Data JPA/Hibernate; Flyway; Spring Security/JWT; OpenAPI; JUnit; Mockito;
Testcontainers; Docker; CI/CD.

## Multi-tenancy y seguridad

- Nunca confiar en `tenant_id` enviado por el frontend, query, header o payload.
- El backend resuelve y valida tenant y membership desde el contexto autenticado.
- El JWT representa identidad/tenant validados; roles o permisos dentro del token
  no conceden autorización por sí solos.
- RBAC efectivo se obtiene de memberships, roles, asignaciones y permissions
  persistidos; comprobar permisos en backend.
- Refresh tokens son opacos, se almacenan como hash, expiran, rotan y pueden
  revocarse. La sesión se transporta en cookie `HttpOnly`; proteger operaciones
  con CSRF y configurar `Secure` en producción.
- No incluir contraseñas, hashes ni secretos en respuestas, documentación o
  repositorio.

## Estado de migración (corte: 2026-10-07)

**Implementado en `backend/springboot/`:**

- Fundación Spring Boot 3.5.6 / Java 21, JPA, Security, Flyway y Actuator.
- V1 (tenants, plans, subscriptions), V2 (esquema tenant-scoped propuesto) y V3
  (perfil tenant-local y refresh sessions) existen en el repositorio.
- Login/logout/refresh, JWT, BCrypt, TenantContext, validación de membership,
  RBAC, `/api/auth/me`, administración de usuarios/memberships/roles/permisos y
  `TenantScopedRepository`.
- `GET /api/catalog/categories` es una lectura de ejemplo; **no** es la
  migración funcional del catálogo.

**Validado según la evidencia documentada:**

- V1 y V2 ejecutadas directamente con `psql` en PostgreSQL 16.15 sobre la base
  aislada `trifood_v2_validation`; se verificaron PK, FK, `NOT NULL`, UNIQUE,
  índices y restricciones de tenant. Esto valida DDL PostgreSQL, no Flyway.
- 42 pruebas focalizadas de identidad/autorización reportadas aprobadas.
- La base de validación se eliminó al terminar; no asumir que aún existe.

**Pendiente:**

- Aplicar V1/V2/V3 con el motor Flyway de Spring Boot en PostgreSQL limpio.
- Validar mapping JPA, arranque conectado a la base y
  `/actuator/health = UP`.
- Validación de integración PostgreSQL/Testcontainers y aislamiento relacional
  de dos tenants con la aplicación. **Testcontainers no está confirmado como
  funcional:** las pruebas de integración no pudieron arrancar por problemas de
  infraestructura Docker.
- Migración funcional del catálogo: no comenzar antes de completar y revisar la
  comparación del esquema vigente con el POS.

**Bloqueo conocido:** Docker/Testcontainers ha impedido la integración real.
Este bloqueo no debe detener módulos independientes. No recrear contenedores
repetidamente, reiniciar Docker Desktop, modificar puertos/base existentes ni
instalar Java dentro de contenedores para resolverlo. La integración completa es
obligatoria antes del despliegue.

**No validado:** Flyway ejecutado desde Spring Boot, integración conjunta
Spring/PostgreSQL, migración V3, arranque de la aplicación conectada a PostgreSQL
y `/actuator/health = UP`. No presentar la validación DDL con `psql` ni las
pruebas unitarias focalizadas como evidencia de esos resultados.

## Base de datos

La base PostgreSQL actual de Potoquitos es la referencia funcional para el POS.
Los datos de desarrollo del destino pueden descartarse; el esquema, las
relaciones, restricciones, historiales y reglas funcionales no. No modificar la
base actual durante inspecciones o validaciones: no ejecutar allí migraciones ni
DDL/DML. Flyway del backend nuevo debe apuntar exclusivamente a una base SaaS
nueva y aislada.

Hay discrepancias documentadas, entre otras, en `actor_user_id`,
`changed_by`, acciones de borrado, `tenant_id` y comportamiento UI/API de código
y disponibilidad. No escoger arbitrariamente PostgreSQL, Alembic, SQLAlchemy,
FastAPI, React o documentación como única verdad: reunir evidencia y registrar
la decisión primero.

## Próximo paso

Generar un fresh schema-only dump directamente desde la DB actual de Potoquitos,
en solo lectura. Después completar la matriz:

`Elemento | PostgreSQL actual | Alembic | SQLAlchemy | FastAPI | React | Regla funcional | Decisión`

No implementar el catálogo hasta terminar y revisar esta comparación. El
baseline previamente documentado en
`docs/migration/potoquitos-postgres-catalog-baseline.md` y el contexto para
transferencia en `docs/migration/AGENT-HANDOFF.md` son referencias de trabajo,
pero un nuevo análisis debe verificar que el dump continúa vigente.

## Reglas para agentes

1. No modificar código sin analizar primero la implementación existente.
2. No inventar reglas de negocio.
3. No eliminar funcionalidades existentes.
4. No hardcodear Potoquitos.
5. No realizar migraciones destructivas ni tocar la base actual.
6. No considerar una migración validada sin pruebas reales adecuadas al alcance.
7. Mantener trazabilidad entre código actual y código nuevo.
8. Si hay discrepancias entre fuentes, documentarlas antes de resolverlas.
9. No usar la base de desarrollo como excusa para cambiar el modelo funcional.
10. Cada módulo nuevo debe demostrar equivalencia funcional con el POS existente
    y aislamiento tenant.
