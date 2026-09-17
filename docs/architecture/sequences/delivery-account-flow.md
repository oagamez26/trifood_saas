# Diagrama de Secuencia 3: Entrega del Pedido, Prefactura y Solicitud de Cuenta

Este diagrama ilustra el flujo operativo de control de mesa cuando Cocina marca la comanda como lista, el Mesero realiza la entrega física en la mesa, consulta la Prefactura preliminar para el cliente y formaliza la Solicitud de Cuenta que habilita el cobro en Caja.

---

```mermaid
sequenceDiagram
    autonumber
    actor M as Mesero (Salón)
    participant F as Frontend (TablesOrdersPage)
    participant API as Backend (OrdersRouter / OrdersService)
    participant UOW as SqlUnitOfWork
    participant DB as PostgreSQL 16
    actor CJ as Cajero (Caja / POS)

    %% 1. Verificación de Entrega
    M->>F: Visualiza badge LISTO en Mesa 3
    M->>F: Lleva los platos a la mesa y pulsa "Marcar Entregado"
    F->>API: POST /api/tables-orders/orders/168/deliver
    API->>UOW: orders.deliver_order(actor, 168)
    Note over API: Valida que state == 'LISTO' (si no, lanza ORDER_NOT_READY_FOR_DELIVERY 409)
    UOW->>DB: UPDATE orders SET state='ENTREGADO', delivered_at=NOW()
    UOW->>DB: UPDATE dining_tables SET state='ENTREGADO' (o EN_ATENCION)
    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Pedido en estado ENTREGADO)

    %% 2. Intento de Cobro Prematuro en Caja (Bloqueo)
    CJ->>API: POST /api/cash/payments (Intento prematuro de cobro sin solicitar cuenta)
    API-->>CJ: HTTP 409 Conflict ("ACCOUNT_NOT_REQUESTED: La mesa no tiene cuenta solicitada")

    %% 3. Consulta de Prefactura Preliminar
    M->>F: Cliente pide la cuenta; Mesero abre "Prefactura"
    F->>API: GET /api/tables-orders/tables/3/prefactura
    API->>UOW: orders.prefactura(actor, 3)
    UOW->>DB: SELECT * FROM orders WHERE table_session_id=...
    UOW->>DB: SELECT * FROM payments WHERE table_session_id=...
    Note over API: Calcula consumo total, abonos ya realizados, saldo pendiente y propina sugerida (10%)
    API-->>F: HTTP 200 (Datos de Prefactura / NO ACREDITA PAGO)
    opt Impresión de Prefactura
        M->>F: Clic en "Imprimir prefactura"
        F->>F: Ejecuta window.print() (@media print: renderiza ticket térmico de 80mm)
    end

    %% 4. Solicitud Formal de Cuenta
    M->>F: Clic en "Solicitar cuenta"
    F->>API: POST /api/tables-orders/tables/3/request-account
    API->>UOW: orders.request_account(actor, 3)
    UOW->>DB: UPDATE orders SET account_requested = TRUE
    UOW->>DB: UPDATE dining_tables SET state = 'CUENTA_SOLICITADA'
    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Mesa pasa a CUENTA_SOLICITADA)

    %% 5. Habilitación en Caja
    CJ->>API: GET /api/cash/tables/3/summary
    API-->>CJ: HTTP 200 (is_billable: True, pendiente_balance: $81.000)
    Note over CJ: La mesa ahora está desbloqueada y lista para recibir pagos o abonos en Caja
```
