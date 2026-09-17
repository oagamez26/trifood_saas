# Diagrama de Secuencia 4: Pagos Múltiples, Abonos Libres y Concurrencia en Caja

Este diagrama representa el soporte integral para múltiples abonos independientes sobre una misma comanda (división de cuenta entre comensales), el cálculo de cambio en efectivo, la protección contra sobrepago, el bloqueo concurrente pesimista (`FOR UPDATE`) y la liberación final de la mesa al liquidar el saldo total a $0.

---

```mermaid
sequenceDiagram
    autonumber
    actor CJ as Cajero (POS Caja)
    participant F as Frontend (CashPage)
    participant API as Backend (CashRouter)
    participant UOW as SqlUnitOfWork (PaymentRepository)
    participant DB as PostgreSQL 16
    actor M as Mesero (Salón)

    %% 1. Consulta Inicial de Mesa
    CJ->>F: Selecciona Mesa 3 en pantalla de Cobro
    F->>API: GET /api/cash/tables/3/summary
    API->>UOW: payments.table_billing_summary(3)
    UOW->>DB: SELECT * FROM orders WHERE table_session_id=...
    UOW->>DB: SELECT * FROM payments WHERE table_session_id=...
    API-->>F: HTTP 200 (Consumo: $150.000, Pagado: $0, Saldo: $150.000)

    %% 2. Pago 1: Abono Libre en Efectivo ($50.000)
    CJ->>F: Ingresa abono de $50.000 en Efectivo (Recibe billete de $60.000)
    F->>API: POST /api/cash/payments {custom_amount: 50000, details: [{method: 'EFECTIVO', amount: 50000}], cash_received: 60000}
    API->>UOW: payments.process_payment(...)
    UOW->>DB: SELECT * FROM table_sessions WHERE id=... FOR UPDATE
    Note over UOW: Bloqueo de fila previene pagos concurrentes desfasados
    Note over UOW: Valida consumo ($50.000) <= saldo_pendiente ($150.000)
    UOW->>DB: INSERT INTO payments (consumption_amount=50000, total_amount=50000, cash_received=60000, cash_change=10000)
    UOW->>DB: INSERT INTO payment_details (payment_method='EFECTIVO', amount=50000)
    UOW->>DB: INSERT INTO invoices (invoice_number='FAC-000101', subtotal=50000, total=50000)
    UOW->>DB: UPDATE cash_sessions SET cash_collected = cash_collected + 50000, sales_amount = sales_amount + 50000
    Note over UOW: Saldo restante = $100.000 (> 0). Sesión sigue abierta.
    UOW->>DB: UPDATE dining_tables SET state = 'PAGO_PARCIAL'
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Cambio: $10.000, Saldo restante: $100.000, Estado: PAGO_PARCIAL)

    %% 3. Pago 2: Abono por Transferencia + Propina ($30.000 + $3.000)
    CJ->>F: Comensal 2 paga $30.000 con $3.000 de propina voluntaria
    F->>API: POST /api/cash/payments {custom_amount: 30000, tip_amount: 3000, details: [{method: 'TRANSFERENCIA', amount: 33000, reference_code: 'NEQUI-9812'}]}
    API->>UOW: payments.process_payment(...)
    UOW->>DB: SELECT * FROM table_sessions WHERE id=... FOR UPDATE
    UOW->>DB: INSERT INTO payments (consumption=30000, tip=3000, total=33000)
    UOW->>DB: INSERT INTO payment_details (method='TRANSFERENCIA', amount=33000)
    UOW->>DB: UPDATE cash_sessions SET transfer_collected = transfer_collected + 33000, tips_amount = tips_amount + 3000
    Note over UOW: Saldo restante = $70.000. Estado sigue PAGO_PARCIAL.
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Saldo restante: $70.000)

    %% 4. Intento de Sobrepago (Rechazo)
    opt Intento de cobro mayor al saldo restante
        CJ->>F: Intento de registrar $80.000 cuando el saldo es $70.000
        F->>API: POST /api/cash/payments {custom_amount: 80000, ...}
        API-->>F: HTTP 422 ("AMOUNT_EXCEEDS_BALANCE: El valor a abonar supera el saldo pendiente")
    end

    %% 5. Pago 3: Liquidación Final y Cierre de Mesa ($70.000 en Tarjeta)
    CJ->>F: Comensal 3 paga los $70.000 restantes con Tarjeta
    F->>API: POST /api/cash/payments {custom_amount: 70000, details: [{method: 'TARJETA', amount: 70000}]}
    API->>UOW: payments.process_payment(...)
    UOW->>DB: SELECT * FROM table_sessions WHERE id=... FOR UPDATE
    UOW->>DB: INSERT INTO payments (consumption=70000, total=70000)
    UOW->>DB: INSERT INTO invoices (invoice_number='FAC-000103', subtotal=70000, total=70000)
    UOW->>DB: UPDATE cash_sessions SET card_collected = card_collected + 70000
    Note over UOW: Saldo restante = $0.00! LIQUIDACIÓN TOTAL.
    UOW->>DB: UPDATE orders SET state = 'PAGADO', closed_at = NOW() WHERE table_session_id=...
    UOW->>DB: UPDATE table_sessions SET state = 'CLOSED', closed_at = NOW() WHERE id=...
    UOW->>DB: UPDATE dining_tables SET state = 'DISPONIBLE' WHERE id=3
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Saldo: $0.00, Mesa liberada a DISPONIBLE)

    %% 6. Notificación a Salón
    M->>F: Actualización de panel de Mesas
    Note over M: Mesa 3 aparece inmediatamente en verde (DISPONIBLE) lista para nuevos clientes
```
