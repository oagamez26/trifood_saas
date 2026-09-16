# PLAN: 018-reports — Reportes Gerenciales y Analíticos

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/reports`
- Modelo de datos: Vistas analíticas agregadas
- Componentes Frontend: ReportsDashboard, DateRangePicker, ExportReportButton, OperatingResultBreakdown

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Vistas analíticas agregadas
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/reports/sales`
- Request: `Fecha inicio y fin`
- Response: `Resumen de ventas por día y totales`

### `GET /api/reports/products`
- Request: `Fecha inicio y fin`
- Response: `Ranking de productos por volumen y facturación`

### `GET /api/reports/operating-result`
- Request: `Fecha inicio y fin`
- Response: `Margen bruto - gastos = resultado operativo`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
