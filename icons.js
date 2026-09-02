(() => {
  // Jeu d'icônes propre à l'application. Remplace les emoji, qui donnaient un rendu
  // générique et dépendaient de la police système de chaque appareil (donc un dessin
  // différent sur Android, iOS et Windows).
  //
  // Toutes suivent le même langage graphique que la barre de navigation : tracé de
  // 24x24, pas de remplissage, épaisseur 1.8, extrémités arrondies, couleur héritée
  // du texte (currentColor) pour s'adapter aux fonds clairs comme foncés.
  const paths = {
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>',
    car: '<path d="M4 17.5v-4.8l1.8-4.4A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.3L20 12.7v4.8"/><path d="M4 12.9h16"/><circle cx="7.6" cy="17.4" r="1.5"/><circle cx="16.4" cy="17.4" r="1.5"/>',
    book: '<path d="M12 4 2.5 8.6 12 13.2l9.5-4.6Z"/><path d="M6.5 11v4.4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8V11"/><path d="M21.5 8.6v5"/>',
    home: '<path d="M3.5 10.4 12 4l8.5 6.4V19a1 1 0 0 1-1 1h-4.2v-5.6H8.7V20H4.5a1 1 0 0 1-1-1Z"/>',
    health: '<path d="M12 19.8S4.8 15.4 4.8 10.5a3.9 3.9 0 0 1 7.2-2.1 3.9 3.9 0 0 1 7.2 2.1c0 4.9-7.2 9.3-7.2 9.3Z"/>',
    travel: '<path d="M10.6 4a1.4 1.4 0 0 1 2.8 0v5l7.1 4.1v2.2l-7.1-2v3.8l2.3 1.6v1.5L12 19.6l-3.7.6v-1.5l2.3-1.6v-3.8l-7.1 2v-2.2L10.6 9Z"/>',
    business: '<rect x="3" y="7.6" width="18" height="11.4" rx="2"/><path d="M9 7.6V6.2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.4"/><path d="M3 12.6h18"/>',
    money: '<rect x="2.6" y="6.6" width="18.8" height="10.8" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.2 10.2v3.6M17.8 10.2v3.6"/>',
    faith: '<path d="M12 3.6v16.8"/><path d="M7.4 8.6h9.2"/>',
    family: '<circle cx="8.6" cy="8" r="2.6"/><circle cx="16.2" cy="9.4" r="2.1"/><path d="M3.6 19.4v-1.6a4.2 4.2 0 0 1 4.2-4.2h1.6a4.2 4.2 0 0 1 4.2 4.2v1.6"/><path d="M15.4 13.6h.8a4 4 0 0 1 4 4v1.8"/>',
    bolt: '<path d="M13.4 3.2 5.4 13.4h5.5l-.3 7.4 8-10.2h-5.5Z"/>',
    check: '<path d="m4.6 12.4 4.8 4.8L19.4 6.6"/>',
    trophy: '<path d="M8 4.2h8v4.6a4 4 0 0 1-8 0Z"/><path d="M8 5.8H5.6a2.4 2.4 0 0 0 2.4 4.2M16 5.8h2.4a2.4 2.4 0 0 1-2.4 4.2"/><path d="M12 12.8v3.6M9.4 19.8h5.2M10.2 16.4h3.6"/>',
    next: '<circle cx="12" cy="12" r="8.2"/><path d="M8.6 12h6.4"/><path d="m12.4 9.2 2.8 2.8-2.8 2.8"/>',
    flame: '<path d="M12 20.2a5.4 5.4 0 0 0 5.4-5.4c0-4.4-5.4-8.4-5.4-8.4s-5.4 4-5.4 8.4A5.4 5.4 0 0 0 12 20.2Z"/><path d="M12 20.2a2.4 2.4 0 0 0 2.4-2.4c0-1.9-2.4-3.6-2.4-3.6s-2.4 1.7-2.4 3.6a2.4 2.4 0 0 0 2.4 2.4Z"/>',
    toolbox: '<rect x="3" y="8.6" width="18" height="10.4" rx="2"/><path d="M8.6 8.6V7.2a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.4"/><path d="M3 13h18M9.8 11.4v3.2M14.2 11.4v3.2"/>',
    wall: '<rect x="3" y="6.2" width="18" height="11.6" rx="1.4"/><path d="M3 10.1h18M3 13.9h18M9.4 6.2v3.9M15.4 6.2v3.9M6.4 10.1v3.8M12.4 10.1v3.8M18.4 10.1v3.8M9.4 13.9v3.9M15.4 13.9v3.9"/>',
    pencil: '<path d="M4.4 19.6h3.8L19.4 8.4a2 2 0 0 0-2.8-2.8L5.4 16.8Z"/><path d="m15.6 6.6 2.8 2.8"/>',
    bell: '<path d="M6.6 9.8a5.4 5.4 0 0 1 10.8 0c0 3.9 1.5 5.3 1.5 5.3H5.1s1.5-1.4 1.5-5.3Z"/><path d="M9.9 18.2a2.2 2.2 0 0 0 4.2 0"/>',
    flag: '<path d="M6 20.4V4.2"/><path d="M6 5.2h11.4l-2 3.4 2 3.4H6"/>',
  };

  const icon = (name, size = 24) => {
    const body = paths[name] || paths.target;
    return `<svg class="bi" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
  };

  const style = document.createElement('style');
  style.textContent = `.bi{display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;overflow:visible}`;
  document.head.append(style);

  window.BudgetIcons = { icon, names: Object.keys(paths) };
})();
