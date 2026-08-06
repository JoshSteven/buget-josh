<?php
declare(strict_types=1);
$v = static fn(string $file): int => @filemtime(__DIR__ . '/' . $file) ?: time();
?><!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#123b35">
  <title>Liaisons — Budget Josh</title>
  <style>
    :root{--ink:#123b35;--paper:#f4f2ec;--card:#fffefa;--line:#dbe2da;--green:#197451;--muted:#647873;--orange:#e96c48}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px Arial,sans-serif;padding-bottom:40px}header,main{max-width:850px;margin:auto;padding:0 16px}header{padding-top:24px}.nav{display:flex;gap:16px}.nav a{color:var(--green);font-size:13px;font-weight:bold;text-decoration:none}.ey{margin:22px 0 5px;color:var(--muted);font-size:10px;letter-spacing:.15em;font-weight:bold}h1{margin:0;font-size:29px}.intro{color:var(--muted);line-height:1.45;margin:7px 0 17px}.toolbar{display:flex;gap:9px;margin:15px 0}.toolbar select{flex:1}.toolbar select,.expense select{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit}.expenses{display:grid;gap:10px}.expense{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:14px}.expense-head{display:flex;justify-content:space-between;gap:10px}.expense b{font-size:14px}.expense-amount{font-weight:bold;white-space:nowrap}.expense small{display:block;color:var(--muted);margin-top:5px}.expense label{display:block;color:var(--muted);font-size:11px;font-weight:bold;margin-top:12px}.saved{color:var(--green);font-size:11px;min-height:15px;margin-top:7px}.empty{padding:16px;border:1px dashed var(--line);border-radius:14px;color:var(--muted)}@media(max-width:520px){header,main{padding-left:12px;padding-right:12px}.toolbar{flex-direction:column}}
  </style>
  <link rel="stylesheet" href="assets/vendor/lenis.css?v=<?= $v('assets/vendor/lenis.css') ?>">
</head>
<body>
  <header><nav class="nav"><a href="index.php">← Budgets</a><a href="objectives.php">Objectifs</a><a href="pilotage.php">Pilotage</a></nav><p class="ey">LIAISONS</p><h1>Relier dépenses et objectifs.</h1><p class="intro">Associe facultativement chaque dépense à l’action d’objectif qu’elle soutient. Laisse « Aucune action » si elle n’est liée à aucun objectif.</p></header>
  <main><div class="toolbar"><select id="budgetFilter" aria-label="Filtrer par budget"><option value="all">Tous les budgets</option></select><select id="statusFilter" aria-label="Filtrer par statut"><option value="all">Toutes les dépenses</option><option value="planned">Prévues</option><option value="realised">Réalisées</option></select></div><div class="expenses" id="expenses"></div></main>
  <script src="assets/vendor/gsap.min.js?v=<?= $v('assets/vendor/gsap.min.js') ?>"></script>
  <script src="assets/vendor/lenis.min.js?v=<?= $v('assets/vendor/lenis.min.js') ?>"></script>
  <script src="liaison.js?v=<?= $v('liaison.js') ?>"></script>
  <script src="mobile-motion.js?v=<?= $v('mobile-motion.js') ?>"></script>
</body>
</html>
