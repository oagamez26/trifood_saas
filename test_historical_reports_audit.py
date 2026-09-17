"""
POTOQUITOS - SUITE DE VALIDACIÓN CON DATOS CONTROLADOS
Auditoría Estricta de Históricos, Medios de Pago, XML, PDF y Kardex Inmutable:
  CASO A — HISTÓRICO DIARIO: Día A ($100.000) vs Día B ($80.000), total A-B ($180.000) e invariancia de Día A
  CASO B — MEDIOS DE PAGO: Efectivo $50k, Tarjeta $30k, Transferencia $20k
  CASO C — XML: Generar, parsear con ElementTree y validar esquema interno y datos exactos
  CASO D — PDF: Generar y validar contenido textual real (título, período, totales, secciones)
  CASO E — KARDEX INMUTABLE: Entradas, consumos, snapshots de saldo y conservación del pasado
"""
import sys
import os
from decimal import Decimal
from datetime import datetime, time as d_time, timezone
import xml.etree.ElementTree as ET
import httpx

# Conectar al backend FastAPI
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5000/api")


def run_tests():
    print("\n" + "=" * 65)
    print("POTOQUITOS — VALIDACIÓN CON DATOS CONTROLADOS (CASOS A - E)")
    print("=" * 65)

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # Autenticación Admin
    r_login = client.post("/auth/login", json={"username": "admin", "password": "Admin12345*"})
    assert r_login.status_code == 200, f"Login falló: {r_login.text}"
    token = r_login.json()["access_token"]
    admin_h = {"Authorization": f"Bearer {token}"}
    print("[OK] Autenticación como Administrador exitosa.")

    # Conexión directa a BD para inyectar datos controlados históricos con fechas precisas
    from fastapi_app.settings import Settings
    from fastapi_app.infrastructure.database import session_factory
    from fastapi_app.infrastructure import models as m

    settings = Settings()
    engine, Session = session_factory(settings.database_url)
    session = Session()

    # Obtener un usuario, mesa y caja existentes para asociar transacciones
    admin_user = session.query(m.User).filter_by(username="admin").first()
    first_reg = session.query(m.CashRegister).first()
    cash_sess = session.query(m.CashSession).filter_by(state="OPEN").first()
    if not cash_sess:
        cash_sess = m.CashSession(
            cash_register_id=first_reg.id,
            opened_by_user_id=admin_user.id,
            initial_amount=Decimal("100000.00"),
            expected_amount=Decimal("100000.00"),
            actual_amount=Decimal("100000.00"),
            difference=Decimal("0.00"),
            state="OPEN",
        )
        session.add(cash_sess)
        session.flush()

    # Identificadores de prueba controlados
    day_a_str = "2026-07-15"
    day_b_str = "2026-07-16"

    day_a_dt = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)
    day_b_dt = datetime(2026, 7, 16, 14, 0, 0, tzinfo=timezone.utc)

    # Limpiar datos previos si existieran de ejecuciones anteriores para estos dos días específicos
    old_payments = session.query(m.Payment).filter(
        m.Payment.created_at >= datetime(2026, 7, 15, 0, 0, 0, tzinfo=timezone.utc),
        m.Payment.created_at <= datetime(2026, 7, 16, 23, 59, 59, tzinfo=timezone.utc),
    ).all()
    for op in old_payments:
        session.delete(op)
    session.commit()

    # -------------------------------------------------------------
    # CASO A & CASO B: Registrar ventas de prueba
    # Día A: Total = $100.000 (Efectivo=$50.000, Tarjeta=$30.000, Transferencia=$20.000)
    # Día B: Total = $80.000 (Efectivo=$80.000)
    # -------------------------------------------------------------
    print("\n--- CASO A & CASO B: REGISTRO DE DATOS CONTROLADOS HISTÓRICOS ---")

    # Obtener una sesión de mesa existente
    t_sess = session.query(m.TableSession).first()
    if not t_sess:
        tbl = session.query(m.RestaurantTable).first()
        t_sess = m.TableSession(
            table_id=tbl.id,
            waiter_id=admin_user.id,
            people_count=2,
            state="CLOSED",
        )
        session.add(t_sess)
        session.flush()

    # Pago Día A
    pay_a = m.Payment(
        table_session_id=t_sess.id,
        cash_session_id=cash_sess.id,
        cashier_id=admin_user.id,
        total_amount=Decimal("100000.00"),
        consumption_amount=Decimal("100000.00"),
        tip_amount=Decimal("0.00"),
        created_at=day_a_dt,
    )
    session.add(pay_a)
    session.flush()

    # Detalles de Medios de Pago Día A: 50k Efectivo, 30k Tarjeta, 20k Transferencia
    d1 = m.PaymentDetail(payment_id=pay_a.id, payment_method="EFECTIVO", amount=Decimal("50000.00"))
    d2 = m.PaymentDetail(payment_id=pay_a.id, payment_method="TARJETA", amount=Decimal("30000.00"))
    d3 = m.PaymentDetail(payment_id=pay_a.id, payment_method="TRANSFERENCIA", amount=Decimal("20000.00"))
    session.add_all([d1, d2, d3])

    # Pago Día B
    pay_b = m.Payment(
        table_session_id=t_sess.id,
        cash_session_id=cash_sess.id,
        cashier_id=admin_user.id,
        total_amount=Decimal("80000.00"),
        consumption_amount=Decimal("80000.00"),
        tip_amount=Decimal("0.00"),
        created_at=day_b_dt,
    )
    session.add(pay_b)
    session.flush()

    db1 = m.PaymentDetail(payment_id=pay_b.id, payment_method="EFECTIVO", amount=Decimal("80000.00"))
    session.add(db1)

    session.commit()
    print("  [OK] Registrado Día A: $100.000 (Efectivo: 50k, Tarjeta: 30k, Transf: 20k)")
    print("  [OK] Registrado Día B: $80.000 (Efectivo: 80k)")

    # 1. Verificar Reporte Día A
    r_a = client.get(f"/analytics/sales?period_type=custom&from_date={day_a_str}&to_date={day_a_str}", headers=admin_h)
    assert r_a.status_code == 200, f"Error reporte día A: {r_a.text}"
    data_a = r_a.json()
    assert float(data_a["total_sales"]) == 100000.0, f"Esperado 100000, obtenido {data_a['total_sales']}"
    print(f"  [OK] Reporte Día A = ${data_a['total_sales']:,.2f} (exactamente $100.000)")

    # 2. Verificar Reporte Día B
    r_b = client.get(f"/analytics/sales?period_type=custom&from_date={day_b_str}&to_date={day_b_str}", headers=admin_h)
    assert r_b.status_code == 200
    data_b = r_b.json()
    assert float(data_b["total_sales"]) == 80000.0, f"Esperado 80000, obtenido {data_b['total_sales']}"
    print(f"  [OK] Reporte Día B = ${data_b['total_sales']:,.2f} (exactamente $80.000)")

    # 3. Verificar Reporte A-B
    r_ab = client.get(f"/analytics/sales?period_type=custom&from_date={day_a_str}&to_date={day_b_str}", headers=admin_h)
    assert r_ab.status_code == 200
    data_ab = r_ab.json()
    assert float(data_ab["total_sales"]) == 180000.0, f"Esperado 180000, obtenido {data_ab['total_sales']}"
    print(f"  [OK] Reporte Día A-B = ${data_ab['total_sales']:,.2f} (exactamente $180.000)")

    # 4. Invarianza: Agregar otra venta en Día B y verificar que Día A NO cambie
    print("  .. Añadiendo venta extra de $25.000 al Día B para verificar aislamiento histórico...")
    pay_b2 = m.Payment(
        table_session_id=t_sess.id,
        cash_session_id=cash_sess.id,
        cashier_id=admin_user.id,
        total_amount=Decimal("25000.00"),
        consumption_amount=Decimal("25000.00"),
        tip_amount=Decimal("0.00"),
        created_at=datetime(2026, 7, 16, 18, 0, 0, tzinfo=timezone.utc),
    )
    session.add(pay_b2)
    session.flush()
    session.add(m.PaymentDetail(payment_id=pay_b2.id, payment_method="TARJETA", amount=Decimal("25000.00")))
    session.commit()

    # Re-consultar Día A: Debe seguir siendo 100.000
    r_a_recheck = client.get(f"/analytics/sales?period_type=custom&from_date={day_a_str}&to_date={day_a_str}", headers=admin_h)
    assert float(r_a_recheck.json()["total_sales"]) == 100000.0
    print("  [OK] INVARIANZA HISTÓRICA CONFIRMADA: Día A conserva intacto su valor de $100.000 tras modificar Día B")

    # Re-consultar Día B: Ahora es 80.000 + 25.000 = 105.000
    r_b_recheck = client.get(f"/analytics/sales?period_type=custom&from_date={day_b_str}&to_date={day_b_str}", headers=admin_h)
    assert float(r_b_recheck.json()["total_sales"]) == 105000.0
    print("  [OK] Día B actualizado correctamente a $105.000 sin afectar el pasado")

    # -------------------------------------------------------------
    # CASO B: Verificar desglose de Medios de Pago Día A
    # -------------------------------------------------------------
    print("\n--- CASO B: VERIFICACIÓN DE MEDIOS DE PAGO DÍA A ---")
    methods_data = {m_item["method"]: m_item["amount"] for m_item in data_a["sales_by_method"]}
    assert methods_data.get("EFECTIVO") == 50000.0, f"Efectivo incorrecto: {methods_data}"
    assert methods_data.get("TARJETA") == 30000.0, f"Tarjeta incorrecta: {methods_data}"
    assert methods_data.get("TRANSFERENCIA") == 20000.0, f"Transferencia incorrecta: {methods_data}"
    print("  [OK] Efectivo: $50.000, Tarjeta: $30.000, Transferencia: $20.000. Suma = $100.000")

    # -------------------------------------------------------------
    # CASO C: Generación y Validación Estricta de XML
    # -------------------------------------------------------------
    print("\n--- CASO C: GENERACIÓN Y PARSING ESTRICTO DE XML ---")
    r_xml = client.get(f"/analytics/reports/xml?from_date={day_a_str}&to_date={day_a_str}", headers=admin_h)
    assert r_xml.status_code == 200, f"Error descargando XML: {r_xml.text}"
    assert "application/xml" in r_xml.headers.get("content-type", "")

    content_disp = r_xml.headers.get("content-disposition", "")
    expected_filename = f"POTOQUITOS_REPORTE_{day_a_str}_{day_a_str}.xml"
    assert expected_filename in content_disp, f"Filename header mismatch: {content_disp}"
    print(f"  [OK] Encabezado Content-Disposition verificado: {expected_filename}")

    # Parsear con ElementTree
    xml_root = ET.fromstring(r_xml.content)
    assert xml_root.tag == "ReportePotoquitos", f"Root tag esperado ReportePotoquitos, obtenido {xml_root.tag}"

    # Validar Periodo
    p_ini = xml_root.find("Periodo/FechaInicio").text
    p_fin = xml_root.find("Periodo/FechaFin").text
    assert p_ini == day_a_str and p_fin == day_a_str
    print(f"  [OK] Nodo <Periodo>: FechaInicio={p_ini}, FechaFin={p_fin}")

    # Validar Resumen
    tot_v = xml_root.find("Resumen/TotalVentas").text
    assert float(tot_v) == 100000.0
    print(f"  [OK] Nodo <Resumen>: TotalVentas={tot_v}")

    # Validar Medios de Pago en XML
    medios_nodes = xml_root.findall("MediosPago/Medio")
    assert len(medios_nodes) >= 3
    medios_xml = {m_elem.attrib.get("tipo"): float(m_elem.text) for m_elem in medios_nodes}
    assert medios_xml.get("EFECTIVO") == 50000.0
    assert medios_xml.get("TARJETA") == 30000.0
    assert medios_xml.get("TRANSFERENCIA") == 20000.0
    print(f"  [OK] Nodos <MediosPago> en XML validados: {medios_xml}")

    # Validar Nodo Ventas
    ventas_nodes = xml_root.findall("Ventas/Venta")
    assert len(ventas_nodes) == 1
    v_a = ventas_nodes[0]
    assert float(v_a.attrib.get("total")) == 100000.0
    detalles_pago = v_a.findall("DetallePago")
    assert len(detalles_pago) == 3
    print(f"  [OK] Nodos <Ventas> en XML validados con sus 3 <DetallePago>")

    # -------------------------------------------------------------
    # CASO D: Generación y Validación Textual de PDF
    # -------------------------------------------------------------
    print("\n--- CASO D: GENERACIÓN Y VALIDACIÓN TEXTUAL DE INFORME PDF ---")
    import base64
    import zlib

    def decode_reportlab_stream(pdf_data):
        s_idx = pdf_data.find(b"stream") + 6
        e_idx = pdf_data.find(b"endstream", s_idx)
        raw_stream = pdf_data[s_idx:e_idx].strip()
        if not raw_stream.endswith(b"~>"):
            raw_stream += b"~>"
        return zlib.decompress(base64.a85decode(raw_stream, adobe=True)).decode("latin1", errors="ignore")

    # 1. PDF de período poblado (Día A)
    r_pdf = client.get(f"/analytics/reports/pdf?from_date={day_a_str}&to_date={day_a_str}", headers=admin_h)
    assert r_pdf.status_code == 200
    pdf_bytes = r_pdf.content
    assert pdf_bytes.startswith(b"%PDF"), "No es un archivo PDF válido"
    assert len(pdf_bytes) > 1500, f"PDF demasiado corto: {len(pdf_bytes)} bytes"

    # Validar presencia de cadenas de texto esenciales en el stream descomprimido
    pdf_text = decode_reportlab_stream(pdf_bytes)
    assert "POTOQUITOS" in pdf_text, "Falta POTOQUITOS en el PDF"
    assert "INFORME FINANCIERO" in pdf_text, "Falta título en el PDF"
    assert "2026-07-15" in pdf_text or "15/07/2026" in pdf_text, "Falta fecha del período en el PDF"
    assert "100,000.00" in pdf_text, "Falta total $100.000 en el PDF"
    assert "EFECTIVO" in pdf_text, "Falta sección de Efectivo en el PDF"
    print(f"  [OK] PDF con datos generado correctamente ({len(pdf_bytes)} bytes) con contenido textual real validado.")

    # 2. PDF de período sin información (comprobar que no sale en blanco)
    r_pdf_empty = client.get("/analytics/reports/pdf?from_date=1999-01-01&to_date=1999-01-01", headers=admin_h)
    assert r_pdf_empty.status_code == 200
    assert r_pdf_empty.content.startswith(b"%PDF")
    empty_pdf_text = decode_reportlab_stream(r_pdf_empty.content)
    assert "POTOQUITOS" in empty_pdf_text
    assert "No se encontraron registros para el per" in empty_pdf_text
    print("  [OK] PDF de período vacío generado con aviso claro: 'No se encontraron registros para el período seleccionado.' (No hoja blanca)")

    # -------------------------------------------------------------
    # CASO E: Kardex Inmutable y Snapshots de Balance
    # -------------------------------------------------------------
    print("\n--- CASO E: INMUTABILIDAD DEL KARDEX Y SNAPSHOTS DE BALANCE ---")
    # 1. Crear un ingrediente de prueba aislado
    test_ing = m.Ingredient(
        name=f"Ingrediente_Auditoria_{datetime.now().microsecond}",
        base_unit="kg",
        stock=Decimal("0.00"),
        min_stock=Decimal("10.00"),
        reference_cost=Decimal("20000.00"),
        is_active=True,
    )
    session.add(test_ing)
    session.commit()
    ing_id = test_ing.id
    print(f"  1. Ingrediente de prueba creado: ID={ing_id}, Stock inicial={test_ing.stock} kg")

    # 2. Movimiento 1: 09:00 Entrada +100
    from fastapi_app.infrastructure.repositories import InventoryRepository
    inv_repo = InventoryRepository(session)
    mov1 = inv_repo.add_movement(
        ingredient_id=ing_id,
        movement_type="ENTRADA_MANUAL",
        quantity=Decimal("100.00"),
        responsible_id=admin_user.id,
        reference="Compra inicial lote audit",
    )
    session.commit()

    # 3. Movimiento 2: 10:00 Consumo -20
    mov2 = inv_repo.add_movement(
        ingredient_id=ing_id,
        movement_type="CONSUMO_PREPARACION",
        quantity=Decimal("20.00"),
        responsible_id=admin_user.id,
        reference="Comanda #9999 - Preparación",
    )
    session.commit()

    # Consultar Kardex
    k_entries = inv_repo.kardex(ingredient_id=ing_id)
    assert len(k_entries) == 2

    # Orden predeterminado: más reciente (Consumo) -> más antiguo (Entrada)
    k_consumo = k_entries[0]
    k_entrada = k_entries[1]

    # Validar Movimiento 1 (Entrada)
    assert float(k_entrada["balance_before"]) == 0.0, f"Esperado 0, obtenido {k_entrada['balance_before']}"
    assert float(k_entrada["balance_after"]) == 100.0, f"Esperado 100, obtenido {k_entrada['balance_after']}"
    assert k_entrada["movement_type"] == "ENTRADA_MANUAL"

    # Validar Movimiento 2 (Consumo)
    assert float(k_consumo["balance_before"]) == 100.0, f"Esperado 100, obtenido {k_consumo['balance_before']}"
    assert float(k_consumo["balance_after"]) == 80.0, f"Esperado 80, obtenido {k_consumo['balance_after']}"
    assert k_consumo["movement_type"] == "CONSUMO_PREPARACION"
    print("  [OK] Movimiento 1 (09:00): Stock anterior = 0.0, Stock posterior = 100.0")
    print("  [OK] Movimiento 2 (10:00): Stock anterior = 100.0, Stock posterior = 80.0")

    # 4. Cambiar posteriormente el stock con un tercer movimiento (+50)
    print("  .. Registrando Movimiento 3 (+50 kg) para verificar que el pasado NO cambia...")
    mov3 = inv_repo.add_movement(
        ingredient_id=ing_id,
        movement_type="ENTRADA_MANUAL",
        quantity=Decimal("50.00"),
        responsible_id=admin_user.id,
        reference="Nueva compra lote posterior",
    )
    session.commit()

    # 5. Verificar que los dos movimientos anteriores permanezcan exactamente iguales
    k_recheck = inv_repo.kardex(ingredient_id=ing_id)
    assert len(k_recheck) == 3

    # Orden: [Mov 3, Mov 2, Mov 1]
    k_mov3 = k_recheck[0]
    k_mov2 = k_recheck[1]
    k_mov1 = k_recheck[2]

    assert float(k_mov1["balance_before"]) == 0.0
    assert float(k_mov1["balance_after"]) == 100.0

    assert float(k_mov2["balance_before"]) == 100.0
    assert float(k_mov2["balance_after"]) == 80.0

    assert float(k_mov3["balance_before"]) == 80.0
    assert float(k_mov3["balance_after"]) == 130.0

    print("  [OK] INMUTABILIDAD DEL KARDEX CONFIRMADA: Los movimientos históricos de 09:00 y 10:00 conservaron sus balances anteriores y posteriores intactos.")

    # 6. Probar filtrado de Kardex vía API HTTP
    r_kardex_api = client.get(f"/inventory/kardex?ingredient_id={ing_id}&movement_type=CONSUMO_PREPARACION", headers=admin_h)
    assert r_kardex_api.status_code == 200
    filtered_k = r_kardex_api.json()
    assert len(filtered_k) == 1
    assert filtered_k[0]["movement_type"] == "CONSUMO_PREPARACION"
    assert float(filtered_k[0]["balance_before"]) == 100.0
    assert float(filtered_k[0]["balance_after"]) == 80.0
    print("  [OK] Filtros HTTP de Kardex por insumo y tipo de movimiento validados exitosamente.")

    session.close()
    print("\n" + "=" * 65)
    print("  TODOS LOS CASOS DE CONTROL (A, B, C, D, E) PASARON EXITOSAMENTE")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    run_tests()
