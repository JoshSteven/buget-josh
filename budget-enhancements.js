(() => {
  const apiUrl = 'api.php?action=bootstrap';
  let initialLayoutApplied = false;
  let userSelectedBudget = false;
  let initialResetTimer = null;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-budget-select]')) {
      userSelectedBudget = true;
      if (initialResetTimer) clearTimeout(initialResetTimer);
      const selectedId = event.target.closest('[data-budget-select]').dataset.budgetSelect;
      setTimeout(() => {
        document.querySelectorAll('[data-budget-select]').forEach(element => {
          element.classList.toggle('active', element.dataset.budgetSelect === selectedId);
        });
      }, 0);
    }
  });

  const html = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const budgetLabel = budget => budget.kind === 'grace'
    ? 'Grâce — ' + new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(budget.period_month + '-02'))
    : budget.name;

  async function getData() {
    const response = await fetch(apiUrl);
    if (!response.ok) throw Error('Impossible de préparer l’export.');
    return response.json();
  }

  function downloadExport(data) {
    const budgets = data.budgets.slice().sort((a, b) =>
      String(b.period_month || b.project_date).localeCompare(String(a.period_month || a.project_date)));
    const columns = ['Date', 'Dépense', 'Statut', 'Nature', 'Note', ...budgets.map(budgetLabel)];
    const rows = data.expenses.map(expense => [
      expense.date,
      expense.label,
      expense.status === 'realised' ? 'Réalisée' : expense.status === 'cancelled' ? 'Annulée' : 'Prévue',
      expense.nature || '',
      expense.note || '',
      ...budgets.map(budget => budget.id === expense.budget_id ? Number(expense.amount) : ''),
    ]);
    const totalCells = columns.map((_, index) => {
      if (index < 5) return index === 0 ? 'TOTAL' : '';
      const letter = String.fromCharCode(65 + index);
      return `=SUM(${letter}5:${letter}${rows.length + 4})`;
    });
    const bodyRows = rows.map(row => `<tr>${row.map((value, index) => `<td class="${index >= 5 ? 'amount' : ''}">${html(value)}</td>`).join('')}</tr>`).join('');
    const header = columns.map(column => `<th>${html(column)}</th>`).join('');
    const totals = totalCells.map((value, index) => `<td class="${index >= 5 ? 'amount total' : 'total'}">${html(value)}</td>`).join('');
    const content = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#1d1d1f}h1{color:#1d1d1f;font-size:20px;margin:0 0 6px}p{color:#6e6e73;font-size:11px;margin:3px 0 14px}table{border-collapse:collapse;min-width:900px}th{background:#1d1d1f;color:#fff;font-weight:bold;padding:10px 8px;border:1px solid #0b1b3a;text-align:left}td{padding:8px;border:1px solid #e5e5ea;vertical-align:top}tr:nth-child(even) td{background:#f2f2f7}.amount{text-align:right;mso-number-format:'#,##0.00';white-space:nowrap}.amount::after{content:' F CFA'}.total{background:#eaf0ff!important;font-weight:bold;border-top:2px solid #2456f5}.total.amount{mso-number-format:'#,##0.00';}</style></head><body><h1>Budget Josh — synthèse des dépenses</h1><p>Export généré le ${html(new Intl.DateTimeFormat('fr-FR',{dateStyle:'long'}).format(new Date()))}. Les montants sont exprimés en F CFA.</p><table><thead><tr>${header}</tr></thead><tbody>${bodyRows}<tr>${totals}</tr></tbody></table></body></html>`;
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-josh-depenses-' + new Date().toISOString().slice(0, 10) + '.xls';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addExportButton() {
    const createButton = document.querySelector('#newBudget');
    if (!createButton || document.querySelector('#exportExpenses')) return;
    const button = document.createElement('button');
    button.id = 'exportExpenses';
    button.type = 'button';
    button.className = 'button export-button';
    button.textContent = 'Télécharger Excel';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { downloadExport(await getData()); }
      catch (error) { alert(error.message); }
      finally { button.disabled = false; }
    });
    createButton.insertAdjacentElement('afterend', button);
  }

  // L'ordre des budgets (le plus récent à gauche) est décidé par app-v6.js, seul responsable.
  // Ici on garantit seulement qu'aucun budget n'est ouvert automatiquement au chargement.
  function closeInitialBudget() {
    if (initialLayoutApplied) return;
    const overview = document.querySelector('#overview');
    const sheet = document.querySelector('#sheet');
    if (!overview || !sheet || !overview.querySelector('[data-budget-select]')) return;
    initialLayoutApplied = true;
    const reset = () => {
      if (userSelectedBudget) return;
      overview.querySelectorAll('.chip').forEach(element => element.classList.remove('active'));
      sheet.querySelectorAll('.card').forEach(element => element.classList.remove('active'));
    };
    reset();
    initialResetTimer = setTimeout(reset, 120);
  }

  const observer = new MutationObserver(() => {
    addExportButton();
    closeInitialBudget();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  addExportButton();
})();
