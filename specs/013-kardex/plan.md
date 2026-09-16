# PLAN: 013-kardex — Kardex Físico Inmutable de Inventario

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/kardex`
- Modelo de datos: KardexEntry
- Componentes Frontend: KardexViewerTable, KardexFilterBar

## 2. Modelo de Datos y Entidades
- Entidades involucradas: KardexEntry
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/kardex`
- Request: `Filtro por ingrediente, rango de fechas`
- Response: `Registros cronológicos de Kardex`

### `GET /api/kardex/ingredient/{id}`
- Request: `ID ingrediente`
- Response: `Kardex consolidado del insumo`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
