# Arquitectura General del Sistema POTOQUITOS

Este documento describe la arquitectura técnica real y vigente del sistema **POTOQUITOS**, derivada directamente de la inspección del código fuente, modelos, servicios, controladores, configuraciones y artefactos de despliegue.

---

## 1. Estilo Arquitectónico

El sistema POTOQUITOS implementa un **Monolito Modular con Arquitectura en Capas (Layered Modular Monolith)**.

### Características Clave:
- **Despliegue Cohesivo:** Un único backend unificado gestiona todos los subdominios de negocio (Autenticación, Catálogo, Mesas, Pedidos, Cocina, Inventario, Caja, Facturación, Gastos, Reportes y Predicciones).
- **Separación Lógica en Capas:** Estricta separación entre Presentación (FastAPI Routers), Aplicación (Services y Use Cases), Dominio (Reglas, Validadores y Estados) e Infraestructura (SQLAlchemy ORM, Repositorios, ReportLab, OpenPyXL, Almacenamiento de Medios).
- **Patrón Unit of Work (UoW):** Transacciones atómicas coordinadas a través de `SqlUnitOfWork`, garantizando consistencia ACID sobre PostgreSQL.
- **Frontend SPA Desacoplado:** Aplicación de página única construida en React + TypeScript servida estáticamente vía Nginx y comunicada exclusivamente mediante API RESTful JSON.

---

## 2. Stack Tecnológico Real

| Capa / Componente | Tecnología Seleccionada | Versión / Detalle en Código | Justificación Técnica en el Proyecto |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React | 19.x (`^19.0.0`) | Biblioteca para construcción de interfaces basada en componentes funcionales y Hooks. |
| **Tipado Frontend** | TypeScript | 5.8.x (`~5.8.2`) | Tipado estático estricto para interfaces de pedidos, pagos, mesas y catálogo. |
| **Bundler Frontend** | Vite | 8.2.x (`^8.2.2`) | Entorno de desarrollo rápido y empaquetado optimizado en chunks de producción. |
| **Enrutamiento Web** | React Router DOM | 7.2.x (`^7.2.0`) | Enrutamiento del lado del cliente con rutas protegidas (`ProtectedRoute`) y públicas (`/menu`, `/login`). |
| **Estilos Frontend** | Vanilla CSS + Design System | Variables CSS (`index.css`) | Tokens semánticos de diseño (`--color-primary`, etc.), Drawers responsivos (`sm`, `md`, `lg`, `xl`) y print media. |
| **Iconografía** | Lucide React | 1.16.x (`^1.16.0`) | Iconos vectoriales coherentes para KDS, comanda, caja y mesas. |
| **Backend Framework**| FastAPI | 0.115.x (`^0.115.0`) | Framework web asíncrono de alto rendimiento con validación automática vía Pydantic v2. |
| **Servidor ASGI** | Uvicorn | 0.34.x (`^0.34.0`) | Servidor ASGI estándar para ejecución del backend en contenedores. |
| **Lenguaje Backend** | Python | 3.11 / 3.14 compatible | Lenguaje de tipado dinámico con soporte de type hints para lógica empresarial. |
| **ORM / Acceso a Datos**| SQLAlchemy | 2.0.x (`^2.0.38`) | Mapeo objeto-relacional con soporte de bloqueo pesimista (`with_for_update`) y Unit of Work. |
| **Migraciones DB** | Alembic | 1.14.x (`^1.14.1`) | Versionado e historial secuencial de esquemas (`0003`, `0004`, `0005`). |
| **Motor de Base de Datos**| PostgreSQL | 16-alpine | RDBMS relacional estricto con soporte de claves foráneas, índices parciales y transacciones concurrentes. |
| **Generación de PDF**| ReportLab | 4.4.x (`^4.4.4`) | Generación programática de facturas de venta, actas de arqueo de caja e informes gerenciales. |
| **Exportación Excel** | OpenPyXL | 3.1.x (`^3.1.5`) | Generación nativa de libros contables XLSX multihioja formateados con estilos y fórmulas. |
| **Seguridad y Cripto**| PyJWT + Werkzeug | PyJWT 2.10.x, Werkzeug 3.1.x | Hashing de claves (`pbkdf2:sha256`) y generación/validación de tokens Bearer JWT con rotación de versión. |
| **Proxy / Servidor Web**| Nginx | 1.27-alpine | Servidor proxy inverso para tráfico `/api/` y servidor de archivos estáticos HTML/JS/CSS. |
| **Contenedores** | Docker & Docker Compose | Compose Spec v3 | Orquestación local de 3 servicios: `db`, `backend` y `frontend`. |

---

## 3. Capas de la Arquitectura Backend

El backend se organiza en cuatro capas bien diferenciadas dentro del paquete `backend/fastapi_app/`:

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                     │
│  (FastAPI Routers: Auth, Catalog, Orders, Kitchen, etc.)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     CAPA DE APLICACIÓN                      │
│  (Services: AuthService, CatalogService, OrdersService)     │
│  (Report Generators: PDF Invoice, Accounting Excel Export)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      CAPA DE DOMINIO                        │
│  (Rules: TRANSITIONS, Validadores, Entidades de Negocio)    │
│  (Ports / Interfaces: UnitOfWork Protocol)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE INFRAESTRUCTURA                   │
│  (SQLAlchemy Repositories, SqlUnitOfWork, Models, Media)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PERSISTENCIA: POSTGRESQL 16                 │
└─────────────────────────────────────────────────────────────┘
```

### 1. Capa de Presentación (`fastapi_app/presentation/`)
- **Routers HTTP:** `auth_routes.py`, `catalog_routes.py`, `orders_routes.py`, `kitchen_routes.py`, `inventory_routes.py`, `cash_routes.py`, `expenses_routes.py`, `analytics_routes.py`, `settings_routes.py`.
- **Inyección de Dependencias (`dependencies.py`):** Suministra instancias de `get_current_user` (validación de token JWT y resolución de permisos efectivos) y `get_uow` (gestión del ciclo de vida del Unit of Work por solicitud).
- **Validación de Solicitudes:** Pydantic Schemas (`schemas.py`) que imponen restricciones de tipos, alias y obligatoriedad.

### 2. Capa de Aplicación (`fastapi_app/modules/*/application/`)
- **Casos de Uso Formales:**
  - `AuthService`: Orquesta inicio de sesión, cambio de contraseña obligatoria, auditoría y administración de colaboradores.
  - `CatalogService`: Gestiona categorización, creación de platos, actualización de versiones de precio y carga de fotografías.
  - `OrdersService`: Administra apertura de mesas, comandas borrador, adición de líneas y transiciones de estado.
- **Generadores Especializados (`fastapi_app/infrastructure/`):**
  - `pdf_invoice.py`: Renderiza facturas oficiales (`FAC-XXXXXX`), arqueos de cierre de turno e informes gerenciales.
  - `accounting_export.py`: Construye el libro de contabilidad en formato Excel (`.xlsx`) con 3 hojas: *Ventas y Cobros*, *Gastos y Egresos* y *Resumen Contable*.

### 3. Capa de Dominio (`fastapi_app/shared/domain/`)
- **Reglas de Negocio Inmutables (`rules.py`):**
  - `TRANSITIONS`: Máquina de estados finitos que gobierna las órdenes:
    `BORRADOR` → `CONFIRMADO` → `EN_COCINA` → `EN_PREPARACION` → `LISTO` → `ENTREGADO`.
  - `require(actor, permission)`: Enforzamiento estricto de RBAC antes de ejecutar cualquier acción protegida.
  - Validadores de dominio: formato de moneda (`money`), cantidades enteras positivas (`positive_integer`), formato de texto (`text`) y política estricta de contraseñas (`password_policy`).
  - `DomainError`: Excepción canónica de negocio que traduce códigos (`ORDER_LOCKED`, `INSUFFICIENT_STOCK`, `ACCOUNT_NOT_REQUESTED`, etc.) a códigos HTTP adecuados (403, 404, 409, 422).

### 4. Capa de Infraestructura (`fastapi_app/infrastructure/`)
- **Modelos de Datos (`models.py`):** 21 tablas relacionales declaradas mediante SQLAlchemy Declarative Base.
- **Repositorios de Datos (`repositories.py`):** 13 repositorios especializados que encapsulan consultas SQL, agregaciones y operaciones transaccionales.
- **SqlUnitOfWork (`SqlUnitOfWork`):** Agrupa todos los repositorios bajo una misma sesión SQLAlchemy con métodos `commit()`, `rollback()` y `close()`.
- **Almacenamiento de Medios (`images.py`):** Almacenamiento local de fotografías validadas con sanitización de nombres y tipo MIME.

---

## 4. Persistencia y Consistencia de Datos

1. **Garantía Transaccional ACID:**
   - Cada solicitud HTTP que modifica estado opera dentro de una transacción gestionada por el generador `uow()`.
   - Si ocurre una excepción no controlada o un `DomainError`, se ejecuta automáticamente `rollback()`.
   - Si la operación concluye exitosamente, el controlador o servicio invoca explícitamente `uow.commit()`.
2. **Control de Concurrencia (Bloqueo Pesimista):**
   - Para prevenir condiciones de carrera en pagos concurrentes sobre una misma mesa o apertura simultánea de comandas, los repositorios aplican `with_for_update()` en PostgreSQL:
     ```python
     query = select(model).where(model.id == identity).with_for_update()
     ```
3. **Restricciones de Integridad en Base de Datos:**
   - Claves foráneas con eliminación en cascada (`ondelete="CASCADE"`) en líneas de comanda, detalles de pago y recetas.
   - Restricciones `CHECK` para precios no negativos, stock no negativo y montos mayores a cero.
   - Índices únicos parciales (`postgresql_where`) para garantizar que una mesa o una caja física tenga **a lo sumo una sesión abierta activa** simultáneamente (`uq_open_table_session`, `uq_open_cash_session`).

---

## 5. Seguridad y Control de Acceso (RBAC)

El sistema opera bajo un modelo **Role-Based Access Control (RBAC)** con las siguientes garantías:

1. **Autenticación Basada en Tokens:**
   - Tokens JWT firmados criptográficamente mediante algoritmo HMAC-SHA256 (`HS256`).
   - El payload del token contiene `sub` (ID de usuario) y `token_version`.
   - Si el usuario cambia su contraseña o es revocado, se incrementa `token_version` en base de datos, invalidando inmediatamente todos los tokens anteriores.
2. **Matriz de Roles y Permisos (`seed.py`):**
   - **`ADMINISTRADOR`:** Acceso total a los 45 permisos del sistema (gestión de usuarios, catálogo, inventario, reportes, caja, configuración).
   - **`MESERO`:** Permisos operativos para ver mesas, abrir sesiones, crear/actualizar comandas en borrador, enviar a cocina, solicitar cuenta y marcar entrega.
   - **`COCINA`:** Acceso al KDS (Kitchen Display System) para visualizar cola de preparación y avanzar pedidos de `EN_PREPARACION` a `LISTO`. Bloqueado de alterar comensales, entregar pedidos o cobrar.
   - **`CAJERO`:** Acceso a apertura y cierre de turno de caja, consulta de prefacturas, procesamiento de pagos/abonos e impresión de comprobantes.
3. **Trazabilidad y Auditoría:**
   - Tabla `audit_events` registra eventos críticos (`LOGIN`, `PASSWORD_CHANGED`, `ORDER_CANCELLED`, `STOCK_ADJUSTED`, `ACCESS_DENIED`) con marca de tiempo UTC y payload JSON estructurado.

---

## 6. Despliegue e Infraestructura (`docker-compose.yml`)

La aplicación se ejecuta como un conjunto de tres contenedores orquestados con Docker Compose:

1. **`potoquitos-db-1` (PostgreSQL 16 Alpine):**
   - Puerto interno: 5432.
   - Volumen persistente: `postgres_data` montado en `/var/lib/postgresql/data`.
   - Healthcheck activo mediante comando `pg_isready`.
2. **`potoquitos-backend-1` (FastAPI / Python 3.11):**
   - Expuesto en el puerto host `5000:5000`.
   - Volumen persistente: `catalog_media` montado en `/app/media/products`.
   - Depende de `db` con condición `service_healthy`.
3. **`potoquitos-frontend-1` (Nginx 1.27 Alpine):**
   - Expuesto en el puerto host `8080:80`.
   - Sirve los activos estáticos HTML/JS/CSS generados por Vite.
   - Proxy reverso interno configurado en `docker/nginx.conf`:
     - `/api/` → `http://backend:5000`
     - `/media/` → `http://backend:5000/media/`
     - `/` → fallback a `/index.html` para SPA routing.
