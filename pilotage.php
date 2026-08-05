<?php
declare(strict_types=1);
$v = static fn(string $file): int => @filemtime(__DIR__ . '/' . $file) ?: time();
?><!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#123b35">
  <title>Pilotage — Budget Josh</title>
  <style>
    :root{--ink:#123b35;--paper:#f4f2ec;--card:#fffefa;--line:#dbe2da;--muted:#647873;--green:#197451;--orange:#e96c48;--red:#b53e25;--purple:#6c5ab0}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px Arial,sans-serif;padding-bottom:40px}
    header,main{max-width:900px;margin:auto;padding:0 16px}header{padding-top:24px}.nav{display:flex;gap:16px;flex-wrap:wrap}.nav a{color:var(--green);font-weight:bold;text-decoration:none;font-size:13px}
    .ey{margin:22px 0 5px;color:var(--muted);font-size:10px;letter-spacing:.15em;font-weight:bold}h1{margin:0;font-size:29px;letter-spacing:-.8px}.intro{color:var(--muted);margin:7px 0 17px;line-height:1.45}
    .toolbar{display:flex;gap:9px;align-items:center;margin:15px 0}.toolbar select{flex:1}.toolbar button,.settings button{border:0;border-radius:11px;padding:12px 14px;background:var(--ink);color:#fff;font:inherit;font-weight:bold;cursor:pointer}
    select,input{width:100%;border:1px solid var(--line);background:#fff;padding:12px;border-radius:10px;color:var(--ink);font:inherit}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:14px 0}.metric{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:15px}.metric b{display:block;font-size:21px;margin-bottom:4px}.metric small{color:var(--muted);font-size:11px}
    .section-title{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:26px 2px 10px}.section-title h2{font-size:17px;margin:0}.section-title small{color:var(--muted)}.alerts,.category-grid,.nature-list{display:grid;gap:9px}
    .alert,.category,.nature{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:14px}.alert{display:flex;gap:11px;align-items:start}.alert-dot{width:10px;height:10px;border-radius:50%;background:var(--green);margin-top:4px;flex:0 0 auto}.alert.warning .alert-dot{background:#d99322}.alert.danger{border-color:#e8b2a5}.alert.danger .alert-dot{background:var(--red)}.alert b{display:block;margin-bottom:4px}.alert small{color:var(--muted);line-height:1.4}
    .category-grid{grid-template-columns:repeat(2,1fr)}.category-head,.nature-head{display:flex;justify-content:space-between;gap:10px}.category h3{font-size:14px;margin:0}.category strong{font-size:16px}.category small,.nature small{display:block;color:var(--muted);margin-top:5px}.bar{height:8px;background:#e8ece5;border-radius:99px;overflow:hidden;margin:13px 0 8px}.bar i{display:block;height:100%;border-radius:99px;background:var(--green)}.category.dogs .bar i{background:var(--orange)}.category-meta{display:flex;justify-content:space-between;color:var(--muted);font-size:11px}
    .nature-head{align-items:center}.nature b{font-size:13px}.nature strong{font-size:14px}.nature .bar{margin:9px 0 0;height:6px;background:#edf0eb}.nature .bar i{background:var(--purple)}
    .empty{background:var(--card);border:1px dashed var(--line);border-radius:15px;padding:16px;color:var(--muted);font-size:13px}.settings{background:#edf3ed;border-radius:16px;padding:16px}.settings p{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.4}.limit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.limit-box{background:var(--card);padding:12px;border-radius:12px}.limit-box label{display:block;font-size:12px;font-weight:bold;margin-bottom:7px}.limit-box small{display:block;color:var(--muted);font-size:10px;margin-top:6px}.setting-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.status{font-size:12px;color:var(--green);min-height:16px;margin:8px 0 0}.hidden{display:none}@media(min-width:680px){.metrics{grid-template-columns:repeat(5,1fr)}}@media(max-width:480px){header,main{padding-left:12px;padding-right:12px}.category-grid,.limit-grid{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column}}
  </style>
</head>
<body>
  <header>
    <nav class="nav"><a href="index.php">← Budgets</a><a href="objectives.php">Objectifs</a><a href="liaison.php">Liaisons</a></nav>
    <p class="ey">PILOTAGE</p>
    <h1>Voir où va l’argent.</h1>
    <p class="intro">Le réel correspond aux dépenses réalisées. L’engagé ajoute les dépenses prévues afin de voir ce qui reste vraiment disponible.</p>
  </header>
  <main>
    <div class="toolbar"><select id="budgetFilter" aria-label="Filtrer par budget"><option value="all">Tous les budgets</option></select><button id="refresh" type="button">Actualiser</button></div>
    <section class="metrics" id="metrics"></section>
    <section><div class="section-title"><h2>Alertes de limite</h2><small id="scopeLabel"></small></div><div class="alerts" id="alerts"></div></section>
    <section><div class="section-title"><h2>Répartition par catégorie</h2><small>Dépenses engagées</small></div><div class="category-grid" id="categories"></div></section>
    <section><div class="section-title"><h2>Top 3 des natures</h2><small>Réalisées + prévues</small></div><div class="nature-list" id="natures"></div></section>
    <section><div class="section-title"><h2>Plafonds</h2><small>Synchronisés avec la base</small></div><div class="settings"><p>Configure un montant fixe ou un pourcentage des revenus pour chaque catégorie. Une alerte apparaît à 80 %, puis devient critique quand le plafond est dépassé.</p><form id="limitsForm"><div class="limit-grid"><div class="limit-box"><label for="priorityMode">Priorités</label><select id="priorityMode"><option value="fixed">Montant fixe</option><option value="percent">Pourcentage des revenus</option></select><input id="priorityValue" type="number" min="0" step="1" placeholder="Désactivé"><small id="priorityHint"></small></div><div class="limit-box"><label for="dogsMode">Petits chiens</label><select id="dogsMode"><option value="fixed">Montant fixe</option><option value="percent">Pourcentage des revenus</option></select><input id="dogsValue" type="number" min="0" step="1" placeholder="Désactivé"><small id="dogsHint"></small></div></div><div class="setting-actions"><button type="submit">Enregistrer les plafonds</button></div><p class="status" id="settingsStatus" role="status"></p></form></div></section>
  </main>
  <script src="pilotage.js?v=<?= $v('pilotage.js') ?>"></script>
</body>
</html>
