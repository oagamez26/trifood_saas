# SPEC: 012-recipes — Fichas Técnicas, Recetas y Capacidad de Producción

## 1. Propósito
Vincular productos preparados con sus recetas e ingredientes; calcular costo estimado por unidad, capacidad teórica de producción e ingrediente limitante.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Fichas Técnicas, Recetas y Capacidad de Producción para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/recipes/{product_id}`: Entrada: ID de producto | Salida: Receta con desglose de ingredientes y costos
- `PUT /api/recipes/{product_id}`: Entrada: Lista de items (ingrediente, cantidad, unidad) | Salida: Receta guardada y costo recalculado
- `GET /api/recipes/{product_id}/capacity`: Entrada: ID de producto | Salida: Capacidad máxima de producción e ingrediente limitante

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
