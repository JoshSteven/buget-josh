(() => {
  const form = document.querySelector('#loginForm');
  if (!form) return; // écran « configuration requise » : rien à brancher

  const password = document.querySelector('#password');
  const submit = document.querySelector('#submit');
  const message = document.querySelector('#message');
  const reveal = document.querySelector('#reveal');

  const show = text => {
    message.textContent = text;
    message.hidden = false;
  };

  reveal.onclick = () => {
    const shown = password.type === 'text';
    password.type = shown ? 'password' : 'text';
    reveal.setAttribute('aria-label', shown ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    password.focus();
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (!password.value) return show('Saisissez votre mot de passe.');

    message.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Vérification…';

    try {
      const response = await fetch('auth-api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Connexion impossible.');
      location.replace(window.__BUDGET_NEXT || 'index.php');
      return;
    } catch (error) {
      show(error.message);
      password.value = '';
      password.focus();
    }

    submit.disabled = false;
    submit.textContent = 'Ouvrir mon budget';
  };

  password.focus();
})();
