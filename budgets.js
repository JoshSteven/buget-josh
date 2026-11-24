(() => {
  /*
   * Écran « Mes budgets » (lot Fondations, novembre 2026).
   * Remplace app-v6.js, budget-enhancements.js et draft-flow.js, qui se corrigeaient entre eux.
   *
   * Principes :
   *  - un seul état (state) et une seule fonction d'affichage (render) ;
   *  - les totaux viennent du moteur de calcul du serveur (api.php → totals) ;
   *  - la saisie d'une dépense vit dans une feuille indépendante : un nouvel affichage
   *    de la page ne l'efface plus ;
   *  - les styles sont dans assets/budgets.css et assets/theme.css.
   */

  const NATURES = ['Foi / générosité', 'Charges essentielles', 'Famille', 'Transport', 'Outils professionnels',
    'Épargne / engagements financiers', 'Dettes / remboursements', 'Plaisir / alimentation', 'Loisirs',
    'Télécoms / connectivité', 'Abonnements numériques', 'Équipement / matériel', 'Santé / bien-être', 'Autre'];
  const CATEGORIES = [['priority', 'Priorités'], ['dogs', 'Petits chiens']];
  const today = () => new Date().toISOString().slice(0, 10);
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { db: { budgets: [], expenses: [], payments: [], totals: {} }, activeId: null, draft: null };

  /* ---------- Outils ---------- */

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0) + ' F CFA';
  const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const budgetLabel = b => b.kind === 'grace' ? 'Grâce — ' + monthFmt.format(new Date(b.period_month + '-02T12:00:00')) : b.name;
  const svg = path => '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';

  async function api(action, data, url = 'api.php') {
    const response = await fetch(url + (action ? '?action=' + action : ''), {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    const json = await response.json();
    if (!response.ok) throw Error(json.error || 'Erreur');
    return json;
  }

  const confirmAction = options => window.BudgetConfirm
    ? window.BudgetConfirm(options)
    : Promise.resolve(confirm(options.title + '\n\n' + options.message));

  /* ---------- Totaux ---------- */

  /*
   * Totaux d'un budget : ceux du serveur. Seule exception, le mode hors connexion :
   * offline-sync.js ajoute alors des lignes au cache local que le serveur n'a pas encore
   * vues ; on recalcule avec la même règle (annulées exclues) jusqu'au retour du réseau.
   */
  function totalsFor(budget) {
    const offline = state.db.expenses.some(e => e._offline);
    const server = state.db.totals?.[budget.id];
    if (server && !offline) return server;
    const rows = state.db.expenses.filter(e => e.budget_id === budget.id && e.status !== 'cancelled');
    const sum = list => list.reduce((n, e) => n + Number(e.amount), 0);
    const part = test => ({ realised: sum(rows.filter(e => test(e) && e.status === 'realised')), planned: sum(rows.filter(e => test(e) && e.status === 'planned')) });
    const t = { received: Number(budget.received), priority: part(e => e.bucket !== 'dogs'), dogs: part(e => e.bucket === 'dogs') };
    t.realised = t.priority.realised + t.dogs.realised;
    t.planned = t.priority.planned + t.dogs.planned;
    t.available_real = t.received - t.realised;
    return t;
  }

  const sortedBudgets = () => state.db.budgets.slice().sort((a, b) =>
    String(b.period_month || b.project_date).localeCompare(String(a.period_month || a.project_date)));
  const entriesOf = (budgetId, category) => state.db.expenses
    .filter(e => e.budget_id === budgetId && (category === 'dogs' ? e.bucket === 'dogs' : e.bucket !== 'dogs'))
    .sort((a, b) => (a.bucket === 'tithe' ? 0 : 1) - (b.bucket === 'tithe' ? 0 : 1));

  /* ---------- Gabarits ---------- */

  function entryRow(e) {
    const cancelled = e.status === 'cancelled';
    const done = e.status === 'realised';
    const status = cancelled ? 'annulée' : done ? 'réalisée' : 'prévue';
    const actions = `<button class="edit-entry" data-edit-entry="${esc(e.id)}" role="menuitem">Modifier la dépense</button>` + (cancelled
      ? `<button class="restore" data-restore="${esc(e.id)}" role="menuitem">Restaurer</button>`
      : `<button class="cancel-entry" data-cancel="${esc(e.id)}" role="menuitem">Annuler la dépense</button>`);
    const toggle = cancelled ? '' : `<button class="toggle" data-toggle="${esc(e.id)}" data-next="${done ? 'planned' : 'realised'}" aria-label="${done ? 'Marquer comme prévue' : 'Marquer comme réalisée'}">${done ? '✓ Réalisée' : 'À faire'}</button>`;
    return `<div class="entry ${e.status}"><div class="entry-main"><b>${esc(e.label)}</b>${e.nature ? `<span class="nature-tag">${esc(e.nature)}</span>` : ''}
      <small>${e.bucket === 'tithe' ? 'Dîme calculée (10 %) · ' : ''}${status}${e.source === 'recurring' ? ' · récurrente' : ''}</small>${e.note ? `<small class="note">${esc(e.note)}</small>` : ''}</div>
      <div class="entry-row"><span class="entry-amount">${money(e.amount)}</span><div class="entry-side">${toggle}
      <span class="entry-menu"><button class="more-entry" data-more="${esc(e.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Plus d’actions">…</button>
      <span class="entry-actions-menu" data-menu="${esc(e.id)}" role="menu" hidden>${actions}</span></span></div></div></div>`;
  }

  function section(budget, category, title, totals) {
    const rows = entriesOf(budget.id, category);
    return `<div class="cat-block cat-${category}"><div class="cat-head"><span>${title}</span><span>${money(totals[category].realised)}</span></div>
      ${rows.map(entryRow).join('') || '<p class="empty">Aucune ligne.</p>'}
      <button class="add" data-add="${esc(budget.id)}" data-category="${category}">＋ Ajouter une dépense</button></div>`;
  }

  function card(budget) {
    const t = totalsFor(budget);
    const engaged = key => t[key].realised + t[key].planned;
    return `<article class="card ${budget.id === state.activeId ? 'active' : ''}" data-budget-card="${esc(budget.id)}">
      <div class="card-head"><div><b>${esc(budgetLabel(budget))}</b>${budget.kind === 'tontine' ? '<span class="kind-tag">Tontine · sans dîme</span>' : ''}<small>Disponible ${money(t.available_real)} · Reçu ${money(t.received)}</small></div>
      <span class="card-tools"><button class="card-more" data-card-more="${esc(budget.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions du budget">…</button>
      <span class="card-actions-menu" data-card-menu="${esc(budget.id)}" role="menu" hidden>
      <button class="tool-edit" data-edit="${esc(budget.id)}" role="menuitem">Modifier le budget</button>
      <button class="tool-del" data-del="${esc(budget.id)}" role="menuitem">Supprimer le budget</button></span></span></div>
      ${CATEGORIES.map(([key, title]) => section(budget, key, title, t)).join('')}
      <div class="card-total"><span>Priorités : ${money(engaged('priority'))}</span><span>Petits chiens : ${money(engaged('dogs'))}</span>
      <strong>Total : ${money(engaged('priority') + engaged('dogs'))}</strong></div></article>`;
  }

  /* ---------- Affichage ---------- */

  function render() {
    const budgets = sortedBudgets();
    if (state.activeId && !budgets.some(b => b.id === state.activeId)) state.activeId = null;
    const strip = $('#overview');
    const keepX = strip.scrollLeft;
    strip.innerHTML = budgets.length ? budgets.map(b => {
      const t = totalsFor(b);
      return `<button class="chip ${b.id === state.activeId ? 'active' : ''}" data-budget-select="${esc(b.id)}" type="button" aria-pressed="${b.id === state.activeId}">
        <b>${esc(budgetLabel(b))}</b><small>Disponible ${money(t.available_real)} · Reçu ${money(t.received)}</small></button>`;
    }).join('') : '<p class="empty">Créez un budget pour commencer.</p>';
    strip.scrollLeft = keepX;
    // La feuille de saisie en cours est mise de côté puis replacée : ce qui a été tapé est conservé.
    const draftLayer = document.querySelector('.draft-layer');
    draftLayer?.remove();
    $('#sheet').innerHTML = budgets.length ? budgets.map(card).join('') : '<p class="empty">Vos cartes de budget apparaîtront ici après la création du premier budget.</p>';
    if (draftLayer && state.draft) placeDraft(draftLayer);
    window.BudgetMotion?.refresh();
  }

  async function load() {
    try {
      state.db = await api('bootstrap');
      render();
    } catch (error) { alert(error.message); }
  }

  function centerChip(id) {
    const strip = $('#overview');
    const chip = strip.querySelector(`[data-budget-select="${CSS.escape(id)}"]`);
    if (!chip || strip.scrollWidth <= strip.clientWidth) return;
    const box = strip.getBoundingClientRect();
    const r = chip.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollLeft + (r.left - box.left) - (strip.clientWidth - r.width) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function selectBudget(id) {
    state.activeId = id;
    render();
    centerChip(id);
    $(`[data-budget-card="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Menus contextuels ---------- */

  function closeMenus() {
    document.querySelectorAll('[data-card-menu],[data-menu]').forEach(m => { m.hidden = true; });
    document.querySelectorAll('[data-card-more],[data-more]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  function toggleMenu(button, menu) {
    const opening = menu.hidden;
    closeMenus();
    menu.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening && window.gsap && !reducedMotion()) gsap.fromTo(menu, { autoAlpha: 0, y: -5, scale: .97 }, { autoAlpha: 1, y: 0, scale: 1, duration: .18, ease: 'power2.out' });
  }

  /* ---------- Feuille « Nouvelle dépense » ---------- */

  function openDraft(budgetId, category) {
    closeDraft();
    state.draft = { budgetId, category, status: 'planned' };
    const sheet = document.createElement('div');
    sheet.className = 'draft-layer';
    sheet.innerHTML = `<div class="draft-backdrop" data-draft-close aria-hidden="true"></div>
      <div class="draft" role="dialog" aria-modal="true" aria-label="Nouvelle dépense">
      <h3 class="draft-title">Nouvelle dépense · ${category === 'dogs' ? 'Petits chiens' : 'Priorités'}</h3>
      <button class="draft-close" type="button" data-draft-close aria-label="Fermer">×</button>
      <input data-field="label" placeholder="Libellé" aria-label="Libellé de la dépense" maxlength="180">
      <input data-field="amount" type="number" inputmode="numeric" min="1" placeholder="Montant" aria-label="Montant de la dépense">
      <input data-field="note" placeholder="Note (optionnel)" aria-label="Note optionnelle" maxlength="300">
      <select data-field="nature" aria-label="Nature optionnelle"><option value="">Nature (optionnel)</option>${NATURES.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>
      <button type="button" data-draft-toggle>Prévue</button>
      <button class="draft-submit" type="button" data-draft-save>Enregistrer la dépense</button>
      <p class="draft-error" role="status"></p></div>`;
    placeDraft(sheet);
    const focus = () => sheet.querySelector('[data-field="label"]')?.focus({ preventScroll: true });
    requestAnimationFrame(focus);
    setTimeout(focus, 180);
  }

  /** La feuille s'affiche dans la carte du budget (style existant sur ordinateur, feuille du bas sur téléphone). */
  function placeDraft(layer) {
    // Sur téléphone, la feuille est fixée en bas de l'écran : elle doit vivre hors de la carte,
    // dont l'animation et le flou piègeraient sa position.
    if (matchMedia('(max-width: 719px)').matches) { document.body.append(layer); return; }
    const block = document.querySelector(`[data-budget-card="${CSS.escape(state.draft.budgetId)}"] .cat-${state.draft.category}`);
    (block || $('#sheet')).insertBefore(layer, block?.querySelector('.add') || null);
  }

  function closeDraft() {
    document.querySelectorAll('.draft-layer').forEach(layer => layer.remove());
    state.draft = null;
  }

  const draftHasContent = () => [...document.querySelectorAll('.draft [data-field]')].some(el => el.value.trim() !== '');

  async function saveDraft(button) {
    const sheet = button.closest('.draft');
    const field = name => sheet.querySelector(`[data-field="${name}"]`).value.trim();
    const error = sheet.querySelector('.draft-error');
    const amount = Number(field('amount'));
    if (!field('label') || !(amount > 0)) { error.textContent = 'Libellé et montant positif requis.'; return; }
    button.disabled = true;
    try {
      await api('expense', {
        id: crypto.randomUUID(), budget_id: state.draft.budgetId, amount, label: field('label'),
        note: field('note'), nature: field('nature'), bucket: state.draft.category, status: state.draft.status, date: today(),
      });
      closeDraft();
      await load();
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  /* ---------- Modification d'une dépense ou d'un budget ---------- */

  async function editEntry(id) {
    const entry = state.db.expenses.find(e => e.id === id);
    if (!entry) return;
    const label = prompt('Libellé :', entry.label);
    if (label === null) return;
    const amountText = prompt('Montant (F CFA) :', entry.amount);
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!label.trim() || !(amount > 0)) { alert('Libellé et montant (positif) requis.'); return; }
    try { await api('expense_update', { id, label: label.trim(), amount }); await load(); } catch (e) { alert(e.message); }
  }

  async function setStatus(id, status) {
    try { await api('', { id, status }, 'update-status.php'); await load(); } catch (e) { alert(e.message); }
  }

  /*
   * Feuille « Modifier le budget » (lot 12). Identité (nom ou mois) et argent reçu :
   * chaque paiement se corrige, s'ajoute ou se supprime. Décision de Josh (option A) :
   * la dîme liée suit automatiquement, et la feuille l'annonce avant d'enregistrer.
   */
  function editBudget(id) {
    const budget = state.db.budgets.find(b => b.id === id);
    if (!budget) return;
    const t = totalsFor(budget);
    const titheOf = paymentId => state.db.expenses.find(e => e.payment_id === paymentId && e.bucket === 'tithe');
    const payments = state.db.payments.filter(p => p.budget_id === id).map(p => ({
      ...p, amount: Number(p.amount), original: { amount: Number(p.amount), label: p.label, date: p.date }, tithe: titheOf(p.id), removed: false, isNew: false,
    }));

    const sheet = document.createElement('dialog');
    sheet.className = 'edit-budget';
    sheet.setAttribute('aria-labelledby', 'editBudgetTitle');
    document.body.append(sheet);

    const noTithe = budget.kind === 'tontine';
    const tenth = value => noTithe ? 0 : Math.round((Number(value) || 0) * .1);

    function rowFoot(p, i) {
      const before = p.tithe ? Number(p.tithe.amount) : null;
      const after = tenth(p.amount);
      const line = p.removed ? 'Ce paiement et sa dîme seront supprimés.'
        : noTithe ? 'Tontine (épargne) : pas de dîme.'
        : p.isNew ? `Nouvelle dîme : ${money(after)}`
        : before === null ? 'Aucune dîme reliée à ce paiement.'
        : before !== after ? `Dîme : ${money(before)} → <b>${money(after)}</b>` : `Dîme : ${money(before)}`;
      const canRemove = p.removed || payments.filter(x => !x.removed).length > 1;
      const warn = !p.removed && p.tithe?.status === 'realised' && before !== after
        ? '<small class="edit-warn">Cette dîme était déjà marquée réalisée : son montant sera ajusté.</small>' : '';
      return `<div class="pay-foot"><small class="pay-tithe">${line}</small>${canRemove
        ? `<button type="button" class="pay-remove" data-remove-row="${i}">${p.removed ? 'Garder' : 'Supprimer'}</button>` : ''}</div>${warn}`;
    }

    function row(p, i) {
      const off = p.removed ? 'disabled' : '';
      return `<div class="pay-row ${p.removed ? 'removed' : ''}" data-row="${i}"><div class="pay-fields">
        <label>Montant reçu<input type="number" min="1" inputmode="numeric" data-pay="amount" value="${esc(p.amount)}" ${off}></label>
        <label>Libellé<input data-pay="label" maxlength="180" value="${esc(p.label)}" ${off}></label>
        <label>Date<input type="date" data-pay="date" value="${esc(p.date)}" ${off}></label></div>
        <div class="pay-extra">${rowFoot(p, i)}</div></div>`;
    }

    function recap() {
      const live = payments.filter(p => !p.removed);
      const received = live.reduce((n, p) => n + (Number(p.amount) || 0), 0);
      let realised = t.realised;
      payments.forEach(p => {
        if (p.tithe?.status === 'realised') realised += (p.removed ? 0 : tenth(p.amount)) - Number(p.tithe.amount);
      });
      return `<div class="edit-recap"><span>Reçu<b>${money(received)}</b></span>
        <span>Dîme<b>${money(live.reduce((n, p) => n + tenth(p.amount), 0))}</b></span>
        <span>Disponible<b>${money(received - realised)}</b></span></div>`;
    }

    function draw() {
      const name = sheet.querySelector('#editName')?.value;
      const month = sheet.querySelector('#editMonth')?.value;
      sheet.innerHTML = `<div class="edit-head"><div><p class="ey">Modifier le budget</p><h2 id="editBudgetTitle">${esc(budgetLabel(budget))}</h2></div>
        <button type="button" class="close" data-edit-close aria-label="Fermer">×</button></div>
        ${budget.kind !== 'grace'
          ? `<label>${budget.kind === 'tontine' ? 'Nom de la tontine' : 'Nom du projet'}<input id="editName" maxlength="160" value="${esc(name ?? budget.name)}"></label>`
          : `<label>Mois couvert<input id="editMonth" type="month" min="2026-06" value="${esc(month ?? budget.period_month)}"></label>`}
        <h3 class="edit-section">Argent reçu</h3>
        <div class="pay-list">${payments.map(row).join('')}</div>
        <button type="button" class="pay-add" data-pay-add>+ Ajouter un paiement</button>
        ${recap()}
        <button type="button" class="button" data-edit-save>Enregistrer les modifications</button>
        <p class="draft-error" role="status"></p>`;
    }

    // Pendant la saisie, seuls la ligne de dîme et le récapitulatif se mettent à jour : les champs ne sont pas redessinés.
    sheet.addEventListener('input', event => {
      const field = event.target.dataset.pay;
      const rowEl = event.target.closest('[data-row]');
      if (!field || !rowEl) return;
      const index = Number(rowEl.dataset.row);
      payments[index][field] = event.target.value;
      rowEl.querySelector('.pay-extra').innerHTML = rowFoot(payments[index], index);
      sheet.querySelector('.edit-recap').outerHTML = recap();
    });

    sheet.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      const d = button.dataset;
      if ('editClose' in d) { sheet.close(); return; }
      if ('removeRow' in d) {
        const p = payments[Number(d.removeRow)];
        if (p.isNew) payments.splice(payments.indexOf(p), 1); else p.removed = !p.removed;
        draw();
        return;
      }
      if ('payAdd' in d) {
        payments.push({ id: crypto.randomUUID(), budget_id: id, amount: '', label: '', date: today(), isNew: true, removed: false, tithe: null });
        draw();
        sheet.querySelector(`[data-row="${payments.length - 1}"] [data-pay="amount"]`)?.focus();
        return;
      }
      if ('editSave' in d) await save(button);
    });

    async function save(button) {
      const error = sheet.querySelector('.draft-error');
      error.textContent = '';
      const live = payments.filter(p => !p.removed);
      if (live.some(p => !(Number(p.amount) > 0) || !String(p.label).trim() || !p.date)) {
        error.textContent = 'Chaque paiement doit avoir un montant positif, un libellé et une date.';
        return;
      }
      const removed = payments.filter(p => p.removed && !p.isNew);
      if (removed.length) {
        const ok = await confirmAction({
          title: removed.length > 1 ? `Supprimer ${removed.length} paiements ?` : `Supprimer « ${removed[0].original.label} » ?`,
          message: 'Le paiement et sa dîme seront effacés. Les autres dépenses du budget ne bougent pas.',
          confirmLabel: 'Supprimer et enregistrer',
        });
        if (!ok) return;
      }
      button.disabled = true;
      try {
        const name = sheet.querySelector('#editName')?.value.trim();
        const month = sheet.querySelector('#editMonth')?.value;
        if (budget.kind !== 'grace' && name && name !== budget.name) await api('budget_label', { id, name });
        if (budget.kind === 'grace' && month && month !== budget.period_month) await api('budget_month', { id, month });
        for (const p of removed) await api('payment_delete', { id: p.id });
        for (const p of live) {
          const label = String(p.label).trim();
          if (p.isNew) {
            await api('payment', { id: p.id, budget_id: id, amount: Number(p.amount), label, payment_date: p.date, tithe_id: crypto.randomUUID() });
          } else if (Number(p.amount) !== p.original.amount || label !== p.original.label || p.date !== p.original.date) {
            await api('payment_update', { id: p.id, amount: Number(p.amount), label, payment_date: p.date });
          }
        }
        sheet.close();
        await load();
      } catch (e) {
        error.textContent = e.message;
        button.disabled = false;
        await load();
      }
    }

    sheet.addEventListener('close', () => sheet.remove());
    draw();
    sheet.showModal();
  }

  async function deleteBudget(id) {
    const budget = state.db.budgets.find(b => b.id === id);
    if (!budget) return;
    const ok = await confirmAction({
      title: `Supprimer « ${budgetLabel(budget)} » ?`,
      message: 'Attention : ce budget, ses paiements et toutes ses dépenses seront effacés définitivement. Cette action est irréversible.',
      confirmLabel: 'Supprimer le budget',
    });
    if (!ok) return;
    try { await api('', { id }, 'delete-budget.php'); await load(); } catch (e) { alert(e.message); }
  }

  /* ---------- Structure de la page ---------- */

  function buildPage() {
    document.body.innerHTML = `<div class="art-bg" aria-hidden="true"></div>
      <header>
        <div class="screen-actions">
          <button type="button" class="action-btn" data-open-recurring aria-label="Dépenses récurrentes">${svg('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>')}<span>Récurrences</span></button>
          <a class="action-btn" id="exportExpenses" href="export-excel.php" download aria-label="Exporter en Excel">${svg('<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>')}<span>Excel</span></a>
        </div>
        <p class="ey">BUDGET JOSH</p><h1>Feuille de dépenses.</h1>
        <p class="intro">Rond bleu coché = dépense réalisée. Rond vide = prévue. La dîme est déjà comptée dans les Priorités.</p>
      </header>
      <main><button class="button" id="newBudget">+ Créer un budget</button><div id="overview" class="overview"></div><p class="ey">VOS BUDGETS</p><div id="sheet" class="sheet"></div></main>
      <dialog id="budgetDialog"><form id="budgetForm"><button type="button" class="close" aria-label="Fermer">×</button><p class="ey">NOUVEAU BUDGET</p><h2>Réglez le budget</h2>
        <label>Type<select id="kind"><option value="grace">Grâce mensuelle</option><option value="project">Projet / consultance</option><option value="tontine">Tontine (épargne)</option></select></label>
        <label id="monthBox">Mois couvert<input id="period" type="month" min="2026-06" required></label>
        <label id="nameBox" class="hidden"><span id="nameLabel">Nom du projet</span><input id="projectName" maxlength="160"></label>
        <label id="projectBox" class="hidden"><span id="dateLabel">Date du projet</span><input id="projectDate" type="date" min="2026-06-01"></label>
        <p class="tithe-note" id="titheNote">Une dîme de 10 % sera ajoutée automatiquement dans les Priorités.</p>
        <label>Date de réception<input id="paymentDate" type="date" min="2026-06-01" required></label>
        <label>Montant reçu<input id="budgetAmount" type="number" min="1" inputmode="numeric" required></label>
        <label>Libellé<input id="paymentLabel" required maxlength="180"></label>
        <button class="button">Valider</button><p class="draft-error" id="budgetError" role="status"></p></form></dialog>`;
  }

  function wireBudgetDialog() {
    const dialog = $('#budgetDialog');
    const month = today().slice(0, 7);
    $('#newBudget').onclick = () => dialog.showModal();
    dialog.querySelector('.close').onclick = () => dialog.close();
    $('#period').value = month;
    $('#projectDate').value = today();
    $('#paymentDate').value = today();
    $('#kind').onchange = () => {
      const kind = $('#kind').value;
      const dated = kind !== 'grace';
      $('#monthBox').classList.toggle('hidden', dated);
      $('#nameBox').classList.toggle('hidden', !dated);
      $('#projectBox').classList.toggle('hidden', !dated);
      $('#nameLabel').textContent = kind === 'tontine' ? 'Nom de la tontine' : 'Nom du projet';
      $('#dateLabel').textContent = kind === 'tontine' ? 'Date de la tontine' : 'Date du projet';
      // Tontine = épargne : jamais de dîme (décision de Josh, sans option).
      $('#titheNote').textContent = kind === 'tontine'
        ? 'Tontine (épargne) : aucune dîme n’est prélevée.'
        : 'Une dîme de 10 % sera ajoutée automatiquement dans les Priorités.';
    };
    $('#period').onchange = () => {
      const [y, m] = $('#period').value.split('-').map(Number);
      $('#paymentDate').value = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    };
    $('#budgetForm').onsubmit = async event => {
      event.preventDefault();
      const kind = $('#kind').value;
      const period = $('#period').value;
      try {
        await api('budget', {
          id: crypto.randomUUID(), kind, name: kind === 'grace' ? 'Grâce ' + period : $('#projectName').value.trim(),
          period_month: period, project_date: $('#projectDate').value, payment_id: crypto.randomUUID(),
          amount: Number($('#budgetAmount').value), payment_label: $('#paymentLabel').value.trim(),
          payment_date: $('#paymentDate').value, tithe_id: crypto.randomUUID(),
        });
        dialog.close();
        await load();
      } catch (e) { $('#budgetError').textContent = e.message; }
    };
  }

  /** Un seul écouteur pour toute la page : chaque bouton porte son intention dans un attribut data-. */
  function wireEvents() {
    document.addEventListener('click', event => {
      const t = event.target.closest('button,[data-draft-close]');
      if (!t) { if (!event.target.closest('.entry-menu,.card-tools')) closeMenus(); return; }
      const d = t.dataset;
      if (d.budgetSelect) return selectBudget(d.budgetSelect);
      if (d.cardMore) { event.stopPropagation(); return toggleMenu(t, $(`[data-card-menu="${CSS.escape(d.cardMore)}"]`)); }
      if (d.more) { event.stopPropagation(); return toggleMenu(t, $(`[data-menu="${CSS.escape(d.more)}"]`)); }
      if (!t.closest('.entry-menu,.card-tools')) closeMenus();
      if (d.add) return openDraft(d.add, d.category);
      if ('draftClose' in d) return closeDraft();
      if ('draftToggle' in d) {
        state.draft.status = state.draft.status === 'realised' ? 'planned' : 'realised';
        t.textContent = state.draft.status === 'realised' ? '✓ Déjà réalisée' : 'Prévue';
        return;
      }
      if ('draftSave' in d) return saveDraft(t);
      if (d.toggle) return setStatus(d.toggle, d.next);
      if (d.editEntry) { closeMenus(); return editEntry(d.editEntry); }
      if (d.cancel) {
        closeMenus();
        return confirmAction({ title: 'Annuler cette dépense ?', message: 'Elle restera visible mais sera exclue des totaux. Tu pourras la restaurer.', confirmLabel: 'Annuler la dépense' })
          .then(ok => ok && setStatus(d.cancel, 'cancelled'));
      }
      if (d.restore) { closeMenus(); return setStatus(d.restore, 'planned'); }
      if (d.edit) { closeMenus(); return editBudget(d.edit); }
      if (d.del) { closeMenus(); return deleteBudget(d.del); }
    });
    window.addEventListener('beforeunload', event => {
      if (draftHasContent()) { event.preventDefault(); event.returnValue = 'Une dépense n’est pas encore enregistrée.'; }
    });
    window.addEventListener('budget:reload', load);
    window.addEventListener('budget-josh-sync-complete', load);
  }

  /** Le bouton Quitter (session-guard.js) rejoint la barre d'actions de l'en-tête. */
  function placeLogout() {
    const bar = document.querySelector('.screen-actions');
    const logout = document.querySelector('.session-logout');
    if (bar && logout && logout.parentElement !== bar) bar.append(logout);
  }

  buildPage();
  wireBudgetDialog();
  wireEvents();
  load();
  document.addEventListener('DOMContentLoaded', placeLogout);
  window.addEventListener('load', placeLogout);
  window.BudgetScreen = { reload: load, placeLogout };
})();
