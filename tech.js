const techJobs = document.getElementById('techJobs');

async function loadJobs() {
  const res = await fetch('/api/tech/jobs');
  const data = await res.json();
  techJobs.innerHTML = '';

  data.jobs.forEach(job => {
    const item = document.createElement('div');
    item.className = 'job';
    item.innerHTML = `<strong>${job.appointment_time} · ${job.customer_name}</strong><br>
      <span class="muted">${job.service_type}</span><br>
      ${job.customer_address}<br>
      <span class="ok">Técnico: ${job.technician_name || 'Sin asignar'}</span><br>
      <span class="muted">Estado: ${job.status}</span>`;
    techJobs.appendChild(item);
  });
}

loadJobs();