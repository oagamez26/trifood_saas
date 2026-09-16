# PLAN: 002-users — Administración de Usuarios y Asignación de Roles

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/users`
- Modelo de datos: User, Role, UserRole
- Componentes Frontend: UsersListTable, UserCreateEditModal, RoleSelector

## 2. Modelo de Datos y Entidades
- Entidades involucradas: User, Role, UserRole
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/users`
- Request: `Filtros de rol, estado`
- Response: `Lista de usuarios con roles asignados`

### `POST /api/users`
- Request: `Datos de empleado y rol`
- Response: `Usuario creado con contraseña temporal o inicial`

### `PATCH /api/users/{id}`
- Request: `Datos modificables o estado`
- Response: `Usuario actualizado`

### `POST /api/users/{id}/reset-password`
- Request: `Nueva contraseña`
- Response: `Confirmación de restablecimiento`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
