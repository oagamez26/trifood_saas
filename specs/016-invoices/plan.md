# PLAN: 016-invoices — Emisión y Descarga de Facturas PDF

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/invoices`
- Modelo de datos: Invoice, InvoiceLine, Payment
- Componentes Frontend: InvoicesListTable, PdfViewModal

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Invoice, InvoiceLine, Payment
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/invoices`
- Request: `Filtro por fecha o número`
- Response: `Listado de facturas emitidas`

### `GET /api/invoices/{id}/pdf`
- Request: `ID factura`
- Response: `Archivo binario PDF generado para impresión/descarga`

### `GET /api/invoices/{id}`
- Request: `ID factura`
- Response: `Detalle de factura en JSON`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
