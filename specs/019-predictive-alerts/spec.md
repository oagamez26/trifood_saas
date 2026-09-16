# SPEC: 019-predictive-alerts — Alertas Predictivas Deterministas de Abastecimiento

## 1. Propósito
Algoritmo estadístico/determinista que proyecta demanda histórica por día de la semana, compara con recetas e inventario actual y emite alertas de riesgo con ingrediente limitante.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Administrador), requiero operar el módulo Alertas Predictivas Deterministas de Abastecimiento para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/predictions/alerts`: Entrada: Día objetivo opcional | Salida: Lista de productos con riesgo (ALTO, MEDIO, SIN_RIESGO), capacidad, demanda esperada e ingrediente limitante
- `GET /api/predictions/parameters`: Entrada: Sin parámetros | Salida: Factores de margen de seguridad y días analizados
- `PUT /api/predictions/parameters`: Entrada: Margen de seguridad, umbral | Salida: Parámetros actualizados

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
