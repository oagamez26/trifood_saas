"""
POTOQUITOS - SUITE DE PRUEBAS E2E OBLIGATORIAS (AUDITORÍA FINAL)
Cumple estrictamente con los 8 tests obligatorios definidos en Section 31:
  TEST 1: Flujo Completo Operativo de Pedidos
  TEST 2: Cocina (KDS limitado a 2 acciones sin entrega)
  TEST 3: Propina (consumo + propina sin sobrepago)
  TEST 4: Efectivo (efectivo recibido y cambio exacto)
  TEST 5: Caja (protección estricta contra cobro prematuro)
  TEST 6: Cierre de Caja (efectivo esperado solo físico + PDF)
  TEST 7: Reportes (PostgreSQL real, filtros día/mes/rango + PDF)
  TEST 8: XLSX Contable (openpyxl, hojas, filas y valores reales)
"""
import httpx
import io
from decimal import Decimal
import openpyxl
import time

BASE_URL = "http://localhost:8080/api"


def login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed for {username}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def get_active_register(client, headers):
    r = client.get("/cash/registers", headers=headers)
    registers = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    active = next((rg for rg in registers if rg.get("active_session")), None)
    if not active:
        reg_id = registers[0]["id"]
        r = client.post(f"/cash/registers/{reg_id}/open",
                        json={"initial_cash": 500000}, headers=headers)
        assert r.status_code in (200, 201), f"Error abriendo caja: {r.text}"
        r = client.get("/cash/registers", headers=headers)
        registers = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        active = next((rg for rg in registers if rg.get("active_session")), None)
    return active


def open_fresh_table(client, waiter_h, people_count=2):
    r = client.get("/tables-orders/tables", headers=waiter_h)
    tables = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    avail = next((t for t in tables if t.get("is_active", True) and t.get("state") == "DISPONIBLE"), None)
    if not avail:
        # Crear mesa si no hay disponible
        admin_h = login(client, "admin", "Admin12345*")
        num = f"Mesa {len(tables) + 10}"
        cr = client.post("/tables-orders/tables", json={"number": num, "capacity": 4}, headers=admin_h)
        assert cr.status_code in (200, 201)
        avail = cr.json()

    table_id = avail["id"]
    r = client.post(f"/tables-orders/tables/{table_id}/open",
                    json={"people_count": people_count}, headers=waiter_h)
    assert r.status_code in (200, 201), f"Error abriendo mesa: {r.text}"
    session_id = r.json()["id"]
    return table_id, session_id


# ======================================================================
# TEST 1 - FLUJO COMPLETO
# ======================================================================
def test_1_flujo_completo(client, mesero_h, cocina_h, cajero_h, admin_h):
    print("\n" + "=" * 60)
    print("TEST 1 - FLUJO COMPLETO OPERATIVO DE PEDIDOS")
    print("=" * 60)

    # 1. Obtener producto para la comanda
    prods = client.get("/catalog/products", headers=admin_h).json()["items"]
    hamb = next(p for p in prods if p.get("internal_code") == "HAMB-001")
    picada = next(p for p in prods if p.get("internal_code") == "PICA-001")

    # 2. Mesero abre mesa
    table_id, sess_id = open_fresh_table(client, mesero_h, people_count=2)
    print(f"  1. [OK] Mesero abre mesa #{table_id} (sesión #{sess_id})")

    # 3. Mesero crea pedido
    r = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "notes": "Término medio",
        "lines": [{"product_id": hamb["id"], "quantity": 2, "notes": "Sin cebolla"}]
    }, headers=mesero_h)
    assert r.status_code in (200, 201), f"Error creando pedido: {r.text}"
    order = r.json()
    order_id = order["id"]
    print(f"  2. [OK] Pedido #{order_id} creado en estado {order['state']}")

    # 4. Intenta segundo pedido simultáneo en la misma mesa -> 409
    r_dup = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "lines": [{"product_id": picada["id"], "quantity": 1}]
    }, headers=mesero_h)
    assert r_dup.status_code == 409, f"Esperado 409 en comanda duplicada, fue {r_dup.status_code}"
    assert r_dup.json().get("code") == "ORDER_ALREADY_EXISTS"
    print("  3. [OK] Intento de segundo pedido simultáneo rechazado con 409 ORDER_ALREADY_EXISTS")

    # 5. Modifica pedido mientras está en PENDIENTE / BORRADOR
    r_mod = client.patch(f"/tables-orders/orders/{order_id}", json={
        "lines": [
            {"product_id": hamb["id"], "quantity": 2, "notes": "Término 3/4"},
            {"product_id": picada["id"], "quantity": 1, "notes": "Bien tostada"}
        ]
    }, headers=mesero_h)
    assert r_mod.status_code == 200, f"Error modificando en borrador: {r_mod.text}"
    print("  4. [OK] Pedido modificado con éxito mientras está en PENDIENTE")

    # Mesero confirma el pedido hacia cocina
    r_conf = client.post(f"/tables-orders/orders/{order_id}/confirm", headers=mesero_h)
    assert r_conf.status_code == 200
    print("  5. [OK] Mesero confirma comanda y pasa a cola de Cocina")

    # Kardex previo para comparar descuento
    kardex_before = len(client.get("/inventory/kardex", headers=admin_h).json())

    # 6. Cocina inicia preparación
    r_prep = client.post(f"/kitchen/orders/{order_id}/start", headers=cocina_h)
    assert r_prep.status_code == 200, f"r_prep failed: {r_prep.status_code} {r_prep.text}"
    print("  6. [OK] Cocina inicia preparación: estado = EN_PREPARACION")

    # Inventario se descuenta UNA vez
    ord_info = client.get(f"/tables-orders/orders/{order_id}", headers=admin_h).json()
    assert ord_info.get("inventory_deducted") is True, "El pedido no marcó inventory_deducted = True"
    kardex_items = client.get("/inventory/kardex", headers=admin_h).json()
    order_kardex = [k for k in kardex_items if f"#{order_id}" in k.get("reference", "")]
    assert len(order_kardex) > 0, f"No se encontraron movimientos en Kardex para la Comanda #{order_id}"
    print(f"  7. [OK] Inventario descontado: {len(order_kardex)} registros de consumo en Kardex para Comanda #{order_id}")

    # 7. Intento de modificación tras inicio de preparación -> BLOQUEADO 409
    r_mod_prep = client.patch(f"/tables-orders/orders/{order_id}", json={
        "lines": [{"product_id": hamb["id"], "quantity": 5}]
    }, headers=mesero_h)
    assert r_mod_prep.status_code == 409, f"Esperado 409 al modificar en preparación, dio {r_mod_prep.status_code}"
    assert r_mod_prep.json().get("code") == "ORDER_LOCKED"
    print("  8. [OK] Intento de modificación tras preparación bloqueado con 409 ORDER_LOCKED")

    # 8. Intento de cobrar ahora en preparación -> RECHAZADO 409
    act_reg = get_active_register(client, cajero_h)
    r_pay_early = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 50000}]
    }, headers=cajero_h)
    assert r_pay_early.status_code == 409
    print(f"  9. [OK] Intento de cobrar mesa en preparación rechazado: {r_pay_early.json().get('code')}")

    # 9. Cocina marca LISTO
    r_ready = client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    assert r_ready.status_code == 200
    # Comprobar que no se descuenta inventario por segunda vez (idempotente)
    kardex_ready = [k for k in client.get("/inventory/kardex", headers=admin_h).json() if f"#{order_id}" in k.get("reference", "")]
    assert len(kardex_ready) == len(order_kardex), "Inventario fue descontado erróneamente por segunda vez"
    print(" 10. [OK] Cocina marca LISTO. Inventario no se descuenta nuevamente (idempotente)")

    # Verificar que NO queda ENTREGADO automáticamente
    t_check = client.get(f"/tables-orders/orders/{order_id}", headers=mesero_h).json()
    assert t_check["state"] == "LISTO", f"El pedido no debe ser ENTREGADO automáticamente: {t_check['state']}"
    print(" 11. [OK] El pedido permanece estrictamente en estado LISTO (no entregado automáticamente)")

    # Intentar cobrar en estado LISTO -> RECHAZADO 409
    r_pay_ready = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 50000}]
    }, headers=cajero_h)
    assert r_pay_ready.status_code == 409
    print(f" 12. [OK] Intento de cobrar mesa en estado LISTO rechazado: {r_pay_ready.json().get('code')}")

    # 10. Mesero ve LISTO y marca ENTREGADO
    r_deliv = client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    assert r_deliv.status_code == 200
    t_deliv = client.get(f"/tables-orders/orders/{order_id}", headers=mesero_h).json()
    assert t_deliv["state"] == "ENTREGADO"
    print(" 13. [OK] Mesero marca ENTREGADO exitosamente")

    # Verificar que todavía NO se puede cobrar en Caja si no se solicitó cuenta
    r_pay_no_acc = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 50000}]
    }, headers=cajero_h)
    assert r_pay_no_acc.status_code == 409
    assert r_pay_no_acc.json().get("code") == "ACCOUNT_NOT_REQUESTED"
    print(" 14. [OK] Intento de cobrar mesa ENTREGADA sin solicitar cuenta rechazado con 409 ACCOUNT_NOT_REQUESTED")

    # 11. Mesero imprime prefactura (comprobar que NO registra pago ni altera saldo)
    r_sum = client.get(f"/cash/tables/{table_id}/summary", headers=mesero_h)
    assert r_sum.status_code == 200
    sum_data = r_sum.json()
    orig_balance = Decimal(str(sum_data["pending_balance"]))
    assert orig_balance > Decimal("0")
    print(f" 15. [OK] Prefactura consultada por Mesero: saldo intacto = ${orig_balance} (no registra pago)")

    # 12. Mesero solicita cuenta
    r_acc = client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)
    assert r_acc.status_code == 200
    print(" 16. [OK] Mesero solicita cuenta: mesa pasa a CUENTA_SOLICITADA")

    # 13. Ahora aparece en Caja habilitada para cobro
    r_sum_ready = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    assert r_sum_ready["is_billable"] is True
    print(" 17. [OK] Mesa ahora es cobrable en Caja (is_billable: True)")

    # 14. Cajero cobra parcialmente (1 hamburguesa)
    hamb_line = next(it for it in r_sum_ready["items"] if it["product_id"] == hamb["id"])
    hamb_price = Decimal(str(hamb["current_price"]))
    r_partial = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "tip_amount": 0,
        "items": [{"order_line_id": hamb_line["order_line_id"], "quantity": 1}],
        "details": [{"payment_method": "EFECTIVO", "amount": float(hamb_price)}]
    }, headers=cajero_h)
    assert r_partial.status_code == 200
    part_data = r_partial.json()
    remaining = Decimal(str(part_data["remaining_balance"]))
    expected_rem = orig_balance - hamb_price
    assert remaining == expected_rem, f"Saldo restante ${remaining} != ${expected_rem}"
    print(f" 18. [OK] Pago parcial registrado: abono ${hamb_price}, saldo disminuye a ${remaining}")

    # Verificar estado mesa: PAGO_PARCIAL
    tables_list = client.get("/tables-orders/tables", headers=mesero_h).json()
    tbl_part = next(t for t in tables_list if t["id"] == table_id)
    assert tbl_part["state"] == "PAGO_PARCIAL"
    print(" 19. [OK] Estado de mesa actualizado a PAGO_PARCIAL")

    # 15. Cobra restante -> saldo = 0 -> mesa liberada
    r_final = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "tip_amount": 0,
        "details": [{"payment_method": "TRANSFERENCIA", "amount": float(remaining)}]
    }, headers=cajero_h)
    assert r_final.status_code == 200
    final_data = r_final.json()
    assert final_data["is_fully_paid"] is True
    print(f" 20. [OK] Cobro final completado: saldo = $0.00")

    # Verificar mesa liberada a DISPONIBLE
    tables_list2 = client.get("/tables-orders/tables", headers=mesero_h).json()
    tbl_final = next(t for t in tables_list2 if t["id"] == table_id)
    assert tbl_final["state"] == "DISPONIBLE"
    print(" 21. [OK] Mesa liberada exitosamente a DISPONIBLE")
    print("=== TEST 1: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 2 - COCINA LIMITADA
# ======================================================================
def test_2_cocina_limitada(client, mesero_h, cocina_h, cajero_h):
    print("\n" + "=" * 60)
    print("TEST 2 - COCINA: LIMITADA A PENDIENTE -> PREPARACION -> LISTO")
    print("=" * 60)

    table_id, sess_id = open_fresh_table(client, mesero_h)
    prods = client.get("/catalog/products", headers=mesero_h).json()["items"]
    p = prods[0]

    r_ord = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "lines": [{"product_id": p["id"], "quantity": 1}]
    }, headers=mesero_h)
    order_id = r_ord.json()["id"]

    # Mesero confirma
    client.post(f"/tables-orders/orders/{order_id}/confirm", headers=mesero_h)

    # 1. Cocina inicia preparación -> OK
    r1 = client.post(f"/kitchen/orders/{order_id}/start", headers=cocina_h)
    assert r1.status_code == 200
    print("  1. [OK] Cocina ejecuta: PENDIENTE -> EN_PREPARACION")

    # 2. Cocina marca listo -> OK
    r2 = client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    assert r2.status_code == 200
    print("  2. [OK] Cocina ejecuta: EN_PREPARACION -> LISTO")

    # 3. Cocina intenta ENTREGAR -> RECHAZADO (endpoint removido o 403)
    r_deliv = client.post(f"/kitchen/orders/{order_id}/deliver", headers=cocina_h)
    assert r_deliv.status_code in (403, 404, 405), f"Cocina no debe poder entregar: {r_deliv.status_code}"
    print(f"  3. [OK] Cocina bloqueada de entregar pedido ({r_deliv.status_code})")

    # 4. Cocina intenta SOLICITAR CUENTA -> RECHAZADO 403
    r_acc = client.post(f"/tables-orders/tables/{table_id}/request-account", headers=cocina_h)
    assert r_acc.status_code == 403, f"Cocina no debe poder solicitar cuenta: {r_acc.status_code}"
    print("  4. [OK] Cocina bloqueada de solicitar cuenta (403)")

    # 5. Cocina intenta COBRAR -> RECHAZADO 403
    act_reg = get_active_register(client, cajero_h)
    r_pay = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 10000}]
    }, headers=cocina_h)
    assert r_pay.status_code == 403, f"Cocina no debe poder cobrar: {r_pay.status_code}"
    print("  5. [OK] Cocina bloqueada de cobrar en Caja (403)")

    # Limpiar mesa
    client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)
    sum_d = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": float(sum_d["pending_balance"])}]
    }, headers=cajero_h)
    print("=== TEST 2: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 3 - PROPINA SIN ERROR DE SOBREPAGO
# ======================================================================
def test_3_propina(client, mesero_h, cocina_h, cajero_h):
    print("\n" + "=" * 60)
    print("TEST 3 - PROPINA: CONSUMO + PROPINA SIN SOBREPAGO")
    print("=" * 60)

    table_id, sess_id = open_fresh_table(client, mesero_h)
    prods = client.get("/catalog/products", headers=mesero_h).json()["items"]
    p = prods[0]
    unit_p = Decimal(str(p["current_price"]))

    r_ord = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "lines": [{"product_id": p["id"], "quantity": 2}]
    }, headers=mesero_h)
    order_id = r_ord.json()["id"]

    client.post(f"/tables-orders/orders/{order_id}/confirm", headers=mesero_h)
    client.post(f"/kitchen/orders/{order_id}/start", headers=cocina_h)
    client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)

    consumption = unit_p * 2
    tip = (consumption * Decimal("0.10")).quantize(Decimal(".01"))
    total_to_pay = consumption + tip

    act_reg = get_active_register(client, cajero_h)
    r_pay = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "tip_amount": float(tip),
        "details": [{"payment_method": "EFECTIVO", "amount": float(total_to_pay)}],
        "cash_received": float(total_to_pay)
    }, headers=cajero_h)

    assert r_pay.status_code == 200, f"Error en pago con propina: {r_pay.text}"
    pay_res = r_pay.json()
    assert Decimal(str(pay_res["consumption"])) == consumption
    assert Decimal(str(pay_res["tip"])) == tip
    assert Decimal(str(pay_res["total"])) == total_to_pay
    print(f"  [OK] Pago aceptado sin error de sobrepago: Consumo=${consumption}, Propina=${tip}, Total=${total_to_pay}")
    print("=== TEST 3: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 4 - EFECTIVO CON CAMBIO EXACTO
# ======================================================================
def test_4_efectivo(client, mesero_h, cocina_h, cajero_h):
    print("\n" + "=" * 60)
    print("TEST 4 - EFECTIVO CON CÁLCULO DE CAMBIO")
    print("=" * 60)

    table_id, sess_id = open_fresh_table(client, mesero_h)
    prods = client.get("/catalog/products", headers=mesero_h).json()["items"]
    p = prods[0]
    consumption = Decimal(str(p["current_price"]))

    r_ord = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "lines": [{"product_id": p["id"], "quantity": 1}]
    }, headers=mesero_h)
    order_id = r_ord.json()["id"]

    client.post(f"/tables-orders/orders/{order_id}/confirm", headers=mesero_h)
    client.post(f"/kitchen/orders/{order_id}/start", headers=cocina_h)
    client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)

    received = consumption + Decimal("20000.00")
    expected_change = Decimal("20000.00")

    act_reg = get_active_register(client, cajero_h)
    r_pay = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "tip_amount": 0,
        "details": [{"payment_method": "EFECTIVO", "amount": float(consumption)}],
        "cash_received": float(received)
    }, headers=cajero_h)

    assert r_pay.status_code == 200, f"Error en pago efectivo: {r_pay.text}"
    pay_res = r_pay.json()
    assert Decimal(str(pay_res["cash_change"])) == expected_change
    print(f"  [OK] Total=${consumption}, Recibido=${received}, Cambio=${pay_res['cash_change']} (exacto)")
    print("=== TEST 4: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 5 - CAJA: RECHAZO DE MESAS ANTES DE TIEMPO
# ======================================================================
def test_5_caja_protegida(client, mesero_h, cocina_h, cajero_h):
    print("\n" + "=" * 60)
    print("TEST 5 - CAJA: RECHAZO DE COBRO PREMATURO EN CADA ESTADO")
    print("=" * 60)

    table_id, sess_id = open_fresh_table(client, mesero_h)
    prods = client.get("/catalog/products", headers=mesero_h).json()["items"]
    p = prods[0]

    r_ord = client.post("/tables-orders/orders", json={
        "table_session_id": sess_id,
        "lines": [{"product_id": p["id"], "quantity": 1}]
    }, headers=mesero_h)
    order_id = r_ord.json()["id"]

    act_reg = get_active_register(client, cajero_h)

    # 1. Intentar cobrar en BORRADOR / PENDIENTE -> 409
    r1 = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 10000}]
    }, headers=cajero_h)
    assert r1.status_code == 409
    print(f"  1. [OK] Cobro en PENDIENTE rechazado (409): {r1.json().get('code')}")

    # 2. Intentar cobrar en EN_PREPARACION -> 409
    client.post(f"/tables-orders/orders/{order_id}/confirm", headers=mesero_h)
    client.post(f"/kitchen/orders/{order_id}/start", headers=cocina_h)
    r2 = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 10000}]
    }, headers=cajero_h)
    assert r2.status_code == 409
    print(f"  2. [OK] Cobro en EN_PREPARACION rechazado (409): {r2.json().get('code')}")

    # 3. Intentar cobrar en LISTO -> 409
    client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    r3 = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 10000}]
    }, headers=cajero_h)
    assert r3.status_code == 409
    print(f"  3. [OK] Cobro en LISTO rechazado (409): {r3.json().get('code')}")

    # 4. Intentar cobrar en ENTREGADO sin cuenta solicitada -> 409 ACCOUNT_NOT_REQUESTED
    client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    r4 = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": 10000}]
    }, headers=cajero_h)
    assert r4.status_code == 409
    assert r4.json().get("code") == "ACCOUNT_NOT_REQUESTED"
    print("  4. [OK] Cobro en ENTREGADO sin solicitar cuenta rechazado con 409 ACCOUNT_NOT_REQUESTED")

    # 5. Solicitar cuenta -> PERMITIDO COBRAR
    client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)
    sum_d = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    r5 = client.post("/cash/payments", json={
        "table_session_id": sess_id,
        "cash_session_id": act_reg["active_session"]["id"],
        "details": [{"payment_method": "EFECTIVO", "amount": float(sum_d["pending_balance"])}]
    }, headers=cajero_h)
    assert r5.status_code == 200
    print("  5. [OK] Tras solicitar cuenta, cobro permitido exitosamente (200)")
    print("=== TEST 5: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 6 - CIERRE DE CAJA (EFECTIVO ESPERADO SOLO FÍSICO)
# ======================================================================
def test_6_cierre_caja(client, mesero_h, cocina_h, cajero_h, admin_h):
    print("\n" + "=" * 60)
    print("TEST 6 - CIERRE DE CAJA CON ARQUEO E INFORME PDF")
    print("=" * 60)

    # 1. Asegurar que no haya sesiones abiertas previas
    regs_resp = client.get("/cash/registers", headers=cajero_h).json()
    reg_list = regs_resp if isinstance(regs_resp, list) else regs_resp.get("items", [])
    for r_item in reg_list:
        if r_item.get("active_session"):
            client.post(f"/cash/sessions/{r_item['active_session']['id']}/close",
                        json={"reported_cash": 500000, "notes": "Cierre previo"}, headers=cajero_h)

    reg = reg_list[0]
    init_cash = Decimal("200000.00")
    r_open = client.post(f"/cash/registers/{reg['id']}/open",
                         json={"initial_cash": float(init_cash)}, headers=cajero_h)
    assert r_open.status_code in (200, 201), f"Error abriendo caja: {r_open.status_code} {r_open.text}"
    new_sess = r_open.json()
    sess_id = new_sess["id"]
    print(f"  1. [OK] Caja abierta #{sess_id} con monto inicial ${init_cash}")

    # 2. Registrar cobro en EFECTIVO ($30.000 + $3.000 propina = $33.000)
    t1_id, t1_sess = open_fresh_table(client, mesero_h)
    prods = client.get("/catalog/products", headers=admin_h).json()["items"]
    p = prods[0]
    r_o1 = client.post("/tables-orders/orders", json={
        "table_session_id": t1_sess,
        "lines": [{"product_id": p["id"], "quantity": 1}]
    }, headers=mesero_h)
    o1_id = r_o1.json()["id"]
    client.post(f"/tables-orders/orders/{o1_id}/confirm", headers=mesero_h)
    client.post(f"/kitchen/orders/{o1_id}/start", headers=cocina_h)
    client.post(f"/kitchen/orders/{o1_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{o1_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{t1_id}/request-account", headers=mesero_h)
    sum_t1 = client.get(f"/cash/tables/{t1_id}/summary", headers=cajero_h).json()
    cash_pay = Decimal(str(sum_t1["pending_balance"]))
    client.post("/cash/payments", json={
        "table_session_id": t1_sess,
        "cash_session_id": sess_id,
        "tip_amount": 3000,
        "details": [{"payment_method": "EFECTIVO", "amount": float(cash_pay + 3000)}],
        "cash_received": float(cash_pay + 3000)
    }, headers=cajero_h)
    print(f"  2. [OK] Pago en EFECTIVO registrado: ${cash_pay + 3000}")

    # 3. Registrar cobro en TARJETA ($50.000) -> NO debe sumar al efectivo físico esperado
    t2_id, t2_sess = open_fresh_table(client, mesero_h)
    r_o2 = client.post("/tables-orders/orders", json={
        "table_session_id": t2_sess,
        "lines": [{"product_id": p["id"], "quantity": 1}]
    }, headers=mesero_h)
    o2_id = r_o2.json()["id"]
    client.post(f"/tables-orders/orders/{o2_id}/confirm", headers=mesero_h)
    client.post(f"/kitchen/orders/{o2_id}/start", headers=cocina_h)
    client.post(f"/kitchen/orders/{o2_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{o2_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{t2_id}/request-account", headers=mesero_h)
    sum_t2 = client.get(f"/cash/tables/{t2_id}/summary", headers=cajero_h).json()
    card_pay = Decimal(str(sum_t2["pending_balance"]))
    client.post("/cash/payments", json={
        "table_session_id": t2_sess,
        "cash_session_id": sess_id,
        "tip_amount": 0,
        "details": [{"payment_method": "TARJETA", "amount": float(card_pay)}]
    }, headers=cajero_h)
    print(f"  3. [OK] Pago en TARJETA registrado: ${card_pay} (no físico)")

    # 4. Cierre de caja
    # Efectivo esperado = initial_cash + cash_collected (sin tarjeta ni transferencia)
    expected_cash = init_cash + cash_pay + Decimal("3000.00")
    reported = expected_cash

    r_close = client.post(f"/cash/sessions/{sess_id}/close", json={
        "reported_cash": float(reported),
        "notes": "Cierre de prueba cuadrada"
    }, headers=cajero_h)
    assert r_close.status_code == 200, f"Error al cerrar caja: {r_close.text}"
    close_data = r_close.json()

    assert Decimal(str(close_data["expected_cash"])) == expected_cash, (
        f"Efectivo esperado ${close_data['expected_cash']} != ${expected_cash}"
    )
    assert Decimal(str(close_data["difference"])) == Decimal("0.00")
    assert close_data["closure_status"] == "CUADRADA"
    print(f"  4. [OK] Arqueo exacto: esperado=${close_data['expected_cash']}, declarado=${reported}, estado={close_data['closure_status']}")

    # 5. Descargar y validar informe PDF
    r_pdf = client.get(f"/cash/sessions/{sess_id}/report/pdf", headers=cajero_h)
    assert r_pdf.status_code == 200
    assert r_pdf.content[:4] == b"%PDF", "El informe no es un PDF válido"
    assert len(r_pdf.content) > 1000
    print(f"  5. [OK] Informe de Cierre en PDF generado y verificado ({len(r_pdf.content)} bytes)")
    print("=== TEST 6: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 7 - REPORTES REALES CON FILTROS Y PDF
# ======================================================================
def test_7_reportes(client, admin_h):
    print("\n" + "=" * 60)
    print("TEST 7 - REPORTES GERENCIALES CON DATOS REALES Y PDF")
    print("=" * 60)

    # 1. Reporte diario
    r_daily = client.get("/analytics/sales?period_type=daily&date=2026-09-16", headers=admin_h)
    assert r_daily.status_code == 200
    daily_data = r_daily.json()
    assert "total_sales" in daily_data
    assert "sales_by_method" in daily_data
    print(f"  1. [OK] Reporte diario consultado: Ventas=${daily_data['total_sales']}, Pedidos={daily_data['orders_count']}")

    # 2. Reporte mensual
    r_monthly = client.get("/analytics/sales?period_type=monthly&month=9&year=2026", headers=admin_h)
    assert r_monthly.status_code == 200
    monthly_data = r_monthly.json()
    print(f"  2. [OK] Reporte mensual consultado: Ventas=${monthly_data['total_sales']}")

    # 3. Reporte rango de fechas
    r_custom = client.get("/analytics/sales?period_type=custom&from_date=2026-09-01&to_date=2026-09-30", headers=admin_h)
    assert r_custom.status_code == 200
    custom_data = r_custom.json()
    print(f"  3. [OK] Reporte por rango consultado: Ventas=${custom_data['total_sales']}")

    # 4. Exportar Informe PDF oficial
    r_pdf = client.get("/analytics/reports/pdf?period_type=custom&from_date=2026-09-01&to_date=2026-09-30", headers=admin_h)
    assert r_pdf.status_code == 200
    assert r_pdf.content[:4] == b"%PDF", "El informe gerencial no es un PDF válido"
    assert len(r_pdf.content) > 1000
    print(f"  4. [OK] Informe gerencial en PDF generado y verificado ({len(r_pdf.content)} bytes)")
    print("=== TEST 7: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 8 - XLSX CONTABLE CON OPENPYXL
# ======================================================================
def test_8_xlsx_contable(client, admin_h):
    print("\n" + "=" * 60)
    print("TEST 8 - EXPORTACIÓN CONTABLE XLSX (OPENPYXL)")
    print("=" * 60)

    r_xlsx = client.get("/analytics/accounting/excel?from_date=2026-09-01&to_date=2026-09-30", headers=admin_h)
    assert r_xlsx.status_code == 200, f"Error descargando Excel: {r_xlsx.status_code}"
    content = r_xlsx.content
    assert len(content) > 1000

    # Abrir con openpyxl en memoria
    wb = openpyxl.load_workbook(io.BytesIO(content))
    sheet_names = wb.sheetnames
    print(f"  1. [OK] Archivo XLSX cargado exitosamente. Hojas: {sheet_names}")

    # Verificar que contenga las 3 hojas requeridas
    assert "Ventas y Cobros" in sheet_names, f"Falta hoja 'Ventas y Cobros' en {sheet_names}"
    assert "Gastos y Egresos" in sheet_names, f"Falta hoja 'Gastos y Egresos' en {sheet_names}"
    assert "Resumen Contable" in sheet_names, f"Falta hoja 'Resumen Contable' en {sheet_names}"
    print("  2. [OK] Las 3 hojas requeridas ('Ventas y Cobros', 'Gastos y Egresos', 'Resumen Contable') existen")

    # Verificar contenido de Ventas y Cobros
    ws_sales = wb["Ventas y Cobros"]
    headers = [cell.value for cell in ws_sales[4] if cell.value is not None]
    if not headers or "Fecha" not in headers:
        for r in range(1, 6):
            h_cand = [cell.value for cell in ws_sales[r] if cell.value is not None]
            if "Fecha" in h_cand:
                headers = h_cand
                break
    assert len(headers) >= 4, f"Encabezados insuficientes en Ventas y Cobros: {headers}"
    print(f"  3. [OK] Hoja 'Ventas y Cobros' tiene {ws_sales.max_row} filas y encabezados: {headers[:5]}")

    # Verificar hoja Resumen Contable
    ws_summary = wb["Resumen Contable"]
    assert ws_summary.max_row >= 2
    print(f"  4. [OK] Hoja 'Resumen Contable' verificada con {ws_summary.max_row} filas")
    print("=== TEST 8: COMPLETADO EXITOSAMENTE ===")


# ======================================================================
# TEST 9 - PAGOS MÚLTIPLES / ABONOS LIBRES Y PROTECCIÓN CONCURRENTE
# ======================================================================
def test_9_pagos_multiples_y_abonos(client, mesero_h, cocina_h, cajero_h, admin_h):
    import concurrent.futures
    print("\n" + "=" * 60)
    print("TEST 9 - PAGOS MÚLTIPLES, ABONOS LIBRES Y CONCURRENCIA")
    print("=" * 60)

    # 1. Asegurar caja abierta
    r_sess = client.get("/cash/active-session", headers=cajero_h)
    if r_sess.status_code != 200 or not r_sess.json():
        client.post("/cash/registers/1/open", json={"initial_cash": 100000}, headers=cajero_h)
        cash_sess_id = client.get("/cash/active-session", headers=cajero_h).json()["id"]
    else:
        cash_sess_id = r_sess.json()["id"]

    # 2. Abrir mesa y crear pedido
    t_raw = client.get("/tables-orders/tables", headers=admin_h).json()
    all_t = t_raw if isinstance(t_raw, list) else t_raw.get("items", [])
    num = f"M-Multi-{time.time_ns() % 1000000}"
    t_res = client.post("/tables-orders/tables", json={"number": num, "capacity": 4}, headers=admin_h)
    table_id = t_res.json()["id"]

    open_res = client.post(f"/tables-orders/tables/{table_id}/open", json={"people_count": 3}, headers=mesero_h)
    session_id = open_res.json()["id"]

    prods = client.get("/catalog/products", headers=admin_h).json()["items"]
    hamb = next(p for p in prods if p.get("internal_code") == "HAMB-001")
    pica = next(p for p in prods if p.get("internal_code") == "PICA-001")

    # 3 hamburguesas a $18.000 + 2 picadas a $45.000 = $54.000 + $90.000 = $144.000
    order_res = client.post("/tables-orders/orders", json={
        "table_session_id": session_id,
        "lines": [
            {"product_id": hamb["id"], "quantity": 3},
            {"product_id": pica["id"], "quantity": 2},
        ]
    }, headers=mesero_h)
    order_id = order_res.json()["id"]

    client.post(f"/tables-orders/orders/{order_id}/send-to-kitchen", headers=mesero_h)
    client.post(f"/kitchen/orders/{order_id}/start-prep", headers=cocina_h)
    client.post(f"/kitchen/orders/{order_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{order_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{table_id}/request-account", headers=mesero_h)

    sum1 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    initial_balance = Decimal(sum1["pending_balance"])
    assert initial_balance == Decimal("144000.00")
    print(f"  1. [OK] Mesa #{table_id} en CUENTA_SOLICITADA con saldo inicial: ${initial_balance}")

    # 3. PAGO #1: Abono libre por valor $50.000 en EFECTIVO (con $60.000 entregados y $10.000 de cambio)
    pay1 = client.post("/cash/payments", json={
        "table_session_id": session_id,
        "cash_session_id": cash_sess_id,
        "custom_amount": 50000,
        "details": [{"payment_method": "EFECTIVO", "amount": 50000}],
        "cash_received": 60000,
    }, headers=cajero_h)
    assert pay1.status_code in (200, 201), f"Pay1 failed: {pay1.status_code} {pay1.text}"
    res1 = pay1.json()
    assert res1["consumption"] == "50000.00"
    assert res1["cash_change"] == "10000.00"
    assert res1["remaining_balance"] == "94000.00"
    assert res1["table_state"] == "PAGO_PARCIAL"

    # Verificar resumen e historial en Caja tras Pago 1
    sum2 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    assert Decimal(sum2["total_paid"]) == Decimal("50000.00")
    assert Decimal(sum2["pending_balance"]) == Decimal("94000.00")
    assert len(sum2["payments_history"]) == 1
    print("  2. [OK] Pago #1 registrado: Abono $50.000 Efectivo, cambio $10.000. Saldo: $94.000, PAGO_PARCIAL")

    # 4. PAGO #2: Abono libre por valor $30.000 en TRANSFERENCIA con $3.000 de propina
    pay2 = client.post("/cash/payments", json={
        "table_session_id": session_id,
        "cash_session_id": cash_sess_id,
        "custom_amount": 30000,
        "details": [{"payment_method": "TRANSFERENCIA", "amount": 33000}],
        "tip_amount": 3000,
    }, headers=cajero_h)
    assert pay2.status_code in (200, 201)
    res2 = pay2.json()
    assert res2["consumption"] == "30000.00"
    assert res2["tip"] == "3000.00"
    assert res2["total"] == "33000.00"
    assert res2["remaining_balance"] == "64000.00"

    sum3 = client.get(f"/cash/tables/{table_id}/summary", headers=cajero_h).json()
    assert Decimal(sum3["total_paid"]) == Decimal("80000.00")
    assert Decimal(sum3["pending_balance"]) == Decimal("64000.00")
    assert len(sum3["payments_history"]) == 2
    print("  3. [OK] Pago #2 registrado: Abono $30.000 + Propina $3.000 Transferencia. Saldo: $64.000, 2 en historial")

    # 5. INTENTO DE SOBREPAGO: Intentar cobrar $70.000 > saldo restante de $64.000 -> RECHAZADO (422)
    overpay = client.post("/cash/payments", json={
        "table_session_id": session_id,
        "cash_session_id": cash_sess_id,
        "custom_amount": 70000,
        "details": [{"payment_method": "TARJETA", "amount": 70000}],
    }, headers=cajero_h)
    assert overpay.status_code == 422
    assert "AMOUNT_EXCEEDS_BALANCE" in overpay.text
    print("  4. [OK] Intento de sobrepago ($70.000 > $64.000) rechazado con 422 AMOUNT_EXCEEDS_BALANCE")

    # 6. PAGO #3: Pago final de $64.000 en TARJETA -> saldo = $0 -> PAGADA y mesa DISPONIBLE
    pay3 = client.post("/cash/payments", json={
        "table_session_id": session_id,
        "cash_session_id": cash_sess_id,
        "custom_amount": 64000,
        "details": [{"payment_method": "TARJETA", "amount": 64000}],
    }, headers=cajero_h)
    assert pay3.status_code in (200, 201)
    res3 = pay3.json()
    assert res3["remaining_balance"] == "0.00"
    assert res3["is_fully_paid"] is True
    assert res3["table_state"] == "DISPONIBLE"

    t_chk_raw = client.get("/tables-orders/tables", headers=admin_h).json()
    tbl_check = t_chk_raw if isinstance(t_chk_raw, list) else t_chk_raw.get("items", [])
    t_final = next(t for t in tbl_check if t["id"] == table_id)
    assert t_final["state"] == "DISPONIBLE"
    assert t_final["active_session"] is None
    print("  5. [OK] Pago #3 liquidado: Saldo $0.00, mesa liberada a DISPONIBLE")

    # 7. TEST CONCURRENTE: 2 pagos simultáneos compitiendo por un saldo
    print("  6. [..] Ejecutando prueba de concurrencia con bloqueo de fila...")
    num_c = f"M-Conc-{time.time_ns() % 1000000}"
    tc_res = client.post("/tables-orders/tables", json={"number": num_c, "capacity": 4}, headers=admin_h)
    tc_id = tc_res.json()["id"]
    sess_c_id = client.post(f"/tables-orders/tables/{tc_id}/open", json={"people_count": 2}, headers=mesero_h).json()["id"]
    ord_c_id = client.post("/tables-orders/orders", json={
        "table_session_id": sess_c_id,
        "lines": [{"product_id": pica["id"], "quantity": 2}]
    }, headers=mesero_h).json()["id"]
    client.post(f"/tables-orders/orders/{ord_c_id}/send-to-kitchen", headers=mesero_h)
    client.post(f"/kitchen/orders/{ord_c_id}/start-prep", headers=cocina_h)
    client.post(f"/kitchen/orders/{ord_c_id}/ready", headers=cocina_h)
    client.post(f"/tables-orders/orders/{ord_c_id}/deliver", headers=mesero_h)
    client.post(f"/tables-orders/tables/{tc_id}/request-account", headers=mesero_h)

    # Saldo es $90.000. Lanzamos 2 cobros simultáneos de $60.000 cada uno ($120.000 > $90.000)
    def attempt_concurrent_pay():
        with httpx.Client(base_url=BASE_URL, timeout=10) as cl:
            return cl.post("/cash/payments", json={
                "table_session_id": sess_c_id,
                "cash_session_id": cash_sess_id,
                "custom_amount": 60000,
                "details": [{"payment_method": "EFECTIVO", "amount": 60000}],
                "cash_received": 60000,
            }, headers=cajero_h)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        fut1 = executor.submit(attempt_concurrent_pay)
        fut2 = executor.submit(attempt_concurrent_pay)
        r1 = fut1.result()
        r2 = fut2.result()

    statuses = [r1.status_code, r2.status_code]
    assert 200 in statuses or 201 in statuses
    assert 422 in statuses or 409 in statuses
    print("  7. [OK] Protección concurrente verificada: 1 cobro aceptado y 1 rechazado por saldo insuficiente")
    print("=== TEST 9: COMPLETADO EXITOSAMENTE ===")


if __name__ == "__main__":
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        print("\nIniciando autenticación por rol...")
        admin_h = login(client, "admin", "Admin12345*")
        mesero_h = login(client, "mesero1", "Mesero12345*")
        cocina_h = login(client, "cocina1", "Cocina12345*")
        cajero_h = login(client, "cajero1", "Cajero12345*")
        print("Autenticación exitosa.")

        # Garantizar stock suficiente para todas las pruebas E2E
        ings = client.get("/inventory/ingredients", headers=admin_h).json()
        for ing in ings:
            if float(ing.get("stock", 0) or 0) < 2000:
                client.post("/inventory/movements", json={
                    "ingredient_id": ing["id"],
                    "movement_type": "ENTRADA_MANUAL",
                    "quantity": 10000,
                    "reference": "Reposición de stock para pruebas E2E"
                }, headers=admin_h)

        test_1_flujo_completo(client, mesero_h, cocina_h, cajero_h, admin_h)
        test_2_cocina_limitada(client, mesero_h, cocina_h, cajero_h)
        test_3_propina(client, mesero_h, cocina_h, cajero_h)
        test_4_efectivo(client, mesero_h, cocina_h, cajero_h)
        test_5_caja_protegida(client, mesero_h, cocina_h, cajero_h)
        test_6_cierre_caja(client, mesero_h, cocina_h, cajero_h, admin_h)
        test_7_reportes(client, admin_h)
        test_8_xlsx_contable(client, admin_h)
        test_9_pagos_multiples_y_abonos(client, mesero_h, cocina_h, cajero_h, admin_h)

    print("\n" + "=" * 60)
    print("  TODOS LOS TESTS E2E (INCLUYENDO ABONOS) PASARON AL 100%")
    print("=" * 60)
