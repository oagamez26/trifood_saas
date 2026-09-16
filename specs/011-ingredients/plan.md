# PLAN: 011-ingredients — Catálogo de Ingredientes y Unidades Base

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/ingredients`
- Modelo de datos: Ingredient
- Componentes Frontend: IngredientsTable, IngredientFormModal, UnitSelector

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Ingredient
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/ingredients`
- Request: `Filtro activo o bajo stock`
- Response: `Lista de ingredientes con stock y unidades`

### `POST /api/ingredients`
- Request: `Datos de insumo`
- Response: `Ingrediente creado`

### `PUT /api/ingredients/{id}`
- Request: `Datos actualizados`
- Response: `Ingrediente modificado`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
