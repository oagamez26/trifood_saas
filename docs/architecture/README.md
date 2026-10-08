# Arquitectura del Sistema POTOQUITOS — Documentación Oficial

Este directorio contiene la documentación técnica y arquitectónica formal del sistema **POTOQUITOS**, modelada bajo el estándar **C4 Model** (Contexto, Contenedores, Componentes y Código), complementada con diagramas de secuencia de flujos críticos de negocio y el modelo de datos relacional (ERD).

Toda la documentación aquí presentada ha sido validada directamente contra el código fuente en producción, modelos SQLAlchemy, migraciones de Alembic, controladores FastAPI y componentes React.

---

## Índice General de Navegación

### 1. [Visión General de la Arquitectura](./architecture-overview.md)
- Resumen ejecutivo del sistema.
- Principios de diseño (Separación de incumbencias, transaccionalidad ACID, inmutabilidad de Kardex).
- [Leer Documento de Visión General](./architecture-overview.md)

### 2. [Stack Tecnológico Real](./architecture-overview.md#2-stack-tecnológico-real)
- **Frontend:** React 19, TypeScript 5.8, Vite, React Router DOM 7, Lucide Icons, Vanilla CSS Design System.
- **Backend:** FastAPI 0.115, Python 3.11/3.14, SQLAlchemy 2.0, Alembic, ReportLab, OpenPyXL.
- **Persistencia:** PostgreSQL 16 Alpine con índices parciales y bloqueos pesimistas.
- **Infraestructura:** Docker Compose, Nginx 1.27 Alpine (Proxy Inverso y servidor estático).
- [Detalle de Versiones y Justificación](./architecture-overview.md#2-stack-tecnológico-real)

### 3. [Estilo Arquitectónico](./architecture-overview.md#1-estilo-arquitectónico)
- **Monolito Modular con Arquitectura en Capas:**
  - Capa de Presentación (FastAPI Routers + Pydantic Schemas).
  - Capa de Aplicación (Services + Generadores de Documentos).
  - Capa de Dominio (Entidades, Validadores y Máquina de Estados).
  - Capa de Infraestructura (SQLAlchemy Models, 13 Repositorios y `SqlUnitOfWork`).
- [Ver Explicación de Capas](./architecture-overview.md#3-capas-de-la-arquitectura-backend)

---

## Modelo C4 Completo

### 4. [C1 — Diagrama de Contexto](./c4/c1-context.md)
- Representación del sistema POTOQUITOS como núcleo central.
- Actores reales del negocio: Administrador, Mesero, Personal de Cocina, Cajero y Comensal.
- Delimitación estricta de fronteras y responsabilidades.
- [Ver Diagrama C1 de Contexto](./c4/c1-context.md)

### 5. [C2 — Diagrama de Contenedores](./c4/c2-containers.md)
- Unidades de ejecución: Frontend Web (SPA), Nginx Reverse Proxy, Backend API (FastAPI), Base de Datos (PostgreSQL 16) y Almacén de Archivos Multimedia (`catalog_media`).
- Protocolos de comunicación (HTTP REST JSON, SQL/TCP, I/O de archivos).
- [Ver Diagrama C2 de Contenedores](./c4/c2-containers.md)

### 6. [C3 — Componentes del Backend](./c4/c3-backend.md)
- Descomposición de controladores (`auth`, `catalog`, `orders`, `kitchen`, `inventory`, `cash`, `expenses`, `analytics`, `settings`).
- Servicios de aplicación (`AuthService`, `CatalogService`, `OrdersService`).
- Repositorios especializados y el patrón transaccional `SqlUnitOfWork`.
- Documentación de la arquitectura híbrida (Servicios desacoplados vs. Repositorios ricos).
- [Ver Diagrama C3 del Backend](./c4/c3-backend.md)

### 7. [C3 — Componentes del Frontend](./c4/c3-frontend.md)
- Descomposición de la SPA React: Enrutador (`App.tsx`), `AuthContext`, `ProtectedRoute`, `AppShell` y el componente reutilizable `Drawer`.
- Módulos funcionales de interfaz (POS Mesas, KDS Cocina, POS Caja, Inventario, Reportes).
- Cliente unificado de servicios HTTP (`api.ts`).
- [Ver Diagrama C3 del Frontend](./c4/c3-frontend.md)

### 8. Nivel C4 de Código (Módulos Críticos)
- **[C4 — Pedidos y Comandas](./c4/c4-orders.md):** Clases `Order`, `OrderLine`, `TableSession`, `OrdersService` y validaciones de comanda activa única.
- **[C4 — Cocina, Inventario y Kardex](./c4/c4-kitchen-inventory.md):** Clases `KitchenRepository`, `InventoryRepository`, `RecipeItem`, explosión de recetas y garantía de descuento idempotente.
- **[C4 — Caja, Pagos y Facturación](./c4/c4-cash-payments.md):** Clases `CashSession`, `Payment`, `PaymentDetail`, `Invoice`, gestión de abonos libres y cálculo de cambio.
- **[C4 — Mesas y Ciclo de Vida](./c4/c4-tables.md):** Clases `DiningTable`, estados del salón y máquina de estados finitos.

---

## Diagramas de Secuencia (Procesos de Negocio)

### 9. Procesos Operativos Extremo a Extremo
- **[Secuencia 1 — Flujo de Creación y Despacho de Pedidos](./sequences/order-flow.md):**
  Apertura de mesa → Comanda borrador → Edición permitida → Confirmación a cocina.
- **[Secuencia 2 — Preparación e Idempotencia de Inventario](./sequences/kitchen-inventory-flow.md):**
  KDS recibe pedido → Inicia preparación → Consulta receta → Descuento atómico en Kardex → Idempotencia ante reintentos → Platos listos.
- **[Secuencia 3 — Entrega, Prefactura y Solicitud de Cuenta](./sequences/delivery-account-flow.md):**
  Entrega física de platos → Consulta de prefactura preliminar (impresión térmica 80mm) → Solicitud formal de cuenta → Habilitación en caja.
- **[Secuencia 4 — Pagos Múltiples, Abonos Libres y Concurrencia](./sequences/partial-payment-flow.md):**
  Abonos sucesivos independientes → Medios mixtos (Efectivo/Tarjeta/Transferencia) → Cálculo de cambio → Bloqueo pesimista de fila → Cierre de mesa al saldo llegar a $0.
- **[Secuencia 5 — Cierre de Turno de Caja y Arqueo](./sequences/cash-closing-flow.md):**
  Apertura con base en efectivo → Discriminación de medios → Conteo de gaveta → Cálculo de diferencia (CUADRADA, SOBRANTE, FALTANTE) → Emisión de informe PDF.

---

## Persistencia y Seguridad

### 10. [Modelo de Datos Relacional (ERD PostgreSQL)](./database/erd.md)
- Diagrama Entidad-Relación del modelo documentado. El dump PostgreSQL activo contiene 30 tablas de aplicación más `alembic_version`.
- El ERD documenta `catalog_audit_events`, contrastada con el dump del esquema activo.
- Claves primarias, foráneas, restricciones de no negatividad (`CHECK`) e índices parciales condicionales (`uq_open_table_session`, `uq_open_cash_session`).
- [Ver Diagrama ERD](./database/erd.md)

### 11. [Seguridad y Matriz de Roles (RBAC)](./architecture-overview.md#5-seguridad-y-control-de-acceso-rbac)
- Autenticación mediante tokens JWT con revocación instantánea mediante `token_version`.
- Roles base: `ADMINISTRADOR`, `MESERO`, `COCINA`, `CAJERO`.
- Tabla de auditoría inmutable (`audit_events`).

### 12. [Despliegue e Infraestructura](./architecture-overview.md#6-despliegue-e-infraestructura-docker-composeyml)
- Topología de tres contenedores Docker (`db`, `backend`, `frontend`).
- Persistencia de volúmenes `postgres_data` y `catalog_media`.
- Configuración de Nginx como proxy inverso hacia FastAPI (`/api/`) y archivos multimedia (`/media/`).

---

## 13. Decisiones Arquitectónicas Registradas (ADRs)

1. **Monolito Modular vs. Microservicios:**
   - Se preserva el monolito modular dado el tamaño del equipo y la necesidad de transacciones atómicas inmediatas entre comanda, inventario y caja. Evita latencias de red, orquestación distribuida (Saga/2PC) y puntos de falla innecesarios.
2. **Descuento de Inventario en `EN_PREPARACION`:**
   - El inventario se descuenta de forma irreversible en el momento en que Cocina acepta y comienza a preparar el plato (momento real de transformación física de la materia prima), garantizando que las mermas o cancelaciones posteriores queden auditadas en Kardex.
3. **Múltiples Pagos Parciales por Mesa:**
   - La mesa admite múltiples transacciones independientes de pago (en diferentes momentos y con diferentes medios) hasta que el saldo pendiente sea $0, momento en el cual se libera automáticamente el salón.
4. **Drawers Responsivos sin Fullscreen en Desktop:**
   - Los paneles laterales secundarios respetan escalas de ancho (`sm`: 480px, `md`: 680px, `lg`: 880px, `xl`: 1040px) y no se apropian del 100% de la pantalla de escritorio, manteniendo visible el contexto operativo de fondo.
