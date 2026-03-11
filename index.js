const dateInput = document.getElementById('appointment_date');
const timeSelect = document.getElementById('appointment_time');
const slotsDiv = document.getElementById('slots');
const bookingForm = document.getElementById('bookingForm');
const bookingMessage = document.getElementById('bookingMessage');

async function loadAvailability() {
  const date = dateInput.value;
  if (!date) return;
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  const data = await res.json();

  timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';
  slotsDiv.innerHTML = '';

  data.slots.forEach(slot => {
    const el = document.createElement('div');
    el.className = `slot ${slot.available ? 'free' : 'busy'}`;
    el.textContent = slot.time;
    slotsDiv.appendChild(el);

    if (slot.available) {
      const opt = document.createElement('option');
      opt.value = slot.time;
      opt.textContent = slot.time;
      timeSelect.appendChild(opt);
    }
  });
}

if (dateInput) {
  dateInput.addEventListener('change', loadAvailability);
}

if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    bookingMessage.textContent = 'Guardando cita...';

    const payload = {
      customer_name: document.getElementById('customer_name').value,
      customer_phone: document.getElementById('customer_phone').value,
      service_type: document.getElementById('service_type').value,
      appointment_date: document.getElementById('appointment_date').value,
      appointment_time: document.getElementById('appointment_time').value,
      customer_address: document.getElementById('customer_address').value,
      notes: document.getElementById('notes').value
    };

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    bookingMessage.textContent = data.message || 'Cita creada';
    await loadAvailability();
    bookingForm.reset();
  });
}