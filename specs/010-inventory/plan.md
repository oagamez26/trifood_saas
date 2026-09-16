# PLAN: 010-inventory — Control de Movimientos de Inventario

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/inventory`
- Modelo de datos: InventoryMovement, Ingredient
- Componentes Frontend: InventoryMovementsTable, ManualMovementModal

## 2. Modelo de Datos y Entidades
- Entidades involucradas: InventoryMovement, Ingredient
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/inventory/movements`
- Request: `Filtro por ingrediente, tipo, fechas`
- Response: `Historial de movimientos`

### `POST /api/inventory/movements`
- Request: `Ingrediente ID, tipo, cantidad, motivo`
- Response: `Movimiento aplicado y stock actualizado`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
