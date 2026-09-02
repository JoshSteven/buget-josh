(() => {
  const $ = selector => document.querySelector(selector);
  const icon = (name, size = 24) => window.BudgetIcons?.icon(name, size) || '';
  let state = { tracks: [], tasks: [] };
  let selectedTrackId = null;
  let initialHashHandled = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const api = async (action, body) => {
    const response = await fetch(`goals-v2-api.php${action ? `?action=${encodeURIComponent(action)}` : ''}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Erreur');
    return result;
  };

  const tasksFor = trackId => state.tasks.filter(task => task.track_id === trackId);
  const dateLabel = date => date
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
    : 'Date à préciser';
  const iconFor = (track, size = 44) => icon(track.icon_key || 'target', size);
  const progressFor = tasks => tasks.length ? Math.round(tasks.filter(task => task.status === 'realised').length * 100 / tasks.length) : 0;
  const nextFor = tasks => tasks.find(task => task.status !== 'realised') || null;

  function dayInfo(task) {
    if (!task?.target_date) return { label: 'Date à préciser', short: '—', className: '' };
    const days = Number(task.days_remaining);
    if (days < 0) return { label: `En retard de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`, short: `${Math.abs(days)} j`, className: 'overdue' };
    if (days === 0) return { label: 'À faire aujourd’hui', short: 'auj.', className: 'near' };
    if (days === 1) return { label: 'À faire demain', short: '1 j', className: 'near' };
    return { label: `${days} jours restants`, short: `${days} j`, className: days <= 7 ? 'near' : '' };
  }

  function menu(kind, id) {
    const goal = kind === 'track';
    return `<span class="more"><button class="more-btn" data-more="${kind}-${esc(id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions ${goal ? 'de l’objectif' : 'de l’étape'}">…</button><span class="menu" data-menu="${kind}-${esc(id)}" role="menu" hidden><button data-edit-${kind}="${esc(id)}" role="menuitem">Modifier</button><button class="danger" data-delete-${kind}="${esc(id)}" role="menuitem">Supprimer</button></span></span>`;
  }

  function render() {
    const active = state.tracks.filter(track => progressFor(tasksFor(track.id)) < 100).length;
    const planned = state.tasks.filter(task => task.status !== 'realised');
    const urgent = planned.filter(task => Number(task.days_remaining) <= 7).length;
    const overall = progressFor(state.tasks);
    $('#summary').innerHTML = `
      <article class="metric"><span class="metric-icon" aria-hidden="true">${icon('target', 22)}</span><span><b>${active}</b><small>objectifs actifs</small></span></article>
      <article class="metric"><span class="metric-icon" aria-hidden="true">${icon('bolt', 22)}</span><span><b>${urgent}</b><small>étapes urgentes</small></span></article>
      <article class="metric"><span class="metric-icon" aria-hidden="true">${icon('check', 22)}</span><span><b>${overall}%</b><small>progression totale</small></span></article>`;

    $('#goals').innerHTML = state.tracks.length ? state.tracks.map(track => {
      const tasks = tasksFor(track.id);
      const progress = progressFor(tasks);
      const next = nextFor(tasks);
      const info = next ? dayInfo(next) : null;
      const nextLabel = next ? next.title : tasks.length ? 'Objectif atteint' : 'Ajouter une première étape';
      const time = next ? `<strong>${esc(info.short)}</strong><span>${info.className === 'overdue' ? 'retard' : 'restants'}</span>` : `<strong>${progress === 100 && tasks.length ? '✓' : '0'}</strong><span>${tasks.length ? 'réussi' : 'étape'}</span>`;
      return `<article class="goal" id="track-${esc(track.id)}">
        <button class="goal-open" type="button" data-open-track="${esc(track.id)}" aria-label="Ouvrir le plan : ${esc(track.title)}">
          <span class="goal-art" aria-hidden="true">${iconFor(track)}</span>
          <span class="goal-copy">${track.category ? `<span class="goal-category">${esc(track.category)}</span>` : ''}<h2>${esc(track.title)}</h2><span class="goal-progress-label">${tasks.filter(task => task.status === 'realised').length} étape${tasks.filter(task => task.status === 'realised').length > 1 ? 's' : ''} sur ${tasks.length}</span><span class="progress" role="progressbar" aria-label="Progression" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></span></span>
          <span class="goal-time ${info?.className || ''}">${time}</span>
          <span class="goal-next"><span class="goal-next-icon" aria-hidden="true">${progress === 100 && tasks.length ? icon('trophy', 22) : icon('next', 22)}</span><span><small>${progress === 100 && tasks.length ? 'Parcours terminé' : 'Prochaine action'}</small><strong>${esc(nextLabel)}</strong></span></span>
        </button>${menu('track', track.id)}
      </article>`;
    }).join('') : '<p class="empty">Créez votre premier objectif pour dessiner son chemin.</p>';

    wirePage();
    if ($('#planDrawer').open && selectedTrackId) renderDrawer();
    window.BudgetMotion?.refresh();
  }

  function challengeFor(track, tasks) {
    if (!tasks.length) return 'Quelle est la toute première étape réalisable ?';
    if (!track.success_definition) return 'Comment sauras-tu précisément que cet objectif est atteint ?';
    if (!track.motivation) return 'Pourquoi cet objectif compte-t-il vraiment pour toi ?';
    const overdue = tasks.find(task => task.status !== 'realised' && Number(task.days_remaining) < 0);
    if (overdue) return `« ${overdue.title} » est dépassée : faut-il la replanifier ou simplifier l’action ?`;
    if (!track.resources) return 'De quel temps, budget ou soutien as-tu besoin pour avancer ?';
    const next = nextFor(tasks);
    if (next) return `Quel créneau précis vas-tu réserver pour « ${next.title} » ?`;
    return 'Bravo. Quelle preuve confirme que ton objectif est réellement atteint ?';
  }

  function fact(icon, label, value, missing) {
    return `<article class="plan-fact"><span aria-hidden="true">${icon}</span><small>${label}</small><strong>${esc(value || missing)}</strong></article>`;
  }

  function renderDrawer() {
    const track = state.tracks.find(item => item.id === selectedTrackId);
    if (!track) {
      $('#planDrawer').close();
      selectedTrackId = null;
      return;
    }
    const tasks = tasksFor(track.id);
    const progress = progressFor(tasks);
    const next = nextFor(tasks);
    const finalDate = tasks.filter(task => task.target_date).at(-1)?.target_date;
    let currentFound = false;
    const journey = tasks.length ? tasks.map((task, index) => {
      const done = task.status === 'realised';
      const current = !done && !currentFound;
      if (current) currentFound = true;
      const info = dayInfo(task);
      return `<div class="journey-step ${done ? 'done' : current ? 'current' : ''} ${info.className}" id="task-${esc(task.id)}">
        <span class="journey-node" aria-hidden="true">${done ? '✓' : index + 1}</span>
        <span class="journey-copy"><strong>${esc(task.title)}</strong><small>${esc(dateLabel(task.target_date))} · ${esc(done ? 'Terminée' : info.label)}</small></span>
        <span class="journey-actions"><button class="status-btn" type="button" data-status-task="${esc(task.id)}" data-next-status="${done ? 'planned' : 'realised'}">${done ? 'Rouvrir' : 'Terminer'}</button>${menu('task', task.id)}</span>
      </div>`;
    }).join('') : '<p class="empty">Le chemin est vide. Ajoutez une première étape simple.</p>';

    $('#drawerContent').innerHTML = `
      <header class="drawer-head"><span class="drawer-art" aria-hidden="true">${iconFor(track, 38)}</span><span><h2 id="drawerTitle">${esc(track.title)}</h2><small>${track.category ? esc(track.category) : 'Objectif personnel'}${finalDate ? ` · arrivée ${esc(dateLabel(finalDate))}` : ''}</small></span><button class="close" id="closeDrawer" type="button" aria-label="Fermer le plan">×</button></header>
      <div class="drawer-body">
        <section class="drawer-progress" aria-label="Progression du parcours"><span class="progress-ring" style="--progress:${progress}" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><strong>${progress}%</strong></span><span><small>Votre parcours</small><strong>${next ? `Prochaine action : ${esc(next.title)}` : tasks.length ? 'Toutes les étapes sont terminées' : 'À construire'}</strong></span></section>
        <section class="challenge"><span class="challenge-icon" aria-hidden="true">${icon('bolt', 25)}</span><span><small>Le challenge de Josh</small><strong>${esc(challengeFor(track, tasks))}</strong></span></section>
        <section class="plan-facts" aria-label="Repères du plan">${fact(icon('trophy', 22), 'Ma réussite', track.success_definition, 'Définir le résultat attendu')}${fact(icon('flame', 22), 'Ma motivation', track.motivation, 'Dire pourquoi cela compte')}${fact(icon('toolbox', 22), 'Mes moyens', track.resources, 'Lister temps, budget et soutiens')}${fact(icon('wall', 22), 'Mes obstacles', track.obstacles, 'Anticiper ce qui peut bloquer')}</section>
        <div class="journey-title"><h3>Mon chemin</h3><small>${tasks.length} étape${tasks.length > 1 ? 's' : ''}</small></div>
        <section class="journey" aria-label="Étapes de l’objectif">${journey}</section>
        <button class="add-step" type="button" data-drawer-add-task="${esc(track.id)}">＋ Ajouter une étape</button>
      </div>
      <footer class="drawer-actions"><button type="button" data-drawer-edit-track="${esc(track.id)}">${icon('pencil', 18)} Compléter mon plan</button><button class="primary" type="button" data-drawer-next="${esc(track.id)}">${next ? `${icon('next', 18)} Voir ma prochaine action` : '＋ Ajouter une étape'}</button></footer>`;
    wireDrawer();
  }

  function openDrawer(trackId) {
    selectedTrackId = trackId;
    renderDrawer();
    const drawer = $('#planDrawer');
    if (!drawer.open) drawer.showModal();
    setTimeout(() => $('#closeDrawer')?.focus(), 30);
  }

  function openTrack(track) {
    $('#trackId').value = track?.id || '';
    $('#trackIcon').value = track?.icon_key || 'target';
    $('#trackCategory').value = track?.category || '';
    $('#trackTitle').value = track?.title || '';
    $('#trackSuccess').value = track?.success_definition || '';
    $('#trackMotivation').value = track?.motivation || '';
    $('#trackResources').value = track?.resources || '';
    $('#trackObstacles').value = track?.obstacles || '';
    $('#trackDialogTitle').textContent = track ? 'Compléter mon plan' : 'Nouvel objectif';
    $('#trackDialog').showModal();
    setTimeout(() => $('#trackTitle').focus(), 50);
  }

  function openTask(trackId, task) {
    $('#taskId').value = task?.id || '';
    $('#taskTrackId').value = trackId;
    $('#taskTitle').value = task?.title || '';
    $('#taskDate').value = task?.target_date || '';
    $('#taskDialogTitle').textContent = task ? 'Modifier l’étape' : 'Nouvelle étape';
    $('#taskDialog').showModal();
    setTimeout(() => $('#taskTitle').focus(), 50);
  }

  function closeMenus() {
    document.querySelectorAll('.menu').forEach(element => { element.hidden = true; });
    document.querySelectorAll('[data-more]').forEach(element => element.setAttribute('aria-expanded', 'false'));
  }

  function wireMenus(scope = document) {
    scope.querySelectorAll('[data-more]').forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        const currentMenu = button.parentElement.querySelector('.menu');
        const opening = currentMenu.hidden;
        closeMenus();
        currentMenu.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
      };
    });
  }

  function wirePage() {
    wireMenus();
    document.querySelectorAll('[data-open-track]').forEach(button => { button.onclick = () => openDrawer(button.dataset.openTrack); });
    document.querySelectorAll('[data-edit-track]').forEach(button => { button.onclick = () => openTrack(state.tracks.find(track => track.id === button.dataset.editTrack)); });
    document.querySelectorAll('[data-delete-track]').forEach(button => {
      button.onclick = async () => {
        const track = state.tracks.find(item => item.id === button.dataset.deleteTrack);
        if (!track || !confirm(`Attention : supprimer « ${track.title} » effacera définitivement toutes ses étapes et retirera leurs liaisons avec les dépenses.\n\nContinuer ?`)) return;
        try { await api('track_delete', { id: track.id }); await load(); } catch (error) { alert(error.message); }
      };
    });
  }

  function wireDrawer() {
    const drawer = $('#planDrawer');
    $('#closeDrawer').onclick = () => drawer.close();
    wireMenus(drawer);
    drawer.querySelector('[data-drawer-edit-track]').onclick = event => {
      const track = state.tracks.find(item => item.id === event.currentTarget.dataset.drawerEditTrack);
      drawer.close();
      openTrack(track);
    };
    drawer.querySelector('[data-drawer-add-task]').onclick = event => { drawer.close(); openTask(event.currentTarget.dataset.drawerAddTask); };
    drawer.querySelector('[data-drawer-next]').onclick = event => {
      const tasks = tasksFor(event.currentTarget.dataset.drawerNext);
      const next = nextFor(tasks);
      if (next) drawer.querySelector(`#task-${CSS.escape(next.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else { drawer.close(); openTask(event.currentTarget.dataset.drawerNext); }
    };
    drawer.querySelectorAll('[data-status-task]').forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try { await api('task_status', { id: button.dataset.statusTask, status: button.dataset.nextStatus }); await load(); }
        catch (error) { alert(error.message); button.disabled = false; }
      };
    });
    drawer.querySelectorAll('[data-edit-task]').forEach(button => {
      button.onclick = () => {
        const task = state.tasks.find(item => item.id === button.dataset.editTask);
        drawer.close();
        openTask(task.track_id, task);
      };
    });
    drawer.querySelectorAll('[data-delete-task]').forEach(button => {
      button.onclick = async () => {
        const task = state.tasks.find(item => item.id === button.dataset.deleteTask);
        if (!task || !confirm(`Supprimer définitivement l’étape « ${task.title} » ?`)) return;
        try { await api('task_delete', { id: task.id }); await load(); } catch (error) { alert(error.message); }
      };
    });
  }

  async function load() {
    try {
      state = await api('');
      render();
      if (!initialHashHandled && location.hash.startsWith('#task-')) {
        initialHashHandled = true;
        const taskId = location.hash.slice(6);
        const task = state.tasks.find(item => item.id === taskId);
        if (task) {
          openDrawer(task.track_id);
          setTimeout(() => $(`#task-${CSS.escape(task.id)}`)?.scrollIntoView({ block: 'center' }), 80);
        }
      }
    } catch (error) {
      $('#goals').innerHTML = `<p class="empty">${esc(error.message)}</p>`;
    }
  }

  $('#addTrack').onclick = () => openTrack();
  document.querySelectorAll('.form-dialog .close').forEach(button => {
    if (button.closest('#notificationsDialog')) return;
    button.onclick = () => button.closest('dialog').close();
  });
  $('#planDrawer').addEventListener('click', event => { if (event.target === $('#planDrawer')) $('#planDrawer').close(); });
  $('#trackForm').onsubmit = async event => {
    event.preventDefault();
    const id = $('#trackId').value;
    try {
      await api(id ? 'track_update' : 'track', {
        id: id || crypto.randomUUID(), title: $('#trackTitle').value.trim(), category: $('#trackCategory').value.trim(), icon_key: $('#trackIcon').value,
        success_definition: $('#trackSuccess').value.trim(), motivation: $('#trackMotivation').value.trim(), resources: $('#trackResources').value.trim(), obstacles: $('#trackObstacles').value.trim(),
      });
      $('#trackDialog').close();
      await load();
      if (id) openDrawer(id);
    } catch (error) { alert(error.message); }
  };
  $('#taskForm').onsubmit = async event => {
    event.preventDefault();
    const id = $('#taskId').value;
    const trackId = $('#taskTrackId').value;
    try {
      await api(id ? 'task_update' : 'task', { id: id || crypto.randomUUID(), track_id: trackId, title: $('#taskTitle').value.trim(), target_date: $('#taskDate').value });
      $('#taskDialog').close();
      await load();
      openDrawer(trackId);
    } catch (error) { alert(error.message); }
  };
  document.addEventListener('click', event => { if (!event.target.closest('.more')) closeMenus(); });
  document.addEventListener('budget:open-goal-task', event => {
    const task = state.tasks.find(item => item.id === event.detail?.taskId);
    if (!task) return;
    openDrawer(task.track_id);
    setTimeout(() => $(`#task-${CSS.escape(task.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  });
  const toolbarIcon = document.querySelector('.toolbar-icon');
  if (toolbarIcon) toolbarIcon.innerHTML = icon('bell', 20);
  load();
})();
