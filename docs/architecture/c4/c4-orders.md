# C4 — Nivel de Código: Dominio de Pedidos y Comandas

Este diagrama C4 detalla la estructura de clases, modelos SQLAlchemy, DTOs Pydantic, repositorios y servicios que componen el flujo de **Pedidos y Comandas** en POTOQUITOS.

---

## 1. Elementos Reales del Código

- **Enrutador:** `presentation/orders_routes.py` (`orders_router`)
- **Servicio de Aplicación:** `modules/orders/application/service.py` (`OrdersService`)
- **Repositorio:** `infrastructure/repositories.py` (`OrdersRepository`)
- **Modelos SQLAlchemy:** `infrastructure/models.py`:
  - `Order` (`orders`)
  - `OrderLine` (`order_lines`)
  - `OrderCancellation` (`order_cancellations`)
  - `TableSession` (`table_sessions`)
  - `DiningTable` (`dining_tables`)
- **Esquemas Pydantic:** `presentation/schemas.py`:
  - `CreateOrderIn`
  - `UpdateOrderIn`
  - `OrderLineIn`
  - `CancelOrderIn`
- **Reglas de Dominio:** `shared/domain/rules.py` (`TRANSITIONS`, `transition()`)

---

## 2. Diagrama de Clases C4 (Mermaid)

```mermaid
classDiagram
    class OrdersRouter {
        +list_orders(session_id, user, uow)
        +get_order(order_id, user, uow)
        +create_order(data: CreateOrderIn, user, service)
        +update_order(order_id, data: UpdateOrderIn, user, service)
        +confirm_order(order_id, user, service)
        +send_to_kitchen(order_id, user, service)
        +deliver_order(order_id, user, service)
        +cancel_order(order_id, data: CancelOrderIn, user, service)
    }

    class OrdersService {
        -uow: UnitOfWork
        +create_order(actor, session_id, lines, notes) Order
        +update_order(actor, order_id, lines, notes) Order
        +confirm_order(actor, order_id) Order
        +send_to_kitchen(actor, order_id) Order
        +deliver_order(actor, order_id) Order
        +cancel_order(actor, order_id, reason) Order
    }

    class OrdersRepository {
        -session: Session
        +order(order_id, lock=False) dict
        +orders(session_id=None, active_only=False) list
        +active_order_for_session(session_id, lock=False) dict
        +save_order(data, order_id=None) dict
        +replace_lines(order_id, lines) list
        +save_cancellation(order_id, reason, user_id) dict
    }

    class Order {
        +int id
        +int table_session_id
        +int waiter_id
        +str state
        +bool account_requested
        +bool inventory_deducted
        +str notes
        +datetime created_at
        +datetime confirmed_at
        +datetime in_kitchen_at
        +datetime ready_at
        +datetime delivered_at
        +datetime closed_at
    }

    class OrderLine {
        +int id
        +int order_id
        +int product_id
        +str product_name
        +Decimal unit_price
        +int quantity
        +str notes
    }

    class OrderCancellation {
        +int id
        +int order_id
        +str reason
        +int cancelled_by
        +datetime cancelled_at
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

    class DiningTable {
        +int id
        +str number
        +int capacity
        +bool is_active
        +str state
    }

    OrdersRouter --> OrdersService : Invoca
    OrdersService --> OrdersRepository : Consulta / Persiste
    OrdersRepository --> Order : Manipula
    Order "1" *-- "*" OrderLine : Contiene líneas (cascade delete)
    Order "1" o-- "0..1" OrderCancellation : Registro de anulación
    TableSession "1" *-- "*" Order : Agrupa comandas
    DiningTable "1" *-- "*" TableSession : Sesiones históricas
```

---

## 3. Reglas de Validación en Código

1. **Unicidad de Comanda Activa:**
   ```python
   active = self.uow.orders.active_order_for_session(session_id)
   if active:
       raise DomainError("ORDER_ALREADY_EXISTS", "La mesa ya cuenta con una comanda activa.", 409)
   ```
2. **Modificación Restringida a Borrador (`BORRADOR` / `PENDIENTE`):**
   - Una vez que la orden pasa a `EN_PREPARACION`, cualquier intento de `PATCH /orders/{id}` lanza `ORDER_LOCKED` (409), preservando la integridad del stock cocinado.
3. **Entrega Estricta desde Cocina:**
   - Para ejecutar `deliver_order()`, el pedido debe estar estrictamente en estado `LISTO` (`rules.py: transition(current, "ENTREGADO")`).
