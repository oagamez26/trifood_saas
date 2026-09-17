# Diagrama de Secuencia 5: Cierre de Turno de Caja, Arqueo Físico e Informe PDF

Este diagrama modela el ciclo de vida del turno de caja: apertura con base inicial, acumulación discriminada de pagos y egresos, conteo físico a ciegas o guiado, cálculo automático de descuadre y emisión del acta oficial de cierre en PDF.

---

```mermaid
sequenceDiagram
    autonumber
    actor CJ as Cajero (Turno)
    participant F as Frontend (CashPage)
    participant API as Backend (CashRouter)
    participant UOW as SqlUnitOfWork (CashRepository)
    participant PDF as PDF Service (ReportLab)
    participant DB as PostgreSQL 16
    actor ADM as Administrador

    %% 1. Apertura de Turno
    CJ->>F: Ingresa base de inicio en efectivo (ej. $200.000)
    F->>API: POST /api/cash/registers/1/open {initial_cash: 200000}
    API->>UOW: cash.open_session(1, cashier_id, 200000)
    Note over UOW: Valida que no exista otra sesión OPEN en la caja (uq_open_cash_session)
    UOW->>DB: INSERT INTO cash_sessions (cash_register_id=1, initial_cash=200000, state='OPEN', opened_at=NOW())
    UOW->>DB: COMMIT
    API-->>F: HTTP 201 (Sesión de Caja #ID abierta)

    %% 2. Operación del Turno (Discriminación de Medios)
    Note over API,DB: Durante el turno se procesan pagos y egresos:
    Note over API,DB: + Efectivo cobrado: $80.000 (afecta gaveta física)
    Note over API,DB: + Tarjeta cobrado: $50.000 (banco/datáfono, no afecta gaveta)
    Note over API,DB: - Gasto en efectivo: $20.000 (salida justificada de gaveta)

    %% 3. Arqueo y Conteo Físico
    CJ->>F: Finaliza turno; cuenta el efectivo físico en gaveta ($260.000)
    CJ->>F: Ingresa $260.000 en el Drawer de Arqueo y Cierre
    F->>API: POST /api/cash/sessions/{session_id}/close {reported_cash: 260000, notes: 'Turno tarde'}
    API->>UOW: cash.close_session(session_id, cashier_id, 260000, 'Turno tarde')
    
    %% 4. Cálculo de Descuadre y Estado
    Note over UOW: expected_cash = initial_cash (200.000) + cash_collected (80.000) - cash_expenses (20.000) = $260.000
    Note over UOW: difference = reported_cash (260.000) - expected_cash (260.000) = $0.00
    Note over UOW: closure_status = 'CUADRADA' (diferencia == 0)
    
    UOW->>DB: UPDATE cash_sessions SET reported_cash=260000, expected_cash=260000, difference=0, closure_status='CUADRADA', state='CLOSED', closed_at=NOW()
    UOW->>DB: COMMIT
    API-->>F: HTTP 200 (Arqueo exitoso: CUADRADA)

    %% 5. Generación del Informe Oficial en PDF
    CJ->>F: Clic en "Descargar Acta de Cierre PDF"
    F->>API: GET /api/cash/sessions/{session_id}/report.pdf
    API->>UOW: cash.session(session_id)
    API->>PDF: generate_cash_close_pdf(session_data)
    Note over PDF: ReportLab compila tabla de arqueo, desglose por medio, diferencias y firma de responsabilidad
    PDF-->>API: Buffer binario PDF (application/pdf)
    API-->>F: Descarga documento `cierre_caja_{session_id}.pdf`
    
    %% 6. Auditoría y Supervisión
    ADM->>API: GET /api/analytics/dashboard
    API-->>ADM: Refleja balance auditado y cierre de turno consolidado
```
