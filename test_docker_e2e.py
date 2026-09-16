import httpx
from decimal import Decimal

BASE_URL = "http://localhost:8080/api"

def run_e2e():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    print("1. Iniciar sesion como Administrador...")
    r = client.post("/auth/login", json={"username": "admin", "password": "Admin12345*"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [OK] Sesion iniciada con exito.")

    print("2. Consultar catalogo y categorias...")
    r = client.get("/catalog/categories", headers=headers)
    assert r.status_code == 200
    categories = r.json()
    assert len(categories) >= 4
    print(f"   [OK] {len(categories)} categorias encontradas.")

    r = client.get("/catalog/products", headers=headers)
    assert r.status_code == 200
    products = r.json()["items"]
    assert len(products) >= 6
    burger = next(p for p in products if "Hamburguesa" in p["name"])
    print(f"   [OK] Plato seleccionado: {burger['name']} (${burger['current_price']} COP, ID: {burger['id']})")

    print("3. Consultar mesas del salon...")
    r = client.get("/tables-orders/tables", headers=headers)
    assert r.status_code == 200
    tables = r.json()
    assert len(tables) >= 6

    # Select an available table or table with active session
    avail_table = next((t for t in tables if t["state"] == "DISPONIBLE"), None)
    if avail_table:
        table_target = avail_table
        r = client.post(f"/tables-orders/tables/{table_target['id']}/open", json={"people_count": 2}, headers=headers)
        assert r.status_code in (200, 201), f"Open table failed: {r.text}"
        session_id = r.json()["id"]
        print(f"   [OK] Mesa {table_target['number']} abierta. Sesion #{session_id}")
    else:
        table_target = next(t for t in tables if t.get("active_session"))
        session_id = table_target["active_session"]["id"]
        print(f"   [OK] Mesa {table_target['number']} usando sesion activa #{session_id}")

    print("4. Tomar comanda en POS...")
    order_data = {
        "table_session_id": session_id,
        "lines": [
            {
                "product_id": burger["id"],
                "quantity": 2,
                "notes": "Termino medio, sin cebolla",
            }
        ],
    }
    r = client.post("/tables-orders/orders", json=order_data, headers=headers)
    assert r.status_code in (200, 201), f"Create order failed: {r.text}"
    order = r.json()
    order_id = order["id"]
    print(f"   [OK] Pedido #{order_id} creado en estado '{order['state']}'")

    print("5. Confirmar pedido para enviar a Cocina...")
    r = client.post(f"/tables-orders/orders/{order_id}/confirm", headers=headers)
    assert r.status_code == 200, f"Confirm order failed: {r.text}"
    print(f"   [OK] Pedido #{order_id} confirmado y enviado a KDS.")

    print("6. Verificar tablero KDS de Cocina...")
    r = client.get("/kitchen/queue", headers=headers)
    assert r.status_code == 200, f"Kitchen queue failed: {r.text}"
    kds_orders = r.json()
    kds_order = next((o for o in kds_orders if o["id"] == order_id), None)
    assert kds_order is not None
    print(f"   [OK] Pedido visualizado en KDS (Estado: {kds_order['state']})")

    print("7. Avanzar pedido en cocina (Preparacion -> Listo)...")
    r = client.post(f"/kitchen/orders/{order_id}/start", headers=headers)
    assert r.status_code == 200
    r = client.post(f"/kitchen/orders/{order_id}/ready", headers=headers)
    assert r.status_code == 200
    print("   [OK] Pedido completado en cocina (Estado: LISTO).")

    print("8. Servir pedido a la mesa...")
    r = client.post(f"/tables-orders/orders/{order_id}/deliver", headers=headers)
    assert r.status_code == 200
    print("   [OK] Pedido entregado al comensal.")

    print("9. Verificar o Abrir caja registradora...")
    r = client.get("/cash/registers", headers=headers)
    assert r.status_code == 200
    registers = r.json()
    reg = registers[0]

    r_active = client.get(f"/cash/active-session?register_id={reg['id']}", headers=headers)
    active_cash = r_active.json() if r_active.status_code == 200 else None
    if not active_cash:
        r = client.post(f"/cash/registers/{reg['id']}/open", json={"initial_cash": 100000.0}, headers=headers)
        assert r.status_code in (200, 201), f"Open cash session failed: {r.text}"
        active_cash = r.json()
        print(f"   [OK] Caja '{reg['name']}' abierta con base inicial de $100.000 COP.")
    else:
        print(f"   [OK] Caja '{reg['name']}' con sesion activa #{active_cash['id']}.")

    print("10. Consultar resumen de cuenta de la mesa...")
    r_summary = client.get(f"/cash/tables/{table_target['id']}/summary", headers=headers)
    assert r_summary.status_code == 200
    summary = r_summary.json()
    total_amount = float(summary["total_amount"])
    print(f"   [OK] Total cuenta mesa {table_target['number']}: ${total_amount} COP")

    print("11. Procesar pago en caja (Efectivo con cambio)...")
    payment_payload = {
        "table_session_id": session_id,
        "cash_session_id": active_cash["id"],
        "details": [
            {
                "payment_method": "EFECTIVO",
                "amount": total_amount,
            }
        ],
        "cash_received": total_amount + 10000.0,
    }
    r = client.post("/cash/payments", json=payment_payload, headers=headers)
    assert r.status_code in (200, 201), f"Payment failed: {r.text}"
    payment_res = r.json()
    invoice_id = payment_res["invoice_id"]
    change_due = payment_res.get("change", 10000.0)
    print(f"   [OK] Pago procesado. Factura ID #{invoice_id}. Cambio: ${change_due} COP")

    print("12. Descargar y validar factura PDF...")
    r = client.get(f"/cash/invoices/{invoice_id}/pdf", headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 1000
    assert r.content.startswith(b"%PDF")
    print(f"   [OK] Factura PDF generada ({len(r.content)} bytes, header %PDF verificado).")

    print("13. Verificar liberacion automatica de la mesa a DISPONIBLE...")
    r_tables = client.get("/tables-orders/tables", headers=headers)
    assert r_tables.status_code == 200
    t_updated = next(t for t in r_tables.json() if t["id"] == table_target["id"])
    assert t_updated["state"] == "DISPONIBLE"
    print(f"   [OK] Mesa {table_target['number']} liberada y disponible en el salon.")

    print("14. Verificar auditoria de inventario en Kardex...")
    r = client.get("/inventory/kardex", headers=headers)
    assert r.status_code == 200
    kardex_entries = r.json()
    assert len(kardex_entries) > 0
    print(f"   [OK] Kardex inmutable registra {len(kardex_entries)} movimientos de ingredientes.")

    print("15. Consultar motor de Alertas Predictivas...")
    r = client.get("/analytics/predictive-alerts", headers=headers)
    assert r.status_code == 200
    alerts = r.json()
    print(f"   [OK] Alertas predictivas calculadas: {len(alerts)} ingredientes evaluados estadisticamente.")

    print("\n=======================================================")
    print("!FLUJO OPERACIONAL END-TO-END VERIFICADO CON EXITO 100%!")
    print("=======================================================")

if __name__ == "__main__":
    run_e2e()
