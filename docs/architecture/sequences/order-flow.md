# Diagrama de Secuencia 1: Flujo de Creación y Despacho de Pedido

Este diagrama ilustra el flujo operativo real desde que el Mesero abre la mesa, ingresa los productos en comanda borrador, realiza modificaciones permitidas y confirma el pedido hacia la cola de Cocina.

---

```mermaid
sequenceDiagram
    autonumber
    actor M as Mesero (App / Mobile)
    participant F as Frontend (TablesOrdersPage)
    participant API as Backend (OrdersRouter / OrdersService)
    participant UOW as SqlUnitOfWork
    participant DB as PostgreSQL 16
    actor C as Cocina (KDS)

    %% 1. Apertura de Mesa
    M->>F: Selecciona mesa disponible e ingresa comensales (ej. 3)
    F->>API: POST /api/tables-orders/tables/{table_id}/open {people_count: 3}
    API->>UOW: orders.open_session(table_id, waiter_id, 3)
    UOW->>DB: INSERT INTO table_sessions (table_id, waiter_id, people_count, state='OPEN')
    UOW->>DB: UPDATE dining_tables SET state='OCUPADA'
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Session creada #ID)

    %% 2. Creación de Pedido Borrador
    M->>F: Agrega platos del menú (Hamburguesa x2, Picada x1)
    F->>API: POST /api/tables-orders/orders {session_id, lines: [...], notes}
    API->>UOW: orders.active_order_for_session(session_id)
    Note over API,UOW: Valida que no exista otra orden activa en la mesa (ORDER_ALREADY_EXISTS si existe)
    UOW->>DB: INSERT INTO orders (table_session_id, state='BORRADOR', ...)
    UOW->>DB: INSERT INTO order_lines (order_id, product_id, quantity, unit_price, ...)
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Order #ID en estado BORRADOR)

    %% 3. Modificación en Borrador
    opt Cliente solicita ajuste antes de enviar
        M->>F: Ajusta especificaciones (ej. "Término 3/4", elimina un ítem)
        F->>API: PATCH /api/tables-orders/orders/{order_id} {lines: [...], notes}
        API->>UOW: orders.order(order_id, lock=True)
        Note over API: Valida que state == 'BORRADOR' (si está en preparación lanza ORDER_LOCKED)
        UOW->>DB: UPDATE order_lines / DELETE / INSERT
        UOW->>DB: COMMIT
        API-->>F: HTTP 200 (Order actualizada)
    end

    %% 4. Confirmación y Enrutamiento a Cocina
    M->>F: Clic en "Confirmar y Enviar a Cocina"
    F->>API: POST /api/tables-orders/orders/{order_id}/confirm
    API->>UOW: orders.update_order_state(order_id, 'CONFIRMADO')
    UOW->>DB: UPDATE orders SET state='CONFIRMADO', confirmed_at=NOW()
    F->>API: POST /api/tables-orders/orders/{order_id}/send-to-kitchen
    API->>UOW: orders.update_order_state(order_id, 'EN_COCINA')
    UOW->>DB: UPDATE orders SET state='EN_COCINA', in_kitchen_at=NOW()
    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Comanda en cola)

    %% 5. Notificación a KDS
    C->>API: GET /api/kitchen/queue (Polling periódico)
    API->>UOW: kitchen.queue()
    UOW->>DB: SELECT orders WHERE state IN ('CONFIRMADO', 'EN_COCINA', 'EN_PREPARACION')
    API-->>C: HTTP 200 (Lista de comandas activas incluye nueva comanda)
```
