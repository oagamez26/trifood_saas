# SPEC: 020-settings — Configuración del Restaurante y Créditos

## 1. Propósito
Parámetros de empresa (nombre, logo, NIT/documento, dirección, teléfono), prefijo de factura, activación de métodos de pago y créditos oficiales (Carlos Reales, Orlando Agamez).

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Configuración del Restaurante y Créditos para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/settings`: Entrada: Sin parámetros | Salida: Configuración completa del restaurante y créditos
- `PUT /api/settings`: Entrada: Datos actualizados | Salida: Configuración guardada

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
