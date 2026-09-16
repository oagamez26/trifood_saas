# PLAN: 017-expenses-costs — Gastos Operativos y Análisis de Costos

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/expenses_costs`
- Modelo de datos: Expense, ExpenseCategory
- Componentes Frontend: ExpensesTable, ExpenseFormModal, CostSummaryWidget

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Expense, ExpenseCategory
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/expenses`
- Request: `Rango de fechas, categoría`
- Response: `Lista de gastos operativos`

### `POST /api/expenses`
- Request: `Concepto, monto, fecha, categoría`
- Response: `Gasto registrado`

### `GET /api/costs/summary`
- Request: `Rango de fechas`
- Response: `Comparativa costo de ventas vs gastos operativos`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
