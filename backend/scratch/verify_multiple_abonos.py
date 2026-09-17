import httpx
import asyncio
from decimal import Decimal

BASE_URL = "http://localhost:5000/api"

def login(client, user, pw):
    r = client.post("/auth/login", json={"username": user, "password": pw})
    assert r.status_code == 200, f"Login failed for {user}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

def run_test():
    with httpx.Client(base_url=BASE_URL, timeout=15) as client:
        admin_h = login(client, "admin", "Admin12345*")
        cajero_h = login(client, "cajero1", "Cajero12345*")
        waiter_h = login(client, "mesero1", "Mesero12345*")
        cocina_h = login(client, "cocina1", "Cocina12345*")

        # 1. Asegurar caja abierta
        r_sess = client.get("/cash/active-session", headers=cajero_h)
        if r_sess.status_code != 200 or not r_sess.json():
            client.post("/cash/registers/1/open", json={"initial_cash": 100000}, headers=cajero_h)
            cash_sess_id = client.get("/cash/active-session", headers=cajero_h).json()["id"]
        else:
            cash_sess_id = r_sess.json()["id"]

        # 2. Abrir mesa fresca
        t_raw = client.get("/tables-orders/tables", headers=admin_h).json()
        all_t = t_raw if isinstance(t_raw, list) else t_raw.get("items", [])
        num = f"M-Abono-{len(all_t) + 1}"
        t_res = client.post("/tables-orders/tables", json={"number": num, "capacity": 4}, headers=admin_h)
        table = t_res.json()
        table_id = table["id"]
        
        open_res = client.post(f"/tables-orders/tables/{table_id}/open", json={"people_count": 3}, headers=waiter_h)
        session_id = open_res.json()["id"]

        # 3. Crear pedido con 3 hamburguesas a $18.000 y 2 picadas a $45.000 = $54.000 + $90.000 = $144.000
        prods = client.get("/catalog/products", headers=admin_h).json()["items"]
        hamb = next(p for p in prods if p.get("internal_code") == "HAMB-001")
        pica = next(p for p in prods if p.get("internal_code") == "PICA-001")

        order_res = client.post("/tables-orders/orders", json={
            "table_session_id": session_id,
            "lines": [
                {"product_id": hamb["id"], "quantity": 3},
                {"product_id": pica["id"], "quantity": 2},
            ]
        }, headers=waiter_h)
        assert order_res.status_code in (200, 201)
        order_id = order_res.json()["id"]

        # Mesero confirma comanda
        client.post(f"/tables-orders/orders/{order_id}/send-to-kitchen", headers=waiter_h)
        # Cocina inicia preparacion y marca listo
        client.post(f"/kitchen/orders/{order_id}/start-prep", headers=cocina_h)
        client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
        # Mesero entrega
        client.post(f"/tables-orders/orders/{order_id}/deliver", headers=waiter_h)
        # Mesero solicita cuenta
        client.post(f"/tables-orders/tables/{table_id}/request-account", headers=waiter_h)

        # Consultar resumen de mesa
        sum1 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
        initial_balance = Decimal(sum1["pending_balance"])
        print(f"Saldo inicial de la mesa: ${initial_balance}")
        assert initial_balance == Decimal("144000.00")

        # -------------------------------------------------------------
        # PAGO #1: Abono libre por valor de $50.000 en EFECTIVO (con $60.000 entregados y $10.000 de cambio)
        # -------------------------------------------------------------
        pay1 = client.post("/cash/payments", json={
            "table_session_id": session_id,
            "cash_session_id": cash_sess_id,
            "custom_amount": 50000,
            "details": [{"payment_method": "EFECTIVO", "amount": 50000}],
            "cash_received": 60000,
            "tip_amount": 0,
        }, headers=cajero_h)
        assert pay1.status_code in (200, 201), f"Fallo pago 1: {pay1.text}"
        res1 = pay1.json()
        assert res1["consumption"] == "50000.00"
        assert res1["cash_change"] == "10000.00"
        assert res1["remaining_balance"] == "94000.00"
        assert res1["table_state"] == "PAGO_PARCIAL"
        print("  [OK] Pago #1 registrado: $50.000 en Efectivo, cambio: $10.000, nuevo saldo: $94.000")

        # Consultar resumen tras pago 1: verificar historial y saldos
        sum2 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
        assert Decimal(sum2["total_paid"]) == Decimal("50000.00")
        assert Decimal(sum2["pending_balance"]) == Decimal("94000.00")
        assert sum2["state"] == "PAGO_PARCIAL"
        assert len(sum2["payments_history"]) == 1
        assert sum2["payments_history"][0]["consumption_amount"] == "50000.00"
        assert sum2["payments_history"][0]["payment_method"] == "EFECTIVO"
        print("  [OK] Resumen de mesa actualizado: 1 pago en historial, saldo pendiente $94.000")

        # -------------------------------------------------------------
        # PAGO #2: Abono libre por valor de $30.000 en TRANSFERENCIA con $3.000 de propina
        # -------------------------------------------------------------
        pay2 = client.post("/cash/payments", json={
            "table_session_id": session_id,
            "cash_session_id": cash_sess_id,
            "custom_amount": 30000,
            "details": [{"payment_method": "TRANSFERENCIA", "amount": 33000}],
            "tip_amount": 3000,
        }, headers=cajero_h)
        assert pay2.status_code in (200, 201), f"Fallo pago 2: {pay2.text}"
        res2 = pay2.json()
        assert res2["consumption"] == "30000.00"
        assert res2["tip"] == "3000.00"
        assert res2["total"] == "33000.00"
        assert res2["remaining_balance"] == "64000.00"
        assert res2["table_state"] == "PAGO_PARCIAL"
        print("  [OK] Pago #2 registrado: $30.000 consumo + $3.000 propina en Transferencia, nuevo saldo: $64.000")

        # Consultar resumen tras pago 2
        sum3 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
        assert Decimal(sum3["total_paid"]) == Decimal("80000.00")
        assert Decimal(sum3["pending_balance"]) == Decimal("64000.00")
        assert len(sum3["payments_history"]) == 2
        print("  [OK] Resumen de mesa actualizado: 2 pagos en historial, saldo pendiente $64.000")

        # -------------------------------------------------------------
        # INTENTO DE SOBREPAGO: Intentar abonar $70.000 cuando el saldo es $64.000
        # -------------------------------------------------------------
        overpay = client.post("/cash/payments", json={
            "table_session_id": session_id,
            "cash_session_id": cash_sess_id,
            "custom_amount": 70000,
            "details": [{"payment_method": "TARJETA", "amount": 70000}],
        }, headers=cajero_h)
        assert overpay.status_code == 422, f"Debio rechazar sobrepago: {overpay.text}"
        assert "AMOUNT_EXCEEDS_BALANCE" in overpay.text
        print("  [OK] Intento de sobrepago ($70.000 > $64.000) rechazado con 422 AMOUNT_EXCEEDS_BALANCE")

        # -------------------------------------------------------------
        # PAGO #3: Pago final del saldo restante ($64.000) en TARJETA
        # -------------------------------------------------------------
        pay3 = client.post("/cash/payments", json={
            "table_session_id": session_id,
            "cash_session_id": cash_sess_id,
            "custom_amount": 64000,
            "details": [{"payment_method": "TARJETA", "amount": 64000}],
        }, headers=cajero_h)
        assert pay3.status_code in (200, 201), f"Fallo pago 3: {pay3.text}"
        res3 = pay3.json()
        assert res3["remaining_balance"] == "0.00"
        assert res3["is_fully_paid"] is True
        assert res3["table_state"] == "DISPONIBLE"
        print("  [OK] Pago #3 liquidado: saldo = $0.00, cuenta completamente pagada y mesa liberada a DISPONIBLE")

        # Verificar que la mesa quedó libre
        t_chk_raw = client.get("/tables-orders/tables", headers=admin_h).json()
        tbl_check = t_chk_raw if isinstance(t_chk_raw, list) else t_chk_raw.get("items", [])
        t_final = next(t for t in tbl_check if t["id"] == table_id)
        assert t_final["state"] == "DISPONIBLE"
        assert t_final["active_session"] is None
        print("  [OK] Mesa verificada en estado DISPONIBLE y sin sesion activa")

        # -------------------------------------------------------------
        # TEST CONCURRENTE: 2 solicitudes simultaneas que exceden el saldo
        # -------------------------------------------------------------
        print("\n--- Probando pagos concurrentes con bloqueo pesimista ---")
        num_c = f"M-Conc-{len(all_t) + 2}"
        tc_res = client.post("/tables-orders/tables", json={"number": num_c, "capacity": 4}, headers=admin_h)
        tbl_c = tc_res.json()
        tc_id = tbl_c["id"]
        
        op_c = client.post(f"/tables-orders/tables/{tc_id}/open", json={"people_count": 2}, headers=waiter_h).json()
        sess_c_id = op_c["id"]
        
        # Pedido por 2 picadas a $45.000 = $90.000
        ord_c = client.post("/tables-orders/orders", json={
            "table_session_id": sess_c_id,
            "lines": [{"product_id": pica["id"], "quantity": 2}]
        }, headers=waiter_h).json()
        o_c_id = ord_c["id"]
        
        client.post(f"/tables-orders/orders/{o_c_id}/send-to-kitchen", headers=waiter_h)
        client.post(f"/kitchen/orders/{o_c_id}/start-prep", headers=cocina_h)
        client.post(f"/kitchen/orders/{o_c_id}/ready", headers=cocina_h)
        client.post(f"/tables-orders/orders/{o_c_id}/deliver", headers=waiter_h)
        client.post(f"/tables-orders/tables/{tc_id}/request-account", headers=waiter_h)
        
        # Saldo es $90.000. Dos pagos simultáneos de $60.000 cada uno ($120.000 > $90.000)
        import concurrent.futures
        def attempt_pay():
            with httpx.Client(base_url=BASE_URL, timeout=10) as cl:
                return cl.post("/cash/payments", json={
                    "table_session_id": sess_c_id,
                    "cash_session_id": cash_sess_id,
                    "custom_amount": 60000,
                    "details": [{"payment_method": "EFECTIVO", "amount": 60000}],
                    "cash_received": 60000,
                }, headers=cajero_h)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut1 = executor.submit(attempt_pay)
            fut2 = executor.submit(attempt_pay)
            r1 = fut1.result()
            r2 = fut2.result()

        statuses = [r1.status_code, r2.status_code]
        print(f"  Resultados concurrentes: {statuses}")
        assert 200 in statuses or 201 in statuses, f"Ningún pago fue aceptado: {statuses}"
        assert 422 in statuses or 409 in statuses, f"No se rechazó el pago concurrente excedente: {statuses}"
        print("  [OK] Concurrencia protegida: Exactamente 1 pago aprobado y 1 rechazado por saldo insuficiente")

        print("\n=== VERIFICACIÓN MULTI-PAGO / ABONOS 100% EXITOSA ===")

if __name__ == "__main__":
    run_test()
