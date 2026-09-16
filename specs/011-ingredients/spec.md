# SPEC: 011-ingredients — Catálogo de Ingredientes y Unidades Base

## 1. Propósito
Definición de insumos gastronómicos con nombre, unidad base (kg, g, L, ml, und, paquete, caja, porcion), stock actual, stock mínimo y costo de referencia.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Catálogo de Ingredientes y Unidades Base para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/ingredients`: Entrada: Filtro activo o bajo stock | Salida: Lista de ingredientes con stock y unidades
- `POST /api/ingredients`: Entrada: Datos de insumo | Salida: Ingrediente creado
- `PUT /api/ingredients/{id}`: Entrada: Datos actualizados | Salida: Ingrediente modificado

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
