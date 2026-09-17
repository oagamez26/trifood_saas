import httpx

client = httpx.Client(base_url="http://localhost:8080/api")
r = client.post("/auth/login", json={"username": "cajero1", "password": "Cajero12345*"})
t = r.json()["access_token"]
h = {"Authorization": "Bearer " + t}

regs = client.get("/cash/registers", headers=h).json()
print("Registers:", [(r["id"], r["name"], bool(r.get("active_session"))) for r in regs])

for r_item in regs:
    sess = r_item.get("active_session")
    if sess:
        print(f"Closing session #{sess['id']} for register #{r_item['id']}...")
        cl = client.post(f"/cash/sessions/{sess['id']}/close", json={"reported_cash": 500000}, headers=h)
        print("Close result:", cl.status_code, cl.text)

regs_after = client.get("/cash/registers", headers=h).json()
print("After close:", [(r["id"], r["name"], bool(r.get("active_session"))) for r in regs_after])
