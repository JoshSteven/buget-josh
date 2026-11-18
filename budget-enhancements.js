(() => {
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

  // Barre d'actions de l'en-tête (lot 11) : Récurrences, Exporter, Quitter, en icônes façon application.
  const svg = path => '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  const actionIcons = {
    recurring: svg('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>'),
    export: svg('<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>'),
  };

  function addHeaderActions() {
    const header = document.querySelector('header');
    if (!header || !document.querySelector('#newBudget')) return;
    let bar = header.querySelector('.screen-actions');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'screen-actions';
      bar.innerHTML =
        '<button type="button" class="action-btn" data-open-recurring aria-label="Dépenses récurrentes">' + actionIcons.recurring + '<span>Récurrences</span></button>' +
        '<a class="action-btn" id="exportExpenses" href="export-excel.php" download aria-label="Exporter en Excel">' + actionIcons.export + '<span>Excel</span></a>';
      header.prepend(bar);
    }
    // Le bouton Quitter (session-guard.js) rejoint la barre pour ne plus flotter au-dessus du contenu.
    const logout = header.querySelector('.session-logout');
    if (logout && logout.parentElement !== bar) bar.append(logout);
    // Le logo (mobile-motion.js) reste à gauche de la barre.
    const logo = header.querySelector('.brand-logo');
    if (logo && logo.nextElementSibling !== bar) logo.insertAdjacentElement('afterend', bar);
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
    addHeaderActions();
    closeInitialBudget();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  addHeaderActions();
})();
