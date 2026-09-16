/* =========================================================================
 * Tuition ERP — Frontend controller
 * Vanilla JS SPA served by the Express backend. All API calls are JWT-authed.
 * ========================================================================= */

'use strict';

// API base — relative, since the frontend is served by the same server.
const API_BASE = '/api';
const TOKEN_KEY = 'tuition-erp-token';

// Restore any existing session instead of forcing the login screen on every load.
let authToken = null;
try { authToken = localStorage.getItem(TOKEN_KEY); } catch (_) { authToken = null; }

// In-memory caches so we can edit without an extra round-trip.
let studentsCache = [];
let editingStudentId = null;

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

// Escape user/DB-supplied text before it goes into innerHTML (prevents stored XSS).
function escapeHtml(value) {
  if (value === null || value === undefined) { return ''; }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape a value for use inside a single-quoted inline handler argument.
function escapeJs(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

// Toast notifications (replace blocking alert()).
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<i class="ph-fill ${icons[type] || icons.info}"></i><span></span>`;
  toast.querySelector('span').textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// Table state helpers — a single row spanning `cols` columns.
function tableRow(cols, className, html) {
  return `<tr><td colspan="${cols}" class="${className}">${html}</td></tr>`;
}
function setTableLoading(tbodyId, cols) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = tableRow(cols, 'table-loading', '<i class="ph ph-spinner ph-spin"></i> Loading…');
  }
}
function setTableEmpty(tbodyId, cols, message, icon = 'ph-tray') {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = tableRow(cols, 'table-empty', `<i class="ph ${icon}"></i>${escapeHtml(message)}`);
  }
}
function setTableError(tbodyId, cols, retryFn) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = tableRow(cols, 'table-error',
      `<i class="ph ph-warning-circle"></i>Couldn't load data.` +
      (retryFn ? ` <button class="btn secondary retry-btn" onclick="${retryFn}()">Retry</button>` : ''));
  }
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */
function activateView(target) {
  document.querySelectorAll('.nav-links li').forEach(l => {
    const isActive = l.dataset.target === target;
    l.classList.toggle('active', isActive);
    l.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  const view = document.getElementById(target);
  if (view) { view.classList.add('active-view'); }

  if (target === 'students-view') { loadStudents(); }
  if (target === 'attendance-view') { loadAttendance(); }
  if (target === 'fees-view') { loadFees(); }
  if (target === 'dashboard-view') { loadDashboard(); }

  // On mobile, selecting a destination closes the drawer.
  closeSidebar();
}

document.querySelectorAll('.nav-links li').forEach(link => {
  link.addEventListener('click', () => activateView(link.dataset.target));
  // Keyboard access for the (non-native-button) nav items.
  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateView(link.dataset.target); }
  });
});

/* ------------------------------------------------------------------ *
 * Mobile sidebar drawer
 * ------------------------------------------------------------------ */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const open = sidebar.classList.toggle('open');
  if (backdrop) { backdrop.classList.toggle('active', open); }
}
function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) { sidebar.classList.remove('open'); }
  if (backdrop) { backdrop.classList.remove('active'); }
}

/* ------------------------------------------------------------------ *
 * Modals
 * ------------------------------------------------------------------ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); }
}

// Close modals on Escape / backdrop click.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    closeSidebar();
  }
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) { overlay.classList.remove('active'); }
  });
});

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */
function showApp() {
  const loginWrapper = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');

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

function showLogin() {
  const loginWrapper = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  appContainer.style.display = 'none';
  loginWrapper.style.display = 'flex';
  loginWrapper.style.opacity = '1';
}

function logout() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (_) { /* ignore */ }
  authToken = null;
  location.reload();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('button');
  const originalText = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> <span>Authenticating…</span>';

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      authToken = data.token;
      try { localStorage.setItem(TOKEN_KEY, authToken); } catch (_) { /* ignore */ }
      showApp();
    } else {
      showToast(data.message || 'Invalid credentials', 'error');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  } catch (err) {
    console.error(err);
    // Real network/server error — never fake a login.
    showToast('Could not reach the server. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// Authenticated fetch wrapper.
async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    showToast('Session expired. Please log in again.', 'error');
    logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try { const body = await res.json(); if (body && body.message) { msg = body.message; } } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return res;
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */
async function loadDashboard() {
  try {
    const students = await (await apiFetch('/students')).json();
    studentsCache = students;
    animateCounter('total-students-count', students.length);

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fees = await (await apiFetch(`/fees/${monthYear}`)).json();

    let pendingAmount = 0;
    students.forEach(s => {
      const f = fees.find(fee => fee.student_id === s.id);
      if (!f || f.status !== 'Paid') { pendingAmount += Number(s.fee_amount) || 0; }
    });
    animateCounter('pending-fees-count', pendingAmount, '₹');

    const date = now.toISOString().split('T')[0];
    const atts = await (await apiFetch(`/attendance/${date}`)).json();
    animateCounter('present-today-count', atts.filter(a => a.status === 'Present').length);

    renderRecentActivity(students);
  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard data.', 'error');
  }
}

function renderRecentActivity(students) {
  const widget = document.getElementById('recent-activity');
  if (!widget) { return; }
  if (!students.length) {
    widget.innerHTML = `<div class="empty-state"><i class="ph ph-activity"></i><p>No recent activity</p></div>`;
    return;
  }
  const recent = [...students]
    .sort((a, b) => new Date(b.joined_date || b.createdAt || 0) - new Date(a.joined_date || a.createdAt || 0))
    .slice(0, 5);

  widget.innerHTML = '<div class="activity-list">' + recent.map(s => {
    const when = s.joined_date || s.createdAt;
    return `
      <div class="activity-item">
        <div class="act-avatar">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}&backgroundColor=transparent" alt="" loading="lazy">
        </div>
        <div class="activity-meta">
          <div class="name">${escapeHtml(s.name)}</div>
          <div class="sub">Enrolled · ${escapeHtml(formatMoney(s.fee_amount))} (${escapeHtml(s.fee_type || 'Monthly')})</div>
        </div>
        <div class="activity-time">${when ? escapeHtml(new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : ''}</div>
      </div>`;
  }).join('') + '</div>';
}

function animateCounter(id, target, prefix = '') {
  const el = document.getElementById(id);
  if (!el) { return; }
  target = Number(target) || 0;
  const isMoney = prefix === '₹';
  const fmt = (v) => isMoney ? prefix + Math.round(v).toLocaleString('en-IN') : prefix + Math.ceil(v);
  if (target === 0) { el.innerText = fmt(0); return; }
  let current = 0;
  const steps = 20;
  const increment = target / steps;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      el.innerText = fmt(target);
      clearInterval(timer);
    } else {
      el.innerText = fmt(current);
    }
  }, 40);
}

/* ------------------------------------------------------------------ *
 * Students
 * ------------------------------------------------------------------ */
async function loadStudents() {
  setTableLoading('students-tbody', 4);
  try {
    const students = await (await apiFetch('/students')).json();
    studentsCache = students;

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fees = await (await apiFetch(`/fees/${monthYear}`)).json();

    if (!students.length) {
      setTableEmpty('students-tbody', 4, 'No students yet. Add your first student to get started.', 'ph-users');
      return;
    }

    const rows = students.map(student => {
      const fee = fees.find(f => f.student_id === student.id);
      const isPaid = fee && fee.status === 'Paid';
      const statusClass = isPaid ? 'status-paid' : 'status-pending';
      const statusText = isPaid ? 'Paid' : 'Pending';
      const idJs = escapeJs(student.id);
      return `
        <tr>
          <td>
            <div class="cell-user">
              <div class="avatar sm">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=transparent" alt="" loading="lazy">
              </div>
              <div>
                <div class="cell-name">${escapeHtml(student.name)}</div>
                <div class="cell-sub"><i class="ph ph-phone"></i> ${escapeHtml(student.phone || 'N/A')}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="cell-sub"><i class="ph ph-clock"></i> ${escapeHtml(student.batch_time || 'N/A')}</div>
          </td>
          <td>
            <div class="fee-amount">${escapeHtml(formatMoney(student.fee_amount))} <span class="cell-sub">(${escapeHtml(student.fee_type || 'Monthly')})</span></div>
            <span class="status-pill ${statusClass}">${statusText}</span>
          </td>
          <td>
            <div class="row-actions">
              <button class="btn icon-only edit-btn" onclick="editStudent('${idJs}')" title="Edit" aria-label="Edit ${escapeHtml(student.name)}">
                <i class="ph ph-pencil-simple"></i>
              </button>
              <button class="btn icon-only delete-btn" onclick="deleteStudent('${idJs}')" title="Delete" aria-label="Delete ${escapeHtml(student.name)}">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });
    document.getElementById('students-tbody').innerHTML = rows.join('');
  } catch (err) {
    console.error(err);
    setTableError('students-tbody', 4, 'loadStudents');
  }
}

// Open the student modal in "add" mode.
function openStudentModal() {
  editingStudentId = null;
  document.getElementById('add-student-form').reset();
  document.getElementById('student-modal-title').textContent = 'Add New Student';
  document.getElementById('student-submit-btn').textContent = 'Save Student';
  openModal('student-modal');
}

// Open the student modal in "edit" mode, pre-filled.
function editStudent(id) {
  const student = studentsCache.find(s => s.id === id);
  if (!student) { showToast('Student not found. Try refreshing.', 'error'); return; }
  editingStudentId = id;
  document.getElementById('student-name').value = student.name || '';
  document.getElementById('student-phone').value = student.phone || '';
  document.getElementById('student-batch').value = student.batch_time || '';
  document.getElementById('student-fee-type').value = student.fee_type || 'Monthly';
  document.getElementById('student-fee-amount').value = student.fee_amount ?? '';
  document.getElementById('student-modal-title').textContent = 'Edit Student';
  document.getElementById('student-submit-btn').textContent = 'Update Student';
  openModal('student-modal');
}

document.getElementById('add-student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('student-submit-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving…';

  const payload = {
    name: document.getElementById('student-name').value.trim(),
    phone: document.getElementById('student-phone').value.trim(),
    batch_time: document.getElementById('student-batch').value.trim(),
    fee_type: document.getElementById('student-fee-type').value,
    fee_amount: Number(document.getElementById('student-fee-amount').value) || 0
  };

  if (!payload.name) {
    showToast('Student name is required.', 'error');
    btn.disabled = false; btn.textContent = originalText;
    return;
  }

  try {
    const isEdit = Boolean(editingStudentId);
    await apiFetch(isEdit ? `/students/${editingStudentId}` : '/students', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    closeModal('student-modal');
    e.target.reset();
    editingStudentId = null;
    showToast(isEdit ? 'Student updated.' : 'Student added.', 'success');
    loadStudents();
    loadDashboard();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not save student.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student? This also removes their fee and attendance history.')) { return; }
  try {
    await apiFetch(`/students/${id}`, { method: 'DELETE' });
    showToast('Student deleted.', 'success');
    loadStudents();
    loadDashboard();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not delete student.', 'error');
  }
}

/* ------------------------------------------------------------------ *
 * AI Assistant
 * ------------------------------------------------------------------ */
function toggleAIChat() {
  const panel = document.getElementById('ai-sidebar');
  const overlay = document.getElementById('ai-overlay');
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    overlay.classList.remove('active');
  } else {
    panel.classList.add('open');
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('ai-chat-input').focus(), 300);
  }
}

function handleAIKeyPress(e) {
  if (e.key === 'Enter') { sendAIMessage(); }
}

function appendChatMessage(container, role, text, asHtml = false) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (asHtml) { bubble.innerHTML = text; } else { bubble.textContent = text; }
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return { div, bubble };
}

async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const message = input.value.trim();
  if (!message) { return; }

  const messagesContainer = document.getElementById('ai-chat-messages');
  appendChatMessage(messagesContainer, 'user', message);
  input.value = '';

  const loading = appendChatMessage(messagesContainer, 'ai',
    '<i class="ph ph-dots-three ph-bounce"></i> Thinking…', true);

  try {
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    loading.bubble.textContent = data.reply || data.message || 'I can help you manage students and track fees!';
  } catch (err) {
    console.error(err);
    loading.bubble.textContent = "I couldn't process that request right now. Please try again.";
  }
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ------------------------------------------------------------------ *
 * Superadmin recovery
 * ------------------------------------------------------------------ */
document.getElementById('recover-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  const resultDiv = document.getElementById('recover-result');
  const emailKey = document.getElementById('recover-email').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Decrypting…';
  resultDiv.style.display = 'none';
  resultDiv.style.color = 'inherit';
  resultDiv.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/recover-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailKey })
    });
    const data = await res.json().catch(() => ({}));
    resultDiv.style.display = 'block';
    if (data.success) {
      resultDiv.style.color = 'var(--success)';
      resultDiv.textContent = 'Success! Credentials decrypted:\n\n' + data.credentials;
    } else {
      resultDiv.style.color = 'var(--danger)';
      resultDiv.textContent = 'Error: ' + (data.message || 'Decryption failed.');
    }
  } catch (err) {
    resultDiv.style.display = 'block';
    resultDiv.style.color = 'var(--danger)';
    resultDiv.textContent = 'Network error or decryption failed.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

/* ------------------------------------------------------------------ *
 * Attendance
 * ------------------------------------------------------------------ */
async function loadAttendance() {
  const dateInput = document.getElementById('attendance-date');
  const date = dateInput.value;
  if (!date) { return; }

  setTableLoading('attendance-tbody', 4);
  try {
    const [attendanceRecords, students] = await Promise.all([
      (await apiFetch(`/attendance/${date}`)).json(),
      (await apiFetch('/students')).json()
    ]);

    if (!students.length) {
      setTableEmpty('attendance-tbody', 4, 'No students found. Add a student first.', 'ph-users');
      return;
    }

    const rows = students.map(student => {
      const record = attendanceRecords.find(a => a.student_id === student.id);
      const status = record ? record.status : 'None';
      const notes = record ? (record.notes || '') : '';
      const idJs = escapeJs(student.id);
      const sel = (v) => status === v ? 'selected' : '';
      return `
        <tr data-student-id="${escapeHtml(student.id)}">
          <td>${escapeHtml(student.name)}</td>
          <td>
            <select class="status-select ${status.toLowerCase()}" aria-label="Attendance status for ${escapeHtml(student.name)}"
                    onchange="onAttStatusChange(this, '${idJs}')">
              <option value="None" ${sel('None')}>-</option>
              <option value="Present" ${sel('Present')}>Present</option>
              <option value="Absent" ${sel('Absent')}>Absent</option>
              <option value="Late" ${sel('Late')}>Late</option>
            </select>
          </td>
          <td>
            <input type="text" class="att-note" value="${escapeHtml(notes)}" placeholder="Notes…"
                   aria-label="Notes for ${escapeHtml(student.name)}" onblur="onAttNoteBlur(this, '${idJs}')">
          </td>
          <td><button class="btn secondary" onclick="onAttMarkPresent(this, '${idJs}')">Mark Present</button></td>
        </tr>`;
    });
    document.getElementById('attendance-tbody').innerHTML = rows.join('');
  } catch (err) {
    console.error(err);
    setTableError('attendance-tbody', 4, 'loadAttendance');
  }
}

// Read the full row state (status + notes) and upsert together, so neither field clobbers the other.
async function saveAttendanceRow(rowEl, studentId, statusOverride) {
  const date = document.getElementById('attendance-date').value;
  const select = rowEl.querySelector('.status-select');
  const noteInput = rowEl.querySelector('.att-note');
  const status = statusOverride || (select ? select.value : 'None');
  const notes = noteInput ? noteInput.value : '';
  try {
    await apiFetch('/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, date, status, notes })
    });
    if (select) { select.className = `status-select ${status.toLowerCase()}`; }
    loadDashboard();
  } catch (err) {
    console.error(err);
    showToast('Failed to save attendance.', 'error');
  }
}

function onAttStatusChange(selectEl, studentId) {
  saveAttendanceRow(selectEl.closest('tr'), studentId);
}
function onAttNoteBlur(inputEl, studentId) {
  saveAttendanceRow(inputEl.closest('tr'), studentId);
}
function onAttMarkPresent(btnEl, studentId) {
  const row = btnEl.closest('tr');
  const select = row.querySelector('.status-select');
  if (select) { select.value = 'Present'; }
  saveAttendanceRow(row, studentId, 'Present');
  showToast('Marked present.', 'success');
}

/* ------------------------------------------------------------------ *
 * Fees
 * ------------------------------------------------------------------ */
async function loadFees() {
  const monthYear = document.getElementById('fee-month').value; // YYYY-MM
  if (!monthYear) { return; }

  setTableLoading('fees-tbody', 4);
  try {
    const [fees, students] = await Promise.all([
      (await apiFetch(`/fees/${monthYear}`)).json(),
      (await apiFetch('/students')).json()
    ]);

    if (!students.length) {
      setTableEmpty('fees-tbody', 4, 'No students found. Add a student first.', 'ph-users');
      return;
    }

    const rows = students.map(student => {
      const record = fees.find(f => f.student_id === student.id);
      const status = record ? record.status : 'Pending';
      const amountDue = record ? record.amount_due : student.fee_amount;
      const statusClass = status === 'Paid' ? 'status-paid' : 'status-pending';
      const idJs = escapeJs(student.id);
      const myJs = escapeJs(monthYear);
      const action = status !== 'Paid'
        ? `<button class="btn primary glow-btn pay-btn" onclick="payFee('${idJs}', '${myJs}', ${Number(amountDue) || 0})">Mark Paid</button>`
        : `<span class="paid-label"><i class="ph ph-check-circle"></i> Paid</span>`;
      return `
        <tr>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(formatMoney(amountDue))}</td>
          <td><span class="status-pill ${statusClass}">${status}</span></td>
          <td>${action}</td>
        </tr>`;
    });
    document.getElementById('fees-tbody').innerHTML = rows.join('');
  } catch (err) {
    console.error(err);
    setTableError('fees-tbody', 4, 'loadFees');
  }
}

async function payFee(studentId, monthYear, amount) {
  if (!confirm('Mark fee as paid for this student?')) { return; }
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
    showToast('Payment recorded.', 'success');
    loadFees();
    loadDashboard();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to process payment.', 'error');
  }
}

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
(function init() {
  // Default the date/month pickers to today / this month.
  const attDate = document.getElementById('attendance-date');
  if (attDate) {
    attDate.valueAsDate = new Date();
    attDate.addEventListener('change', loadAttendance);
  }
  const feeMonth = document.getElementById('fee-month');
  if (feeMonth) {
    const t = new Date();
    feeMonth.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    feeMonth.addEventListener('change', loadFees);
  }

  if (authToken) { showApp(); } else { showLogin(); }
})();
