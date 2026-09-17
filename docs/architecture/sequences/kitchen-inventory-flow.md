# Diagrama de Secuencia 2: Preparación en Cocina y Descuento Idempotente de Inventario

Este diagrama ilustra el flujo crítico en Cocina cuando se inicia la preparación de una comanda, la validación de stock según el recetario, el descuento atómico de ingredientes, el registro en el **Kardex** inmutable y la garantía estricta de **idempotencia**.

---

```mermaid
sequenceDiagram
    autonumber
    actor C as Cocinero (KDS)
    participant F as Frontend (KitchenPage)
    participant API as Backend (KitchenRouter)
    participant UOW as SqlUnitOfWork (KitchenRepository)
    participant DB as PostgreSQL 16
    actor M as Mesero (TablesOrdersPage)

    %% 1. Inicio de Preparación
    C->>F: Clic en "Iniciar preparación" (Comanda #168)
    F->>API: POST /api/kitchen/orders/168/start
    API->>UOW: kitchen.update_state(168, 'EN_PREPARACION', user_id)
    UOW->>DB: SELECT * FROM orders WHERE id=168 FOR UPDATE

    %% 2. Chequeo de Idempotencia y Recetario
    alt inventory_deducted == False (Primera vez que se prepara)
        UOW->>DB: SELECT * FROM order_lines WHERE order_id=168
        loop Para cada producto en la comanda
            UOW->>DB: SELECT * FROM recipes JOIN recipe_items ON ... WHERE product_id=...
            loop Para cada ingrediente de la receta
                UOW->>DB: SELECT * FROM ingredients WHERE id=... FOR UPDATE
                Note over UOW: Valida stock_disponible >= cantidad_requerida
                alt Stock insuficiente
                    UOW-->>API: Error DomainError("INSUFFICIENT_STOCK", 409)
                    API->>UOW: rollback()
                    API-->>F: HTTP 409 (Stock insuficiente para [Ingrediente])
                else Stock suficiente
                    UOW->>DB: UPDATE ingredients SET stock = stock - cantidad_requerida
                    UOW->>DB: INSERT INTO inventory_movements (movement_type='CONSUMO_POR_PEDIDO', reference='Comanda #168', ...)
                    UOW->>DB: INSERT INTO kardex_entries (movement_type='CONSUMO_POR_PEDIDO', exit_quantity=..., new_balance=..., reference='Comanda #168', ...)
                end
            end
        end
        UOW->>DB: UPDATE orders SET inventory_deducted = TRUE, state = 'EN_PREPARACION'
    else inventory_deducted == True (Reintento o ya descontado)
        Note over UOW: IDEMPOTENCIA: Omite explosión de receta y movimientos de Kardex
        UOW->>DB: UPDATE orders SET state = 'EN_PREPARACION'
    end

    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Estado actualizado a EN_PREPARACION)

    %% 3. Bloqueo Inmutable
    Note over API,DB: A partir de este momento la orden está bloqueada contra modificaciones (ORDER_LOCKED)

    %% 4. Finalización en Cocina
    C->>F: Clic en "Marcar Listo"
    F->>API: POST /api/kitchen/orders/168/ready
    API->>UOW: kitchen.update_state(168, 'LISTO', user_id)
    Note over UOW: Valida transición (EN_PREPARACION -> LISTO). No toca inventario.
    UOW->>DB: UPDATE orders SET state='LISTO', ready_at=NOW()
    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Comanda marcada como LISTO)

    %% 5. Notificación Visual al Mesero
    M->>API: GET /api/tables-orders/orders (Polling cada 5s)
    API-->>M: HTTP 200 (Comanda #168 en estado LISTO con badge visual llamativo)
```
