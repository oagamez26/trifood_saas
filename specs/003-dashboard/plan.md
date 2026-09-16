# PLAN: 003-dashboard — Dashboard Administrativo y Centro de Control

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/dashboard`
- Modelo de datos: Vistas agregadas de Orders, Tables, Inventory, Payments
- Componentes Frontend: DashboardKpiCard, WeeklySalesChart, LiveTableStatusWidget, UrgentAlertsList

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Vistas agregadas de Orders, Tables, Inventory, Payments
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/dashboard/summary`
- Request: `Sin parámetros o fecha opcional`
- Response: `Ventas hoy, pedidos hoy, mesas activas, alertas urgentes`

### `GET /api/dashboard/weekly-sales`
- Request: `Rango de 7 días`
- Response: `Historial de ventas diarias para gráfico comparativo`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
