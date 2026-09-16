# CONSTITUCIÓN DEL SISTEMA POTOQUITOS

Versión: 2.0.0
Estado: ACTIVA Y VINCULANTE
Ámbito: Sistema Integral de Restaurante POTOQUITOS

---

## 1. MISIÓN Y PRINCIPIOS FUNDAMENTALES

1.1. **Propósito Único:** POTOQUITOS es un sistema web concebido exclusivamente para la operación técnica, comercial, operativa y gerencial del restaurante físico POTOQUITOS.
1.2. **No SaaS / No Multi-tenant:** El sistema es monoinquilino, sin roles de Super Admin, sin suscripciones, sin planes de cobro ni gestión multi-sucursal.
1.3. **Simplicidad y Robustez:** Se adopta un monolito modular con Vertical Slice Architecture sobre PostgreSQL. No se permiten microservicios, brokers innecesarios (Kafka, RabbitMQ, Redis) ni arquitecturas sobrecomplejas.
1.4. **Consistencia Visual con Google Stitch:** La fuente de verdad visual es el proyecto oficial de Google Stitch. La estética es profesional, gastronómica, moderna, sobria y clara, usando la paleta institucional (azul `#1255a0`, azul profundo `#173b65`, rojo carmesí `#b11f2a` y fondos `#f5f7fa`). No se permite glassmorphism, temas oscuros no solicitados, ni interfaces infantiles.

---

## 2. STACK TECNOLÓGICO OBLIGATORIO

2.1. **Backend:** Python 3.12+ con FastAPI, Pydantic v2 y validaciones estrictas en cada capa.
2.2. **Frontend:** React 19 con TypeScript, Vite, React Router v7 y Vanilla CSS / CSS Modules estructurado con tokens de diseño.
2.3. **Base de Datos:** PostgreSQL con ORM SQLAlchemy 2.0 (estilo 2.0 declarativo con tipos y `Mapped`).
2.4. **Migraciones:** Alembic como único mecanismo autorizado para definir y evolucionar el esquema de base de datos.
2.5. **Contenedores:** Docker y Docker Compose (`compose.yaml`) con healthchecks rigurosos.
2.6. **API:** Arquitectura REST pura, códigos de estado HTTP semánticos y payloads JSON estructurados.

---

## 3. LÍMITES ESTRICTOS DE ALCANCE (FUERA DEL ALCANCE)

Está terminantemente PROHIBIDO implementar o mantener:
- Multi-tenancy o múltiples restaurantes.
- Super Admin global.
- Planes, pasarelas de pago online o suscripciones.
- Proveedores, órdenes de compra externas o abastecimiento complejo (las entradas de inventario son registradas directamente por el Administrador).
- Carrito de compras web, checkout para clientes o delivery.
- Pedidos directos desde el menú público (el menú público es estrictamente informativo y de consulta).
- Reservas de mesas o pagos online.
- Programas de fidelización o puntos de fidelidad.
- Controladores directos de impresoras físicas (la impresión se apoya en el diálogo nativo del navegador / visor PDF).
- Contabilidad contable general de partida doble o nómina avanzada.
- Auditoría general exhaustiva no justificada.
- Integración de IA generativa (las predicciones se basan en algoritmos estadísticos y deterministas explicables).

---

## 4. CONTROL DE ACCESO BASADO EN ROLES (RBAC)

4.1. **Roles Oficiales:**
- `ADMINISTRADOR`: Acceso integral a todas las funciones, catálogos, finanzas, usuarios y configuración. Debe existir siempre al menos un Administrador activo.
- `MESERO`: Gestión de mesas físicas, toma y confirmación de pedidos, envío a cocina y solicitud de cuenta.
- `COCINA`: Recepción de pedidos, preparación y cambio de estado a listo.
- `CAJERO`: Gestión de sesiones de caja (apertura/cierre), cobro consolidado de mesas, registro de pagos y emisión de facturas PDF.

4.2. **Seguridad del Servidor:**
- La validación de roles y permisos se ejecuta forzosamente en el Backend mediante dependencias de FastAPI (`require_role`, `require_permission`).
- El Frontend adapta la navegación y controles visuales, pero nunca sustituye la seguridad del servidor.
- Contraseñas almacenadas exclusivamente con algoritmos de derivación de claves seguros (bcrypt/argon2/pbkdf2). Nunca en texto claro.
- Manejo de tokens de sesión y autenticación sin exponer secretos en el repositorio ni en clientes.

---

## 5. FLUJO OPERATIVO Y REGLAS TRANSACCIONALES

5.1. **Ciclo de Atención:**
`CLIENTE consulta MENÚ PÚBLICO` → `MESERO selecciona MESA` → `Crea PEDIDO` → `Envía a COCINA` (`PENDIENTE` → `EN_PREPARACION` → `LISTO`) → `MESERO entrega` → `CLIENTE solicita cuenta` (`MESA PENDIENTE_PAGO`) → `CAJERO cobra en CAJA` → `Consolidación de pedidos` → `Registro de pago` → `Generación de FACTURA PDF` → `MESA vuelve a DISPONIBLE`.

5.2. **Consumo de Inventario y Kardex:**
- El descuento de ingredientes por productos preparados se ejecuta de manera ATÓMICA y TRANSACCIONAL en base de datos.
- Se confirma en el momento de envío del pedido a cocina o confirmación del pedido.
- No se permiten descuentos parciales silenciosos ni doble descuento por reintentos concurrentes.
- Cada movimiento de inventario genera un registro inmutable en el Kardex con cantidades de entrada/salida, saldo anterior y saldo posterior. Las correcciones se realizan únicamente mediante movimientos compensatorios o reversiones.

5.3. **Cajas, Pagos e Idempotencia:**
- No es posible registrar cobros sin una sesión de caja ABIERTA por un cajero responsable.
- Métodos permitidos: `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `NEQUI`, `DAVIPLATA`, `OTRO`, con soporte para pagos mixtos.
- Cálculo de cambio en efectivo: `CAMBIO = RECIBIDO - TOTAL`.
- El cobro es IDEMPOTENTE: se previene de forma estricta el cobro duplicado de una mesa o pedido mediante locks o comprobaciones de estado a nivel de transacción.
- La factura PDF se genera con numeración correlativa secuencial (`FAC-000001`...) garantizando integridad contable interna.

5.4. **Cierre de Caja y Arqueo:**
- Se calcula automáticamente el efectivo esperado (`BASE_INICIAL + PAGOS_EN_EFECTIVO`).
- El cajero reporta el efectivo físico real.
- La diferencia (`REPORTADO - ESPERADO`) determina el resultado (`CUADRADA`, `SOBRANTE`, `FALTANTE`), requiriendo justificación si existe discrepancia.

---

## 6. INTELIGENCIA PREDICTIVA Y REPORTES

6.1. **Alertas Predictivas Deterministas:**
- Algoritmo matemático transparente: Demanda histórica por día de la semana + recetas activas + inventario actual + margen de seguridad.
- Estados de alerta: `RIESGO_ALTO`, `RIESGO_MEDIO`, `SIN_RIESGO`, `DATOS_INSUFICIENTES`.
- Identificación automática de la capacidad de producción y del **ingrediente limitante**, con sugerencia de reabastecimiento en unidades físicas base.

6.2. **Márgenes y Separación de Costos:**
- Costo de producción = `Receta × Costo unitario de ingredientes`.
- Margen bruto estimado = `Ventas - Costo estimado vendido`.
- Resultado operativo estimado = `Margen bruto estimado - Gastos operativos registrados`.
- No se le denomina "utilidad neta contable".

---

## 7. CALIDAD, TESTING Y DESPLIEGUE

7.1. **Pruebas Automatizadas Obligatorias:**
- Suite de pruebas en backend validando flujos completos de login, RBAC, mesa-pedido-cocina, deducción de inventario, Kardex, apertura-cobro-cierre de caja, y motor predictivo.
- Verificación estricta de tipos en TypeScript (`tsc -b`) y build de producción de Vite.
7.2. **Despliegue Contenerizado:**
- Entorno multi-contenedor orquestado vía Docker Compose con imágenes reproducibles y variables de entorno documentadas en `.env.example`.
