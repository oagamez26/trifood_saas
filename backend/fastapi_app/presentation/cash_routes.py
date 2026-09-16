from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, AliasChoices
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require
from ..infrastructure.pdf_invoice import generate_invoice_pdf

router = APIRouter(prefix="/api/cash", tags=["cash"])


class OpenSessionIn(BaseModel):
    initial_cash: float


class CloseSessionIn(BaseModel):
    reported_cash: float = Field(validation_alias=AliasChoices("reported_cash", "counted_cash"))
    notes: Optional[str] = None


class PaymentDetailIn(BaseModel):
    payment_method: str = Field(validation_alias=AliasChoices("payment_method", "method"))
    amount: float
    reference_code: Optional[str] = None


class ProcessPaymentIn(BaseModel):
    table_session_id: int
    cash_session_id: int
    details: Optional[List[PaymentDetailIn]] = None
    payments: Optional[List[Any]] = None
    cash_received: Optional[float] = None
    tip_amount: Optional[float] = 0.0


@router.get("/registers")
def list_registers(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "cash.view")
    return uow.cash.registers()


@router.get("/active-session")
def get_active_session(register_id: Optional[int] = None, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "cash.view")
    return uow.cash.active_session(register_id)


@router.post("/registers/{register_id}/open")
def open_cash_session(register_id: int, data: OpenSessionIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "cash.open")
    res = uow.cash.open_session(register_id, user["id"], data.initial_cash)
    uow.commit()
    return res


@router.post("/sessions/{session_id}/close")
def close_cash_session(session_id: int, data: CloseSessionIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "cash.close")
    res = uow.cash.close_session(session_id, data.reported_cash, data.notes)
    uow.commit()
    return res


@router.get("/sessions/history")
def cash_sessions_history(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "cash.view")
    return uow.cash.sessions_history()


@router.get("/tables/{table_id}/summary")
def get_table_payment_summary(table_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "payment.view")
    return uow.payments.table_summary(table_id)


@router.post("/payments")
@router.post("/pay")
def process_payment(data: ProcessPaymentIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "payment.process")
    if data.details:
        details_dict = [d.model_dump() for d in data.details]
    elif data.payments:
        details_dict = [
            {"payment_method": p.get("method") or p.get("payment_method", "EFECTIVO"), "amount": p["amount"]}
            for p in data.payments
        ]
    else:
        details_dict = []
    res = uow.payments.process_payment(
        table_session_id=data.table_session_id,
        cash_session_id=data.cash_session_id,
        cashier_id=user["id"],
        details=details_dict,
        cash_received=data.cash_received,
    )
    uow.commit()
    return res


@router.get("/invoices")
def list_invoices(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "invoice.view")
    return uow.invoices.invoices()


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "invoice.view")
    return uow.invoices.invoice(invoice_id)


@router.get("/invoices/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "invoice.view")
    inv = uow.invoices.invoice(invoice_id)
    settings = uow.settings.all()
    pdf_bytes = generate_invoice_pdf(inv, settings)
    filename = f"{inv['invoice_number']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )
