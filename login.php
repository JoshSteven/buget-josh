<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';

// Déjà connecté : on ne montre pas l'écran de connexion.
if (budgetSessionIsValid()) {
    header('Location: index.php', true, 302);
    exit;
}

$configured = budgetHasPassword();

/**
 * Empêche une redirection ouverte : on n'accepte qu'un chemin interne.
 * « //evil.com » et « https://evil.com » sont rejetés.
 */
function budgetSafeNext(string $raw): string
{
    $path = parse_url($raw, PHP_URL_PATH) ?: '';
    if ($path === '' || $path[0] !== '/' || str_starts_with($path, '//')) return 'index.php';
    $file = basename($path);
    $allowed = ['index.php', 'objectives.php', 'objectives-v2.php', 'liaison.php', 'pilotage.php'];
    return in_array($file, $allowed, true) ? $file : 'index.php';
}

$next = budgetSafeNext((string) ($_GET['next'] ?? 'index.php'));
$v = static fn(string $file): int => @filemtime(__DIR__ . '/' . $file) ?: time();
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#123b35">
<meta name="robots" content="noindex,nofollow">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<title>Connexion — Budget Josh</title>
<style>
:root{--ink:#123b35;--paper:#f5f3ed;--card:#fffefa;--line:#dbe2da;--green:#197451;--green-soft:#e2f3e8;--muted:#526b65;--red:#bd4934;--red-soft:#f9e4de}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px 18px calc(24px + env(safe-area-inset-bottom));color:var(--ink);font:15px Arial,sans-serif;background:radial-gradient(circle at -6% 78%,#f5cfc5 0 11%,transparent 11.3%),radial-gradient(circle at 104% 16%,#d9eedf 0 15%,transparent 15.3%),var(--paper)}
button,input{font:inherit}
.shell{width:min(410px,100%)}
.brand{display:flex;align-items:center;gap:11px;margin-bottom:22px}
.brand img{width:52px;height:52px;border-radius:16px}
.brand span{display:block}
.brand small{display:block;color:var(--muted);font-size:10px;letter-spacing:.15em;font-weight:bold}
.brand b{display:block;font-size:20px;letter-spacing:-.4px}
.card{background:#fffefaf5;border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:0 18px 46px #123b3518;backdrop-filter:blur(8px)}
h1{margin:0 0 5px;font-size:25px;letter-spacing:-.6px}
.intro{margin:0 0 19px;color:var(--muted);font-size:13px;line-height:1.45}
label{display:block;font-size:12px;color:var(--muted);font-weight:bold}
.field{position:relative;margin-top:7px}
input{width:100%;padding:15px 52px 15px 14px;border:1px solid var(--line);border-radius:13px;background:#fff;color:var(--ink);font-size:16px}
input:focus{outline:2px solid var(--green);outline-offset:1px}
.reveal{position:absolute;right:5px;top:50%;translate:0 -50%;width:44px;height:44px;border:0;border-radius:11px;background:transparent;color:var(--muted);font-size:17px;cursor:pointer}
.submit{width:100%;min-height:52px;margin-top:15px;border:0;border-radius:14px;background:var(--ink);color:#fff;font-size:15px;font-weight:bold;cursor:pointer}
.submit:disabled{opacity:.6;cursor:progress}
.submit:active:not(:disabled){transform:scale(.985)}
.msg{margin-top:14px;padding:12px 13px;border-radius:12px;font-size:12.5px;line-height:1.45}
.msg[hidden]{display:none}
.msg.error{background:var(--red-soft);color:#8d2f1e}
.msg.info{background:var(--green-soft);color:#14603f}
.hint{margin:16px 2px 0;color:var(--muted);font-size:11.5px;line-height:1.5}
code{background:#eaeee9;border-radius:5px;padding:1px 5px;font-size:11px;word-break:break-all}
@media(max-width:380px){.card{padding:18px}h1{font-size:22px}}
</style>
</head>
<body>
<div class="shell">
  <div class="brand"><img src="icon-192.png" alt=""><span><small>BUDGET JOSH</small><b>Vos budgets, vos objectifs.</b></span></div>
  <div class="card">
<?php if (!$configured): ?>
    <h1>Configuration requise</h1>
    <p class="intro">Aucun mot de passe n’a encore été défini. L’application reste fermée tant que ce n’est pas fait.</p>
    <p class="hint">Depuis le Terminal cPanel, lancez&nbsp;: <code>php set-password.php</code><br>Le mot de passe est saisi directement sur le serveur — il ne transite ni par un fichier, ni par Git.</p>
<?php else: ?>
    <h1>Connexion</h1>
    <p class="intro">Cet appareil restera connecté pendant 90 jours. Vous n’aurez pas à retaper votre mot de passe à chaque ouverture.</p>
    <form id="loginForm" novalidate>
      <label for="password">Mot de passe</label>
      <div class="field">
        <input id="password" name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required>
        <button class="reveal" id="reveal" type="button" aria-label="Afficher le mot de passe">👁</button>
      </div>
      <button class="submit" id="submit" type="submit">Ouvrir mon budget</button>
      <div class="msg error" id="message" role="alert" hidden></div>
    </form>
<?php endif; ?>
  </div>
</div>
<script>window.__BUDGET_NEXT = <?= json_encode($next, JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="login.js?v=<?= $v('login.js') ?>"></script>
</body>
</html>
