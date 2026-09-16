# SPEC: 009-kitchen — Tablero de Cocina (Kitchen Display System - KDS)

## 1. Propósito
Pantalla operativa para el personal de cocina con actualización rápida, mostrando comandas en estados PENDIENTE, EN_PREPARACION y LISTO con avance de un clic.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Cocina, Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Cocina, Administrador), requiero operar el módulo Tablero de Cocina (Kitchen Display System - KDS) para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/kitchen/queue`: Entrada: Sin parámetros | Salida: Pedidos activos en cocina ordenados por antigüedad
- `POST /api/kitchen/orders/{id}/start`: Entrada: Sin cuerpo | Salida: Cambio de estado a EN_PREPARACION
- `POST /api/kitchen/orders/{id}/ready`: Entrada: Sin cuerpo | Salida: Cambio de estado a LISTO y notificación al mesero

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
