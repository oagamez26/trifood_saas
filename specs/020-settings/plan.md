# PLAN: 020-settings — Configuración del Restaurante y Créditos

## 1. Arquitectura y Vertical Slice
- Módulo backend: `fastapi_app/modules/settings`
- Modelo de datos: RestaurantSetting
- Componentes Frontend: SettingsForm, CreditsCard, InvoiceConfigSection

## 2. Modelo de Datos y Entidades
- Entidades involucradas: RestaurantSetting
- Constraints: Claves primarias, foráneas, índices de búsqueda y validaciones `CheckConstraint`.

## 3. Contratos de API
### `GET /api/settings`
- Request: `Sin parámetros`
- Response: `Configuración completa del restaurante y créditos`

### `PUT /api/settings`
- Request: `Datos actualizados`
- Response: `Configuración guardada`


## 4. Frontend y Estados
- Vistas asociadas en `frontend/src/features/`
- Estados de carga, error y éxito controlados con retroalimentación inmediata.

## 5. Estrategia de Pruebas
- Pruebas unitarias de dominio y repositorios.
- Pruebas de integración HTTP usando TestClient de FastAPI.
