# SPEC: 015-payments — Cobro Presencial, Pagos Mixtos y Arqueo

## 1. Propósito
Cobro presencial en caja para mesas en PENDIENTE_PAGO, soporte de métodos múltiples (EFECTIVO, TARJETA, TRANSFERENCIA, NEQUI, DAVIPLATA), cálculo de cambio y prevención de doble cobro.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Cajero, Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Cajero, Administrador), requiero operar el módulo Cobro Presencial, Pagos Mixtos y Arqueo para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/payments/table/{table_id}/summary`: Entrada: ID de mesa | Salida: Consolidación de pedidos de la sesión y total a cobrar
- `POST /api/payments`: Entrada: ID sesión, métodos, montos, recibido | Salida: Pago registrado, cambio calculado y mesa liberada a DISPONIBLE

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
