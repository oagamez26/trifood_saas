# PLAN: 007-tables — Gestión y Estados de Mesas Físicas

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/tables`
- Modelo de datos: DiningTable, TableSession
- Componentes Frontend: TablesGridView, TableCard, OpenSessionModal

## 2. Modelo de Datos y Entidades
- Entidades involucradas: DiningTable, TableSession
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/tables`
- Request: `Filtro de estado opcional`
- Response: `Lista de mesas físicas con estado actual y sesión activa`

### `POST /api/tables`
- Request: `Número de mesa, capacidad`
- Response: `Mesa registrada`

### `POST /api/tables/{id}/open-session`
- Request: `Mesero responsable`
- Response: `Nueva sesión de atención abierta (estado OCUPADA/EN_ATENCION)`

### `POST /api/tables/{id}/request-bill`
- Request: `ID de sesión`
- Response: `Mesa pasa a PENDIENTE_PAGO`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
