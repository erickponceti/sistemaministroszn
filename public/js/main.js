// SMZN - Sistema de Ministros Zona Norte - Main JS

// Abrir popup de agendamento
function openScheduleModal(data, turno, igrejaId, igrejaNome, agendId) {
  var modal = document.getElementById('schedModal');
  if (!modal) return;

  document.getElementById('sched_data').value      = data;
  document.getElementById('sched_turno').value     = turno || '';
  document.getElementById('sched_igreja_id').value = igrejaId;
  document.getElementById('sched_agend_id').value  = agendId || '';

  // Formatar data
  var d = new Date(data + 'T12:00:00');
  var opts = { weekday:'long', day:'2-digit', month:'long', year:'numeric' };
  document.getElementById('modal-date-display').textContent = d.toLocaleDateString('pt-BR', opts);
  document.getElementById('modal-igreja-display').textContent = igrejaNome;

  // Pre-selecionar turno
  document.querySelectorAll('input[name="turno_radio"]').forEach(function(r) {
    r.checked = (turno && r.value === turno);
  });

  // Preencher dados se for edicao
  if (agendId) {
    var btn = document.querySelector('[data-agend-id="' + agendId + '"]');
    if (btn) {
      document.getElementById('sched_ministro').value = btn.dataset.ministroId || '';
      document.getElementById('sched_tema').value     = btn.dataset.tema || '';
      document.getElementById('sched_obs').value      = btn.dataset.obs  || '';
    }
    document.getElementById('btn-delete-sched').style.display = 'inline-flex';
  } else {
    document.getElementById('sched_ministro').value = '';
    document.getElementById('sched_tema').value     = '';
    document.getElementById('sched_obs').value      = '';
    document.getElementById('btn-delete-sched').style.display = 'none';
  }

  modal.classList.add('open');
}

function closeScheduleModal() {
  var modal = document.getElementById('schedModal');
  if (modal) modal.classList.remove('open');
}

// Salvar agendamento
async function submitSchedule() {
  var turnoSelected = document.querySelector('input[name="turno_radio"]:checked');
  if (!turnoSelected) { alert('Por favor, selecione o turno.'); return; }

  var ministroId = document.getElementById('sched_ministro').value;
  if (!ministroId) { alert('Por favor, selecione um ministro.'); return; }

  var payload = {
    data:        document.getElementById('sched_data').value,
    turno:       turnoSelected.value,
    ministro_id: ministroId,
    igreja_id:   document.getElementById('sched_igreja_id').value,
    tema:        document.getElementById('sched_tema').value,
    observacao:  document.getElementById('sched_obs').value,
  };

  try {
    var res  = await fetch('/agendamento', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    var data = await res.json();
    if (data.success) { closeScheduleModal(); window.location.reload(); }
  } catch(e) { alert('Erro ao salvar agendamento.'); }
}

async function deleteSchedule() {
  var agendId = document.getElementById('sched_agend_id').value;
  if (!agendId) return;
  if (!confirm('Remover este agendamento?')) return;
  try {
    await fetch('/agendamento/' + agendId, { method:'DELETE' });
    closeScheduleModal();
    window.location.reload();
  } catch(e) { alert('Erro ao remover agendamento.'); }
}

// Fechar modal clicando fora ou Escape
document.addEventListener('click', function(e) {
  var modal = document.getElementById('schedModal');
  if (modal && e.target === modal) closeScheduleModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeScheduleModal();
});
