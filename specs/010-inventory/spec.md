# SPEC: 010-inventory — Control de Movimientos de Inventario

## 1. Propósito
Registro directo de entradas manuales, mermas, ajustes y reversiones sin proveedores ni compras externas, manteniendo el stock actualizado.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Control de Movimientos de Inventario para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/inventory/movements`: Entrada: Filtro por ingrediente, tipo, fechas | Salida: Historial de movimientos
- `POST /api/inventory/movements`: Entrada: Ingrediente ID, tipo, cantidad, motivo | Salida: Movimiento aplicado y stock actualizado

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
