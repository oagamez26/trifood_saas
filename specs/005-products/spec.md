# SPEC: 005-products — Gestión de Productos del Menú

## 1. Propósito
Crear y mantener productos con nombre, código interno, descripción, precio en COP versionado, imagen, categoría y disponibilidad.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Gestión de Productos del Menú para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/products`: Entrada: Filtros por categoría, disponibilidad | Salida: Lista de productos paginada
- `POST /api/products`: Entrada: Datos de producto y precio | Salida: Producto creado con versión de precio 1
- `PATCH /api/products/{id}`: Entrada: Campos actualizables | Salida: Producto actualizado
- `POST /api/products/{id}/price`: Entrada: Nuevo precio, versión actual | Salida: Precio actualizado con registro en histórico
- `POST /api/products/{id}/image`: Entrada: Archivo de imagen | Salida: Referencia de imagen actualizada

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
