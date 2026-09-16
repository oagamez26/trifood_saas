import httpx

client = httpx.Client(base_url="http://localhost:5000")
login_res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin12345*"})
assert login_res.status_code == 200, login_res.text
token = login_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 1. Get initial dashboard
dash_before = client.get("/api/analytics/dashboard", headers=headers).json()
tables_before = dash_before["tables_total"]
print(f"Tables total before: {tables_before}")

# 2. Create Mesa 99
create_res = client.post("/api/tables-orders/tables", json={"number": "Mesa 99", "capacity": 6}, headers=headers)
assert create_res.status_code == 201, create_res.text
new_tbl = create_res.json()
print(f"Created table: {new_tbl['number']}, id={new_tbl['id']}, capacity={new_tbl['capacity']}")

# 3. Check dashboard total increased by 1
dash_after = client.get("/api/analytics/dashboard", headers=headers).json()
assert dash_after["tables_total"] == tables_before + 1, f"Expected {tables_before + 1}, got {dash_after['tables_total']}"
print(f"Tables total after create: {dash_after['tables_total']}")

# 4. Update Mesa 99 capacity to 8
upd_res = client.patch(f"/api/tables-orders/tables/{new_tbl['id']}", json={"capacity": 8}, headers=headers)
assert upd_res.status_code == 200, upd_res.text
assert int(upd_res.json()["capacity"]) == 8
print(f"Updated table capacity to: {upd_res.json()['capacity']}")

# 5. Deactivate table
deact_res = client.patch(f"/api/tables-orders/tables/{new_tbl['id']}", json={"is_active": False}, headers=headers)
assert deact_res.status_code == 200, deact_res.text
dash_deact = client.get("/api/analytics/dashboard", headers=headers).json()
assert dash_deact["tables_total"] == tables_before, f"Expected {tables_before}, got {dash_deact['tables_total']}"
print(f"Tables total after deactivation: {dash_deact['tables_total']}")

# 6. Reactivate table
react_res = client.patch(f"/api/tables-orders/tables/{new_tbl['id']}", json={"is_active": True}, headers=headers)
assert react_res.status_code == 200, react_res.text
dash_react = client.get("/api/analytics/dashboard", headers=headers).json()
assert dash_react["tables_total"] == tables_before + 1
print(f"Tables total after reactivation: {dash_react['tables_total']}")

# 7. Delete table (never had sessions -> physically deleted)
del_res = client.delete(f"/api/tables-orders/tables/{new_tbl['id']}", headers=headers)
assert del_res.status_code == 200, del_res.text
print(f"Delete result: {del_res.json()}")

dash_final = client.get("/api/analytics/dashboard", headers=headers).json()
assert dash_final["tables_total"] == tables_before
print(f"Tables total after delete: {dash_final['tables_total']}")

print("SUCCESS: ALL TABLE CRUD & DYNAMIC METRIC TESTS PASSED!")
