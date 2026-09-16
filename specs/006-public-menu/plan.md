# PLAN: 006-public-menu — Menú Público Digital de Consulta

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/public_menu`
- Modelo de datos: Category, Product (solo activos y disponibles)
- Componentes Frontend: PublicHeader, CategoryTabs, ProductCard, ProductDetailDrawer

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Category, Product (solo activos y disponibles)
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/public/menu`
- Request: `Sin parámetros`
- Response: `Estructura de categorías con productos disponibles, fotos y precios en COP`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
