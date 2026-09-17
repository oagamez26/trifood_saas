from typing import Optional
from decimal import Decimal
import xml.etree.ElementTree as ET
import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require
from ..infrastructure import models as m


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard/summary")
@router.get("/dashboard")
def get_dashboard_summary(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "report.view")
    sales = uow.reports.sales_summary()
    all_tables = uow.orders.tables()
    active_tables = [t for t in all_tables if t.get("is_active", True)]
    occupied_tables = sum(1 for t in active_tables if t.get("state") in ("OCUPADA", "EN_ATENCION", "PENDIENTE_PAGO"))
    kitchen_queue = uow.kitchen.queue()
    alerts = uow.predictions.alerts()
    urgent_alerts = [a for a in alerts if a.get("status") == "RIESGO_ALTO"]
    
    ingredients = uow.inventory.ingredients(active_only=True)
    critical_ingredients = [
        i for i in ingredients if float(i.get("stock") or i.get("current_stock") or 0) <= float(i.get("min_stock", 0))
    ]
    
    active_orders_query = (
        select(m.Order)
        .join(m.TableSession, m.Order.table_session_id == m.TableSession.id)
        .where(
            m.TableSession.state == "OPEN",
            m.Order.state.in_(["BORRADOR", "CONFIRMADO", "EN_COCINA", "EN_PREPARACION", "LISTO"]),
        )
        .order_by(m.Order.created_at.desc())
    )
    active_orders = uow.session.scalars(active_orders_query).all()
    recent_orders = []
    for o in active_orders:
        tbl_num = (
            o.table_session.table.number
            if o.table_session and o.table_session.table
            else str(o.table_session_id)
        )
        waiter = uow.auth.user(o.waiter_id) if hasattr(uow, "auth") else None
        waiter_name = f"{waiter.get('first_name', '')} {waiter.get('last_name', '')}".strip() if waiter else "Servicio"
        tot = sum(float(l.unit_price) * l.quantity for l in o.lines)
        recent_orders.append({
            "id": o.id,
            "table_number": tbl_num,
            "waiter_name": waiter_name or "Servicio",
            "state": o.state,
            "total": tot,
            "created_at": str(o.created_at)[:16].replace("T", " "),
        })

    return {
        "sales_today": float(sales.get("total_sales", 0)),
        "orders_today": int(sales.get("orders_count", 0)),
        "tables_total": len(active_tables),
        "tables_occupied": occupied_tables,
        "kitchen_pending_orders": len(kitchen_queue),
        "urgent_alerts_count": len(urgent_alerts),
        "urgent_alerts": urgent_alerts,
        "critical_stock_count": len(critical_ingredients),
        "critical_ingredients": critical_ingredients,
        "recent_orders": recent_orders,
        "sales": sales,
    }


@router.get("/reports/sales")
@router.get("/sales")
def get_sales_report(
    period_type: str = Query("all", pattern="^(all|daily|monthly|custom)$"),
    date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "report.view")
    from datetime import datetime, date as d_date, time as d_time, timezone
    import calendar
    from ..shared.domain.rules import DomainError

    start_dt = None
    end_dt = None

    if from_date and to_date:
        try:
            f_d = datetime.strptime(from_date, "%Y-%m-%d").date()
            t_d = datetime.strptime(to_date, "%Y-%m-%d").date()
            if f_d > t_d:
                raise DomainError("INVALID_DATE_RANGE", "La fecha inicial no puede ser posterior a la fecha final.", 422)
            start_dt = datetime.combine(f_d, d_time.min, tzinfo=timezone.utc)
            end_dt = datetime.combine(t_d, d_time.max, tzinfo=timezone.utc)
            period_type = "custom"
        except ValueError:
            raise DomainError("INVALID_DATE_FORMAT", "Las fechas deben tener el formato YYYY-MM-DD.", 422)
    elif period_type == "daily" and date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.combine(d, d_time.min, tzinfo=timezone.utc)
            end_dt = datetime.combine(d, d_time.max, tzinfo=timezone.utc)
            from_date = date
            to_date = date
        except ValueError:
            pass
    elif period_type == "monthly" and month and year:
        last_day = calendar.monthrange(year, month)[1]
        start_dt = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        from_date = f"{year}-{month:02d}-01"
        to_date = f"{year}-{month:02d}-{last_day:02d}"

    sales = uow.reports.sales_summary(from_date=start_dt, to_date=end_dt)
    op = uow.reports.operating_result(from_date=start_dt, to_date=end_dt)

    total_sales = float(sales.get("total_sales", 0))
    total_consumption = float(sales.get("total_consumption", 0))
    total_tips = float(sales.get("total_tips", 0))
    cogs = float(op.get("estimated_cogs", 0))
    expenses = float(op.get("total_expenses", 0))
    net_profit = float(op.get("estimated_operating_result", 0))
    margin_pct = round((net_profit / total_sales * 100), 1) if total_sales > 0 else 0.0

    methods_breakdown = sales.get("methods_breakdown", {})
    methods_counts = sales.get("methods_count", {})
    methods_list = [
        {"method": k, "amount": float(v), "count": int(methods_counts.get(k, 1 if float(v) > 0 else 0))}
        for k, v in methods_breakdown.items()
    ]

    # TOP PRODUCTOS HISTÓRICOS (FILTRADOS POR EL PERÍODO EXACTO)
    line_q = (
        select(
            m.OrderLine.product_name,
            sa.func.sum(m.OrderLine.quantity).label("total_qty"),
            sa.func.sum(m.OrderLine.quantity * m.OrderLine.unit_price).label("total_sales"),
        )
        .join(m.Order, m.OrderLine.order_id == m.Order.id)
        .where(m.Order.state != "CANCELADO")
    )
    if start_dt:
        line_q = line_q.where(m.Order.created_at >= start_dt)
    if end_dt:
        line_q = line_q.where(m.Order.created_at <= end_dt)
    line_q = line_q.group_by(m.OrderLine.product_name).order_by(sa.desc("total_sales")).limit(10)
    top_prods_res = uow.session.execute(line_q).all() if hasattr(uow, "session") else []
    top_products = [
        {"name": row[0], "quantity": float(row[1] or 0), "total": float(row[2] or 0)}
        for row in top_prods_res
    ]

    # EVOLUCIÓN DE VENTAS SEMANAL / DIARIA
    weekday_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    weekday_totals = {name: 0.0 for name in weekday_names}
    pay_query = select(m.Payment)
    if start_dt:
        pay_query = pay_query.where(m.Payment.created_at >= start_dt)
    if end_dt:
        pay_query = pay_query.where(m.Payment.created_at <= end_dt)
    payments = uow.session.scalars(pay_query).all() if hasattr(uow, "session") else []
    for p in payments:
        if getattr(p, "created_at", None):
            w_name = weekday_names[p.created_at.weekday()]
            weekday_totals[w_name] += float(p.total_amount)

    max_day_sales = max(weekday_totals.values()) if weekday_totals else 0.0
    sales_by_day = [
        {
            "day": d,
            "amount": round(weekday_totals[d], 2),
            "percentage": round((weekday_totals[d] / max_day_sales * 100)) if max_day_sales > 0 else 0,
        }
        for d in weekday_names
    ]

    return {
        "period_type": period_type,
        "from_date": from_date,
        "to_date": to_date,
        "total_sales": total_sales,
        "total_consumption": total_consumption,
        "total_tips": total_tips,
        "orders_count": sales.get("orders_count", 0),
        "average_ticket": float(sales.get("ticket_average", 0)),
        "estimated_cost": cogs,
        "estimated_expenses": expenses,
        "estimated_net_profit": net_profit,
        "margin_percentage": margin_pct,
        "sales_by_day": sales_by_day,
        "sales_by_method": methods_list,
        "top_products": top_products,
    }


@router.get("/reports/pdf")
def export_sales_report_pdf(
    period_type: str = Query("all", pattern="^(all|daily|monthly|custom)$"),
    date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "report.view")
    from ..infrastructure.pdf_invoice import generate_sales_report_pdf

    rep = get_sales_report(period_type, date, month, year, from_date, to_date, user, uow)
    if from_date and to_date:
        label = f"{from_date} al {to_date}"
        filename = f"POTOQUITOS_REPORTE_{from_date}_{to_date}.pdf"
    elif period_type == "daily" and date:
        label = f"Día {date}"
        filename = f"POTOQUITOS_REPORTE_{date}_{date}.pdf"
    elif period_type == "monthly" and month and year:
        label = f"Mes {month:02d}/{year}"
        filename = f"POTOQUITOS_REPORTE_{year}_{month:02d}.pdf"
    elif period_type == "custom" and from_date and to_date:
        label = f"{from_date} al {to_date}"
        filename = f"POTOQUITOS_REPORTE_{from_date}_{to_date}.pdf"
    else:
        label = "Histórico Completo"
        filename = "POTOQUITOS_REPORTE_historico.pdf"

    settings = uow.settings.all()
    pdf_bytes = generate_sales_report_pdf(rep, label, settings)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/accounting/excel")
def export_accounting_excel(
    from_date: str = Query(..., description="Fecha inicial YYYY-MM-DD"),
    to_date: str = Query(..., description="Fecha final YYYY-MM-DD"),
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "report.view")
    from datetime import datetime, time as d_time, timezone
    from ..shared.domain.rules import DomainError
    from ..infrastructure.accounting_export import ExcelAccountingExporter

    try:
        f_d = datetime.strptime(from_date, "%Y-%m-%d").date()
        t_d = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise DomainError("INVALID_DATE_FORMAT", "Las fechas deben tener el formato YYYY-MM-DD.", 422)

    if f_d > t_d:
        raise DomainError("INVALID_DATE_RANGE", "La fecha inicial no puede ser posterior a la fecha final.", 422)

    start_dt = datetime.combine(f_d, d_time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(t_d, d_time.max, tzinfo=timezone.utc)

    # Consultar transacciones en rango
    payments_query = (
        select(m.Payment)
        .where(m.Payment.created_at >= start_dt, m.Payment.created_at <= end_dt)
        .order_by(m.Payment.created_at.asc())
    )
    payments = uow.session.scalars(payments_query).all()

    payments_data = []
    for p in payments:
        inv = p.invoice
        ts = p.table_session
        tbl = ts.table if ts else None
        c_name = f"{p.cashier.first_name} {p.cashier.last_name}" if p.cashier else "?"
        reg_name = p.cash_session.cash_register.name if p.cash_session and p.cash_session.cash_register else "?"

        efec = sum(Decimal(str(d.amount)) for d in p.details if d.payment_method.upper() in ("EFECTIVO", "CASH"))
        tarj = sum(Decimal(str(d.amount)) for d in p.details if d.payment_method.upper() in ("TARJETA", "CARD", "DEBITO", "CREDITO"))
        trans = sum(Decimal(str(d.amount)) for d in p.details if d.payment_method.upper() not in ("EFECTIVO", "CASH", "TARJETA", "CARD", "DEBITO", "CREDITO"))

        concept = "Consumo salón"
        if inv and inv.lines:
            concept = ", ".join(f"{il.product_name} x{il.quantity}" for il in inv.lines[:3])
            if len(inv.lines) > 3:
                concept += f" (+{len(inv.lines)-3} más)"

        dt = p.created_at
        payments_data.append({
            "date": dt.strftime("%d/%m/%Y") if dt else "",
            "time": dt.strftime("%H:%M:%S") if dt else "",
            "invoice_number": inv.invoice_number if inv else f"PAG-{p.id}",
            "table_number": tbl.number if tbl else (inv.table_number if inv else "?"),
            "cashier_name": c_name,
            "register_name": reg_name,
            "concept": concept,
            "consumption_amount": float(p.consumption_amount or p.total_amount),
            "tip_amount": float(p.tip_amount or 0),
            "tax_amount": float(inv.tax) if inv else 0.0,
            "total_amount": float(p.total_amount),
            "payment_method_summary": ", ".join(sorted(set(d.payment_method for d in p.details))),
            "cash_amount": float(efec),
            "card_amount": float(tarj),
            "transfer_amount": float(trans),
        })

    # Consultar gastos en rango
    exp_query = (
        select(m.Expense)
        .where(m.Expense.expense_date >= start_dt, m.Expense.expense_date <= end_dt)
        .order_by(m.Expense.expense_date.asc())
    )
    expenses = uow.session.scalars(exp_query).all()
    expenses_data = []
    for e in expenses:
        cat_name = e.category.name if e.category else "General"
        resp_name = f"{e.responsible_user.first_name} {e.responsible_user.last_name}" if e.responsible_user else "?"
        edt = e.expense_date
        c_at = e.created_at
        expenses_data.append({
            "date": edt.strftime("%d/%m/%Y") if edt else (c_at.strftime("%d/%m/%Y") if c_at else ""),
            "time": c_at.strftime("%H:%M:%S") if c_at else "00:00:00",
            "category_name": cat_name,
            "description": e.concept or "",
            "reference": e.notes or "",
            "amount": float(e.amount),
            "payment_method": "EFECTIVO",
            "responsible_name": resp_name,
        })

    exporter = ExcelAccountingExporter()
    data = {"payments": payments_data, "expenses": expenses_data}
    from_str = f_d.strftime("%d/%m/%Y")
    to_str = t_d.strftime("%d/%m/%Y")
    excel_bytes = exporter.export(data, from_str, to_str)

    filename = f"potoquitos_contabilidad_{from_date}_{to_date}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/xml")
@router.get("/accounting/xml")
def export_sales_report_xml(
    from_date: str = Query(..., description="Fecha inicial YYYY-MM-DD"),
    to_date: str = Query(..., description="Fecha final YYYY-MM-DD"),
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "report.view")
    from datetime import datetime, time as d_time, timezone
    from ..shared.domain.rules import DomainError

    try:
        f_d = datetime.strptime(from_date, "%Y-%m-%d").date()
        t_d = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise DomainError("INVALID_DATE_FORMAT", "Las fechas deben tener el formato YYYY-MM-DD.", 422)

    if f_d > t_d:
        raise DomainError("INVALID_DATE_RANGE", "La fecha inicial no puede ser posterior a la fecha final.", 422)

    start_dt = datetime.combine(f_d, d_time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(t_d, d_time.max, tzinfo=timezone.utc)

    # 1. Resumen de ventas y resultado
    rep_summary = get_sales_report(
        period_type="custom",
        from_date=from_date,
        to_date=to_date,
        user=user,
        uow=uow,
    )

    # 2. Consultar transacciones de pago en el período
    payments_query = (
        select(m.Payment)
        .where(m.Payment.created_at >= start_dt, m.Payment.created_at <= end_dt)
        .order_by(m.Payment.created_at.asc())
    )
    payments = uow.session.scalars(payments_query).all() if hasattr(uow, "session") else []

    # 3. Consultar gastos en el período
    exp_query = (
        select(m.Expense)
        .where(m.Expense.expense_date >= f_d, m.Expense.expense_date <= t_d)
        .order_by(m.Expense.expense_date.asc())
    )
    expenses = uow.session.scalars(exp_query).all() if hasattr(uow, "session") else []

    # 4. Construir árbol XML según estándar POTOQUITOS
    root = ET.Element("ReportePotoquitos")

    # <Periodo>
    periodo = ET.SubElement(root, "Periodo")
    f_ini = ET.SubElement(periodo, "FechaInicio")
    f_ini.text = from_date
    f_fin = ET.SubElement(periodo, "FechaFin")
    f_fin.text = to_date

    # <Resumen>
    resumen = ET.SubElement(root, "Resumen")
    tv = ET.SubElement(resumen, "TotalVentas")
    tv.text = f"{rep_summary.get('total_sales', 0):.2f}"
    tcons = ET.SubElement(resumen, "TotalConsumo")
    tcons.text = f"{rep_summary.get('total_consumption', 0):.2f}"
    tp = ET.SubElement(resumen, "TotalPropinas")
    tp.text = f"{rep_summary.get('total_tips', 0):.2f}"
    tg = ET.SubElement(resumen, "TotalGastos")
    tg.text = f"{rep_summary.get('estimated_expenses', 0):.2f}"
    nped = ET.SubElement(resumen, "NumeroPedidos")
    nped.text = str(rep_summary.get('orders_count', 0))
    tprom = ET.SubElement(resumen, "TicketPromedio")
    tprom.text = f"{rep_summary.get('average_ticket', 0):.2f}"
    marg = ET.SubElement(resumen, "MargenOperativoPorcentaje")
    marg.text = f"{rep_summary.get('margin_percentage', 0):.1f}"

    # <MediosPago>
    medios_elem = ET.SubElement(root, "MediosPago")
    for m_item in rep_summary.get("sales_by_method", []):
        m_node = ET.SubElement(
            medios_elem,
            "Medio",
            tipo=str(m_item.get("method", "")),
            transacciones=str(m_item.get("count", 0)),
        )
        m_node.text = f"{m_item.get('amount', 0):.2f}"

    # <Ventas>
    ventas_elem = ET.SubElement(root, "Ventas")
    for p in payments:
        inv = getattr(p, "invoice", None)
        ts = getattr(p, "table_session", None)
        tbl_num = ts.table.number if ts and ts.table else (inv.table_number if inv else "?")
        cashier_name = f"{p.cashier.first_name} {p.cashier.last_name}" if getattr(p, "cashier", None) else "Sistema"
        dt_str = p.created_at.strftime("%Y-%m-%d") if p.created_at else ""
        tm_str = p.created_at.strftime("%H:%M:%S") if p.created_at else ""

        v_node = ET.SubElement(
            ventas_elem,
            "Venta",
            id=str(p.id),
            factura=inv.invoice_number if inv else f"PAG-{p.id}",
            fecha=dt_str,
            hora=tm_str,
            mesa=str(tbl_num),
            cajero=str(cashier_name),
            consumo=f"{(p.consumption_amount or p.total_amount):.2f}",
            propina=f"{(p.tip_amount or 0):.2f}",
            total=f"{p.total_amount:.2f}",
        )
        for d in p.details:
            ET.SubElement(
                v_node,
                "DetallePago",
                medio=str(d.payment_method),
                monto=f"{d.amount:.2f}",
            )

    # <Productos>
    prods_elem = ET.SubElement(root, "Productos")
    for pr in rep_summary.get("top_products", []):
        ET.SubElement(
            prods_elem,
            "Producto",
            nombre=str(pr.get("name", "")),
            cantidad=str(pr.get("quantity", 0)),
            total=f"{pr.get('total', 0):.2f}",
        )

    # <Gastos>
    gastos_elem = ET.SubElement(root, "Gastos")
    for e in expenses:
        edt = e.expense_date.strftime("%Y-%m-%d") if e.expense_date else ""
        cat_name = e.category.name if e.category else "General"
        resp_name = f"{e.responsible_user.first_name} {e.responsible_user.last_name}" if e.responsible_user else "Administración"
        ET.SubElement(
            gastos_elem,
            "Gasto",
            id=str(e.id),
            fecha=edt,
            categoria=cat_name,
            concepto=str(e.concept or ""),
            monto=f"{e.amount:.2f}",
            responsable=resp_name,
        )

    ET.indent(root, space="    ")
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    filename = f"POTOQUITOS_REPORTE_{from_date}_{to_date}.xml"
    return Response(
        content=xml_bytes,
        media_type="application/xml; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/operating-result")
@router.get("/operating-result")
def get_operating_result(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "report.view")
    return uow.reports.operating_result()


@router.get("/predictions/alerts")
@router.get("/predictive-alerts")
def get_predictive_alerts(target_weekday: Optional[int] = None, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "prediction.view")
    return uow.predictions.alerts(target_weekday=target_weekday)
