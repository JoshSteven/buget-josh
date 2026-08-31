(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const api = async (action, body) => {
    const response = await fetch(`notifications-api.php?action=${action}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Erreur');
    return result;
  };
  const b64 = value => {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base);
    return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
  };
  let reminders = [];

  async function load() {
    try {
      const data = await api('reminders');
      reminders = data.reminders || [];
      const badge = $('#notificationBadge');
      badge.textContent = data.unread;
      badge.hidden = !data.unread;
      render();
    } catch (error) {
      $('#pushStatus').textContent = error.message;
    }
  }

  function render() {
    const list = $('#notificationList');
    list.innerHTML = reminders.length
      ? reminders.map(reminder => `<article class="notice ${reminder.read_at ? '' : 'unread'}" data-notice="${esc(reminder.id)}" data-task="${esc(reminder.task_id)}"><b>${esc(reminder.title)}</b><small>${esc(reminder.body)}</small></article>`).join('')
      : '<p class="empty">Aucun rappel pour le moment.</p>';
    list.querySelectorAll('[data-notice]').forEach(row => {
      row.onclick = async () => {
        try {
          await api('read', { id: row.dataset.notice });
          row.classList.remove('unread');
          $('#notificationsDialog').close();
          document.dispatchEvent(new CustomEvent('budget:open-goal-task', { detail: { taskId: row.dataset.task } }));
          await load();
        } catch (error) {
          $('#pushStatus').textContent = error.message;
        }
      };
    });
  }

  async function enable() {
    const status = $('#pushStatus');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw Error('Les notifications système ne sont pas disponibles sur cet appareil.');
      if (Notification.permission === 'denied') throw Error('Les notifications sont bloquées dans les réglages du navigateur.');
      const config = await api('config');
      if (!config.available) throw Error('Les clés Web Push ne sont pas encore configurées sur le serveur.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Error('Autorisation non accordée.');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(config.publicKey) });
      const json = subscription.toJSON();
      await api('subscribe', { endpoint: subscription.endpoint, keys: json.keys, contentEncoding: 'aes128gcm' });
      status.textContent = 'Notifications activées sur cet appareil.';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function testPush() {
    const status = $('#pushStatus');
    const button = $('#testPush');
    button.disabled = true;
    status.textContent = 'Envoi du test…';
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw Error('Le Web Push n’est pas disponible sur cet appareil.');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw Error('Activez d’abord les notifications sur cet appareil.');
      await api('test', { endpoint: subscription.endpoint });
      status.textContent = 'Test envoyé. La notification doit apparaître dans quelques secondes.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  $('#openNotifications').onclick = () => { $('#notificationsDialog').showModal(); load(); };
  $('#enablePush').onclick = enable;
  $('#testPush').onclick = testPush;
  load();
})();
