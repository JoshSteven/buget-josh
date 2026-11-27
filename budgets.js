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
  /** Pas du curseur « au fur et à mesure », en F CFA. Le champ « Montant exact » couvre le reste. */
  const STEP = 500;
  const today = () => new Date().toISOString().slice(0, 10);
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { db: { budgets: [], expenses: [], payments: [], consumptions: [], totals: {} }, activeId: null, draft: null, refreshSheet: null };

  /* ---------- Outils ---------- */

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0);
  const money = n => number(n) + ' F CFA';
  const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const dayLabel = date => dayFmt.format(new Date(date + 'T12:00:00'));
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

  /* ---------- Dépenses « au fur et à mesure » ---------- */

  const isGradual = e => e.tracking === 'gradual';
  const passagesOf = entryId => (state.db.consumptions || []).filter(c => c.entry_id === entryId);
  const consumedOf = entryId => passagesOf(entryId).reduce((n, c) => n + Number(c.amount), 0);

  /** [réalisé, prévu] d'une dépense. Copie de budgetEntrySplit (lib/budget-totals.php) pour le hors connexion. */
  function split(e) {
    if (e.status === 'cancelled') return [0, 0];
    const amount = Number(e.amount);
    if (isGradual(e)) {
      const done = consumedOf(e.id);
      return [done, e.status === 'planned' ? Math.max(amount - done, 0) : 0];
    }
    return e.status === 'realised' ? [amount, 0] : [0, amount];
  }

  /* ---------- Totaux ---------- */

  /*
   * Totaux d'un budget : ceux du serveur. Seule exception, le mode hors connexion :
   * offline-sync.js modifie alors le cache local avec des saisies que le serveur n'a pas encore
   * vues ; on recalcule avec la même règle (annulées exclues) jusqu'au retour du réseau.
   */
  function totalsFor(budget) {
    const offline = state.db.expenses.some(e => e._offline);
    const server = state.db.totals?.[budget.id];
    if (server && !offline) return server;
    const rows = state.db.expenses.filter(e => e.budget_id === budget.id);
    const part = test => rows.filter(test).reduce((sum, e) => {
      const [done, planned] = split(e);
      return { realised: sum.realised + done, planned: sum.planned + planned };
    }, { realised: 0, planned: 0 });
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

  /** La jauge sous une dépense au fur et à mesure ; la toucher ouvre le cadran. */
  function gaugeLine(e) {
    const amount = Number(e.amount);
    const done = consumedOf(e.id);
    const over = done - amount;
    const text = over > 0 ? `${number(done)} sur ${number(amount)} · dépassé de ${number(over)}`
      : e.status === 'realised' ? `${number(done)} dépensés sur ${number(amount)}`
      : `${number(done)} sur ${number(amount)} · reste ${number(amount - done)}`;
    return `<button type="button" class="gauge-line" data-consume="${esc(e.id)}" aria-label="${esc(e.label)} : ${esc(text)} F CFA. Ouvrir le cadran">
      <span class="gauge" aria-hidden="true"><span style="width:${Math.min(100, amount ? done / amount * 100 : 0)}%"></span></span>
      <span class="gauge-text">${text}</span></button>`;
  }

  function entryRow(e) {
    const cancelled = e.status === 'cancelled';
    const done = e.status === 'realised';
    const gradual = isGradual(e);
    const id = esc(e.id);
    const status = cancelled ? 'annulée'
      : gradual ? (done ? 'clôturée' : 'au fur et à mesure')
      : done ? 'réalisée' : 'prévue';
    const item = (kind, attrs, label) => `<button class="${kind}" ${attrs} role="menuitem">${label}</button>`;
    let actions = item('edit-entry', `data-edit-entry="${id}"`, 'Modifier la dépense');
    if (cancelled) actions += item('restore', `data-restore="${id}"`, 'Restaurer');
    else if (gradual) {
      actions = item('consume-entry', `data-consume="${id}"`, done ? 'Voir les passages' : 'Ajouter un montant') + actions
        + (done ? item('reopen-entry', `data-toggle="${id}" data-next="planned"`, 'Rouvrir la dépense')
          : item('close-entry', `data-close-entry="${id}"`, 'Clôturer la dépense'));
      // De l'argent déjà sorti ne s'annule pas : on clôture.
      if (!passagesOf(e.id).length) actions += item('cancel-entry', `data-cancel="${id}"`, 'Annuler la dépense');
    } else actions += item('cancel-entry', `data-cancel="${id}"`, 'Annuler la dépense');
    let toggle = '';
    if (!cancelled && gradual) {
      toggle = done
        ? `<button class="gauge-closed" data-consume="${id}" aria-label="Voir les passages de ${esc(e.label)} (clôturée)">✓</button>`
        : `<button class="gauge-add" data-consume="${id}" aria-label="Ajouter un montant sur ${esc(e.label)}">＋</button>`;
    } else if (!cancelled) {
      toggle = `<button class="toggle" data-toggle="${id}" data-next="${done ? 'planned' : 'realised'}" aria-label="${done ? 'Marquer comme prévue' : 'Marquer comme réalisée'}">${done ? '✓ Réalisée' : 'À faire'}</button>`;
    }
    const over = gradual && !cancelled && consumedOf(e.id) > Number(e.amount);
    return `<div class="entry ${e.status}${gradual ? ' gradual' : ''}${over ? ' over' : ''}"><div class="entry-main"><b>${esc(e.label)}</b>${e.nature ? `<span class="nature-tag">${esc(e.nature)}</span>` : ''}
      <small>${e.bucket === 'tithe' ? 'Dîme calculée (10 %) · ' : ''}${status}${e.source === 'recurring' ? ' · récurrente' : ''}</small>${e.note ? `<small class="note">${esc(e.note)}</small>` : ''}</div>
      <div class="entry-row"><span class="entry-amount">${money(e.amount)}</span><div class="entry-side">${toggle}
      <span class="entry-menu"><button class="more-entry" data-more="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="Plus d’actions">…</button>
      <span class="entry-actions-menu" data-menu="${id}" role="menu" hidden>${actions}</span></span></div></div>${gradual && !cancelled ? gaugeLine(e) : ''}</div>`;
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
    state.refreshSheet?.();
    window.BudgetMotion?.refresh();
  }

  let loadTicket = 0;
  async function load() {
    const ticket = ++loadTicket;
    try {
      const db = await api('bootstrap');
      if (ticket !== loadTicket) return; // une lecture plus récente arrive : on ignore celle-ci
      state.db = db;
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
    state.draft = { budgetId, category, status: 'planned', tracking: 'single' };
    const sheet = document.createElement('div');
    sheet.className = 'draft-layer';
    sheet.innerHTML = `<div class="draft-backdrop" data-draft-close aria-hidden="true"></div>
      <div class="draft" role="dialog" aria-modal="true" aria-label="Nouvelle dépense">
      <h3 class="draft-title">Nouvelle dépense · ${category === 'dogs' ? 'Petits chiens' : 'Priorités'}</h3>
      <button class="draft-close" type="button" data-draft-close aria-label="Fermer">×</button>
      <input data-field="label" placeholder="Libellé" aria-label="Libellé de la dépense" maxlength="180">
      <input data-field="amount" type="number" inputmode="numeric" min="1" placeholder="Montant" aria-label="Montant de la dépense">
      ${window.BudgetTrackingField('draft-tracking', 'single')}
      <input data-field="usual" type="number" inputmode="numeric" min="1" placeholder="Montant habituel (facultatif)" aria-label="Montant habituel d’un passage" hidden>
      <input data-field="note" placeholder="Note (optionnel)" aria-label="Note optionnelle" maxlength="300">
      <select data-field="nature" aria-label="Nature optionnelle"><option value="">Nature (optionnel)</option>${NATURES.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>
      <button type="button" data-draft-toggle>Prévue</button>
      <button class="draft-submit" type="button" data-draft-save>Enregistrer la dépense</button>
      <p class="draft-error" role="status"></p></div>`;
    sheet.addEventListener('change', event => {
      if (event.target.name !== 'draft-tracking') return;
      const gradual = event.target.value === 'gradual';
      state.draft.tracking = event.target.value;
      sheet.querySelector('[data-field="usual"]').hidden = !gradual;
      sheet.querySelector('[data-draft-toggle]').hidden = gradual;
      sheet.querySelector('[data-field="amount"]').placeholder = gradual ? 'Montant prévu' : 'Montant';
    });
    placeDraft(sheet);
    // Ne jamais reprendre le curseur à un champ déjà choisi : la saisie partirait dans le libellé.
    const focus = () => { if (!sheet.contains(document.activeElement)) sheet.querySelector('[data-field="label"]')?.focus({ preventScroll: true }); };
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
    const gradual = state.draft.tracking === 'gradual';
    const usual = gradual ? field('usual') : '';
    if (usual !== '' && !(Number(usual) > 0)) { error.textContent = 'Le montant habituel doit être positif.'; return; }
    button.disabled = true;
    try {
      await api('expense', {
        id: crypto.randomUUID(), budget_id: state.draft.budgetId, amount, label: field('label'),
        note: field('note'), nature: field('nature'), bucket: state.draft.category, date: today(),
        status: gradual ? 'planned' : state.draft.status, tracking: state.draft.tracking, usual_amount: usual === '' ? null : Number(usual),
      });
      closeDraft();
      await load();
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  /* ---------- Modification d'une dépense ou d'un budget ---------- */

  /** Fenêtre indépendante (en bas sur téléphone), retirée de la page à sa fermeture. */
  function openSheet(className, titleId) {
    const sheet = document.createElement('dialog');
    sheet.className = 'entry-sheet ' + className;
    sheet.setAttribute('aria-labelledby', titleId);
    sheet.setAttribute('data-lenis-prevent', '');
    sheet.addEventListener('close', () => sheet.remove());
    sheet.addEventListener('click', event => { if (event.target.closest('[data-sheet-close]')) sheet.close(); });
    document.body.append(sheet);
    return sheet;
  }

  function editEntry(id) {
    const entry = state.db.expenses.find(e => e.id === id);
    if (!entry) return;
    const tithe = entry.bucket === 'tithe';
    const hasPassages = passagesOf(id).length > 0;
    const natures = !entry.nature || NATURES.includes(entry.nature) ? NATURES : [entry.nature, ...NATURES];
    const sheet = openSheet('edit-expense', 'editEntryTitle');
    sheet.innerHTML = `<form novalidate>
      <div class="edit-head"><div><p class="ey">Modifier la dépense</p><h2 id="editEntryTitle">${esc(entry.label)}</h2></div>
      <button type="button" class="close" data-sheet-close aria-label="Fermer">×</button></div>
      <label>Libellé<input name="label" maxlength="180" value="${esc(entry.label)}"></label>
      <label><span data-amount-label>Montant</span><input name="amount" type="number" min="1" inputmode="numeric" value="${esc(Number(entry.amount))}"></label>
      ${tithe ? '<p class="tithe-note">La dîme se règle en une fois.</p>' : window.BudgetTrackingField('edit-tracking', entry.tracking || 'single', hasPassages ? 'single' : '')}
      <p class="sheet-hint" data-hint></p>
      <label data-usual>Montant habituel (facultatif)<input name="usual" type="number" min="1" inputmode="numeric" value="${entry.usual_amount ? esc(Number(entry.usual_amount)) : ''}"></label>
      <label>Note (optionnelle)<input name="note" maxlength="300" value="${esc(entry.note || '')}"></label>
      <label>Nature (optionnel)<select name="nature"><option value="">Aucune</option>${natures.map(n => `<option value="${esc(n)}" ${n === entry.nature ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <button type="submit" class="button">Enregistrer les modifications</button>
      <p class="draft-error" role="status"></p></form>`;
    const form = sheet.querySelector('form');
    const tracking = () => form.querySelector('[name="edit-tracking"]:checked')?.value || 'single';
    const refresh = () => {
      const gradual = tracking() === 'gradual';
      form.querySelector('[data-usual]').hidden = !gradual;
      form.querySelector('[data-amount-label]').textContent = gradual ? 'Montant prévu' : 'Montant';
      form.querySelector('[data-hint]').textContent = hasPassages
        ? 'Pour repasser « En une fois », retire d’abord les passages.'
        : gradual && !isGradual(entry) && entry.status === 'realised'
          ? `Les ${money(entry.amount)} déjà marqués réalisés deviennent un premier passage.` : '';
    };
    form.addEventListener('change', refresh);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = name => form.elements[name].value.trim();
      const error = form.querySelector('.draft-error');
      const amount = Number(value('amount'));
      const usual = tracking() === 'gradual' ? value('usual') : '';
      if (!value('label') || !(amount > 0)) { error.textContent = 'Libellé et montant positif requis.'; return; }
      if (usual !== '' && !(Number(usual) > 0)) { error.textContent = 'Le montant habituel doit être positif.'; return; }
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api('expense_update', {
          id, label: value('label'), amount, note: value('note'), nature: value('nature'),
          ...(tithe ? {} : { tracking: tracking(), usual_amount: usual === '' ? null : Number(usual) }),
        });
        sheet.close();
        await load();
      } catch (e) {
        error.textContent = e.message;
        button.disabled = false;
      }
    });
    refresh();
    sheet.showModal();
  }

  async function setStatus(id, status) {
    try { await api('', { id, status }, 'update-status.php'); await load(); } catch (e) { alert(e.message); }
  }

  async function closeEntry(id) {
    const entry = state.db.expenses.find(e => e.id === id);
    if (!entry) return;
    const done = consumedOf(id);
    const left = Number(entry.amount) - done;
    const ok = await confirmAction({
      title: `Clôturer « ${entry.label} » ?`,
      message: !done ? `Aucun passage : la dépense comptera pour 0 et les ${money(entry.amount)} redeviennent disponibles.`
        : `${money(done)} comptés comme dépensés.` + (left > 0 ? ` Les ${money(left)} restants redeviennent disponibles.` : ''),
      confirmLabel: 'Clôturer la dépense', cancelLabel: 'Pas maintenant', tone: 'neutral',
    });
    if (ok) await setStatus(id, 'realised');
  }

  /*
   * Le cadran (lot 14) : on fait glisser le curseur vers l'avant, le montant ajouté
   * s'affiche en grand, et rien n'est enregistré sans le bouton « Ajouter ».
   */
  function openConsume(id) {
    if (!state.db.expenses.some(e => e.id === id)) return;
    const sheet = openSheet('consume-sheet', 'consumeTitle');
    sheet.innerHTML = `<div class="edit-head"><div><p class="ey" data-c="eyebrow"></p><h2 id="consumeTitle"></h2></div>
      <button type="button" class="close" data-sheet-close aria-label="Fermer">×</button></div>
      <div class="dial"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="dial-rail" cx="70" cy="70" r="60"/>
        <circle class="dial-pending" cx="70" cy="70" r="60"/><circle class="dial-done" cx="70" cy="70" r="60"/></svg>
        <div class="dial-center"><b data-c="big"></b><small data-c="caption"></small></div></div>
      <p class="dial-sum" data-c="sum" aria-live="polite"></p>
      <div class="dial-adder" data-c="adder">
        <div class="dial-slider"><div class="dial-bar" aria-hidden="true"><i class="bar-pending"></i><i class="bar-done"></i><i class="bar-limit"></i></div>
          <input type="range" step="${STEP}" aria-label="Montant à ajouter" data-c="range"></div>
        <div class="dial-quick"><button type="button" data-c="usual"></button>
          <label>Montant exact<input type="number" min="1" inputmode="numeric" data-c="exact"></label>
          <label>Date<input type="date" min="2026-06-01" data-c="date" value="${today()}"></label></div>
        <button type="button" class="button" data-c="add"></button>
      </div>
      <p class="sheet-status" role="status" data-c="status"></p>
      <h3 class="edit-section">Passages</h3><div class="passages" data-c="history"></div>
      <button type="button" class="sheet-secondary" data-c="state"></button>`;
    const part = name => sheet.querySelector(`[data-c="${name}"]`);
    const range = part('range');
    let pending = 0;
    // Un même ajout garde son identifiant d'un essai à l'autre : il ne peut pas compter deux fois.
    let passageId = null;

    const say = (message, failed = false) => {
      part('status').textContent = message;
      part('status').classList.toggle('failed', failed);
    };
    const setPending = value => { pending = Math.max(0, value); passageId = null; say(''); draw(); };

    function draw() {
      const entry = state.db.expenses.find(e => e.id === id);
      if (!entry) { sheet.close(); return; }
      const amount = Number(entry.amount);
      const done = consumedOf(id);
      const open = entry.status === 'planned';
      if (!open) pending = 0;
      const total = done + pending;
      const over = total - amount;
      sheet.classList.toggle('dogs', entry.bucket === 'dogs');
      sheet.classList.toggle('over', over > 0);
      sheet.classList.toggle('done-over', done > amount);
      part('eyebrow').textContent = entry.status === 'cancelled' ? 'Dépense annulée' : open ? 'Au fur et à mesure' : 'Dépense clôturée';
      $('#consumeTitle').textContent = entry.label;
      const [big, caption] = pending ? ['+ ' + number(pending), 'à ajouter']
        : over > 0 ? [number(over), 'de dépassement']
        : open ? [number(amount - done), 'restants'] : [number(done), 'dépensés'];
      part('big').textContent = big;
      part('caption').textContent = caption;
      part('sum').textContent = pending
        ? `Total ${number(total)} sur ${money(amount)} · ` + (over > 0 ? `dépassement de ${number(over)}` : `il restera ${number(amount - total)}`)
        : `Déjà ${number(done)} sur ${money(amount)}` + (!open && over < 0 ? ` · ${money(-over)} redevenus disponibles` : '');

      const circle = 2 * Math.PI * 60;
      [['.dial-done', done], ['.dial-pending', total]].forEach(([selector, value]) => {
        const arc = sheet.querySelector(selector);
        const share = Math.min(1, value / amount);
        arc.style.strokeDasharray = `${share * circle} ${circle}`;
        arc.style.visibility = share > 0 ? 'visible' : 'hidden';
      });

      // Le curseur part de ce qui est déjà consommé et avance par pas de 500 ajoutés.
      part('adder').hidden = !open;
      const min = done % STEP;
      const reach = Math.max(amount * 1.4, done + Math.max(amount * .4, 2000), total);
      const max = min + Math.ceil((reach - min) / STEP) * STEP;
      range.min = min;
      range.max = max;
      range.value = total;
      range.setAttribute('aria-valuetext', `Ajout de ${money(pending)}, total ${number(total)} sur ${money(amount)}`);
      const at = value => Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) + '%';
      sheet.querySelector('.bar-done').style.width = at(done);
      sheet.querySelector('.bar-pending').style.width = at(total);
      sheet.querySelector('.bar-limit').style.left = at(amount);

      const usual = Number(entry.usual_amount) || 0;
      part('usual').hidden = !usual;
      part('usual').textContent = '+ ' + number(usual);
      part('add').textContent = pending ? `Ajouter ${money(pending)}` : 'Ajouter';

      const passages = passagesOf(id);
      part('history').innerHTML = passages.length ? passages.map(p => `<div class="passage"><span>${dayLabel(p.date)}${p._offline ? ' · à envoyer' : ''}</span>
        <b>${money(p.amount)}</b><button type="button" data-passage="${esc(p.id)}" aria-label="Retirer ${esc(money(p.amount))} du ${esc(dayLabel(p.date))}">Retirer</button></div>`).join('')
        : '<p class="empty">Aucun passage pour le moment.</p>';
      part('state').hidden = entry.status === 'cancelled';
      part('state').textContent = open ? 'Clôturer la dépense' : 'Rouvrir la dépense';
    }

    range.addEventListener('input', () => {
      part('exact').value = '';
      setPending(Math.round((Number(range.value) - consumedOf(id)) / STEP) * STEP);
    });
    part('exact').addEventListener('input', () => setPending(Math.round(Number(part('exact').value)) || 0));

    sheet.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      const entry = state.db.expenses.find(e => e.id === id);
      if (!entry) return;
      if (button === part('usual')) { part('exact').value = ''; return setPending(Number(entry.usual_amount)); }
      if (button === part('state')) return entry.status === 'planned' ? closeEntry(id) : setStatus(id, 'planned');
      if (button.dataset.passage) {
        const passage = passagesOf(id).find(p => p.id === button.dataset.passage);
        const ok = await confirmAction({
          title: `Retirer ${money(passage.amount)} ?`,
          message: `Le passage du ${dayLabel(passage.date)} sur « ${entry.label} » sera effacé.`,
          confirmLabel: 'Retirer le passage',
        });
        if (!ok) return;
        try {
          await api('consumption_delete', { id: passage.id });
          await load();
          say('Passage retiré.');
        } catch (e) { say(e.message, true); }
        return;
      }
      if (button !== part('add')) return;
      if (!(pending > 0)) return say('Fais glisser le curseur ou saisis un montant.', true);
      const amount = pending;
      button.disabled = true;
      try {
        passageId ||= crypto.randomUUID();
        const result = await api('consumption_add', { id: passageId, entry_id: id, amount, date: part('date').value || today() });
        pending = 0;
        passageId = null;
        part('exact').value = '';
        await load();
        say(`${money(amount)} ajoutés.` + (result.queued ? ' Envoi dès le retour du réseau.' : ''));
      } catch (e) {
        // TypeError : le navigateur n'a pas pu joindre le serveur.
        say(e instanceof TypeError ? 'Réseau instable : réessaie, l’ajout ne comptera qu’une fois.' : e.message, true);
      }
      button.disabled = false;
    });

    state.refreshSheet = draw;
    sheet.addEventListener('close', () => { if (state.refreshSheet === draw) state.refreshSheet = null; });
    sheet.showModal();
    draw();
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
        <p class="intro">Rond bleu coché = dépense réalisée. Rond vide = prévue. Le « + » avance une dépense au fur et à mesure. La dîme est déjà comptée dans les Priorités.</p>
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
      if (d.consume) { closeMenus(); return openConsume(d.consume); }
      if (d.closeEntry) { closeMenus(); return closeEntry(d.closeEntry); }
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
