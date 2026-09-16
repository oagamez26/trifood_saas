from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require
from ..infrastructure import models as m


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard/summary")
@router.get("/dashboard")
def get_dashboard_summary(user=Depends(get_current_user), uow=Depends(get_uow)):
    if not user or not user.get("is_active"):
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
    
    recent_orders = []
    all_orders = uow.orders.orders()
    for o in all_orders[:10]:
        recent_orders.append({
            "id": o["id"],
            "table_number": o.get("table_number", f"Mesa {o.get('table_session_id', '')}"),
            "waiter_name": o.get("waiter_name", "Servicio"),
            "state": o["state"],
            "total": float(o.get("total_amount", 0)),
            "created_at": str(o.get("created_at", ""))[:16].replace("T", " "),
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
def get_sales_report(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "report.view")
    sales = uow.reports.sales_summary()
    op = uow.reports.operating_result()
    total_sales = float(sales.get("total_sales", 0))
    cogs = float(op.get("estimated_cogs", 0))
    expenses = float(op.get("total_expenses", 0))
    net_profit = float(op.get("estimated_operating_result", 0))
    margin_pct = round((net_profit / total_sales * 100), 1) if total_sales > 0 else 0.0

    methods_breakdown = sales.get("methods_breakdown", {})
    methods_list = [
        {"method": k, "amount": float(v), "count": 1}
        for k, v in methods_breakdown.items()
    ]

    all_orders = uow.orders.orders()
    product_sales = {}
    for o in all_orders:
        if o["state"] != "CANCELADO":
            for line in o.get("lines", []):
                pname = line.get("product_name", "Producto")
                qty = line.get("quantity", 0)
                tot = float(line.get("unit_price", 0)) * qty
                if pname not in product_sales:
                    product_sales[pname] = {"quantity": 0, "total": 0.0}
                product_sales[pname]["quantity"] += qty
                product_sales[pname]["total"] += tot

    top_products = [
        {"name": k, "quantity": v["quantity"], "total": v["total"]}
        for k, v in sorted(product_sales.items(), key=lambda x: x[1]["total"], reverse=True)[:5]
    ]

    weekday_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    weekday_totals = {name: 0.0 for name in weekday_names}
    payments = uow.session.scalars(select(m.Payment)).all() if hasattr(uow, "session") else []
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
        "total_sales": total_sales,
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
