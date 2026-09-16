# PLAN: 009-kitchen — Tablero de Cocina (Kitchen Display System - KDS)

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/kitchen`
- Modelo de datos: Order, OrderLine
- Componentes Frontend: KitchenKanbanBoard, KitchenTicketCard, KitchenTimerBadge

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Order, OrderLine
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/kitchen/queue`
- Request: `Sin parámetros`
- Response: `Pedidos activos en cocina ordenados por antigüedad`

### `POST /api/kitchen/orders/{id}/start`
- Request: `Sin cuerpo`
- Response: `Cambio de estado a EN_PREPARACION`

### `POST /api/kitchen/orders/{id}/ready`
- Request: `Sin cuerpo`
- Response: `Cambio de estado a LISTO y notificación al mesero`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
