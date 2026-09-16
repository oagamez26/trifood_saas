# SPEC: 001-auth — Autenticación y Seguridad de Acceso

## 1. Propósito
Gestionar el inicio de sesión seguro, emisión y revocación de tokens JWT/sesión, validación de estado de usuario y cierre de sesión para todos los roles del restaurante.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador, Mesero, Cocina, Cajero.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador, Mesero, Cocina, Cajero), requiero operar el módulo Autenticación y Seguridad de Acceso para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `POST /api/auth/login`: Entrada: Credenciales (username, password) | Salida: Tokens de acceso, datos del usuario y permisos efectivos
- `POST /api/auth/refresh`: Entrada: Refresh token | Salida: Nuevo access token
- `POST /api/auth/logout`: Entrada: Token activo | Salida: Confirmación de revocación
- `GET /api/auth/me`: Entrada: Bearer token | Salida: Perfil actual y roles autorizados

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
