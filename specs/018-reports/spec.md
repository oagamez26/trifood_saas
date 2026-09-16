# SPEC: 018-reports — Reportes Gerenciales y Analíticos

## 1. Propósito
Reportes consolidados con filtros de fecha: ventas totales, pedidos atendidos, productos más vendidos, métodos de pago, margen bruto estimado y resultado operativo.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Reportes Gerenciales y Analíticos para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/reports/sales`: Entrada: Fecha inicio y fin | Salida: Resumen de ventas por día y totales
- `GET /api/reports/products`: Entrada: Fecha inicio y fin | Salida: Ranking de productos por volumen y facturación
- `GET /api/reports/operating-result`: Entrada: Fecha inicio y fin | Salida: Margen bruto - gastos = resultado operativo

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
