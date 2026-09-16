import re
with open('public/app.js', 'r') as f:
    content = f.read()

replacement = """async function loadStudents() {
  try {
    const res = await apiFetch(`/students`);
    const students = await res.json();
    const monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const resFee = await apiFetch(`/fees/${monthYear}`);
    const fees = await resFee.json();

    const tbody = document.getElementById('students-tbody');
    tbody.innerHTML = '';
    
    students.forEach(student => {
      const fee = fees.find(f => f.student_id === student.id);
      const isPaid = fee && fee.status === 'Paid';
      const statusClass = isPaid ? 'status-paid' : 'status-pending';
      const statusText = isPaid ? 'Paid' : 'Pending';
"""

content = re.sub(r'async function loadStudents\(\) \{\s*try \{\s*const res = await apiFetch\(`/students`\);\s*const students = await res\.json\(\);\s*const tbody = document\.getElementById\(\'students-tbody\'\);\s*tbody\.innerHTML = \'\';\s*students\.forEach\(student => \{\s*const statusClass = [^;]+;\s*const statusText = [^;]+;', replacement, content)

with open('public/app.js', 'w') as f:
    f.write(content)
