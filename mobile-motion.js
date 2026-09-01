(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const navItems = {
    'index.php': { full: 'Mes budgets', short: 'Budgets', icon: 'wallet' },
    'objectives.php': { full: 'Mes objectifs', short: 'Objectifs', icon: 'target' },
    'liaison.php': { full: 'Lier mes dépenses', short: 'Liaisons', icon: 'link' },
    'pilotage.php': { full: 'Tableau de bord', short: 'Tableau', icon: 'chart' }
  };
  const icons = {
    wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 2 18V6a1.5 1.5 0 0 1 1.5-1.5H17"/><path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m14 10 6-6m-3 0h3v3"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 14.5 5-5M7.8 17.9l-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l3-3a3.3 3.3 0 0 1 4.7 0m4.6.8a3.3 3.3 0 0 1 4.7 0l1.6-1.6a3.3 3.3 0 0 0-4.7-4.7l-1.4 1.4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>'
  };

  const style = document.createElement('style');
  style.textContent = `
    body{background-color:#f5f3ed!important;background-image:radial-gradient(circle at 104% 8%,#cdebd977 0 9rem,transparent 9.1rem),radial-gradient(circle at -8% 82%,#f1b5aa66 0 8rem,transparent 8.1rem),linear-gradient(145deg,#f7f4ed,#f2f5ed 58%,#f8f1ed)!important;background-attachment:fixed}
    .app-nav{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:14px 0!important;padding:0!important}
    .app-nav-button{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:48px;padding:9px 7px;border:1px solid #dbe2da;border-radius:14px;background:#fffefa;color:#197451!important;text-align:center;font-size:12px!important;font-weight:700;text-decoration:none;box-shadow:0 5px 14px #123b350d}
    .app-nav-icon{display:grid;place-items:center;flex:0 0 auto;width:21px;height:21px}
    .app-nav-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .app-nav-label-short{display:none}
    .app-nav-button[aria-current="page"]{background:#123b35;color:#fff!important;border-color:#123b35;box-shadow:0 8px 20px #123b3524}
    .app-nav-button:active{transform:scale(.97)}
    .brand-logo{display:block;width:62px;height:62px;object-fit:cover;border-radius:18px;margin:0 0 12px;box-shadow:0 8px 20px #123b3518}
    @media(max-width:699px){
      body.has-mobile-app-nav{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}
      .app-nav{position:fixed!important;z-index:75;left:0;right:0;bottom:0;margin:0!important;gap:2px!important;padding:7px 6px calc(7px + env(safe-area-inset-bottom))!important;border-top:1px solid #dce5de;background:#fffdf9f5;box-shadow:0 -12px 30px #123b3518;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      .app-nav-button{flex-direction:column;gap:3px;min-height:58px;padding:5px 2px;border:0;border-radius:13px;background:transparent;box-shadow:none;font-size:10.5px!important;line-height:1.05}
      .app-nav-button[aria-current="page"]{background:#e3f1e9;color:#0e6f4a!important;box-shadow:none}
      .app-nav-icon{width:22px;height:22px}
      .app-nav-label-full{display:none}
      .app-nav-label-short{display:block;overflow:hidden;width:100%;text-overflow:ellipsis;white-space:nowrap}
    }
  `;
  document.head.append(style);

  const fileName = link => {
    try {
      const name = new URL(link.href, location.href).pathname.split('/').pop() || 'index.php';
      return name === 'objectives-v2.php' ? 'objectives.php' : name;
    } catch (_) {
      return '';
    }
  };

  const enhanceNav = () => document.querySelectorAll('nav[aria-label="Navigation principale"], nav.app-nav').forEach(nav => {
    nav.classList.add('app-nav');
    document.body.classList.add('has-mobile-app-nav');
    nav.querySelectorAll('a').forEach(link => {
      const item = navItems[fileName(link)];
      if (!item) return;
      link.classList.add('app-nav-button');
      link.setAttribute('aria-label', item.full);
      link.innerHTML = `<span class="app-nav-icon">${icons[item.icon]}</span><span class="app-nav-label-full">${item.full}</span><span class="app-nav-label-short">${item.short}</span>`;
    });
  });

  const addBrandLogo = () => document.querySelectorAll('header').forEach(header => {
    if (header.querySelector('.brand-logo')) return;
    const logo = document.createElement('img');
    logo.className = 'brand-logo';
    logo.src = 'assets/logo-budget-josh.png';
    logo.alt = 'Budget Josh';
    logo.width = 62;
    logo.height = 62;
    header.prepend(logo);
  });

  let lenis;
  const refresh = () => {
    enhanceNav();
    addBrandLogo();
    if (reduced || !window.gsap) return;
    gsap.fromTo('.card,.metric,.goal-card,.expense', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .42, stagger: .035, ease: 'power2.out', overwrite: 'auto' });
  };

  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: .8, smoothWheel: true, touchMultiplier: 1.05 });
    const raf = time => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  window.BudgetMotion = { refresh };
  refresh();
  setTimeout(refresh, 350);
})();
