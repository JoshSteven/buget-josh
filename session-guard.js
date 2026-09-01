(() => {
  // Chargé en premier sur chaque page : enveloppe fetch pour que toute réponse 401
  // renvoie vers l'écran de connexion au lieu d'afficher « Erreur » dans l'app.
  // offline-sync.js enveloppe fetch à son tour ensuite ; l'ordre est volontaire.
  const nativeFetch = window.fetch.bind(window);

  const toLogin = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`login.php?next=${next}`);
  };

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (response.status === 401) {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      // auth-api.php renvoie aussi 401 sur mot de passe incorrect : c'est l'écran de
      // connexion lui-même, il gère son propre message.
      if (!url.includes('auth-api.php')) toLogin();
    }
    return response;
  };

  async function logout() {
    try {
      await nativeFetch('auth-api.php?action=logout', { method: 'POST' });
    } catch (_) {
      // Même hors ligne on repart vers l'écran de connexion : le cookie sera
      // rejeté au prochain accès réseau.
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      localStorage.removeItem('budget-josh-bootstrap-v1');
    } catch (_) {
      // Nettoyage de confort : son échec ne doit pas empêcher la déconnexion.
    }
    location.replace('login.php');
  }

  function injectLogout() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('.session-logout')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-logout';
    button.textContent = 'Quitter';
    button.setAttribute('aria-label', 'Se déconnecter de Budget Josh');
    button.onclick = () => {
      if (confirm('Se déconnecter de cet appareil ?')) logout();
    };
    header.append(button);
  }

  const style = document.createElement('style');
  style.textContent = `
    header{position:relative}
    .session-logout{position:absolute;right:16px;top:20px;z-index:10;min-height:36px;padding:7px 13px;border:1px solid #dbe2da;border-radius:99px;background:#fffefacc;color:#526b65;font:inherit;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(6px)}
    .session-logout:active{transform:scale(.96);background:#f1f4ef}
    @media(max-width:600px){.session-logout{right:12px;top:16px}}
  `;
  document.head.append(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLogout);
  } else {
    injectLogout();
  }
  window.BudgetSession = { logout };
})();
