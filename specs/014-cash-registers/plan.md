# PLAN: 014-cash-registers — Gestión de Cajas Físicas y Sesiones

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/cash_registers`
- Modelo de datos: CashRegister, CashSession
- Componentes Frontend: CashRegisterCards, OpenCashModal, ActiveSessionBanner

## 2. Modelo de Datos y Entidades
- Entidades involucradas: CashRegister, CashSession
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/cash-registers`
- Request: `Sin parámetros`
- Response: `Cajas físicas con estado de sesión actual`

### `POST /api/cash-registers/{id}/open`
- Request: `Base inicial en COP`
- Response: `Nueva sesión de caja abierta`

### `GET /api/cash-registers/{id}/current-session`
- Request: `ID de caja`
- Response: `Detalle de sesión activa y transacciones`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
