# Fase 0 — Auditoría técnica y de negocio

## Resumen ejecutivo

El sistema actual de POTOQUITOS es un monolito modular basado en:

- Backend: FastAPI + Python + SQLAlchemy + PostgreSQL
- Frontend: React + TypeScript + Vite
- Infraestructura: Docker Compose
- Seguridad: JWT + refresh token + cookies + RBAC por roles
- Estructura funcional: autenticación, catálogo, pedidos, cocina, inventario, caja, gastos, reportes y configuración

La arquitectura actual está bien separada en capas y es adecuada para soportar un primer paso de migración a SaaS con mínimo riesgo si se introduce el contexto multi-tenant de forma incremental.

## Hallazgos clave

### 1. Arquitectura actual

El backend se organiza en capas de presentación, aplicación, dominio e infraestructura. La separación entre routers, servicios y repositorios ya existe y permite introducir políticas de multi-tenancy en un punto central sin reorganizar todo el sistema de un solo golpe.

### 2. Seguridad actual

El sistema usa JWT para autenticación y roles para autorización. El patrón actual de seguridad es correcto, pero no incorpora aún el concepto de tenant. El backend debe validar el tenant de cada usuario mediante el token o una resolución explícita del contexto de sesión.

### 3. Datos y dominio

El modelo actual está orientado a una operación de restaurante única. Muchas entidades de negocio (productos, mesas, órdenes, sesiones de caja, inventario, gastos, etc.) tendrán que asociarse a un tenant para evitar fuga de datos entre clientes.

### 4. Frontend

La SPA React usa rutas protegidas y roles. Eso facilita la introducción de un modelo de usuario-tenant, pero el frontend nunca debe ser fuente de la verdad para `tenant_id`.

### 5. Persistencia

PostgreSQL ya provee la base técnica necesaria para soportar multi-tenancy con un enfoque seguro y transaccional. El patrón de migraciones (Alembic/Flyway) permitirá introducir cambios de esquema de forma controlada.

---

## Mapa del sistema actual

### Backend

- `backend/fastapi_app/bootstrap.py`
  - configuración raíz de FastAPI
  - CORS, lifecycle, handlers de error, health checks
- `backend/fastapi_app/presentation/`
  - routers por dominio: auth, catalog, orders, kitchen, inventory, cash, expenses, analytics, settings
- `backend/fastapi_app/infrastructure/models.py`
  - entidades SQLAlchemy con el dominio principal del negocio
- `backend/fastapi_app/infrastructure/repositories.py`
  - repositorios y unit of work
- `backend/fastapi_app/infrastructure/security.py`
  - lógica de JWT, refresh token y política de seguridad

### Frontend

- `frontend/src/app/App.tsx`
  - rutas protegidas y roles
- `frontend/src/contexts/AuthContext.tsx`
  - sesión, refresh, roles, zona de autenticación del cliente

### Infraestructura

- `docker-compose.yml`
  - PostgreSQL, backend y frontend

---

## Riesgos y observaciones del estado actual

### Riesgo 1: ausencia de tenant en el modelo de dominio

El sistema asume un único contexto operativo. La mayor parte de la lógica no discrimina entre empresas y clientes.

Mitigación:
- introducir entidad `Tenant`
- asociar usuarios, ubicaciones, productos y sesiones al tenant
- filtrar todas las consultas por `tenant_id` desde capa de infraestructura o servicio

### Riesgo 2: autenticación con confianza implícita en el cliente

El frontend puede tener acceso a datos de usuario, pero no debe ser la fuente de `tenant_id`.

Mitigación:
- resolver `tenant_id` desde el token o la sesión autenticada
- validar el tenant explícitamente en cada operación sensible

### Riesgo 3: dato compartido accidentalmente

Los objetos con scope global (catálogo, roles, usuarios, configuraciones, cajas) requieren decisiones claras de clasificación.

Mitigación:
- distinguir entre tablas globales y tablas de tenant
- permitir solo lectura global para ciertos metadatos

### Riesgo 4: migración no incremental

Un cambio abrupto de esquema puede romper operación del restaurante.

Mitigación:
- migración por etapas
- despliegue en paralelo con compatibilidad gradual
- copia y validación de datos antes del corte

---

## Boundary del proyecto

La migración debe conservar el comportamiento actual del sistema y sus procesos reales en cocina, caja, inventario y pedidos. El objetivo no es reescribir la lógica del negocio desde cero, sino volver el sistema multi-tenant con seguridad, aislamiento y manejo de clientes.

## Conclusión

El proyecto ya tiene una base técnica sólida para migrar a SaaS multi-tenant. El mayor cambio no será tecnológico en sí, sino la introducción explícita del concepto de tenant en autenticación, modelo de datos, autorización, y aislamiento de consultas. La ruta recomendada es comenzar con el modelo de tenant y la capa de seguridad antes de repartir la lógica de negocio en módulos o servicios nuevos.
