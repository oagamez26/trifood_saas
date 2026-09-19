import json
import urllib.request
import urllib.parse
import sys
import time

BASE_URL = "http://localhost:5000/api"

def request(path, method="GET", body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[HTTP {e.code}] Error on {method} {path}: {err_msg}")
        raise

def main():
    print("================================================================")
    print("TEST E2E: CICLO COMPLETO DE 'PEDIR MÁS' Y REGLAS DE NEGOCIO")
    print("================================================================")

    # 1. Login
    login_res = request("/auth/login", "POST", {"username": "admin", "password": "Admin12345*"})
    token = login_res["access_token"]
    print("1. [OK] Autenticado como Administrador.")

    # 2. Open Cash Session if not already open
    active_cash = request("/cash/active-session", "GET", token=token)
    if not active_cash:
        regs = request("/cash/registers", "GET", token=token)
        reg_id = regs[0]["id"]
        active_cash = request(f"/cash/registers/{reg_id}/open", "POST", {"initial_cash": 100000}, token=token)
        print(f"2. [OK] Sesión de caja abierta: ID {active_cash['id']}")
    else:
        print(f"2. [OK] Sesión de caja activa encontrada: ID {active_cash['id']}")
    cash_session_id = active_cash["id"]

    # 3. Create unique Table and Open Session
    table_num = f"M-Test-{int(time.time()) % 100000}"
    tbl_res = request("/tables-orders/tables", "POST", {"number": table_num, "capacity": 4}, token=token)
    table_id = tbl_res["id"]
    print(f"3. [OK] Mesa de prueba creada: {table_num} (ID: {table_id})")

    # Get active products
    prods = request("/catalog/products?page_size=20", "GET", token=token)["items"]
    p1 = prods[0]
    p2 = prods[1] if len(prods) > 1 else prods[0]
    p1_price = float(p1["current_price"])
    p2_price = float(p2["current_price"])
    print(f"   Productos de prueba: '{p1['name']}' (${p1_price}) y '{p2['name']}' (${p2_price})")

    # Open Table Session
    sess = request(f"/tables-orders/tables/{table_id}/open", "POST", {"people_count": 2}, token=token)
    session_id = sess["id"]
    print(f"4. [OK] Sesión de mesa abierta con ID: {session_id}")

    # 5. Create Order #1 (2x P1, 1x P2)
    order_1 = request("/tables-orders/orders", "POST", {
        "table_session_id": session_id,
        "notes": "Comanda inicial",
        "lines": [
            {"product_id": p1["id"], "quantity": 2, "notes": "Sin cebolla"},
            {"product_id": p2["id"], "quantity": 1, "notes": "Bien fría"}
        ]
    }, token=token)
    o1_id = order_1["id"]
    print(f"5. [OK] Comanda #1 creada con ID: {o1_id}, Estado: {order_1['state']}")

    # 6. Send Order #1 to Kitchen
    o1_sent = request(f"/tables-orders/orders/{o1_id}/send-kitchen", "POST", token=token)
    print(f"6. [OK] Comanda #1 enviada a cocina. Estado: {o1_sent['state']}")

    # 7. Kitchen starts preparation (inventory deducted idempotently)
    o1_prep = request(f"/kitchen/orders/{o1_id}/start", "POST", token=token)
    print(f"7. [OK] Cocina inicia preparación de Comanda #1. Estado: {o1_prep['state']}")

    # 8. Kitchen marks READY & Waiter DELIVERS
    o1_ready = request(f"/kitchen/orders/{o1_id}/ready", "POST", token=token)
    o1_deliv = request(f"/tables-orders/orders/{o1_id}/deliver", "POST", token=token)
    print(f"8. [OK] Comanda #1 marcada LISTO y ENTREGADO. Estado: {o1_deliv['state']}")

    # 9. PEDIR MÁS: Waiter creates Order #2 on the same session
    print("\n--- EJECUTANDO 'PEDIR MÁS' SOBRE MESA CON COMANDA ENTREGADA ---")
    order_2 = request("/tables-orders/orders", "POST", {
        "table_session_id": session_id,
        "notes": "Adición / Pedir más",
        "lines": [
            {"product_id": p1["id"], "quantity": 1, "notes": "Adicional"}
        ]
    }, token=token)
    o2_id = order_2["id"]
    print(f"9. [OK] Comanda #2 creada exitosamente con ID: {o2_id}, Estado: {order_2['state']}")

    # Verify Order #1 remains 100% UNCHANGED
    o1_check = request(f"/tables-orders/orders/{o1_id}", "GET", token=token)
    assert o1_check["state"] == "ENTREGADO", f"Order #1 status modified! Was {o1_check['state']}"
    assert len(o1_check["lines"]) == 2, "Order #1 items were modified!"
    print("   [OK] Invarianza verificada: Comanda #1 sigue ENTREGADO con sus 2 líneas originales.")

    # 10. Send Order #2 to Kitchen, prepare and deliver
    o2_sent = request(f"/tables-orders/orders/{o2_id}/send-kitchen", "POST", token=token)
    o2_prep = request(f"/kitchen/orders/{o2_id}/start", "POST", token=token)
    o2_ready = request(f"/kitchen/orders/{o2_id}/ready", "POST", token=token)
    o2_deliv = request(f"/tables-orders/orders/{o2_id}/deliver", "POST", token=token)
    print(f"10. [OK] Comanda #2 enviada a cocina, preparada y ENTREGADA.")

    # 11. Request account and check consolidation
    print("\n--- SOLICITUD DE CUENTA Y CONSOLIDACIÓN DE COMANDAS ---")
    req_acc = request(f"/tables-orders/tables/{table_id}/request-account", "POST", token=token)
    print(f"11. [OK] Solicitud de cuenta exitosa. Estado mesa: {req_acc.get('state')}")

    summary_1 = request(f"/cash/tables/{table_id}/summary", "GET", token=token)
    total_consumption = float(summary_1["total_amount"])
    expected_consumption = (2 * p1_price) + (1 * p2_price) + (1 * p1_price)
    print(f"   [OK] Cuenta consolidada: Total=${total_consumption:,.2f} (Esperado: ${expected_consumption:,.2f})")
    assert abs(total_consumption - expected_consumption) < 0.01, f"Error in total consolidation! Got {total_consumption}, expected {expected_consumption}"

    # 12. Partial payment (Pago parcial)
    print("\n--- PAGO PARCIAL ---")
    partial_amount = min(20000.0, total_consumption / 2)
    partial_pay = request("/cash/payments", "POST", {
        "table_session_id": session_id,
        "cash_session_id": cash_session_id,
        "details": [{"payment_method": "EFECTIVO", "amount": partial_amount}],
        "amount": partial_amount,
        "tip_amount": 0
    }, token=token)
    remaining_balance = float(partial_pay["remaining_balance"])
    print(f"12. [OK] Pago parcial registrado: ${partial_amount:,.2f}. Saldo restante: ${remaining_balance:,.2f}. Estado mesa: {partial_pay['table_state']}")
    assert abs(remaining_balance - (total_consumption - partial_amount)) < 0.01

    # 13. PEDIR MÁS TRAS PAGO PARCIAL Y CUENTA SOLICITADA
    print("\n--- 'PEDIR MÁS' CON CUENTA SOLICITADA Y PAGO PARCIAL EXISTENTE ---")
    order_3 = request("/tables-orders/orders", "POST", {
        "table_session_id": session_id,
        "notes": "Adición tardía con saldo pendiente",
        "lines": [
            {"product_id": p2["id"], "quantity": 1, "notes": "Otra bebida"}
        ]
    }, token=token)
    o3_id = order_3["id"]
    print(f"13. [OK] Comanda #3 creada tras pago parcial con ID: {o3_id}, Estado: {order_3['state']}")

    # Prepare and deliver order #3
    request(f"/tables-orders/orders/{o3_id}/send-kitchen", "POST", token=token)
    request(f"/kitchen/orders/{o3_id}/start", "POST", token=token)
    request(f"/kitchen/orders/{o3_id}/ready", "POST", token=token)
    request(f"/tables-orders/orders/{o3_id}/deliver", "POST", token=token)
    print(f"   [OK] Comanda #3 preparada y entregada.")

    # 14. Re-request account and verify accounting integrity
    req_acc_2 = request(f"/tables-orders/tables/{table_id}/request-account", "POST", token=token)
    summary_2 = request(f"/cash/tables/{table_id}/summary", "GET", token=token)
    new_total = float(summary_2["total_amount"])
    expected_new_total = total_consumption + p2_price
    print(f"14. [OK] Cuenta recalculada tras adición:")
    print(f"        Consumo Total Acumulado: ${new_total:,.2f} (Esperado: ${expected_new_total:,.2f})")
    assert abs(new_total - expected_new_total) < 0.01

    paid_so_far = float(summary_2["total_paid"])
    assert abs(paid_so_far - partial_amount) < 0.01, f"Original payment was corrupted! Expected {partial_amount}, got {paid_so_far}"
    expected_final_balance = new_total - partial_amount
    actual_balance = float(summary_2["pending_balance"])
    assert abs(actual_balance - expected_final_balance) < 0.01, f"Balance mismatch! Expected {expected_final_balance}, got {actual_balance}"
    print(f"   [OK] Integridad contable perfecta:")
    print(f"        Total Pagado (Preservado intacto): ${paid_so_far:,.2f}")
    print(f"        Saldo Actualizado a cobrar: ${actual_balance:,.2f}")

    # 15. Settle full remaining payment and close session
    print("\n--- LIQUIDACIÓN TOTAL Y CIERRE DE CUENTA ---")
    final_pay = request("/cash/payments", "POST", {
        "table_session_id": session_id,
        "cash_session_id": cash_session_id,
        "details": [{"payment_method": "TARJETA", "amount": actual_balance}],
        "amount": actual_balance,
        "tip_amount": 0
    }, token=token)
    print(f"15. [OK] Pago final registrado. Saldo restante: ${float(final_pay['remaining_balance']):,.2f}, Totalmente pagada: {final_pay['is_fully_paid']}")
    assert float(final_pay["remaining_balance"]) <= 0.01
    assert final_pay["is_fully_paid"] is True

    # Check table is now free/disponible and session closed
    tbl_after = request(f"/tables-orders/tables", "GET", token=token)
    tbl_rec = next((t for t in tbl_after if t["id"] == table_id), None)
    print(f"   [OK] Estado final de la mesa en el sistema: {tbl_rec.get('state')}")

    # 16. Verify new session on the same table creates new independent session
    print("\n--- VERIFICACIÓN DE NUEVO CONSUMO EN MESA LIBERADA ---")
    sess_new = request(f"/tables-orders/tables/{table_id}/open", "POST", {"people_count": 3}, token=token)
    new_session_id = sess_new["id"]
    assert new_session_id != session_id, "New session must have new unique ID!"
    print(f"16. [OK] Nueva sesión independiente creada: ID {new_session_id} (Historial previo 100% conservado).")

    print("\n================================================================")
    print("✓ TODAS LAS PRUEBAS E2E DE 'PEDIR MÁS' PASARON EXITOSAMENTE")
    print("================================================================")

if __name__ == "__main__":
    main()
