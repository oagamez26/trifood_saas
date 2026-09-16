# PLAN: 015-payments — Cobro Presencial, Pagos Mixtos y Arqueo

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/payments`
- Modelo de datos: Payment, PaymentDetail, TableSession, Order
- Componentes Frontend: CheckoutModal, PaymentMethodSelector, ChangeCalculator, PaymentReceiptPreview

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Payment, PaymentDetail, TableSession, Order
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/payments/table/{table_id}/summary`
- Request: `ID de mesa`
- Response: `Consolidación de pedidos de la sesión y total a cobrar`

### `POST /api/payments`
- Request: `ID sesión, métodos, montos, recibido`
- Response: `Pago registrado, cambio calculado y mesa liberada a DISPONIBLE`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
