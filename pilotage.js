(() => {
  // Tableau de bord. Les chiffres viennent du moteur de calcul unique du serveur
  // (api.php?action=bootstrap → totals) : ce fichier additionne et affiche, il ne recalcule pas.
  const $ = selector => document.querySelector(selector);
  const fmt = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0) + ' F CFA';
  const pct = n => `${Math.round(Number(n) || 0)} %`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const months = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const budgetName = b => b.kind === 'grace' ? `Grâce · ${months.format(new Date(`${b.period_month}-02T12:00:00`))}` : b.name;
  const titles = { priority: 'Priorités', dogs: 'Petits chiens' };

  const state = { db: { budgets: [], totals: {} }, limits: {}, selected: 'all' };

  const api = async (action, data, endpoint = 'api.php') => {
    const response = await fetch(`${endpoint}?action=${encodeURIComponent(action)}`, {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    const json = await response.json();
    if (!response.ok) throw Error(json.error || 'Erreur');
    return json;
  };

  /** Totaux du périmètre choisi : somme des totaux serveur des budgets concernés. */
  function scope() {
    const ids = state.selected === 'all' ? state.db.budgets.map(b => b.id) : [state.selected];
    const out = { received: 0, realised: 0, planned: 0, priority: { realised: 0, planned: 0 }, dogs: { realised: 0, planned: 0 }, natures: {} };
    ids.forEach(id => {
      const t = state.db.totals?.[id];
      if (!t) return;
      out.received += t.received;
      out.realised += t.realised;
      out.planned += t.planned;
      ['priority', 'dogs'].forEach(k => { out[k].realised += t[k].realised; out[k].planned += t[k].planned; });
      Object.entries(t.natures || {}).forEach(([name, n]) => { out.natures[name] = (out.natures[name] || 0) + n.realised + n.planned; });
    });
    out.committed = out.realised + out.planned;
    return out;
  }

  const limitFor = (key, received) => {
    const l = state.limits[key];
    if (!l || Number(l.value) <= 0) return null;
    return { ...l, ceiling: l.mode === 'percent' ? received * Number(l.value) / 100 : Number(l.value) };
  };

  function render() {
    const s = scope();
    $('#scopeLabel').textContent = state.selected === 'all' ? 'Tous les budgets' : budgetName(state.db.budgets.find(b => b.id === state.selected) || {});
    $('#metrics').innerHTML = [
      ['Reçu', s.received], ['Réalisé', s.realised], ['Prévu', s.planned],
      ['Disponible réel', s.received - s.realised], ['Disponible engagé', s.received - s.committed],
    ].map(([label, value]) => `<article class="metric"><b>${fmt(value)}</b><small>${label}</small></article>`).join('');
    renderAlerts(s);
    renderCategories(s);
    renderNatures(s);
    renderHints(s);
  }

  function renderAlerts(s) {
    const rows = ['priority', 'dogs'].map(key => ({ key, engaged: s[key].realised + s[key].planned, l: limitFor(key, s.received) })).filter(x => x.l);
    if (!rows.length) {
      $('#alerts').innerHTML = '<p class="empty">Aucun plafond configuré. Choisis un montant ou un pourcentage ci-dessous pour activer les alertes.</p>';
      return;
    }
    $('#alerts').innerHTML = rows.map(({ key, engaged, l }) => {
      const ratio = l.ceiling ? engaged / l.ceiling : 0;
      const level = ratio >= 1 ? 'danger' : ratio >= .8 ? 'warning' : 'ok';
      const message = level === 'danger' ? `Plafond dépassé de ${fmt(engaged - l.ceiling)}.`
        : level === 'warning' ? `Il reste ${fmt(l.ceiling - engaged)} avant le plafond.` : 'La consommation reste sous contrôle.';
      const ceiling = l.mode === 'percent' ? `${l.value} % des revenus (${fmt(l.ceiling)})` : fmt(l.ceiling);
      return `<article class="alert ${level}"><i class="alert-dot"></i><div><b>${titles[key]} : ${pct(ratio * 100)} du plafond</b><small>${message} Engagement : ${fmt(engaged)} sur ${ceiling}.</small></div></article>`;
    }).join('');
  }

  function renderCategories(s) {
    const engaged = key => s[key].realised + s[key].planned;
    const max = Math.max(engaged('priority'), engaged('dogs'), 1);
    $('#categories').innerHTML = ['priority', 'dogs'].map(key => `<article class="category ${key === 'dogs' ? 'dogs' : ''}">
      <div class="category-head"><h3>${titles[key]}</h3><strong>${fmt(engaged(key))}</strong></div>
      <small>${s.committed ? Math.round(engaged(key) / s.committed * 100) : 0} % de toutes les dépenses engagées</small>
      <div class="bar"><i style="width:${Math.min(100, engaged(key) / max * 100)}%"></i></div>
      <div class="category-meta"><span>Réalisé ${fmt(s[key].realised)}</span><span>Prévu ${fmt(s[key].planned)}</span></div></article>`).join('');
  }

  function renderNatures(s) {
    const named = Object.values(s.natures).reduce((a, b) => a + b, 0);
    const rows = { ...s.natures };
    if (s.committed - named > 0) rows['Sans nature'] = s.committed - named;
    const top = Object.entries(rows).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = top[0]?.[1] || 1;
    $('#natures').innerHTML = top.length ? top.map(([name, value]) => `<article class="nature">
      <div class="nature-head"><b>${esc(name)}</b><strong>${fmt(value)}</strong></div>
      <small>${pct(value / (s.committed || 1) * 100)} des dépenses engagées</small>
      <div class="bar"><i style="width:${value / max * 100}%"></i></div></article>`).join('') : '<p class="empty">Aucune dépense à analyser.</p>';
  }

  function renderHints(s) {
    ['priority', 'dogs'].forEach(key => {
      const l = state.limits[key];
      const hint = $(`#${key}Hint`);
      const input = $(`#${key}Value`);
      if (!l || Number(l.value) <= 0) { hint.textContent = 'Laisser à 0 pour désactiver.'; input.value = ''; return; }
      $(`#${key}Mode`).value = l.mode;
      hint.textContent = l.mode === 'percent' ? `Plafond actuel : ${fmt(s.received * Number(l.value) / 100)} pour ce périmètre.` : `Plafond actuel : ${fmt(l.value)}.`;
      input.value = Number(l.value);
    });
  }

  function fillBudgetFilter() {
    const select = $('#budgetFilter');
    const sorted = state.db.budgets.slice().sort((a, b) => String(b.period_month || b.project_date).localeCompare(String(a.period_month || a.project_date)));
    select.innerHTML = '<option value="all">Tous les budgets</option>' + sorted.map(b => `<option value="${esc(b.id)}">${esc(budgetName(b))}</option>`).join('');
    select.value = state.selected;
  }

  async function load() {
    try {
      const [db, limits] = await Promise.all([api('bootstrap'), api('limits', undefined, 'limits-api.php')]);
      state.db = db;
      state.limits = limits.limits || {};
      fillBudgetFilter();
      render();
    } catch (error) {
      $('#alerts').innerHTML = `<p class="empty">${esc(error.message)}</p>`;
    }
  }

  $('#budgetFilter').onchange = event => { state.selected = event.target.value; render(); };
  $('#refresh').onclick = load;
  $('#limitsForm').onsubmit = async event => {
    event.preventDefault();
    const payload = {
      priority: { mode: $('#priorityMode').value, value: Number($('#priorityValue').value) || 0 },
      dogs: { mode: $('#dogsMode').value, value: Number($('#dogsValue').value) || 0 },
    };
    try {
      await api('limits', payload, 'limits-api.php');
      state.limits = payload;
      $('#settingsStatus').textContent = 'Plafonds enregistrés.';
      render();
    } catch (error) { $('#settingsStatus').textContent = error.message; }
  };
  ['priority', 'dogs'].forEach(key => { $(`#${key}Mode`).onchange = () => renderHints(scope()); });
  load();
})();
