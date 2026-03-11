create table if not exists technicians (
  id serial primary key,
  name text not null,
  phone text,
  vehicle_label text,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists appointments (
  id serial primary key,
  customer_name text not null,
  customer_phone text not null,
  service_type text not null check (service_type in (
    'Instalación de aires inverter',
    'Mantenimiento de aires inverter',
    'Reparación de aires inverter',
    'Cotización para nuevos clientes'
  )),
  appointment_date date not null,
  appointment_time text not null,
  customer_address text not null,
  notes text,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled','completed')),
  technician_id integer references technicians(id),
  created_at timestamp default now()
);

create table if not exists blocked_slots (
  id serial primary key,
  block_date date not null,
  block_time text not null,
  created_at timestamp default now(),
  unique(block_date, block_time)
);

create index if not exists idx_appointments_date_time on appointments(appointment_date, appointment_time);
create index if not exists idx_blocked_slots_date_time on blocked_slots(block_date, block_time);

insert into technicians (name, phone, vehicle_label)
values
  ('Carlos', '+10000000001', 'Van 1'),
  ('Miguel', '+10000000002', 'Truck 2')
on conflict do nothing;