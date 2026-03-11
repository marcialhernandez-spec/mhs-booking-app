// MHS Services booking backend starter
// Add package.json in Replit with: express, pg, bcryptjs, jsonwebtoken, dotenv, twilio, cors
// Required env vars:
// DATABASE_URL=postgres://...
// JWT_SECRET=change_me
// ADMIN_EMAIL=admin@example.com
// ADMIN_PASSWORD_HASH=<bcrypt hash>
// TWILIO_ACCOUNT_SID=...
// TWILIO_AUTH_TOKEN=...
// TWILIO_FROM=+1...

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
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

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !passwordHash) {
      return res.status(500).json({ message: 'Faltan variables de admin en el servidor.' });
    }

    const okEmail = email === adminEmail;
    const okPass = await bcrypt.compare(password, passwordHash);

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

    await sendBookingSms(customer_phone, service_type, appointment_date, appointment_time);

    res.status(201).json({ message: 'Cita confirmada y guardada correctamente.', appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo crear la cita.', error: err.message });
  }
});

app.get('/api/admin/appointments', async (_req, res) => {
  try {
    const result = await pool.query(`select * from appointments order by appointment_date asc, appointment_time asc limit 50`);
    res.json({ appointments: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'No se pudieron cargar las citas.', error: err.message });
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

app.get('/api/tech/jobs', async (_req, res) => {
  try {
    const result = await pool.query(
      `select a.*, t.name as technician_name
       from appointments a
       left join technicians t on a.technician_id = t.id
       order by a.appointment_date asc, a.appointment_time asc`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'No se pudieron cargar los trabajos.', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});