(function () {
  'use strict';
  const mobile = window.matchMedia('(max-width: 760px), (max-width: 1023px) and (pointer: coarse)');
  const navigation = document.querySelector('.mobile-nav');
  const links = [...navigation.querySelectorAll('a')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  const picker = document.querySelector('.mobile-period-picker');
  const table = document.querySelector('.table-container');
  const caption = document.getElementById('mobile-period-caption');
  let frame = 0;

  // Keep one source of financial data: the mobile view selects a column of the existing table.
  table.dataset.periodColumn = '5';
  document.documentElement.classList.add('mobile-enhanced');
  picker.addEventListener('click', event => {
    const button = event.target.closest('button[data-months]');
    if (!button || !picker.contains(button)) return;
    const months = Number(button.dataset.months);
    const column = { 1: 2, 3: 3, 6: 4, 12: 5 }[months];
    if (!column) return;
    table.dataset.periodColumn = String(column);
    picker.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    caption.textContent = months === 1 ? 'Valores acumulados no primeiro mês.' : 'Valores acumulados em ' + months + ' meses.';
  });

  function updateNavigation() {
    frame = 0;
    if (!mobile.matches) return;
    let selected = -1;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= window.innerHeight * 0.4) selected = index;
    });
    links.forEach((link, index) => {
      if (index === selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scheduleNavigation() {
    if (!frame) frame = requestAnimationFrame(updateNavigation);
  }

  function updateKeyboard() {
    const editing = mobile.matches && document.activeElement?.matches('#simulator-form input');
    document.body.classList.toggle('mobile-input-active', Boolean(editing));
  }

  function syncLayout() {
    window.removeEventListener('scroll', scheduleNavigation);
    if (mobile.matches) window.addEventListener('scroll', scheduleNavigation, { passive: true });
    updateNavigation();
    updateKeyboard();
  }
  mobile.addEventListener('change', syncLayout);
  window.addEventListener('resize', scheduleNavigation, { passive: true });
  document.addEventListener('focusin', updateKeyboard);
  document.addEventListener('focusout', () => requestAnimationFrame(updateKeyboard));
  document.querySelectorAll('#simulator-form input').forEach(input => {
    if (!input.hasAttribute('inputmode')) input.inputMode = input.step === '1' || input.step === '100' ? 'numeric' : 'decimal';
  });
  syncLayout();
})();
