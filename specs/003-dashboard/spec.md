# SPEC: 003-dashboard — Dashboard Administrativo y Centro de Control

## 1. Propósito
Presentar al Administrador un resumen ejecutivo en tiempo real: ventas del día, pedidos activos, ocupación de mesas y alertas de inventario.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Dashboard Administrativo y Centro de Control para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/dashboard/summary`: Entrada: Sin parámetros o fecha opcional | Salida: Ventas hoy, pedidos hoy, mesas activas, alertas urgentes
- `GET /api/dashboard/weekly-sales`: Entrada: Rango de 7 días | Salida: Historial de ventas diarias para gráfico comparativo

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
