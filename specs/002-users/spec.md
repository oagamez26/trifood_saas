# SPEC: 002-users — Administración de Usuarios y Asignación de Roles

## 1. Propósito
Permitir al Administrador dar de alta, modificar datos, activar/desactivar empleados y asignar uno de los 4 roles (ADMINISTRADOR, MESERO, COCINA, CAJERO).

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Administración de Usuarios y Asignación de Roles para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/users`: Entrada: Filtros de rol, estado | Salida: Lista de usuarios con roles asignados
- `POST /api/users`: Entrada: Datos de empleado y rol | Salida: Usuario creado con contraseña temporal o inicial
- `PATCH /api/users/{id}`: Entrada: Datos modificables o estado | Salida: Usuario actualizado
- `POST /api/users/{id}/reset-password`: Entrada: Nueva contraseña | Salida: Confirmación de restablecimiento

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
