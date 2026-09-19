import urllib.request
import json
import io
import time
from PIL import Image

BASE_URL = "http://localhost:5000/api"

def request(path, method="GET", body=None, token=None, headers_extra=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if headers_extra:
        headers.update(headers_extra)
    data = None
    if body is not None:
        if isinstance(body, bytes):
            data = body
        else:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            return json.loads(content.decode("utf-8")) if content else None
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] Error on {method} {path}: {e.read().decode('utf-8')}")
        raise

def create_sample_jpeg():
    img = Image.new("RGB", (100, 100), color=(37, 99, 235))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def upload_image(product_id, image_bytes, token):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="sample.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + image_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")
    
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return request(f"/catalog/products/{product_id}/image", "POST", body=body, token=token, headers_extra=headers)

def main():
    print("================================================================")
    print("TEST SUITE: EDICIÓN COMPLETA DE PRODUCTOS, CONTRATO Y PERSISTENCIA")
    print("================================================================")

    # 1. Login
    login_res = request("/auth/login", "POST", {"username": "admin", "password": "Admin12345*"})
    token = login_res["access_token"]
    print("1. [OK] Autenticado como Administrador.")

    # 2. Create clean test product
    sku = f"TST-{int(time.time()) % 10000}"
    created = request("/catalog/products", "POST", {
        "internal_code": sku,
        "name": "Producto Prueba Edicion",
        "description": "Descripcion inicial",
        "category_id": 4, # Bebidas
        "current_price": "12000.00",
        "recommended_people": 1,
        "is_active": True,
        "is_available": True
    }, token=token)
    prod_id = created["id"]
    print(f"2. [OK] Producto creado para pruebas: ID {prod_id}, SKU {sku}")

    # A. Editar nombre
    print("\n--- TEST A: EDITAR NOMBRE ---")
    upd_name = request(f"/catalog/products/{prod_id}", "PATCH", {
        "name": "Producto Nombre Modificado"
    }, token=token)
    assert upd_name["name"] == "Producto Nombre Modificado", "Name mismatch!"
    print(f"   [OK] Nombre editado y verificado: '{upd_name['name']}'")

    # B. Editar precio
    print("\n--- TEST B: EDITAR PRECIO (VÍA ENDPOINT PRECIOS) ---")
    upd_price = request(f"/catalog/products/{prod_id}/price", "POST", {
        "current_price": "15500.00",
        "expected_price_version": upd_name["price_version"]
    }, token=token)
    assert float(upd_price["current_price"]) == 15500.00, "Price mismatch!"
    print(f"   [OK] Precio editado y verificado: ${float(upd_price['current_price']):,.2f} (versión {upd_price['price_version']})")

    # C. Editar Porciones
    print("\n--- TEST C: EDITAR PORCIONES ---")
    upd_serves = request(f"/catalog/products/{prod_id}", "PATCH", {
        "recommended_people": 3
    }, token=token)
    assert upd_serves["recommended_people"] == 3, "Serves mismatch!"
    print(f"   [OK] Porciones editadas y verificadas: {upd_serves['recommended_people']} personas")

    # D. Editar Disponibilidad y Estado
    print("\n--- TEST D: EDITAR DISPONIBILIDAD Y ESTADO ---")
    upd_state = request(f"/catalog/products/{prod_id}", "PATCH", {
        "is_available": False,
        "is_active": False
    }, token=token)
    assert upd_state["is_available"] is False, "Availability mismatch!"
    assert upd_state["is_active"] is False, "Active status mismatch!"
    print(f"   [OK] Disponibilidad (False) y Estado (False) guardados correctamente.")

    # Reactivar para seguir pruebas
    request(f"/catalog/products/{prod_id}", "PATCH", {"is_available": True, "is_active": True}, token=token)

    # E. Editar descripción vacía (debe permitir limpiar la descripción sin error 422)
    print("\n--- TEST E: DESCRIPCIÓN VACÍA / LIMPIA ---")
    upd_desc = request(f"/catalog/products/{prod_id}", "PATCH", {
        "description": ""
    }, token=token)
    print(f"   [OK] Descripción limpiada sin error 422. Valor: '{upd_desc.get('description')}'")

    # F. Subir imagen a producto sin imagen
    print("\n--- TEST F: SUBIR IMAGEN A PRODUCTO ---")
    img_bytes = create_sample_jpeg()
    upd_img = upload_image(prod_id, img_bytes, token)
    img_ref = upd_img.get("image_reference")
    print(f"   [OK] Imagen subida exitosamente: {img_ref}")
    assert img_ref and "/media/products/" in img_ref, "Image reference missing!"

    # G. Cambiar imagen
    print("\n--- TEST G: CAMBIAR IMAGEN EXISTENTE ---")
    img_bytes_2 = create_sample_jpeg()
    upd_img_2 = upload_image(prod_id, img_bytes_2, token)
    img_ref_2 = upd_img_2.get("image_reference")
    print(f"   [OK] Nueva imagen almacenada: {img_ref_2}")
    assert img_ref_2 and "/media/products/" in img_ref_2, "New image reference missing!"

    # H. Validar persistencia real consultando producto desde API
    print("\n--- TEST H: COMPROBACIÓN DE PERSISTENCIA REAL ---")
    persisted = request(f"/catalog/products/{prod_id}", "GET", token=token)
    assert persisted["name"] == "Producto Nombre Modificado"
    assert float(persisted["current_price"]) == 15500.00
    assert persisted["recommended_people"] == 3
    assert persisted["is_available"] is True
    assert persisted["is_active"] is True
    assert persisted["image_reference"] == img_ref_2
    print("   [OK] Todos los campos editados coinciden exactamente con la persistencia de PostgreSQL:")
    print(f"        Nombre: {persisted['name']}")
    print(f"        Precio: ${float(persisted['current_price']):,.2f}")
    print(f"        Porciones: {persisted['recommended_people']}")
    print(f"        Disponibilidad: {persisted['is_available']}")
    print(f"        Estado: {persisted['is_active']}")
    print(f"        Imagen: {persisted['image_reference']}")

    # I. Validar que la imagen es servida correctamente vía HTTP
    img_url = f"http://localhost:5000{img_ref_2}"
    with urllib.request.urlopen(img_url) as resp:
        assert resp.status == 200
        data = resp.read()
        print(f"   [OK] Archivo de imagen servido correctamente vía HTTP 200 ({len(data)} bytes).")

    print("\n================================================================")
    print("✓ TODAS LAS PRUEBAS DE EDICIÓN DE PRODUCTO PASARON EXITOSAMENTE")
    print("================================================================")

if __name__ == "__main__":
    main()
