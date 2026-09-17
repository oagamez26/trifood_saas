# C4 — Nivel de Código: Caja, Pagos Parciales, Facturación y Cierre

Este diagrama C4 detalla la arquitectura de código implementada para el punto de cobro (POS Caja), la liquidación mediante pagos múltiples o abonos libres, el cálculo exacto de cambio en efectivo, la generación de facturas y el arqueo de cierre de turno.

---

## 1. Elementos Reales del Código

- **Enrutador:** `presentation/cash_routes.py` (`cash_router`)
- **Repositorios:**
  - `infrastructure/repositories.py` (`CashRepository`)
  - `infrastructure/repositories.py` (`PaymentRepository`)
  - `infrastructure/repositories.py` (`InvoiceRepository`)
- **Servicios de Documentos:**
  - `infrastructure/pdf_invoice.py` (`generate_invoice_pdf`, `generate_cash_close_pdf`)
- **Modelos SQLAlchemy:** `infrastructure/models.py`:
  - `CashRegister` (`cash_registers`)
  - `CashSession` (`cash_sessions`)
  - `Payment` (`payments`)
  - `PaymentDetail` (`payment_details`)
  - `Invoice` (`invoices`)
  - `InvoiceLine` (`invoice_lines`)
  - `TableSession` (`table_sessions`)
- **Esquemas Pydantic:** `presentation/cash_routes.py`:
  - `OpenSessionIn`
  - `CloseSessionIn`
  - `ProcessPaymentIn`
  - `PaymentDetailIn`

---

## 2. Diagrama de Clases C4 (Mermaid)

```mermaid
classDiagram
    class CashRouter {
        +list_registers(user, uow)
        +get_active_session(register_id, user, uow)
        +open_cash_session(register_id, data: OpenSessionIn, user, uow)
        +close_cash_session(session_id, data: CloseSessionIn, user, uow)
        +download_close_report_pdf(session_id, user, uow)
        +get_table_billing_summary(table_id, user, uow)
        +process_payment(data: ProcessPaymentIn, user, uow)
        +download_invoice_pdf(invoice_id, user, uow)
    }

    class CashRepository {
        -session: Session
        +registers() list
        +active_session(register_id=None) dict
        +open_session(register_id, cashier_id, initial_cash) dict
        +close_session(session_id, cashier_id, reported_cash, notes) dict
        +session(session_id) dict
    }

    class PaymentRepository {
        -session: Session
        +table_billing_summary(table_id) dict
        +process_payment(table_session_id, cash_session_id, cashier_id, custom_amount, details, cash_received, tip_amount) dict
        +payments_for_table_session(table_session_id) list
    }

    class InvoiceRepository {
        -session: Session
        +create_invoice_for_payment(payment_id, cashier_id, waiter_id, table_number, subtotal, tip, details) dict
        +invoice(invoice_id) dict
    }

    class CashRegister {
        +int id
        +str name
        +bool is_active
        +datetime created_at
    }

    class CashSession {
        +int id
        +int cash_register_id
        +int cashier_id
        +str state
        +Numeric initial_cash
        +Numeric expected_cash
        +Numeric reported_cash
        +Numeric difference
        +str closure_status
        +Numeric sales_amount
        +Numeric tips_amount
        +Numeric total_collected
        +Numeric cash_collected
        +Numeric card_collected
        +Numeric transfer_collected
        +Numeric cash_expenses
        +datetime opened_at
        +datetime closed_at
    }

    class Payment {
        +int id
        +int table_session_id
        +int cash_session_id
        +int cashier_id
        +Numeric consumption_amount
        +Numeric tip_amount
        +Numeric total_amount
        +Numeric cash_received
        +Numeric cash_change
        +datetime created_at
    }

    class PaymentDetail {
        +int id
        +int payment_id
        +str payment_method
        +Numeric amount
        +str reference_code
    }

    class Invoice {
        +int id
        +str invoice_number
        +int payment_id
        +int table_session_id
        +int cashier_id
        +int waiter_id
        +str table_number
        +Numeric subtotal
        +Numeric tip
        +Numeric tax
        +Numeric total
        +str payment_method_summary
        +datetime created_at
    }

    class InvoiceLine {
        +int id
        +int invoice_id
        +int order_line_id
        +int product_id
        +str product_name
        +int quantity
        +Numeric unit_price
        +Numeric subtotal
    }

    CashRouter --> CashRepository : Administra turnos
    CashRouter --> PaymentRepository : Procesa cobros/abonos
    CashRouter --> InvoiceRepository : Emite comprobantes

    PaymentRepository --> CashSession : Acumula totales por medio
    PaymentRepository --> Payment : Crea registro de pago
    Payment "1" *-- "*" PaymentDetail : Métodos mixtos (Efectivo/Tarjeta/Transf)
    Payment "1" o-- "1" Invoice : Genera factura fiscal/equivalente
    Invoice "1" *-- "*" InvoiceLine : Detalle de ítems cobrados

    CashRegister "1" *-- "*" CashSession : Historial de turnos
```

---

## 3. Garantías de Negocio en Código

1. **Abonos Libres y Pagos Múltiples:**
   - En `PaymentRepository.process_payment`:
     - Se valida que `consumption_amount <= pending_balance`. Si se intenta cobrar más del saldo disponible, lanza `AMOUNT_EXCEEDS_BALANCE` (422).
     - Si tras el pago el saldo restante es mayor a $0, la mesa pasa al estado **`PAGO_PARCIAL`** y permanece abierta para recibir abonos adicionales.
     - Únicamente cuando el saldo llega exactamente a $0, la sesión de la mesa se cierra (`state="CLOSED"`) y la mesa física pasa a **`DISPONIBLE`**.
2. **Cálculo Exacto de Cambio en Efectivo:**
   ```python
   if cash_received is not None and cash_received > 0:
       cash_change = max(Decimal("0.00"), Decimal(str(cash_received)) - total_paid_in_cash)
   ```
3. **Discriminación Estricta de Medios en Arqueo:**
   - Solo los abonos en medio `EFECTIVO` suman al efectivo físico esperado en gaveta:
     $$\text{expected\_cash} = \text{initial\_cash} + \text{cash\_collected} - \text{cash\_expenses}$$
   - Los pagos por `TARJETA` o `TRANSFERENCIA` incrementan las ventas globales (`sales_amount`) pero **no** alteran el efectivo en gaveta ni generan descuadres en el arqueo físico.
