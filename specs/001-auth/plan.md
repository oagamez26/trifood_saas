# PLAN: 001-auth — Autenticación y Seguridad de Acceso

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/auth`
- Modelo de datos: User, Role, Permission
- Componentes Frontend: LoginModal / LoginForm, UserStatusBadge, SessionTimeoutWarning

## 2. Modelo de Datos y Entidades
- Entidades involucradas: User, Role, Permission
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `POST /api/auth/login`
- Request: `Credenciales (username, password)`
- Response: `Tokens de acceso, datos del usuario y permisos efectivos`

### `POST /api/auth/refresh`
- Request: `Refresh token`
- Response: `Nuevo access token`

### `POST /api/auth/logout`
- Request: `Token activo`
- Response: `Confirmación de revocación`

### `GET /api/auth/me`
- Request: `Bearer token`
- Response: `Perfil actual y roles autorizados`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
