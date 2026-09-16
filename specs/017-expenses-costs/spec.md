# SPEC: 017-expenses-costs — Gastos Operativos y Análisis de Costos

## 1. Propósito
Registro de gastos fijos y variables del restaurante (arriendo, servicios, internet, nómina, insumos generales) y cálculo de márgenes frente a costos de producción.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Gastos Operativos y Análisis de Costos para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/expenses`: Entrada: Rango de fechas, categoría | Salida: Lista de gastos operativos
- `POST /api/expenses`: Entrada: Concepto, monto, fecha, categoría | Salida: Gasto registrado
- `GET /api/costs/summary`: Entrada: Rango de fechas | Salida: Comparativa costo de ventas vs gastos operativos

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
