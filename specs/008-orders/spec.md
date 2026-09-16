# SPEC: 008-orders — Toma y Gestión de Pedidos por Mesa

## 1. Propósito
Permitir al Mesero asociar pedidos a una mesa con atención activa, agregar líneas con cantidades y notas, confirmar y enviar a cocina.

## 2. Alcance
- Funcionalidades incluidas: Flujo operativo correspondiente al módulo en POTOQUITOS.
- Exclusiones: Ninguna funcionalidad fuera del alcance de la Constitución de POTOQUITOS.

## 3. Actores y Permisos
- Actores: Mesero, Administrador.
- Requiere autenticación: Sí, validación de sesión y rol en FastAPI.

## 4. Historias de Usuario
- Como usuario autorizado (Mesero, Administrador), requiero operar el módulo Toma y Gestión de Pedidos por Mesa para mantener la fluidez del restaurante.

## 5. Reglas de Negocio y Estados
- Integridad referencial en base de datos.
- Operaciones financieras en pesos colombianos (COP).
- No estados inconsistentes ni duplicados.

## 6. Endpoints
- `GET /api/orders`: Entrada: Filtro por mesa, sesión o estado | Salida: Lista de pedidos
- `POST /api/orders`: Entrada: ID mesa/sesión, líneas (producto, cantidad, notas) | Salida: Pedido creado en BORRADOR o CONFIRMADO
- `POST /api/orders/{id}/send-kitchen`: Entrada: Sin cuerpo | Salida: Pedido enviado a cocina y consumo de ingredientes descontado
- `POST /api/orders/{id}/cancel`: Entrada: Motivo de cancelación | Salida: Pedido cancelado con motivo registrado

## 7. Criterios de Aceptación
- Endpoints protegidos por RBAC según corresponda.
- Respuestas en formato JSON estándar con códigos HTTP 200, 201, 400, 401, 403, 404, 409, 422.
- Cobertura de pruebas automatizadas.
