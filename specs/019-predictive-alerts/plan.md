# PLAN: 019-predictive-alerts — Alertas Predictivas Deterministas de Abastecimiento

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/predictive_alerts`
- Modelo de datos: PredictionAlert, InventoryDailyDemand
- Componentes Frontend: PredictiveAlertsBanner, ProductRiskBadge, LimitingIngredientTooltip, PredictionParamsModal

## 2. Modelo de Datos y Entidades
- Entidades involucradas: PredictionAlert, InventoryDailyDemand
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/predictions/alerts`
- Request: `Día objetivo opcional`
- Response: `Lista de productos con riesgo (ALTO, MEDIO, SIN_RIESGO), capacidad, demanda esperada e ingrediente limitante`

### `GET /api/predictions/parameters`
- Request: `Sin parámetros`
- Response: `Factores de margen de seguridad y días analizados`

### `PUT /api/predictions/parameters`
- Request: `Margen de seguridad, umbral`
- Response: `Parámetros actualizados`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
