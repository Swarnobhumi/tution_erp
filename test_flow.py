import requests

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJpYXQiOjE3ODk1NDYyMDUsImV4cCI6MTc4OTYzMjYwNX0.wRi2S61Z0EvzuJnidT61fv_2KgZ3a_b9UFwnpG5p-sM"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Add student
print("Adding student...")
r = requests.post("http://localhost:3000/api/students", headers=H, json={
    "name": "Test User", "phone": "12345", "batch_time": "10AM", "fee_type": "Monthly", "fee_amount": 1000
})
assert r.status_code == 201, r.text
sid = r.json()["id"]

# Get students
r = requests.get("http://localhost:3000/api/students", headers=H)
assert r.status_code == 200
print("Students:", r.json())

# Pay fee
print("Paying fee...")
r = requests.post("http://localhost:3000/api/fees", headers=H, json={
    "student_id": sid, "month_year": "2026-09", "amount_due": 1000, "amount_paid": 1000, "status": "Paid"
})
assert r.status_code == 200, r.text

# Mark attendance
print("Marking attendance...")
r = requests.post("http://localhost:3000/api/attendance", headers=H, json={
    "student_id": sid, "date": "2026-09-16", "status": "Present", "notes": ""
})
assert r.status_code == 200, r.text

print("ALL PASSED")
