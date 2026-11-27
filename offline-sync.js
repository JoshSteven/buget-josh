(() => {
  /*
   * Hors connexion : la dernière lecture des budgets est gardée sur le téléphone, et les saisies
   * attendent dans une file envoyée au retour du réseau. Le cache local est modifié tout de suite
   * pour que l'écran montre la saisie (lignes marquées _offline, totaux recalculés par budgets.js).
   */
  const CACHE = 'budget-josh-bootstrap-v1';
  const QUEUE = 'budget-josh-offline-queue-v1';
  const nativeFetch = window.fetch.bind(window);
  const isBootstrap = url => url.includes('api.php?action=bootstrap');
  const isPost = url => /api\.php|update-status\.php|delete-budget\.php/.test(url);

  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch { return null; } };
  const writeCache = data => localStorage.setItem(CACHE, JSON.stringify(data));
  const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch { return []; } };
  const saveQueue = items => localStorage.setItem(QUEUE, JSON.stringify(items));
  const jsonResponse = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  /* sw.js marque ainsi une réponse reprise de son cache faute de réseau. */
  const fromServiceWorkerCache = response => response.headers.get('X-Budget-Cache') === '1';

  /** Reporte une saisie en attente dans le cache local. L'action est comparée exactement. */
  function patchCache(url, body) {
    const cached = readCache();
    if (!cached) return;
    let data;
    try { data = JSON.parse(body); } catch { return; }
    const target = new URL(url, location.href);
    const file = target.pathname.split('/').pop();
    const action = target.searchParams.get('action');
    cached.expenses = cached.expenses || [];
    cached.consumptions = cached.consumptions || [];
    const entry = id => cached.expenses.find(e => e.id === id);
    const touch = row => { if (row) row._offline = true; };

    if (file === 'api.php' && action === 'expense') {
      cached.expenses.unshift({ ...data, type: 'expense', status: data.status || 'planned', _offline: true });
    }
    if (file === 'api.php' && action === 'expense_update') {
      const row = entry(data.id);
      if (row) {
        // Même règle que le serveur : une dépense déjà payée qui passe « au fur et à mesure » garde son passage.
        if (data.tracking === 'gradual' && row.tracking !== 'gradual' && row.status === 'realised') {
          cached.consumptions.unshift({ id: 'attente-' + row.id, entry_id: row.id, amount: row.amount, date: row.date, _offline: true });
          row.status = 'planned';
        }
        if (data.tracking === 'single' && row.tracking === 'gradual' && row.status === 'realised') row.status = 'planned';
        ['label', 'amount', 'note', 'nature', 'tracking', 'usual_amount'].forEach(key => { if (key in data) row[key] = data[key]; });
        touch(row);
      }
    }
    if (file === 'api.php' && action === 'consumption_add') {
      cached.consumptions.unshift({ id: data.id, entry_id: data.entry_id, amount: data.amount, date: data.date, _offline: true });
      touch(entry(data.entry_id));
    }
    if (file === 'api.php' && action === 'consumption_delete') {
      const passage = cached.consumptions.find(c => c.id === data.id);
      cached.consumptions = cached.consumptions.filter(c => c.id !== data.id);
      if (passage) touch(entry(passage.entry_id));
    }
    if (file === 'update-status.php') {
      const row = entry(data.id);
      if (row) { row.status = data.status; touch(row); }
    }
    writeCache(cached);
  }

  let flushing = false;
  async function replay() {
    const pending = queue();
    const left = [];
    for (const item of pending) {
      try {
        const response = await nativeFetch(item.url, { method: item.method, headers: item.headers, body: item.body });
        if (!response.ok) throw Error();
      } catch { left.push(item); }
    }
    saveQueue(left);
    if (left.length < pending.length) window.dispatchEvent(new Event('budget-josh-sync-complete'));
  }

  async function flush() {
    if (!navigator.onLine) return;
    if (navigator.locks?.request) {
      return navigator.locks.request('budget-josh-offline-flush', { ifAvailable: true }, lock => (lock ? replay() : undefined));
    }
    if (flushing) return;
    flushing = true;
    try { await replay(); } finally { flushing = false; }
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (isBootstrap(url)) {
      // Sans réseau, le cache local fait foi : lui seul contient les saisies en attente.
      if (!navigator.onLine && readCache()) return jsonResponse(readCache());
      try {
        const response = await nativeFetch(input, init);
        if (fromServiceWorkerCache(response) && readCache()) return jsonResponse(readCache());
        if (response.ok) response.clone().json().then(writeCache).catch(() => {});
        return response;
      } catch (error) {
        const cached = readCache();
        if (cached) return jsonResponse(cached);
        throw error;
      }
    }
    if (!isPost(url) || !init.body || navigator.onLine) return nativeFetch(input, init);
    const item = { url, method: init.method || 'POST', headers: init.headers || { 'Content-Type': 'application/json' }, body: init.body };
    try {
      return await nativeFetch(input, init);
    } catch {
      patchCache(url, item.body);
      saveQueue([...queue(), item]);
      return jsonResponse({ ok: true, queued: true });
    }
  };

  window.addEventListener('online', flush);
  // Le téléphone peut se croire connecté pendant une coupure : on réessaie aussi au retour sur l'application.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  // Des saisies en attente ne doivent pas être recouvertes par une lecture du serveur.
  if (navigator.onLine && !queue().length) {
    nativeFetch('api.php?action=bootstrap')
      .then(r => (r.ok && !fromServiceWorkerCache(r) ? r.json() : null))
      .then(data => { if (data) writeCache(data); })
      .catch(() => {});
  }
  // L'écran a fait sa première lecture avant ce script : il la refait pour montrer les saisies en attente,
  // sinon on risquerait de les saisir une seconde fois.
  if (!navigator.onLine || queue().length) window.dispatchEvent(new Event('budget:reload'));
  flush();
})();
