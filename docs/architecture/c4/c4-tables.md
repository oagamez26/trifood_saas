# C4 — Nivel de Código: Mesas y Ciclo de Vida del Salón

Este diagrama C4 documenta la gestión de mesas del salón, la máquina de estados de las sesiones de servicio y el ciclo de vida operativo desde la apertura hasta la liberación final de la mesa.

---

## 1. Elementos Reales del Código

- **Enrutador:** `presentation/orders_routes.py` (Endpoints `/tables-orders/tables/*`)
- **Servicio:** `modules/orders/application/service.py` (`OrdersService`)
- **Repositorio:** `infrastructure/repositories.py` (`OrdersRepository`)
- **Modelos SQLAlchemy:** `infrastructure/models.py`:
  - `DiningTable` (`dining_tables`)
  - `TableSession` (`table_sessions`)
  - `Order` (`orders`)
  - `Payment` (`payments`)
- **Índice Condicional de Base de Datos:**
  - `uq_open_table_session`: Garantiza a nivel PostgreSQL que una mesa solo pueda tener una sesión activa (`state == 'OPEN'`).

---

## 2. Diagrama de Clases C4 (Mermaid)

```mermaid
classDiagram
    class TablesEndpoints {
        +list_tables(active_only, user, service)
        +create_table(data: CreateTableIn, user, service)
        +update_table(table_id, data: UpdateTableIn, user, service)
        +open_table_session(table_id, data: OpenTableIn, user, service)
        +request_account(table_id, user, service)
        +get_prefactura(table_id, user, service)
        +close_table(table_id, user, service)
    }

    class OrdersService {
        -uow: UnitOfWork
        +tables(actor) list
        +create_table(actor, number, capacity) dict
        +update_table(actor, identity, data) dict
        +open_table(actor, table_id, people_count) dict
        +request_account(actor, table_id) dict
        +prefactura(actor, table_id) dict
        +close_table(actor, table_id) dict
    }

    class OrdersRepository {
        -session: Session
        +table(table_id, lock=False) dict
        +tables(active_only=False) list
        +save_table(data, table_id=None) dict
        +active_session(table_id, lock=False) dict
        +open_session(table_id, waiter_id, people_count) dict
        +close_session(session_id) dict
        +update_table_state(table_id, state) dict
    }

    class DiningTable {
        +int id
        +str number
        +int capacity
        +bool is_active
        +str state
        +datetime created_at
        +datetime updated_at
    }

    class TableSession {
        +int id
        +int table_id
        +int waiter_id
        +int people_count
        +str state
        +datetime opened_at
        +datetime closed_at
    }

    TablesEndpoints --> OrdersService : Invoca casos de uso
    OrdersService --> OrdersRepository : Ejecuta transacciones
    OrdersRepository --> DiningTable : Modifica estado
    OrdersRepository --> TableSession : Crea / Cierra sesión
    DiningTable "1" *-- "*" TableSession : Sesiones históricas
```

---

## 3. Máquina de Estados de la Mesa (`DiningTable.state`)

```mermaid
stateDiagram-v2
    [*] --> DISPONIBLE : Mesa creada en el sistema

    DISPONIBLE --> OCUPADA : Mesero abre mesa (POST /tables/{id}/open)
    OCUPADA --> EN_ATENCION : Pedido confirmado / en cocina / entregado

    EN_ATENCION --> CUENTA_SOLICITADA : Mesero solicita cuenta (POST /tables/{id}/request-account)
    
    CUENTA_SOLICITADA --> PAGO_PARCIAL : Abono parcial en Caja (saldo pendiente > 0)
    PAGO_PARCIAL --> PAGO_PARCIAL : Abonos parciales sucesivos

    PAGO_PARCIAL --> DISPONIBLE : Pago final en Caja (saldo pendiente = 0)
    CUENTA_SOLICITADA --> DISPONIBLE : Pago total directo en Caja (saldo pendiente = 0)

    DISPONIBLE --> [*] : Inactivación o eliminación (si no tiene sesiones activas)
```

### Reglas de Integridad Implementadas:
1. **Protección contra Inactivación:**
   - No es posible inactivar ni eliminar una mesa que tenga un servicio activo abierto (`TABLE_BUSY` 409).
2. **Protección contra Cobro Prematuro:**
   - La mesa solo es cobrable en Caja (`is_billable: true`) cuando su estado es `CUENTA_SOLICITADA` o `PAGO_PARCIAL`. Intentar cobrar antes genera `ACCOUNT_NOT_REQUESTED` (409) u `ORDER_NOT_DELIVERED` (409).
