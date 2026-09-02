(() => {
  const style = document.createElement('style');
  style.textContent = '.recurring-open{margin-top:8px;background:#e8efea;color:#123b35}.recurring-item{display:flex;justify-content:space-between;gap:12px;padding:12px;border:1px solid #dbe2da;border-radius:12px;background:#fffefa}.recurring-item small{display:block;color:#647873;margin-top:4px}.recurring-actions{display:flex;gap:6px;align-items:center}.recurring-actions button{min-height:44px;border:0;border-radius:9px;padding:8px 10px;background:#e8efea;cursor:pointer}.recurring-actions button[data-delete]{color:#b53e25}';
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
  let budgets = [];

  async function refresh() {
    const bootstrap = await (await fetch('api.php?action=bootstrap')).json();
    budgets = bootstrap.budgets || [];
    const data = await api('list');
    const list = document.querySelector('#recurringList');
    if (!list) return;
    list.innerHTML = data.recurrences.length ? data.recurrences.map(item =>
      '<article class="recurring-item"><div><strong>' + esc(item.label) + '</strong><small>' +
      money(item.amount) + ' · ' + (item.bucket === 'priority' ? 'Priorités' : 'Petits chiens') +
      ' · prochaine : ' + esc(item.next_date) + '</small></div><div class="recurring-actions">' +
      '<button type="button" data-toggle="' + esc(item.id) + '">' + (item.active ? 'Pause' : 'Activer') +
      '</button><button type="button" data-delete="' + esc(item.id) + '">Supprimer</button></div></article>'
    ).join('') : '<p class="empty">Aucune dépense récurrente.</p>';
    list.querySelectorAll('[data-toggle]').forEach(button => button.onclick = async () => {
      await api('toggle', { id: button.dataset.toggle }); refresh();
    });
    list.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
      if (confirm('Supprimer cette récurrence ? Les dépenses déjà générées resteront conservées.')) {
        await api('delete', { id: button.dataset.delete }); refresh();
      }
    });
  }

  function init() {
  const newBudget = document.querySelector('#newBudget');
  if (!newBudget || document.querySelector('.recurring-open')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button recurring-open';
  button.textContent = 'Dépenses récurrentes';
  newBudget.insertAdjacentElement('afterend', button);
  const dialog = document.createElement('dialog');
  dialog.innerHTML = '<form id="recurringForm"><button class="close" type="button" aria-label="Fermer">×</button>' +
    '<p class="ey">AUTOMATISATION</p><h2>Nouvelle dépense récurrente</h2>' +
    '<label>Budget<select id="recurringBudget" required></select></label>' +
    '<label>Libellé<input id="recurringLabel" required></label>' +
    '<label>Montant<input id="recurringAmount" type="number" min="1" required></label>' +
    '<label>Catégorie<select id="recurringBucket"><option value="priority">Priorités</option><option value="dogs">Petits chiens</option></select></label>' +
    '<label>Première date<input id="recurringDate" type="date" required></label>' +
    '<label>Nature (optionnel)<input id="recurringNature"></label><label>Note (optionnelle)<input id="recurringNote"></label>' +
    '<button class="button" type="submit">Créer la récurrence mensuelle</button><p class="recurring-status" role="status"></p></form>';
  document.body.append(dialog);
  button.onclick = async () => {
    await refresh();
    document.querySelector('#recurringBudget').innerHTML = budgets.map(item =>
      '<option value="' + esc(item.id) + '">' + esc(item.kind === 'grace' ? item.name : item.name) + '</option>'
    ).join('');
    dialog.showModal();
  };
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.querySelector('#recurringForm').onsubmit = async event => {
    event.preventDefault();
    try {
      await api('create', {
        id: crypto.randomUUID(), budget_id: document.querySelector('#recurringBudget').value,
        label: document.querySelector('#recurringLabel').value.trim(),
        amount: Number(document.querySelector('#recurringAmount').value),
        bucket: document.querySelector('#recurringBucket').value,
        start_date: document.querySelector('#recurringDate').value,
        nature: document.querySelector('#recurringNature').value.trim(),
        note: document.querySelector('#recurringNote').value.trim(),
      });
      dialog.close(); refresh();
    } catch (error) { dialog.querySelector('.recurring-status').textContent = error.message; }
  };
  refresh().catch(() => {});
  }
  init();
  const timer = setInterval(() => {
    init();
    if (document.querySelector('.recurring-open')) clearInterval(timer);
  }, 100);
})();
