# PLAN: 004-categories — Gestión de Categorías del Catálogo

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/categories`
- Modelo de datos: Category
- Componentes Frontend: CategoryList, CategoryFormModal

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Category
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/categories`
- Request: `Filtro activo opcional`
- Response: `Lista ordenada de categorías`

### `POST /api/categories`
- Request: `Nombre, orden, estado`
- Response: `Categoría creada`

### `PUT /api/categories/{id}`
- Request: `Datos actualizados`
- Response: `Categoría actualizada`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
