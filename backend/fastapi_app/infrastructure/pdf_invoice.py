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
