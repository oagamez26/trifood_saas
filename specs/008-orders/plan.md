# PLAN: 008-orders — Toma y Gestión de Pedidos por Mesa

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/orders`
- Modelo de datos: Order, OrderLine, OrderCancellation
- Componentes Frontend: OrderBuilder, OrderLinesList, ProductPickerModal, OrderSummaryCard

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Order, OrderLine, OrderCancellation
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/orders`
- Request: `Filtro por mesa, sesión o estado`
- Response: `Lista de pedidos`

### `POST /api/orders`
- Request: `ID mesa/sesión, líneas (producto, cantidad, notas)`
- Response: `Pedido creado en BORRADOR o CONFIRMADO`

### `POST /api/orders/{id}/send-kitchen`
- Request: `Sin cuerpo`
- Response: `Pedido enviado a cocina y consumo de ingredientes descontado`

### `POST /api/orders/{id}/cancel`
- Request: `Motivo de cancelación`
- Response: `Pedido cancelado con motivo registrado`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
