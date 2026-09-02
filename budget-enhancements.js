(() => {
  const apiUrl = 'api.php?action=bootstrap';
  let initialLayoutApplied = false;
  let userSelectedBudget = false;
  let initialResetTimer = null;
  let budgetRank = new Map();
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

  const csv = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
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
      ...budgets.map(budget => budget.id === expense.budget_id ? expense.amount + ' F CFA' : ''),
    ]);
    const content = '\uFEFF' + [columns, ...rows].map(row => row.map(csv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-josh-depenses-' + new Date().toISOString().slice(0, 10) + '.csv';
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
    button.textContent = 'Exporter pour Excel';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { downloadExport(await getData()); }
      catch (error) { alert(error.message); }
      finally { button.disabled = false; }
    });
    createButton.insertAdjacentElement('afterend', button);
  }

  async function arrangeInitialBudgets() {
    if (initialLayoutApplied) return;
    const overview = document.querySelector('#overview');
    const sheet = document.querySelector('#sheet');
    if (!overview || !sheet || !overview.querySelector('[data-budget-select]')) return;
    if (initialLayoutApplied) {
      [...overview.children]
        .sort((a, b) => (budgetRank.get(a.dataset.budgetSelect) ?? 999) - (budgetRank.get(b.dataset.budgetSelect) ?? 999))
        .forEach(element => overview.append(element));
      [...sheet.querySelectorAll('[data-budget-card]')]
        .sort((a, b) => (budgetRank.get(a.dataset.budgetCard) ?? 999) - (budgetRank.get(b.dataset.budgetCard) ?? 999))
        .forEach(element => sheet.append(element));
      return;
    }
    initialLayoutApplied = true;
    const data = await getData();
    const order = data.budgets.slice().sort((a, b) =>
      String(b.period_month || b.project_date).localeCompare(String(a.period_month || a.project_date)));
    budgetRank = new Map(order.map((budget, index) => [budget.id, index]));
    [...overview.children]
      .sort((a, b) => (budgetRank.get(a.dataset.budgetSelect) ?? 999) - (budgetRank.get(b.dataset.budgetSelect) ?? 999))
      .forEach(element => overview.append(element));
    [...sheet.querySelectorAll('[data-budget-card]')]
      .sort((a, b) => (budgetRank.get(a.dataset.budgetCard) ?? 999) - (budgetRank.get(b.dataset.budgetCard) ?? 999))
      .forEach(element => sheet.append(element));
    initialResetTimer = setTimeout(() => {
      if (userSelectedBudget) return;
      overview.querySelectorAll('.chip').forEach(element => element.classList.remove('active'));
      sheet.querySelectorAll('.card').forEach(element => element.classList.remove('active'));
    }, 120);
    if (!userSelectedBudget && !overview.querySelector('.chip.active')) {
      overview.querySelectorAll('.chip').forEach(element => element.classList.remove('active'));
      sheet.querySelectorAll('.card').forEach(element => element.classList.remove('active'));
    }
  }

  const observer = new MutationObserver(() => {
    addExportButton();
    arrangeInitialBudgets().catch(() => {});
  });
  observer.observe(document.body, { childList: true, subtree: true });
  addExportButton();
})();
