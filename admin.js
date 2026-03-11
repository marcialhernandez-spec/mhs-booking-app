const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const appointmentsDiv = document.getElementById('appointments');
const blockForm = document.getElementById('blockForm');

async function loadAppointments() {
  const res = await fetch('/api/admin/appointments');
  const data = await res.json();
  appointmentsDiv.innerHTML = '';

  data.appointments.forEach(a => {
    const item = document.createElement('div');
    item.className = 'appt';
    item.innerHTML = `<strong>${a.customer_name}</strong><br>
      <span class="muted">${a.service_type}</span><br>
      ${a.appointment_date} - ${a.appointment_time}<br>
      ${a.customer_address}<br>
      <span class="ok">Estado: ${a.status}</span>`;
    appointmentsDiv.appendChild(item);
  });
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
    if (res.ok) loadAppointments();
  });
}

if (blockForm) {
  blockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      block_date: document.getElementById('block_date').value,
      block_time: document.getElementById('block_time').value
    };
    await fetch('/api/admin/block-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    loadAppointments();
  });
}