(function (root) {
  'use strict';
  const dayMs = 86400000;
  const lastInputDate = '9998-12-01';
  const tasks = Object.freeze([
    ['publico', 'presenca', 0], ['perfis', 'presenca', 0.04],
    ['roteiro', 'presenca', 0.08], ['video', 'presenca', 0.15],
    ['cortes', 'presenca', 0.18], ['publicar-curtos', 'presenca', 0.22],
    ['rotina', 'presenca', 0.98], ['revisao', 'presenca', 1],
    ['proposta', 'comunidade', 0.8], ['grupo', 'comunidade', 0.84],
    ['cobranca', 'comunidade', 0.87], ['teste-pagamento', 'comunidade', 0.9],
    ['entregaveis', 'comunidade', 0.96], ['abrir-turma', 'comunidade', 'opening'],
    ['problema', 'desafio', 'opening'], ['programa', 'desafio', 'prepare'],
    ['inscricao', 'desafio', 'registration'], ['convite', 'desafio', 'invitation'],
    ['confirmar', 'desafio', 'confirmation'], ['conduzir', 'desafio', 'challengeEnd'],
    ['ofertar', 'desafio', 'challengeEnd'], ['avaliar', 'desafio', 'review']
  ]);
  const ids = new Set(tasks.map(task => task[0]));
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    if (value < '1900-01-01' || value > '9999-12-31') return null;
    return date.getTime();
  }
  function iso(value) { return new Date(value).toISOString().slice(0, 10); }
  function addDays(value, days) { return iso(parseDate(value) + days * dayMs); }
  function today() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function initialState(start = today()) {
    const finish = addDays(start, 59);
    return { start, finish: finish > lastInputDate ? lastInputDate : finish, completed: [] };
  }
  function sanitize(input, defaultStart = today()) {
    const fallback = initialState(defaultStart);
    if (!input || typeof input !== 'object') return fallback;
    const start = parseDate(input.start) !== null && input.start <= lastInputDate ? input.start : fallback.start;
    const finish = parseDate(input.finish) !== null && input.finish >= start && input.finish <= lastInputDate ? input.finish : initialState(start).finish;
    const completed = Array.isArray(input.completed) ? [...new Set(input.completed.filter(id => ids.has(id)))] : [];
    return { start, finish, completed };
  }
  function schedule(input) {
    const state = sanitize(input);
    const duration = Math.round((parseDate(state.finish) - parseDate(state.start)) / dayMs);
    const opening = addDays(state.finish, 1);
    let challengeEnd = addDays(state.finish, 14);
    while (![0, 6].includes(new Date(parseDate(challengeEnd)).getUTCDay())) challengeEnd = addDays(challengeEnd, 1);
    const challengeStart = addDays(challengeEnd, -6);
    const milestones = { start: state.start, finish: state.finish, opening, challengeStart, challengeEnd };
    const preparationDays = Math.round((parseDate(challengeStart) - parseDate(opening)) / dayMs);
    const dates = {
      ...milestones,
      prepare: addDays(opening, Math.floor(preparationDays * 0.2)),
      registration: addDays(opening, Math.floor(preparationDays * 0.4)),
      invitation: addDays(opening, Math.floor(preparationDays * 0.5)),
      confirmation: addDays(challengeStart, -1),
      review: addDays(challengeEnd, 2)
    };
    return { milestones, tasks: Object.fromEntries(tasks.map(([id, , point]) => [id,
      typeof point === 'number' ? addDays(state.start, Math.round(duration * point)) : dates[point]
    ])) };
  }
  const api = Object.freeze({ tasks, parseDate, addDays, today, initialState, sanitize, schedule });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoadmapModel = api;
  if (typeof document === 'undefined') return;

  const form = document.getElementById('roadmap-dates');
  if (!form) return;
  const storageKey = 'edinaldo-roadmap-v1';
  const startInput = document.getElementById('roadmap-start');
  const finishInput = document.getElementById('roadmap-finish');
  const feedback = document.getElementById('roadmap-date-feedback');
  const storageNote = document.getElementById('roadmap-storage-note');
  const taskInputs = [...document.querySelectorAll('[data-task]')];
  const resetButton = document.getElementById('roadmap-reset');
  const resetConfirm = document.getElementById('roadmap-reset-confirm');
  const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  let state = initialState();
  try { state = sanitize(JSON.parse(localStorage.getItem(storageKey))); }
  catch { /* A fresh plan also works without storage. */ }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      storageNote.textContent = 'Seu progresso fica salvo neste navegador.';
    } catch {
      storageNote.textContent = 'O navegador não permitiu salvar. Seu progresso vale nesta página; exporte o PDF para guardá-lo.';
    }
  }
  function syncDates() {
    startInput.value = state.start;
    finishInput.value = state.finish;
    startInput.min = finishInput.min = '1900-01-01';
    startInput.max = finishInput.max = '9998-12-01';
    finishInput.min = state.start;
  }
  function render() {
    const plan = schedule(state);
    const completed = new Set(state.completed);
    const todayDate = today();
    for (const [key, date] of Object.entries(plan.milestones)) {
      document.querySelectorAll('[data-roadmap-date="' + key + '"]').forEach(el => { el.textContent = formatter.format(parseDate(date)); });
    }
    taskInputs.forEach(input => {
      const id = input.dataset.task;
      input.checked = completed.has(id);
      const label = input.closest('label');
      const overdue = !input.checked && plan.tasks[id] < todayDate;
      label.classList.toggle('is-complete', input.checked);
      label.classList.toggle('is-overdue', overdue);
      const time = label.querySelector('time');
      time.dateTime = plan.tasks[id];
      time.textContent = (overdue ? 'Replanejar · ' : 'Até ') + formatter.format(parseDate(plan.tasks[id]));
      label.querySelector('.task-state').textContent = input.checked ? 'Feito' : '';
    });
    document.getElementById('roadmap-progress').value = completed.size;
    document.getElementById('roadmap-progress').textContent = completed.size + ' de 22 tarefas';
    document.getElementById('roadmap-progress-label').textContent = completed.size + ' de 22 tarefas · ' + Math.round(completed.size / tasks.length * 100) + '%';
    document.querySelectorAll('[data-phase-progress]').forEach(el => {
      const group = tasks.filter(task => task[1] === el.dataset.phaseProgress);
      el.textContent = group.filter(task => completed.has(task[0])).length + ' / ' + group.length;
    });
    const next = taskInputs.find(input => !input.checked);
    document.getElementById('roadmap-next-action').textContent = next
      ? 'Próximo passo: ' + next.nextElementSibling.firstChild.textContent
      : 'Você colocou o plano em prática. Agora, revise o que aprendeu e prepare a próxima turma.';
    // The original 60-day label becomes accurate for customized deadlines too.
    const days = Math.round((parseDate(state.finish) - parseDate(state.start)) / dayMs) + 1;
    document.querySelector('[data-phase="presenca"] .eyebrow').textContent = '01 / PRIMEIROS ' + days + (days === 1 ? ' DIA' : ' DIAS');
  }
  function applyDates(announce) {
    const start = startInput.value;
    const finish = finishInput.value;
    const validStart = parseDate(start) !== null && start <= lastInputDate;
    const validFinish = parseDate(finish) !== null && finish <= lastInputDate && (!validStart || finish >= start);
    startInput.setAttribute('aria-invalid', String(!validStart));
    finishInput.setAttribute('aria-invalid', String(!validFinish));
    if (!validStart || !validFinish) {
      feedback.textContent = 'Escolha datas válidas. O prazo da primeira fase deve ser igual ou posterior ao início.';
      return false;
    }
    state = { ...state, start, finish };
    finishInput.min = start;
    render();
    persist();
    if (announce) feedback.textContent = 'Plano atualizado. Suas tarefas concluídas foram mantidas.';
    return true;
  }
  form.addEventListener('submit', event => { event.preventDefault(); applyDates(true); });
  form.addEventListener('change', () => applyDates(true));
  taskInputs.forEach(input => input.addEventListener('change', () => {
    const completed = new Set(state.completed);
    input.checked ? completed.add(input.dataset.task) : completed.delete(input.dataset.task);
    state.completed = [...completed];
    render();
    persist();
  }));
  resetButton.addEventListener('click', () => {
    resetConfirm.hidden = false;
    resetButton.setAttribute('aria-expanded', 'true');
    document.getElementById('roadmap-reset-no').focus();
  });
  function dismissReset() {
    resetConfirm.hidden = true;
    resetButton.setAttribute('aria-expanded', 'false');
    resetButton.focus();
  }
  resetButton.setAttribute('aria-controls', 'roadmap-reset-confirm');
  resetButton.setAttribute('aria-expanded', 'false');
  document.getElementById('roadmap-reset-no').addEventListener('click', dismissReset);
  document.getElementById('roadmap-reset-yes').addEventListener('click', () => {
    state = initialState();
    syncDates();
    render();
    persist();
    startInput.removeAttribute('aria-invalid');
    finishInput.removeAttribute('aria-invalid');
    feedback.textContent = 'Roteiro reiniciado. Uma tarefa de cada vez.';
    dismissReset();
  });
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !resetConfirm.hidden) dismissReset();
  });
  window.addEventListener('beforeprint', () => { applyDates(false); });
  window.addEventListener('focus', render);
  syncDates();
  render();
  persist();
})(typeof globalThis !== 'undefined' ? globalThis : this);
