(function () {
  'use strict';
  const { schema, defaults, sanitize, simulate } = window.FunnelModel;
  const storageKey = 'edinaldo-funnel-views-v2';
  const form = document.getElementById('simulator-form');
  const feedback = document.getElementById('input-feedback');
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const exactCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  let state = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') state = sanitize(saved);
  } catch { /* The simulator also works when browser storage is unavailable. */ }

  function output(key, value) {
    document.querySelectorAll('[data-output="' + key + '"]').forEach(element => { element.textContent = value; });
  }

  function render() {
    const result = simulate(state);
    const { months, totals, config } = result;
    const first = months[0];
    const last = months[11];
    const moneyValues = {
      communityRevenue: first.communityRevenue, midRevenue: first.midRevenue, consultRevenue: first.consultRevenue,
      midPrice: config.midPrice, consultPrice: config.consultPrice,
      averageGross: totals.gross / 12, averageCosts: totals.costs / 12, averageNet: totals.net / 12,
      investmentMonthly: totals.investment / 12, acquisitionMonthly: totals.acquisition / 12, myhubMonthly: totals.myhubDeposit / 12,
      portfolioYear: last.portfolio, portfolioIncome: result.portfolioIncome,
      acquisitionYear: last.acquisitions, myhubYear: last.myhub,
      yearGross: totals.gross, yearNet: totals.net, incomeGoal: config.incomeGoal
    };
    for (const [key, value] of Object.entries(moneyValues)) output(key, currency.format(value));
    output('communityPrice', exactCurrency.format(config.communityPrice));
    output('quarterPrice', exactCurrency.format(config.communityPrice * 3));
    output('annualMember', exactCurrency.format(config.communityPrice * 12));
    output('memberLtv', exactCurrency.format(result.memberLtv));
    const counts = {
      visitors: config.visitors, newMembers: result.newMembers, midBuyers: first.midBuyers,
      communityBuyers: first.communityBuyers, directBuyers: first.directBuyers,
      consultCount: first.consultCount, consultYearCount: totals.consultCount,
      yearMembers: last.members, midCapacity: config.midCapacity, consultCapacity: config.consultCapacity
    };
    for (const [key, value] of Object.entries(counts)) output(key, integer.format(value));
    for (const key of ['investmentShare', 'acquisitionShare', 'costRate', 'annualReturn']) output(key, decimal.format(config[key]) + '%');
    output('myhubShare', result.myhubShare + '%');
    output('requiredCapital', result.requiredCapital === null ? 'indefinido com retorno de 0%' : currency.format(result.requiredCapital));
    output('goalProgress', result.requiredCapital === null ? '0%' : decimal.format(last.portfolio / result.requiredCapital * 100) + '%');
    document.getElementById('bar-investment').style.width = config.investmentShare + '%';
    document.getElementById('bar-acquisition').style.width = config.acquisitionShare + '%';
    document.getElementById('bar-myhub').style.width = result.myhubShare + '%';

    const periods = [months[0], months[2], months[5], months[11]];
    const rows = [
      ['Comunidade · WhatsApp', 'communityRevenue', ''],
      ['Cursos, mentorias e imersões', 'midRevenue', ''],
      ['Consultoria empresarial', 'consultRevenue', ''],
      ['Faturamento bruto', 'gross', 'row-total'],
      ['Reserva de impostos e operação', 'costs', ''],
      ['Saldo para distribuir', 'net', 'row-net'],
      ['Carteira de investimentos', 'portfolio', 'row-asset'],
      ['Fundo para aquisições', 'acquisitions', 'row-asset'],
      ['Fundo MyHub', 'myhub', 'row-asset']
    ];
    const body = document.getElementById('forecast-body');
    body.replaceChildren();
    for (const [label, key, className] of rows) {
      const row = document.createElement('tr');
      row.className = className;
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = label;
      row.append(heading);
      for (const period of periods) {
        const cell = document.createElement('td');
        const value = ['portfolio', 'acquisitions', 'myhub'].includes(key) ? period[key] : period.cumulative[key];
        cell.textContent = currency.format(value);
        row.append(cell);
      }
      body.append(row);
    }
    try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch { /* Optional persistence. */ }
  }

  function syncInputs() {
    for (const key of Object.keys(schema)) {
      form.elements.namedItem(key).value = state[key];
      form.elements.namedItem(key).removeAttribute('aria-invalid');
    }
    form.elements.acquisitionShare.max = 100 - state.investmentShare;
  }

  function readField(field, finalize) {
    const key = field.name;
    const rule = schema[key];
    if (!rule) return;
    const value = field.valueAsNumber;
    const maximum = key === 'acquisitionShare' ? 100 - state.investmentShare : rule.max;
    const invalid = !Number.isFinite(value) || value < rule.min || value > maximum || (rule.integer && !Number.isInteger(value));
    if (invalid && !finalize && !(value > maximum)) {
      field.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Informe um valor entre ' + decimal.format(rule.min) + ' e ' + decimal.format(maximum) + (rule.integer ? ', sem casas decimais.' : '.');
      return;
    }
    let next = Number.isFinite(value) ? Math.min(maximum, Math.max(rule.min, value)) : state[key];
    next = rule.integer ? Math.floor(next) : Math.round(next * 100) / 100;
    state[key] = next;
    field.removeAttribute('aria-invalid');
    if (finalize || invalid) field.value = next;
    feedback.textContent = invalid ? 'Valor ajustado ao intervalo permitido. O cenário foi atualizado.' : '';
    if (key === 'investmentShare') {
      const remaining = 100 - next;
      form.elements.acquisitionShare.max = remaining;
      if (state.acquisitionShare > remaining) {
        state.acquisitionShare = remaining;
        form.elements.acquisitionShare.value = remaining;
        feedback.textContent = 'A reserva para aquisições foi ajustada para que os três destinos somem 100%.';
      }
    }
    render();
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', event => readField(event.target, false));
  form.addEventListener('focusout', event => readField(event.target, true));
  form.addEventListener('keydown', event => {
    if (event.target.type === 'number' && ['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
  });
  document.getElementById('reset-button').addEventListener('click', () => {
    state = { ...defaults };
    syncInputs();
    render();
    feedback.textContent = 'Cenário inicial restaurado.';
  });

  // Native vector/text printing preserves selectable text and the complete site styling.
  let printing = false;
  let detailsState = [];
  const originalTitle = document.title;
  function preparePrint() {
    if (printing) return;
    printing = true;
    for (const key of Object.keys(schema)) readField(form.elements.namedItem(key), true);
    detailsState = [...document.querySelectorAll('details')].map(element => ({ element, open: element.open }));
    detailsState.forEach(({ element }) => { element.open = true; });
    document.title = 'Edinaldo — Plano de negócio e patrimônio';
  }
  function restorePrint() {
    detailsState.forEach(({ element, open }) => { element.open = open; });
    printing = false;
    document.title = originalTitle;
    document.getElementById('export-status').textContent = 'Para gerar o arquivo, use a opção Salvar como PDF na janela de impressão.';
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrint);
  document.querySelectorAll('.export-button').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      document.getElementById('export-status').textContent = 'Preparando o plano. Na janela de impressão, selecione Salvar como PDF.';
      try {
        if (document.fonts) await document.fonts.ready;
        preparePrint();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.print();
      } finally {
        button.disabled = false;
        // Some browsers do not dispatch afterprint when the dialog is dismissed.
        if (printing) restorePrint();
      }
    });
  });
  syncInputs();
  render();
})();
