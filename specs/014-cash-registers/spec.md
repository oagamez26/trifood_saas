# SPEC: 014-cash-registers — Gestión de Cajas Físicas y Sesiones

## 1. Propósito
Control de cajas físicas (Principal, Secundaria) y registro de apertura con base inicial y estado ABIERTA / CERRADA por cajero.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador, Cajero.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador, Cajero), requiero operar el módulo Gestión de Cajas Físicas y Sesiones para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/cash-registers`: Entrada: Sin parámetros | Salida: Cajas físicas con estado de sesión actual
- `POST /api/cash-registers/{id}/open`: Entrada: Base inicial en COP | Salida: Nueva sesión de caja abierta
- `GET /api/cash-registers/{id}/current-session`: Entrada: ID de caja | Salida: Detalle de sesión activa y transacciones

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
