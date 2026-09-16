# SPEC: 016-invoices — Emisión y Descarga de Facturas PDF

## 1. Propósito
Generación automática de factura con numeración correlativa secuencial (FAC-000001), desglose de pedidos, mesa, cajero, mesero y visor/descarga de PDF.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Cajero, Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Cajero, Administrador), requiero operar el módulo Emisión y Descarga de Facturas PDF para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/invoices`: Entrada: Filtro por fecha o número | Salida: Listado de facturas emitidas
- `GET /api/invoices/{id}/pdf`: Entrada: ID factura | Salida: Archivo binario PDF generado para impresión/descarga
- `GET /api/invoices/{id}`: Entrada: ID factura | Salida: Detalle de factura en JSON

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
