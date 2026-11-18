(() => {
  // Fenêtre « Dépenses récurrentes » : la liste existante d'abord (voir, mettre en pause,
  // supprimer), puis le formulaire de création, replié par défaut quand la liste n'est pas vide.
  const style = document.createElement('style');
  style.textContent = `
    .recurring-open{margin-top:8px}
    .recurring-dialog{max-height:min(88vh,760px);overflow:auto}
    .recurring-dialog .recurring-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px}
    .recurring-dialog .recurring-head h2{margin:2px 0 0}
    .recurring-dialog .recurring-head .close{position:static}
    .recurring-list{display:grid;gap:8px;margin:12px 0 18px}
    .recurring-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:var(--surface-2,#f5f5f7)}
    .recurring-item.paused{opacity:.62}
    .recurring-item strong{display:block;font-size:15px}
    .recurring-item small{display:block;color:var(--text-2,#6e6e73);margin-top:3px;font-size:12px;line-height:1.4}
    .recurring-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:var(--line,#e5e5ea);color:var(--text-2,#6e6e73);font-size:11px;font-weight:600;vertical-align:middle}
    .recurring-actions{display:flex;gap:6px;align-items:center;flex:0 0 auto}
    .recurring-actions button{min-height:44px;border:0;border-radius:12px;padding:8px 12px;background:var(--surface,#fff);color:var(--text,#1d1d1f);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
    .recurring-actions button[data-delete]{color:var(--danger,#d70015)}
    .recurring-new{width:100%;min-height:48px;border:1px dashed var(--line-strong,#c7c7cc);border-radius:14px;background:transparent;color:var(--accent,#2456f5);font:inherit;font-weight:600;cursor:pointer}
    .recurring-form[hidden]{display:none}
    .recurring-status{min-height:1em;color:var(--danger,#d70015);font-size:13px;margin:0}
    @media(max-width:479px){.recurring-item{flex-direction:column;align-items:stretch}.recurring-actions{justify-content:flex-end}}
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
  const day = value => value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00')) : '';
  const budgetName = item => item.kind === 'grace'
    ? 'Grâce ' + new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date((item.period_month || '') + '-02T12:00:00'))
    : item.name;
  let budgets = [];
  let dialog = null;

  async function refresh() {
    const list = dialog?.querySelector('#recurringList');
    if (!list) return;
    try {
      const data = await api('list');
      const items = data.recurrences || [];
      dialog.querySelector('#recurringCount').textContent = items.length
        ? items.length + (items.length > 1 ? ' récurrences' : ' récurrence')
        : 'Aucune récurrence pour le moment';
      list.innerHTML = items.length ? items.map(item => {
        const active = Number(item.active) === 1;
        return '<article class="recurring-item' + (active ? '' : ' paused') + '" data-recurring="' + esc(item.id) + '"><div><strong>' +
          esc(item.label) + (active ? '' : '<span class="recurring-badge">En pause</span>') + '</strong><small>' +
          money(item.amount) + ' · ' + (item.bucket === 'priority' ? 'Priorités' : 'Petits chiens') + ' · ' + esc(budgetName(item)) +
          '<br>' + (active ? 'Prochaine : ' + esc(day(item.next_date)) : 'Aucune génération tant qu’elle est en pause') +
          '</small></div><div class="recurring-actions">' +
          '<button type="button" data-toggle="' + esc(item.id) + '">' + (active ? 'Mettre en pause' : 'Reprendre') + '</button>' +
          '<button type="button" data-delete="' + esc(item.id) + '" aria-label="Supprimer ' + esc(item.label) + '">Supprimer</button></div></article>';
      }).join('') : '';
      list.querySelectorAll('[data-toggle]').forEach(button => button.onclick = async () => {
        button.disabled = true;
        try { await api('toggle', { id: button.dataset.toggle }); } catch (error) { alert(error.message); }
        refresh();
      });
      list.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
        if (!confirm('Supprimer cette récurrence ? Les dépenses déjà générées resteront conservées.')) return;
        try { await api('delete', { id: button.dataset.delete }); } catch (error) { alert(error.message); }
        refresh();
      });
      const form = dialog.querySelector('#recurringForm');
      if (!items.length) form.hidden = false;
      dialog.querySelector('.recurring-new').hidden = !form.hidden;
    } catch (error) {
      list.innerHTML = '<p class="empty">' + esc(error.message) + '</p>';
    }
  }

  function init() {
    const newBudget = document.querySelector('#newBudget');
    if (!newBudget || document.querySelector('.recurring-open')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-secondary recurring-open';
    button.textContent = 'Dépenses récurrentes';
    newBudget.insertAdjacentElement('afterend', button);

    dialog = document.createElement('dialog');
    dialog.className = 'recurring-dialog';
    dialog.setAttribute('aria-labelledby', 'recurringTitle');
    dialog.innerHTML =
      '<div class="recurring-head"><div><p class="ey">AUTOMATISATION</p><h2 id="recurringTitle">Dépenses récurrentes</h2>' +
      '<p class="intro" id="recurringCount"></p></div><button class="close" type="button" aria-label="Fermer">×</button></div>' +
      '<div class="recurring-list" id="recurringList" aria-live="polite"></div>' +
      '<button class="recurring-new" type="button">+ Nouvelle récurrence</button>' +
      '<form id="recurringForm" class="recurring-form" hidden><h3>Nouvelle dépense récurrente</h3>' +
      '<label>Budget<select id="recurringBudget" required></select></label>' +
      '<label>Libellé<input id="recurringLabel" required></label>' +
      '<label>Montant<input id="recurringAmount" type="number" min="1" inputmode="numeric" required></label>' +
      '<label>Catégorie<select id="recurringBucket"><option value="priority">Priorités</option><option value="dogs">Petits chiens</option></select></label>' +
      '<label>Première date<input id="recurringDate" type="date" required></label>' +
      '<label>Nature (optionnel)<input id="recurringNature"></label><label>Note (optionnelle)<input id="recurringNote"></label>' +
      '<button class="button" type="submit">Créer la récurrence mensuelle</button><p class="recurring-status" role="status"></p></form>';
    document.body.append(dialog);

    const form = dialog.querySelector('#recurringForm');
    dialog.querySelector('.recurring-new').onclick = () => {
      form.hidden = false;
      dialog.querySelector('.recurring-new').hidden = true;
      dialog.querySelector('#recurringLabel').focus();
    };
    button.onclick = async () => {
      form.hidden = true;
      form.reset();
      dialog.querySelector('.recurring-status').textContent = '';
      dialog.querySelector('#recurringDate').value = new Date().toISOString().slice(0, 10);
      dialog.showModal();
      try {
        budgets = (await (await fetch('api.php?action=bootstrap')).json()).budgets || [];
      } catch { budgets = []; }
      dialog.querySelector('#recurringBudget').innerHTML = budgets.map(item =>
        '<option value="' + esc(item.id) + '">' + esc(budgetName(item)) + '</option>'
      ).join('');
      await refresh();
    };
    dialog.querySelector('.close').onclick = () => dialog.close();
    form.onsubmit = async event => {
      event.preventDefault();
      const status = dialog.querySelector('.recurring-status');
      status.textContent = '';
      try {
        await api('create', {
          id: crypto.randomUUID(), budget_id: dialog.querySelector('#recurringBudget').value,
          label: dialog.querySelector('#recurringLabel').value.trim(),
          amount: Number(dialog.querySelector('#recurringAmount').value),
          bucket: dialog.querySelector('#recurringBucket').value,
          start_date: dialog.querySelector('#recurringDate').value,
          nature: dialog.querySelector('#recurringNature').value.trim(),
          note: dialog.querySelector('#recurringNote').value.trim(),
        });
        form.reset();
        form.hidden = true;
        await refresh();
      } catch (error) { status.textContent = error.message; }
    };
  }

  init();
  const timer = setInterval(() => {
    init();
    if (document.querySelector('.recurring-open')) clearInterval(timer);
  }, 100);
})();
