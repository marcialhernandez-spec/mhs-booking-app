let authToken = null;

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const blockForm = document.getElementById('blockForm');
const blockMessage = document.getElementById('blockMessage');
const todaySection = document.getElementById('todaySection');
const allSection = document.getElementById('allSection');
const blockSection = document.getElementById('blockSection');
const todayDateLabel = document.getElementById('todayDateLabel');
const todayDiv = document.getElementById('todayAppointments');
const appointmentsDiv = document.getElementById('appointments');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function statusBadge(status) {
  const colors = { confirmed: '#2a7a2a', pending: '#b8860b', completed: '#1a6896', cancelled: '#a33' };
  const labels = { confirmed: 'Confirmada', pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada' };
  const color = colors[status] || '#555';
  return `<span style="background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:0.8em;">${labels[status] || status}</span>`;
}

function buildCard(a, compact) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.customer_address)}`;
  const isDone = a.status === 'completed' || a.status === 'cancelled';

  const actions = isDone ? '' : `
    <div class="appt-actions">
      <a href="tel:${a.customer_phone}" role="button" class="outline">📞 Llamar</a>
      <a href="${mapsUrl}" target="_blank" role="button" class="outline">📍 Maps</a>
      <button onclick="updateStatus(${a.id},'completed')" class="btn-complete">✔ Completada</button>
      <button onclick="updateStatus(${a.id},'cancelled')" class="btn-cancel outline">✖ Cancelar</button>
    </div>`;

  return `
    <div class="appt-card" data-id="${a.id}">
      <div class="appt-header">
        <strong>${a.customer_name}</strong>
        ${statusBadge(a.status)}
      </div>
      <div class="appt-details">
        <span>📱 <a href="tel:${a.customer_phone}">${a.customer_phone}</a></span>
        <span>🔧 ${a.service_type}</span>
        <span>📅 ${formatDate(a.appointment_date)} · ${a.appointment_time}</span>
        <span>📍 ${a.customer_address}</span>
        ${a.notes ? `<span>📝 ${a.notes}</span>` : ''}
      </div>
      ${actions}
    </div>`;
}

async function loadTodayAppointments() {
  const res = await fetch('/api/admin/appointments/today', {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await res.json();
  const list = data.appointments || [];

  const today = todayISO();
  const [y, m, d] = today.split('-');
  todayDateLabel.textContent = `${d}/${m}/${y}`;

  if (!list.length) {
    todayDiv.innerHTML = '<p>No hay citas para hoy.</p>';
    return;
  }
  todayDiv.innerHTML = list.map(a => buildCard(a)).join('');
}

async function loadAllAppointments() {
  const res = await fetch('/api/admin/appointments', {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await res.json();
  const list = data.appointments || [];

  if (!list.length) {
    appointmentsDiv.innerHTML = '<p>No hay citas registradas.</p>';
    return;
  }
  appointmentsDiv.innerHTML = list.map(a => buildCard(a)).join('');
}

async function updateStatus(id, status) {
  const res = await fetch(`/api/admin/appointments/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    await loadTodayAppointments();
    await loadAllAppointments();
  }
}

function showAdminPanels() {
  todaySection.style.display = '';
  allSection.style.display = '';
  blockSection.style.display = '';
  loadTodayAppointments();
  loadAllAppointments();
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    loginMessage.textContent = data.message;
    if (res.ok && data.token) {
      authToken = data.token;
      loginForm.closest('article').style.display = 'none';
      showAdminPanels();
    }
  });
}

if (blockForm) {
  blockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      block_date: document.getElementById('block_date').value,
      block_time: document.getElementById('block_time').value
    };
    const res = await fetch('/api/admin/block-slot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    blockMessage.textContent = data.message || 'Horario bloqueado.';
    blockForm.reset();
    await loadTodayAppointments();
    await loadAllAppointments();
  });
}
