# PLAN: 005-products — Gestión de Productos del Menú

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/products`
- Modelo de datos: Product, ProductPriceHistory, ProductImage
- Componentes Frontend: ProductsTable, ProductEditModal, PriceUpdateModal, ProductImageUploader

## 2. Modelo de Datos y Entidades
- Entidades involucradas: Product, ProductPriceHistory, ProductImage
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/products`
- Request: `Filtros por categoría, disponibilidad`
- Response: `Lista de productos paginada`

### `POST /api/products`
- Request: `Datos de producto y precio`
- Response: `Producto creado con versión de precio 1`

### `PATCH /api/products/{id}`
- Request: `Campos actualizables`
- Response: `Producto actualizado`

### `POST /api/products/{id}/price`
- Request: `Nuevo precio, versión actual`
- Response: `Precio actualizado con registro en histórico`

### `POST /api/products/{id}/image`
- Request: `Archivo de imagen`
- Response: `Referencia de imagen actualizada`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
