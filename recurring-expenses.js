(() => {
  // Fenêtre « Dépenses récurrentes » (lot 11) : une récurrence n'appartient à aucun budget précis.
  // Chaque mois, elle est ajoutée comme dépense prévue dans la Grâce de ce mois. Si la Grâce
  // n'existe pas encore, elle attend sa création.
  const style = document.createElement('style');
  style.textContent = `
    .recurring-dialog{max-height:min(90vh,780px);overflow:auto}
    .recurring-dialog .recurring-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}
    .recurring-dialog .recurring-head h2{margin:2px 0 0}
    .recurring-dialog .recurring-head .close{position:static;flex:0 0 auto}
    .recurring-rule{display:flex;gap:10px;align-items:flex-start;margin:10px 0 4px;padding:12px 14px;border-radius:14px;background:var(--accent-soft,#eaf0ff);color:var(--text,#1d1d1f);font-size:14px;line-height:1.45}
    .recurring-rule svg{flex:0 0 auto;width:20px;height:20px;margin-top:1px;fill:none;stroke:var(--accent,#2456f5);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .recurring-list{display:grid;gap:8px;margin:14px 0 16px}
    .recurring-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:var(--surface-2,#f2f2f7)}
    .recurring-item.paused{opacity:.62}
    .recurring-item strong{display:block;font-size:15px}
    .recurring-item small{display:block;color:var(--text-2,#6e6e73);margin-top:3px;font-size:13px;line-height:1.4}
    .recurring-item .waiting{color:var(--dogs,#c2700a);font-weight:600}
    .recurring-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:var(--line,#e5e5ea);color:var(--text-2,#6e6e73);font-size:11px;font-weight:600;vertical-align:middle}
    .recurring-actions{display:flex;gap:6px;align-items:center;flex:0 0 auto}
    .recurring-actions button{min-height:44px;border:0;border-radius:12px;padding:8px 12px;background:var(--surface,#fff);color:var(--text,#1d1d1f);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
    .recurring-actions button[data-rec-delete]{color:var(--danger,#d70015)}
    .recurring-new{width:100%;min-height:48px;border:1px dashed var(--line-strong,#c7c7cc);border-radius:14px;background:transparent;color:var(--accent,#2456f5);font:inherit;font-weight:600;cursor:pointer}
    .recurring-form[hidden],.recurring-new[hidden]{display:none!important}
    .recurring-form h3{margin:4px 0 0}
    .recurring-status{min-height:1em;color:var(--danger,#d70015);font-size:13px;margin:0}
    .confirm-sheet{max-width:420px;text-align:center;padding:26px 22px 20px}
    .confirm-sheet .confirm-icon{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:var(--danger-soft,#ffe9eb);color:var(--danger,#d70015)}
    .confirm-sheet .confirm-icon svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .confirm-sheet h2{margin:0 0 6px;font-size:20px}
    .confirm-sheet p{margin:0 0 18px;color:var(--text-2,#6e6e73);font-size:15px;line-height:1.45}
    .confirm-actions{display:grid;gap:8px}
    .confirm-actions button{min-height:50px;border:0;border-radius:14px;font:inherit;font-weight:600;font-size:16px;cursor:pointer}
    .confirm-actions .confirm-danger{background:var(--danger,#d70015);color:#fff}
    .confirm-actions .confirm-keep{background:var(--surface-2,#f2f2f7);color:var(--text,#1d1d1f)}
    .confirm-sheet.neutral .confirm-icon{background:var(--accent-soft,#eaf0ff);color:var(--accent,#2456f5)}
    .confirm-sheet.neutral .confirm-actions .confirm-danger{background:var(--accent,#2456f5)}
    .recurring-item{flex-wrap:wrap}
    .recurring-tracking{flex:0 0 100%;display:grid;gap:10px;padding-top:10px;border-top:1px solid var(--line,#e5e5ea)}
    .recurring-tracking[hidden]{display:none!important}
    @media(max-width:479px){.recurring-item{flex-direction:column;flex-wrap:nowrap;align-items:stretch}.recurring-actions{justify-content:flex-end}.recurring-tracking{flex:0 0 auto}}
  `;
  document.head.append(style);

  const api = async (action, data) => {
    const response = await fetch('recurring-api.php?action=' + action, {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Erreur');
    return result;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' F CFA';
  const day = value => value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(value + 'T12:00:00')) : '';
  const monthName = value => value ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(value + 'T12:00:00')) : '';
  const icon = path => '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  let dialog = null;
  let refreshTicket = 0;

  // Choix « En une fois / Au fur et à mesure » (lot 14), partagé avec l'écran Budgets.
  // « locked » désigne le choix devenu impossible.
  const trackingField = (name, value, locked = '') => '<fieldset class="segmented"><legend>Elle se dépense</legend><div>' +
    [['single', 'En une fois'], ['gradual', 'Au fur et à mesure']].map(([key, label]) =>
      '<label><input type="radio" name="' + esc(name) + '" value="' + key + '"' + (key === value ? ' checked' : '') +
      (key === locked ? ' disabled' : '') + '><span>' + label + '</span></label>').join('') + '</div></fieldset>';
  window.BudgetTrackingField = trackingField;

  // Feuille de confirmation au style de l'application (remplace confirm() du navigateur).
  // tone « neutral » : action sans suppression (coche bleue au lieu de la corbeille rouge).
  function confirmSheet({ title, message, confirmLabel, cancelLabel = 'Garder', tone = 'danger' }) {
    return new Promise(resolve => {
      const sheet = document.createElement('dialog');
      sheet.className = 'confirm-sheet' + (tone === 'neutral' ? ' neutral' : '');
      sheet.setAttribute('aria-labelledby', 'confirmTitle');
      const picture = tone === 'neutral' ? '<path d="m5 12.5 4.5 4.5L19 7.5"/>'
        : '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>';
      sheet.innerHTML = '<div class="confirm-icon">' + icon(picture) + '</div>' +
        '<h2 id="confirmTitle">' + esc(title) + '</h2><p>' + esc(message) + '</p>' +
        '<div class="confirm-actions"><button type="button" class="confirm-danger">' + esc(confirmLabel) + '</button>' +
        '<button type="button" class="confirm-keep">' + esc(cancelLabel) + '</button></div>';
      document.body.append(sheet);
      const done = value => { sheet.close(); sheet.remove(); resolve(value); };
      sheet.querySelector('.confirm-danger').onclick = () => done(true);
      sheet.querySelector('.confirm-keep').onclick = () => done(false);
      sheet.addEventListener('cancel', event => { event.preventDefault(); done(false); });
      sheet.showModal();
      sheet.querySelector('.confirm-keep').focus();
    });
  }
  window.BudgetConfirm = confirmSheet;

  async function refresh() {
    const list = dialog?.querySelector('#recurringList');
    if (!list) return;
    const ticket = ++refreshTicket;
    try {
      const items = (await api('list')).recurrences || [];
      if (ticket !== refreshTicket) return; // une réponse plus récente arrive : on ignore celle-ci
      dialog.querySelector('#recurringCount').textContent = items.length
        ? items.length + (items.length > 1 ? ' récurrences' : ' récurrence')
        : 'Aucune récurrence pour le moment';
      list.innerHTML = items.map(item => {
        const active = Number(item.active) === 1;
        const waiting = active && Number(item.grace_ready) !== 1;
        const next = !active ? 'En pause : rien n’est ajouté'
          : waiting ? '<span class="waiting">En attente de la Grâce de ' + esc(monthName(item.next_date)) + '</span>'
          : 'Prochaine : ' + esc(day(item.next_date));
        const gradual = item.tracking === 'gradual';
        const usual = Number(item.usual_amount) || 0;
        const tracking = gradual ? 'Au fur et à mesure' + (usual ? ' · habituel ' + money(usual) : '') : 'En une fois';
        return '<article class="recurring-item' + (active ? '' : ' paused') + '"><div><strong>' +
          esc(item.label) + (active ? '' : '<span class="recurring-badge">En pause</span>') + '</strong><small>' +
          money(item.amount) + ' · ' + (item.bucket === 'priority' ? 'Priorités' : 'Petits chiens') +
          ' · le ' + esc(item.day_of_month) + ' de chaque mois<br>' + tracking + '<br>' + next +
          '</small></div><div class="recurring-actions">' +
          '<button type="button" data-rec-tracking="' + esc(item.id) + '" aria-expanded="false" aria-label="Changer le suivi de ' + esc(item.label) + '">Suivi</button>' +
          '<button type="button" data-rec-toggle="' + esc(item.id) + '">' + (active ? 'Mettre en pause' : 'Reprendre') + '</button>' +
          '<button type="button" data-rec-delete="' + esc(item.id) + '" data-label="' + esc(item.label) + '" aria-label="Supprimer ' + esc(item.label) + '">Supprimer</button></div>' +
          '<form class="recurring-tracking" data-rec-form="' + esc(item.id) + '" novalidate hidden>' +
          trackingField('rec-tracking-' + item.id, gradual ? 'gradual' : 'single') +
          '<label data-usual' + (gradual ? '' : ' hidden') + '>Montant habituel (facultatif)<input type="number" min="1" inputmode="numeric" value="' + (usual || '') + '"></label>' +
          '<p class="sheet-hint">Vaut pour les prochains mois. Une dépense déjà créée se modifie dans son budget.</p>' +
          '<button class="button" type="submit">Enregistrer le suivi</button><p class="recurring-status" role="status"></p></form></article>';
      }).join('');
      list.querySelectorAll('[data-rec-tracking]').forEach(button => button.onclick = () => {
        const form = button.closest('.recurring-item').querySelector('.recurring-tracking');
        form.hidden = !form.hidden;
        button.setAttribute('aria-expanded', String(!form.hidden));
      });
      list.querySelectorAll('[data-rec-form]').forEach(form => {
        const choice = () => form.querySelector('input[type="radio"]:checked').value;
        form.onchange = () => { form.querySelector('[data-usual]').hidden = choice() !== 'gradual'; };
        form.onsubmit = async event => {
          event.preventDefault();
          try {
            const usual = form.querySelector('[data-usual] input').value;
            await api('tracking', { id: form.dataset.recForm, tracking: choice(), usual_amount: choice() === 'gradual' && usual !== '' ? Number(usual) : null });
            await refresh();
          } catch (error) { form.querySelector('.recurring-status').textContent = error.message; }
        };
      });
      list.querySelectorAll('[data-rec-toggle]').forEach(button => button.onclick = async () => {
        button.disabled = true;
        try { await api('toggle', { id: button.dataset.recToggle }); } catch (error) { alert(error.message); }
        refresh();
      });
      list.querySelectorAll('[data-rec-delete]').forEach(button => button.onclick = async () => {
        const ok = await confirmSheet({
          title: 'Supprimer « ' + button.dataset.label + ' » ?',
          message: 'Elle ne sera plus ajoutée les prochains mois. Les dépenses déjà créées restent dans tes budgets.',
          confirmLabel: 'Supprimer la récurrence',
        });
        if (!ok) return;
        try { await api('delete', { id: button.dataset.recDelete }); } catch (error) { alert(error.message); }
        refresh();
      });
      const form = dialog.querySelector('#recurringForm');
      if (!items.length) form.hidden = false;
      dialog.querySelector('.recurring-new').hidden = !form.hidden;
    } catch (error) {
      list.innerHTML = '<p class="empty">' + esc(error.message) + '</p>';
    }
  }

  function open() {
    const form = dialog.querySelector('#recurringForm');
    form.hidden = true;
    form.reset();
    dialog.querySelector('.recurring-status').textContent = '';
    dialog.querySelector('#recurringDate').value = new Date().toISOString().slice(0, 10);
    dialog.showModal();
    refresh();
  }

  function init() {
    if (dialog || !document.querySelector('#newBudget')) return;
    dialog = document.createElement('dialog');
    dialog.className = 'recurring-dialog';
    dialog.setAttribute('aria-labelledby', 'recurringTitle');
    dialog.setAttribute('data-lenis-prevent', '');
    dialog.innerHTML =
      '<div class="recurring-head"><div><p class="ey">Automatisation</p><h2 id="recurringTitle">Dépenses récurrentes</h2>' +
      '<p class="intro" id="recurringCount"></p></div><button class="close" type="button" aria-label="Fermer">×</button></div>' +
      '<p class="recurring-rule">' + icon('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>') +
      '<span>Chaque mois, ces dépenses sont ajoutées automatiquement comme <b>prévues</b> dans la <b>Grâce du mois</b>. Si la Grâce n’existe pas encore, elles attendent sa création.</span></p>' +
      '<div class="recurring-list" id="recurringList" aria-live="polite"></div>' +
      '<button class="recurring-new" type="button">+ Nouvelle récurrence</button>' +
      '<form id="recurringForm" class="recurring-form" hidden><h3>Nouvelle dépense récurrente</h3>' +
      '<label>Libellé<input id="recurringLabel" required maxlength="180" placeholder="Ex. Wifi, Loyer, Tontine"></label>' +
      '<label>Montant (F CFA)<input id="recurringAmount" type="number" min="1" inputmode="numeric" required></label>' +
      trackingField('rec-tracking', 'single') +
      '<label id="recurringUsualBox" hidden>Montant habituel (facultatif)<input id="recurringUsual" type="number" min="1" inputmode="numeric" placeholder="Ex. 2000"></label>' +
      '<label>Catégorie<select id="recurringBucket"><option value="priority">Priorités</option><option value="dogs">Petits chiens</option></select></label>' +
      '<label>À partir du<input id="recurringDate" type="date" required></label>' +
      '<label>Nature (optionnel)<input id="recurringNature"></label><label>Note (optionnelle)<input id="recurringNote"></label>' +
      '<button class="button" type="submit">Créer la récurrence mensuelle</button><p class="recurring-status" role="status"></p></form>';
    document.body.append(dialog);

    const form = dialog.querySelector('#recurringForm');
    dialog.querySelector('.recurring-new').onclick = () => {
      form.hidden = false;
      dialog.querySelector('.recurring-new').hidden = true;
      dialog.querySelector('#recurringLabel').focus();
    };
    dialog.querySelector('.close').onclick = () => dialog.close();
    const choice = () => form.querySelector('[name="rec-tracking"]:checked').value;
    const showUsual = () => { dialog.querySelector('#recurringUsualBox').hidden = choice() !== 'gradual'; };
    form.addEventListener('change', showUsual);
    form.addEventListener('reset', () => setTimeout(showUsual));
    form.onsubmit = async event => {
      event.preventDefault();
      const status = form.querySelector('.recurring-status');
      status.textContent = '';
      const usual = dialog.querySelector('#recurringUsual').value;
      try {
        await api('create', {
          id: crypto.randomUUID(),
          label: dialog.querySelector('#recurringLabel').value.trim(),
          amount: Number(dialog.querySelector('#recurringAmount').value),
          bucket: dialog.querySelector('#recurringBucket').value,
          start_date: dialog.querySelector('#recurringDate').value,
          nature: dialog.querySelector('#recurringNature').value.trim(),
          note: dialog.querySelector('#recurringNote').value.trim(),
          tracking: choice(),
          usual_amount: choice() === 'gradual' && usual !== '' ? Number(usual) : null,
        });
        form.reset();
        form.hidden = true;
        await refresh();
        window.dispatchEvent(new CustomEvent('budget:reload'));
      } catch (error) { status.textContent = error.message; }
    };
  }

  // Ouverture depuis n'importe quel bouton portant data-open-recurring (en-tête, menu…).
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-open-recurring]')) return;
    init();
    if (dialog) open();
  });
  window.BudgetRecurring = { open: () => { init(); if (dialog) open(); } };
  init();
  const timer = setInterval(() => { init(); if (dialog) clearInterval(timer); }, 100);
})();
