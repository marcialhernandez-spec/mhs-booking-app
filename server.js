// MHS Services booking backend
// Required env vars:
// DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (optional)
// EMAIL_USER, EMAIL_PASS, NOTIFY_EMAIL

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        service_type TEXT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time VARCHAR(5) NOT NULL,
        customer_address TEXT,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_slots (
        id SERIAL PRIMARY KEY,
        block_date DATE NOT NULL,
        block_time VARCHAR(5) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (block_date, block_time)
      );
    `);

    console.log('DB lista');
  } catch (err) {
    console.error('Error creando tablas:', err.message);
  }
}

initDb();
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_SLOTS = ['08:00','10:00','12:00','14:00','16:00','18:00'];

function signAdminToken(email) {
  return jwt.sign({ email, role: 'admin' }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '12h' });
}

async function sendBookingSms(to, service, date, time) {
  if (!twilioClient || !process.env.TWILIO_FROM) return;
  const body = `MHS Services: Tu cita para ${service} está confirmada el ${date} a las ${time}. Gracias por reservar.`;
  await twilioClient.messages.create({ from: process.env.TWILIO_FROM, to, body });
}

async function sendBookingEmail({ customer_name, customer_phone, service_type, appointment_date, appointment_time, customer_address, notes }) {
  if (!resend || !process.env.NOTIFY_EMAIL) return;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer_address)}`;
  const notesLine = notes ? `Notes: ${notes}` : 'Notes: —';

  const text = [
    'New appointment booked on MHS Services.',
    '',
    `Customer Name:  ${customer_name}`,
    `Phone:          ${customer_phone}`,
    `Service:        ${service_type}`,
    `Date:           ${appointment_date}`,
    `Time:           ${appointment_time}`,
    `Address:        ${customer_address}`,
    notesLine,
    '',
    `Google Maps: ${mapsUrl}`
  ].join('\n');

  const html = `
    <h2 style="color:#0d6e6e;">New Appointment – MHS Services</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr><td><strong>Customer Name</strong></td><td>${customer_name}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${customer_phone}</td></tr>
      <tr><td><strong>Service</strong></td><td>${service_type}</td></tr>
      <tr><td><strong>Date</strong></td><td>${appointment_date}</td></tr>
      <tr><td><strong>Time</strong></td><td>${appointment_time}</td></tr>
      <tr><td><strong>Address</strong></td><td>${customer_address}</td></tr>
      <tr><td><strong>Notes</strong></td><td>${notes || '—'}</td></tr>
    </table>
    <p style="margin-top:16px;">
      <a href="${mapsUrl}" style="background:#0d6e6e;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;">
        Open in Google Maps
      </a>
    </p>
  `;

  await emailTransporter.sendMail({
    from: `"MHS Services" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: 'New Appointment - MHS Services',
    text,
    html
  });
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !passwordHash) {
      return res.status(500).json({ message: 'Faltan variables de admin en el servidor.' });
    }
const okEmail =
  String(email || '').trim().toLowerCase() ===
  String(adminEmail || '').trim().toLowerCase();

const okPass = await bcrypt.compare(
  String(password || '').trim(),
  String(passwordHash || '').trim()
);
    console.log('LOGIN email recibido:', email);
console.log('LOGIN admin email:', adminEmail);
console.log('LOGIN okEmail/okPass:', okEmail, okPass);
    

    if (!okEmail || !okPass) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = signAdminToken(email);
    return res.json({ message: 'Login correcto.', token });
  } catch (err) {
    return res.status(500).json({ message: 'Error en login.', error: err.message });
  }
});

app.get('/api/availability', async (req, res) => {
  try {
    const { date } = req.query;
    const booked = await pool.query(
      `select appointment_time from appointments where appointment_date = $1 and status in ('confirmed','pending')`,
      [date]
    );
    const blocked = await pool.query(
      `select block_time from blocked_slots where block_date = $1`,
      [date]
    );

    const bookedSet = new Set(booked.rows.map(r => r.appointment_time));
    const blockedSet = new Set(blocked.rows.map(r => r.block_time));

    const slots = DEFAULT_SLOTS.map(time => ({
      time,
      available: !bookedSet.has(time) && !blockedSet.has(time)
    }));

    res.json({ slots });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo cargar disponibilidad.', error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      service_type,
      appointment_date,
      appointment_time,
      customer_address,
      notes
    } = req.body;

    const check = await pool.query(
      `select id from appointments where appointment_date = $1 and appointment_time = $2 and status in ('confirmed','pending')`,
      [appointment_date, appointment_time]
    );

    const blocked = await pool.query(
      `select id from blocked_slots where block_date = $1 and block_time = $2`,
      [appointment_date, appointment_time]
    );

    if (check.rows.length || blocked.rows.length) {
      return res.status(409).json({ message: 'Ese horario ya no está disponible.' });
    }

    const result = await pool.query(
      `insert into appointments (
        customer_name, customer_phone, service_type,
        appointment_date, appointment_time, customer_address, notes, status
      ) values ($1,$2,$3,$4,$5,$6,$7,'confirmed') returning *`,
      [customer_name, customer_phone, service_type, appointment_date, appointment_time, customer_address, notes]
    );

    const appt = result.rows[0];

    await sendBookingSms(customer_phone, service_type, appointment_date, appointment_time);

    sendBookingEmail({
      customer_name,
      customer_phone,
      service_type,
      appointment_date,
      appointment_time,
      customer_address,
      notes
    }).catch(err => console.error('Email notification failed:', err.message));

    res.status(201).json({ message: 'Cita confirmada y guardada correctamente.', appointment: appt });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo crear la cita.', error: err.message });
  }
});

app.get('/api/admin/appointments', async (_req, res) => {
  try {
    const result = await pool.query(
      `select * from appointments order by appointment_date asc, appointment_time asc limit 100`
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'No se pudieron cargar las citas.', error: err.message });
  }
});

app.get('/api/admin/appointments/today', async (_req, res) => {
  try {
    const result = await pool.query(
      `select * from appointments
       where appointment_date = current_date
       order by appointment_time asc`
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'No se pudieron cargar las citas de hoy.', error: err.message });
  }
});

app.patch('/api/admin/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido.' });
    }
    const result = await pool.query(
      `update appointments set status = $1 where id = $2 returning *`,
      [status, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Cita no encontrada.' });
    }
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo actualizar el estado.', error: err.message });
  }
});

app.post('/api/admin/block-slot', async (req, res) => {
  try {
    const { block_date, block_time } = req.body;
    await pool.query(`insert into blocked_slots (block_date, block_time) values ($1,$2)`, [block_date, block_time]);
    res.json({ message: 'Horario bloqueado.' });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo bloquear el horario.', error: err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
