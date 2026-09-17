from io import BytesIO
from decimal import Decimal
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_invoice_pdf(invoice_data: dict, settings: dict = None) -> bytes:
    """Generates a professional PDF invoice for POTOQUITOS.
    
    invoice_data contains:
      - invoice_number
      - created_at
      - table_number
      - cashier_name
      - waiter_name
      - subtotal
      - total
      - payment_method_summary
      - lines: list of {product_name, quantity, unit_price, subtotal}
    """
    settings = settings or {}
    restaurant_name = settings.get("restaurant_name", "POTOQUITOS")
    restaurant_nit = settings.get("restaurant_nit", "901.458.789-2")
    restaurant_address = settings.get("restaurant_address", "Calle 45 # 28 - 14, Barranquilla, Colombia")
    restaurant_phone = settings.get("restaurant_phone", "+57 300 123 4567")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1255a0"),
    )

    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#657184"),
    )

    inv_num_style = ParagraphStyle(
        "InvNumStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=2,  # Right aligned
        textColor=colors.HexColor("#b11f2a"),
    )

    bold_label = ParagraphStyle(
        "BoldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#173b65"),
    )

    regular_text = ParagraphStyle(
        "RegularText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#122033"),
    )

    elements = []

    # Header section
    raw_created = invoice_data.get("created_at")
    if hasattr(raw_created, "strftime"):
        created_str = raw_created.strftime("%Y-%m-%d %H:%M")
    else:
        created_str = str(raw_created or "")[:16].replace("T", " ")

    header_data = [
        [
            Paragraph(f"<b>{restaurant_name}</b>", title_style),
            Paragraph(f"<b>FACTURA DE VENTA</b><br/>{invoice_data['invoice_number']}", inv_num_style),
        ],
        [
            Paragraph(
                f"NIT: {restaurant_nit}<br/>{restaurant_address}<br/>Tel: {restaurant_phone}",
                subtitle_style,
            ),
            Paragraph(
                f"<b>Fecha:</b> {created_str}<br/>"
                f"<b>Mesa:</b> {invoice_data.get('table_number', 'Barra')}<br/>"
                f"<b>Cajero:</b> {invoice_data.get('cashier_name', 'General')}<br/>"
                f"<b>Mesero:</b> {invoice_data.get('waiter_name', 'Sin asignar')}",
                subtitle_style,
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1255a0"), spaceBefore=5, spaceAfter=15))

    # Items table
    table_rows = [
        [
            Paragraph("<b>Cant.</b>", bold_label),
            Paragraph("<b>Descripción</b>", bold_label),
            Paragraph("<b>Precio Unit.</b>", bold_label),
            Paragraph("<b>Subtotal</b>", bold_label),
        ]
    ]

    for line in invoice_data.get("lines", []):
        unit_p = Decimal(str(line.get("unit_price", 0)))
        sub_t = Decimal(str(line.get("subtotal", 0)))
        table_rows.append([
            Paragraph(str(line.get("quantity", 1)), regular_text),
            Paragraph(str(line.get("product_name", "")), regular_text),
            Paragraph(f"${unit_p:,.2f} COP", regular_text),
            Paragraph(f"${sub_t:,.2f} COP", regular_text),
        ])

    items_table = Table(table_rows, colWidths=[0.8 * inch, 3.4 * inch, 1.4 * inch, 1.4 * inch])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f5f7fa")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#c6ced8")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#e9edf2")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))

    # Summary table
    total_dec = Decimal(str(invoice_data.get("total", 0)))
    summary_data = [
        [
            Paragraph(f"<b>Método de Pago:</b> {invoice_data.get('payment_method_summary', 'EFECTIVO')}", regular_text),
            Paragraph("<b>Subtotal:</b>", regular_text),
            Paragraph(f"${total_dec:,.2f} COP", regular_text),
        ],
        [
            Paragraph("", regular_text),
            Paragraph("<b>IVA (0%):</b>", regular_text),
            Paragraph("$0.00 COP", regular_text),
        ],
        [
            Paragraph("", regular_text),
            Paragraph("<b>TOTAL A PAGAR:</b>", ParagraphStyle("BigTotal", parent=bold_label, fontSize=11, textColor=colors.HexColor("#1255a0"))),
            Paragraph(f"<b>${total_dec:,.2f} COP</b>", ParagraphStyle("BigTotalVal", parent=bold_label, fontSize=11, textColor=colors.HexColor("#1255a0"), alignment=2)),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[3.8 * inch, 1.6 * inch, 1.6 * inch])
    summary_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(summary_table)

    elements.append(Spacer(1, 25))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#c6ced8"), spaceBefore=5, spaceAfter=10))

    footer_style = ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        alignment=1,
        textColor=colors.HexColor("#8c9ba5"),
    )
    elements.append(Paragraph(f"Gracias por visitar {restaurant_name}. ¡Esperamos atenderle pronto!<br/>Sistema de Gestión POTOQUITOS — Desarrollado por Carlos Reales y Orlando Agamez", footer_style))

    doc.build(elements)
    return buffer.getvalue()


def generate_cash_close_pdf(session_data: dict, settings: dict = None) -> bytes:
    """Genera informe oficial de Cierre de Caja / Turno para POTOQUITOS."""
    settings = settings or {}
    restaurant_name = settings.get("restaurant_name", "POTOQUITOS")
    restaurant_nit = settings.get("restaurant_nit", "901.458.789-2")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#1255a0"))
    regular_text = ParagraphStyle("Reg", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#2d3748"))
    bold_label = ParagraphStyle("Bold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=colors.HexColor("#2d3748"))
    header_cell = ParagraphStyle("HCell", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white)

    elements = [
        Paragraph(f"<b>{restaurant_name}</b>", title_style),
        Paragraph(f"NIT: {restaurant_nit} | <b>INFORME DE CIERRE DE CAJA Y ARQUEO</b>", regular_text),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1255a0"), spaceBefore=8, spaceAfter=15),
    ]

    raw_opened = session_data.get("opened_at", "")
    opened = raw_opened.strftime("%Y-%m-%d %H:%M:%S") if hasattr(raw_opened, "strftime") else str(raw_opened or "")[:19].replace("T", " ")

    raw_closed = session_data.get("closed_at")
    if raw_closed:
        closed = raw_closed.strftime("%Y-%m-%d %H:%M:%S") if hasattr(raw_closed, "strftime") else str(raw_closed)[:19].replace("T", " ")
    else:
        closed = "En curso"

    info_data = [
        [Paragraph(f"<b>Sesión ID:</b> #{session_data.get('id', '')}", regular_text), Paragraph(f"<b>Caja / Turno:</b> {session_data.get('register_name', 'Caja Principal')}", regular_text)],
        [Paragraph(f"<b>Cajero Responsable:</b> {session_data.get('cashier_name', 'General')}", regular_text), Paragraph(f"<b>Estado Cierre:</b> <b>{session_data.get('closure_status', 'CUADRADA')}</b>", regular_text)],
        [Paragraph(f"<b>Apertura:</b> {opened}", regular_text), Paragraph(f"<b>Cierre:</b> {closed}", regular_text)],
    ]
    t_info = Table(info_data, colWidths=[3.5 * inch, 3.5 * inch])
    t_info.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    elements.extend([t_info, Spacer(1, 15)])

    def to_dec(val):
        if val is None or val == "":
            return Decimal("0.00")
        try:
            return Decimal(str(val))
        except Exception:
            return Decimal("0.00")

    # Tabla financiera
    fin_headers = [Paragraph("CONCEPTO FINANCIERO", header_cell), Paragraph("VALOR (COP)", header_cell)]
    init_cash = to_dec(session_data.get("initial_cash"))
    sales_amt = to_dec(session_data.get("sales_amount"))
    tips_amt = to_dec(session_data.get("tips_amount"))
    total_col = to_dec(session_data.get("total_collected"))
    cash_col = to_dec(session_data.get("cash_collected"))
    card_col = to_dec(session_data.get("card_collected"))
    trans_col = to_dec(session_data.get("transfer_collected"))
    expenses = to_dec(session_data.get("cash_expenses"))
    expected = to_dec(session_data.get("expected_cash"))
    reported = to_dec(session_data.get("reported_cash"))
    diff = to_dec(session_data.get("difference"))

    if expected == Decimal("0.00") and session_data.get("state") == "OPEN":
        expected = init_cash + cash_col - expenses

    fin_rows = [
        fin_headers,
        [Paragraph("Monto Inicial en Caja (Fondo de Cambio)", regular_text), Paragraph(f"${init_cash:,.2f}", regular_text)],
        [Paragraph("Ventas Netas / Consumo en Alimentos", regular_text), Paragraph(f"${sales_amt:,.2f}", regular_text)],
        [Paragraph("Propinas Voluntarias Recaudadas", regular_text), Paragraph(f"${tips_amt:,.2f}", regular_text)],
        [Paragraph("<b>TOTAL RECAUDADO EN EL TURNO</b>", bold_label), Paragraph(f"<b>${total_col:,.2f}</b>", bold_label)],
        [Paragraph("  - Cobrado en Efectivo", regular_text), Paragraph(f"${cash_col:,.2f}", regular_text)],
        [Paragraph("  - Cobrado en Tarjeta Débito/Crédito", regular_text), Paragraph(f"${card_col:,.2f}", regular_text)],
        [Paragraph("  - Cobrado en Transferencia Bancaria", regular_text), Paragraph(f"${trans_col:,.2f}", regular_text)],
        [Paragraph("Gastos y Egresos en Efectivo del Turno", regular_text), Paragraph(f"-${expenses:,.2f}", regular_text)],
        [Paragraph("<b>EFECTIVO FÍSICO ESPERADO EN GAVETA</b>", bold_label), Paragraph(f"<b>${expected:,.2f}</b>", bold_label)],
        [Paragraph("<b>EFECTIVO DECLARADO / CONTADO</b>", bold_label), Paragraph(f"<b>${reported:,.2f}</b>", bold_label)],
        [Paragraph(f"<b>DIFERENCIA ({session_data.get('closure_status', 'CUADRADA')})</b>", bold_label), Paragraph(f"<b>${diff:,.2f}</b>", bold_label)],
    ]

    t_fin = Table(fin_rows, colWidths=[4.8 * inch, 2.2 * inch])
    t_fin.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1255a0")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("BACKGROUND", (0, 4), (-1, 4), colors.HexColor("#EDF2F7")),
        ("BACKGROUND", (0, 9), (-1, -1), colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.extend([t_fin, Spacer(1, 20)])

    notes = session_data.get("notes")
    if notes:
        elements.extend([
            Paragraph(f"<b>Observaciones del Cajero:</b> {notes}", regular_text),
            Spacer(1, 15),
        ])

    # Firmas
    sig_data = [
        [Paragraph("________________________________________<br/>Firma Cajero", regular_text),
         Paragraph("________________________________________<br/>Firma Administrador / Auditor", regular_text)]
    ]
    t_sig = Table(sig_data, colWidths=[3.5 * inch, 3.5 * inch])
    t_sig.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 30)]))
    elements.append(t_sig)

    doc.build(elements)
    return buffer.getvalue()


def generate_sales_report_pdf(report_data: dict, period_label: str, settings: dict = None) -> bytes:
    """Genera informe consolidado de Ventas y Dinámica Gerencial para POTOQUITOS."""
    settings = settings or {}
    restaurant_name = settings.get("restaurant_name", "POTOQUITOS")
    restaurant_nit = settings.get("restaurant_nit", "901.458.789-2")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#1255a0"))
    regular_text = ParagraphStyle("Reg", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#2d3748"))
    bold_label = ParagraphStyle("Bold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=colors.HexColor("#2d3748"))
    header_cell = ParagraphStyle("HCell", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white)
    warning_box = ParagraphStyle("WarnBox", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=colors.HexColor("#9b2c2c"), alignment=1)

    elements = [
        Paragraph(f"<b>{restaurant_name}</b>", title_style),
        Paragraph(f"NIT: {restaurant_nit} | <b>INFORME FINANCIERO Y DINÁMICA GERENCIAL</b>", regular_text),
        Paragraph(f"Período: <b>{period_label}</b>", regular_text),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1255a0"), spaceBefore=8, spaceAfter=15),
    ]

    total_sales = Decimal(str(report_data.get("total_sales", 0)))
    total_consumption = Decimal(str(report_data.get("total_consumption", 0)))
    total_tips = Decimal(str(report_data.get("total_tips", 0)))
    orders_count = report_data.get("orders_count", 0)
    ticket_avg = Decimal(str(report_data.get("average_ticket", 0)))
    cogs = Decimal(str(report_data.get("estimated_cost", 0)))
    expenses = Decimal(str(report_data.get("estimated_expenses", 0)))
    net_profit = Decimal(str(report_data.get("estimated_net_profit", 0)))
    margin_pct = report_data.get("margin_percentage", 0)

    # Si el período no tiene información en ventas ni gastos
    if total_sales == 0 and orders_count == 0 and expenses == 0:
        empty_table = Table(
            [[Paragraph("<b>AVISO: No se encontraron registros para el período seleccionado.</b>", warning_box)]],
            colWidths=[7.0 * inch],
        )
        empty_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FED7D7")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#FEB2B2")),
        ]))
        elements.extend([empty_table, Spacer(1, 15)])

    kpi_rows = [
        [Paragraph("MÉTRICA GERENCIAL", header_cell), Paragraph("VALOR (COP)", header_cell)],
        [Paragraph("Ventas Totales Facturadas", regular_text), Paragraph(f"${total_sales:,.2f}", regular_text)],
        [Paragraph("Consumo Neto (Comidas y Bebidas)", regular_text), Paragraph(f"${total_consumption:,.2f}", regular_text)],
        [Paragraph("Total Propinas Voluntarias", regular_text), Paragraph(f"${total_tips:,.2f}", regular_text)],
        [Paragraph("Total de Comandas / Órdenes Atendidas", regular_text), Paragraph(f"{orders_count}", regular_text)],
        [Paragraph("Ticket Promedio por Comanda", regular_text), Paragraph(f"${ticket_avg:,.2f}", regular_text)],
        [Paragraph("Costo Estimado de Insumos (Kardex / Recetas)", regular_text), Paragraph(f"${cogs:,.2f}", regular_text)],
        [Paragraph("Gastos y Costos Operativos", regular_text), Paragraph(f"${expenses:,.2f}", regular_text)],
        [Paragraph("<b>RESULTADO OPERATIVO NETO</b>", bold_label), Paragraph(f"<b>${net_profit:,.2f}</b>", bold_label)],
        [Paragraph("<b>MARGEN OPERATIVO ESTIMADO</b>", bold_label), Paragraph(f"<b>{margin_pct}%</b>", bold_label)],
    ]
    t_kpi = Table(kpi_rows, colWidths=[4.8 * inch, 2.2 * inch])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1255a0")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("BACKGROUND", (0, 8), (-1, -1), colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.extend([t_kpi, Spacer(1, 16)])

    # Medios de Pago
    methods_list = report_data.get("sales_by_method", [])
    if methods_list:
        pay_rows = [
            [Paragraph("MEDIO DE PAGO", header_cell), Paragraph("TRANSACCIONES", header_cell), Paragraph("MONTO RECAUDADO", header_cell)]
        ]
        for m_item in methods_list:
            m_amt = Decimal(str(m_item.get("amount", 0)))
            pay_rows.append([
                Paragraph(str(m_item.get("method", "")), regular_text),
                Paragraph(str(m_item.get("count", 0)), regular_text),
                Paragraph(f"${m_amt:,.2f}", regular_text),
            ])
        t_pay = Table(pay_rows, colWidths=[3.6 * inch, 1.6 * inch, 1.8 * inch])
        t_pay.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1255a0")),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.extend([Paragraph("<b>Distribución por Medio de Pago</b>", bold_label), Spacer(1, 6), t_pay, Spacer(1, 16)])

    # Top Productos
    top_prods = report_data.get("top_products", [])
    if top_prods:
        prod_rows = [[Paragraph("PRODUCTO MÁS VENDIDO", header_cell), Paragraph("CANTIDAD", header_cell), Paragraph("TOTAL VENTAS", header_cell)]]
        for tp in top_prods:
            tot_p = Decimal(str(tp.get("total", 0)))
            prod_rows.append([
                Paragraph(tp.get("name", ""), regular_text),
                Paragraph(str(tp.get("quantity", 0)), regular_text),
                Paragraph(f"${tot_p:,.2f}", regular_text),
            ])
        t_prod = Table(prod_rows, colWidths=[4.2 * inch, 1.4 * inch, 1.4 * inch])
        t_prod.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1255a0")),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.extend([Paragraph("<b>Top Productos Más Vendidos</b>", bold_label), Spacer(1, 6), t_prod, Spacer(1, 16)])

    doc.build(elements)
    return buffer.getvalue()


