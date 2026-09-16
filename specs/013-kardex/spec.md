# SPEC: 013-kardex — Kardex Físico Inmutable de Inventario

## 1. Propósito
Trazabilidad inmutable de todas las entradas, consumos por pedido, mermas y ajustes con saldo anterior y posterior, fecha y usuario responsable.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Kardex Físico Inmutable de Inventario para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/kardex`: Entrada: Filtro por ingrediente, rango de fechas | Salida: Registros cronológicos de Kardex
- `GET /api/kardex/ingredient/{id}`: Entrada: ID ingrediente | Salida: Kardex consolidado del insumo

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
