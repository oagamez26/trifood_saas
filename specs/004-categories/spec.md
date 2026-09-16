# SPEC: 004-categories — Gestión de Categorías del Catálogo

## 1. Propósito
Permitir la organización de productos en categorías (Hamburguesas, Perros, Picadas, Bebidas) con orden de visualización y estado activo.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Gestión de Categorías del Catálogo para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/categories`: Entrada: Filtro activo opcional | Salida: Lista ordenada de categorías
- `POST /api/categories`: Entrada: Nombre, orden, estado | Salida: Categoría creada
- `PUT /api/categories/{id}`: Entrada: Datos actualizados | Salida: Categoría actualizada

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
