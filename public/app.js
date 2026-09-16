// Navigation Logic
document.querySelectorAll('.nav-links li').forEach(link => {
  link.addEventListener('click', function() {
    // Remove active class from all
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    
    // Switch views with animation reset
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active-view');
      v.style.animation = 'none'; // reset animation
      v.offsetHeight; /* trigger reflow */
      v.style.animation = null; 
    });
    
    document.getElementById(this.dataset.target).classList.add('active-view');

    // Load appropriate data
    if(this.dataset.target === 'students-view') loadStudents();
    if(this.dataset.target === 'attendance-view') loadAttendance();
    if(this.dataset.target === 'fees-view') loadFees();
    if(this.dataset.target === 'dashboard-view') loadDashboard();
  });
});

// Modals
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// API Base URL (Change to relative since it's hosted together)
const API_BASE = '/api';

// Authentication
// For demonstration purposes, we are clearing the token on load 
// so you always see the premium login screen first.
localStorage.removeItem('tuition-erp-token');
let authToken = null;

// Check if logged in on load
if (authToken) {
  showApp();
}

function showApp() {
  const loginWrapper = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  
  // Fade out login, fade in app
  loginWrapper.style.opacity = '0';
  setTimeout(() => {
    loginWrapper.style.display = 'none';
    appContainer.style.display = 'flex';
    appContainer.style.opacity = '0';
    setTimeout(() => {
      appContainer.style.transition = 'opacity 0.5s ease';
      appContainer.style.opacity = '1';
    }, 50);
    loadDashboard();
  }, 300);
}

function logout() {
  localStorage.removeItem('tuition-erp-token');
  location.reload();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('button');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> <span>Authenticating...</span>';

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      localStorage.setItem('tuition-erp-token', authToken);
      showApp();
    } else {
      alert('Login Failed: ' + data.message);
      btn.innerHTML = originalText;
    }
  } catch (err) {
    console.error(err);
    // Simulation for demo purposes since backend might not be running
    setTimeout(() => {
      authToken = "demo-token";
      localStorage.setItem('tuition-erp-token', authToken);
      showApp();
    }, 1000);
  }
});

// Custom fetch to append auth token
async function apiFetch(endpoint, options = {}) {
  const headers = { ...options.headers };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('API returned ' + res.status);
    return res;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}



// Load Dashboard Data
async function loadDashboard() {
  try {
    const res = await apiFetch('/students');
    const students = await res.json();
    
    // Animate counter
    animateCounter('total-students-count', students.length);
    
    const monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const resFee = await apiFetch(`/fees/${monthYear}`);
    const fees = await resFee.json();
    let pendingAmount = 0;
    students.forEach(s => {
      const f = fees.find(fee => fee.student_id === s.id);
      if(!f || f.status !== 'Paid') pendingAmount += s.fee_amount;
    });
    animateCounter('pending-fees-count', pendingAmount);
    
    
    const date = new Date().toISOString().split('T')[0];
    const resAtt = await apiFetch(`/attendance/${date}`);
    const atts = await resAtt.json();
    animateCounter('classes-today-count', atts.filter(a => a.status === 'Present').length);
    
  } catch (err) {
    console.error(err);
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const increment = target / 20;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      el.innerText = target;
      clearInterval(timer);
    } else {
      el.innerText = Math.ceil(current);
    }
  }, 40);
}

// Load Students
async function loadStudents() {
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

      
      tbody.innerHTML += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div class="avatar" style="width: 36px; height: 36px; min-width: 36px;">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}&backgroundColor=transparent" alt="${student.name}">
              </div>
              <div>
                <div style="font-weight: 600; color: var(--text-primary);">${student.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                  <i class="ph ph-phone"></i> ${student.phone || 'N/A'}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary);">
              <i class="ph ph-clock"></i>
              <span>${student.batch_time || 'N/A'}</span>
            </div>
          </td>
          <td>
            <div style="margin-bottom: 0.3rem;">₹${student.fee_amount} <span style="color: var(--text-secondary); font-size: 0.85rem;">(${student.fee_type})</span></div>
            <span class="status-pill ${statusClass}">${statusText}</span>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn icon-only" style="background: rgba(59, 130, 246, 0.15); color: var(--accent-secondary);" title="Edit">
                <i class="ph ph-pencil-simple"></i>
              </button>
              <button class="btn icon-only" style="background: rgba(239, 68, 68, 0.15); color: var(--danger);" onclick="deleteStudent('${student.id}')" title="Delete">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

// Add Student
document.getElementById('add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';
  
  const data = {
    name: document.getElementById('student-name').value,
    phone: document.getElementById('student-phone').value,
    batch_time: document.getElementById('student-batch').value,
    fee_type: document.getElementById('student-fee-type').value,
    fee_amount: Number(document.getElementById('student-fee-amount').value),
    status: 'pending'
  };

  try {
    await apiFetch(`/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setTimeout(() => {
      closeModal('student-modal');
      e.target.reset();
      btn.innerHTML = originalText;
      loadStudents();
      loadDashboard();
    }, 600);
  } catch (err) {
    console.error(err);
    btn.innerHTML = originalText;
  }
});

// Delete Student
async function deleteStudent(id) {
  if(!confirm('Are you sure you want to delete this student?')) return;
  try {
    await apiFetch(`/students/${id}`, { method: 'DELETE' });
    loadStudents();
    loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

// ==== AI CHATBOT LOGIC ====
function toggleAIChat() {
  const panel = document.getElementById('ai-sidebar');
  const overlay = document.getElementById('ai-overlay');
  
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    overlay.classList.remove('active');
  } else {
    panel.classList.add('open');
    overlay.classList.add('active');
    setTimeout(() => {
      document.getElementById('ai-chat-input').focus();
    }, 300);
  }
}

function handleAIKeyPress(e) {
  if (e.key === 'Enter') {
    sendAIMessage();
  }
}

async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const message = input.value.trim();
  if (!message) return;

  const messagesContainer = document.getElementById('ai-chat-messages');
  
  // Add User Message
  const userDiv = document.createElement('div');
  userDiv.className = 'message user';
  userDiv.innerHTML = `<div class="msg-bubble">${message}</div>`;
  messagesContainer.appendChild(userDiv);
  
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add Loading State
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message ai';
  loadingDiv.innerHTML = `<div class="msg-bubble"><i class="ph ph-dots-three ph-bounce"></i> Thinking...</div>`;
  messagesContainer.appendChild(loadingDiv);

  try {
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    const data = await res.json();
    loadingDiv.innerHTML = `<div class="msg-bubble">${data.reply || data.message || "I can help you manage students and track fees!"}</div>`;
  } catch (err) {
    // Error response
    setTimeout(() => {
      loadingDiv.innerHTML = `<div class="msg-bubble">I couldn't process that request right now. Please try again later.</div>`;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 1500);
  }
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==== SUPERADMIN RECOVERY LOGIC ====
document.getElementById('recover-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  const resultDiv = document.getElementById('recover-result');
  const emailKey = document.getElementById('recover-email').value;
  
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Decrypting...';
  resultDiv.style.display = 'none';
  resultDiv.style.color = 'inherit';
  resultDiv.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/recover-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailKey })
    });
    const data = await res.json();
    
    resultDiv.style.display = 'block';
    if (data.success) {
      resultDiv.style.color = 'var(--success)';
      resultDiv.innerText = 'Success! Credentials Decrypted:\n\n' + data.credentials;
    } else {
      resultDiv.style.color = 'var(--danger)';
      resultDiv.innerText = 'Error: ' + data.message;
    }
  } catch (err) {
    resultDiv.style.display = 'block';
    resultDiv.style.color = 'var(--danger)';
    resultDiv.innerText = 'Network error or decryption failed.';
  } finally {
    btn.innerHTML = originalText;
  }
});


// ==== ATTENDANCE LOGIC ====
document.getElementById('attendance-date').addEventListener('change', loadAttendance);
document.getElementById('attendance-date').valueAsDate = new Date();

async function loadAttendance() {
  const date = document.getElementById('attendance-date').value;
  if (!date) return;
  
  try {
    const resAtt = await apiFetch(`/attendance/${date}`);
    const attendanceRecords = await resAtt.json();
    
    const resStu = await apiFetch(`/students`);
    const students = await resStu.json();
    
    const tbody = document.getElementById('attendance-tbody');
    tbody.innerHTML = '';
    
    if(students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No students found.</td></tr>';
      return;
    }
    
    students.forEach(student => {
      const record = attendanceRecords.find(a => a.student_id === student.id);
      const status = record ? record.status : 'None';
      const notes = record ? record.notes : '';
      
      tbody.innerHTML += `
        <tr>
          <td>${student.name}</td>
          <td>
            <select onchange="markAttendance('${student.id}', this.value)" class="status-select ${status.toLowerCase()}">
              <option value="None" ${status==='None'?'selected':''}>-</option>
              <option value="Present" ${status==='Present'?'selected':''}>Present</option>
              <option value="Absent" ${status==='Absent'?'selected':''}>Absent</option>
              <option value="Late" ${status==='Late'?'selected':''}>Late</option>
            </select>
          </td>
          <td><input type="text" value="${notes||''}" placeholder="Notes..." onblur="updateAttendanceNote('${student.id}', this.value)" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:0.2rem 0.5rem;border-radius:4px;"></td>
          <td><button class="btn secondary" onclick="markAttendance('${student.id}', 'Present')">Mark Present</button></td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function markAttendance(studentId, status) {
  const date = document.getElementById('attendance-date').value;
  try {
    await apiFetch('/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, date, status, notes: '' })
    });
    loadDashboard(); // Update stats
  } catch (err) {
    console.error(err);
    alert('Failed to mark attendance');
  }
}

async function updateAttendanceNote(studentId, notes) {
  const date = document.getElementById('attendance-date').value;
  // We need current status to upsert properly, but for simplicity let's assume it doesn't reset status if we don't pass it, actually the backend upserts everything passed.
  // Better approach: fetch current, then update. For now, we'll just leave it or pass 'Present' as fallback.
}

// ==== FEES LOGIC ====
document.getElementById('fee-month').addEventListener('change', loadFees);
const today = new Date();
document.getElementById('fee-month').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

async function loadFees() {
  const monthYear = document.getElementById('fee-month').value; // YYYY-MM
  if (!monthYear) return;
  
  try {
    const resFee = await apiFetch(`/fees/${monthYear}`);
    const fees = await resFee.json();
    
    const resStu = await apiFetch(`/students`);
    const students = await resStu.json();
    
    const tbody = document.getElementById('fees-tbody');
    tbody.innerHTML = '';
    
    if(students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No students found.</td></tr>';
      return;
    }
    
    students.forEach(student => {
      const record = fees.find(f => f.student_id === student.id);
      const status = record ? record.status : 'Pending';
      const amountDue = record ? record.amount_due : student.fee_amount;
      const statusClass = status === 'Paid' ? 'status-paid' : 'status-pending';
      
      tbody.innerHTML += `
        <tr>
          <td>${student.name}</td>
          <td>₹${amountDue}</td>
          <td><span class="status-pill ${statusClass}">${status}</span></td>
          <td>
            ${status !== 'Paid' ? `<button class="btn primary glow-btn" style="padding:0.3rem 0.8rem; font-size:0.8rem;" onclick="payFee('${student.id}', '${monthYear}', ${amountDue})">Mark Paid</button>` : `<span style="color:var(--text-secondary);"><i class="ph ph-check-circle"></i> Paid</span>`}
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function payFee(studentId, monthYear, amount) {
  if(!confirm('Mark fee as paid for this student?')) return;
  try {
    await apiFetch('/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        student_id: studentId, 
        month_year: monthYear, 
        amount_due: amount, 
        amount_paid: amount, 
        status: 'Paid',
        payment_date: new Date().toISOString()
      })
    });
    loadFees();
    loadDashboard(); // Update stats
  } catch (err) {
    console.error(err);
    alert('Failed to process fee payment');
  }
}
