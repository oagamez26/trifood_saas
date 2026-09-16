# SPEC: 007-tables — Gestión y Estados de Mesas Físicas

## 1. Propósito
Administración del mapa de mesas del restaurante y control de sus estados conceptuales: DISPONIBLE, OCUPADA, EN_ATENCION, PENDIENTE_PAGO.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador, Mesero, Cajero.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador, Mesero, Cajero), requiero operar el módulo Gestión y Estados de Mesas Físicas para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/tables`: Entrada: Filtro de estado opcional | Salida: Lista de mesas físicas con estado actual y sesión activa
- `POST /api/tables`: Entrada: Número de mesa, capacidad | Salida: Mesa registrada
- `POST /api/tables/{id}/open-session`: Entrada: Mesero responsable | Salida: Nueva sesión de atención abierta (estado OCUPADA/EN_ATENCION)
- `POST /api/tables/{id}/request-bill`: Entrada: ID de sesión | Salida: Mesa pasa a PENDIENTE_PAGO

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
