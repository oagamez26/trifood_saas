# SPEC: 006-public-menu — Menú Público Digital de Consulta

## 1. Propósito
Página pública responsive optimizada para móviles, accesible sin autenticación, mostrando el catálogo gastronómico de Potoquitos sin compras web ni carrito.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Cliente Público.
- Requiere autenticación: No.

## 4. Historias de Usuario
- Como usuario autorizado (Cliente Público), requiero operar el módulo Menú Público Digital de Consulta para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/public/menu`: Entrada: Sin parámetros | Salida: Estructura de categorías con productos disponibles, fotos y precios en COP

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
