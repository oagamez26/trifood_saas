# PLAN: 012-recipes — Fichas Técnicas, Recetas y Capacidad de Producción

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/recipes`
- Modelo de datos: Recipe, RecipeItem, Product, Ingredient
- Componentes Frontend: RecipeEditorModal, RecipeItemsList, ProductionCapacityCard

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Recipe, RecipeItem, Product, Ingredient
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/recipes/{product_id}`
- Request: `ID de producto`
- Response: `Receta con desglose de ingredientes y costos`

### `PUT /api/recipes/{product_id}`
- Request: `Lista de items (ingrediente, cantidad, unidad)`
- Response: `Receta guardada y costo recalculado`

### `GET /api/recipes/{product_id}/capacity`
- Request: `ID de producto`
- Response: `Capacidad máxima de producción e ingrediente limitante`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
