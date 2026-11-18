#!/usr/bin/env bash
# Deploiement Budget Josh, execute SUR LE SERVEUR par deploy.ps1 (via SSH).
# Remplace les clics cPanel : Update from Remote + Deploy HEAD Commit + etapes manuelles.
#   --dry-run : montre ce qui serait fait, sans rien modifier.
# Texte volontairement sans accents : il transite par le terminal Windows.
set -euo pipefail

SITE="$HOME/depensesjosh.brightlightmind.online"
REPO="$HOME/repositories/buget-josh"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
step() { printf '\n== %s\n' "$1"; }

step "1/7 Depot cPanel : recuperation de GitHub"
cd "$REPO"
git fetch --quiet origin master
BEFORE=$(git rev-parse --short HEAD)
AFTER=$(git rev-parse --short origin/master)
echo "Production actuelle : $BEFORE  ->  cible : $AFTER"
git log --oneline "$BEFORE..origin/master" | sed 's/^/  + /' || true
if [ "$DRY" = 1 ]; then
  step "Simulation : migrations en attente sur la cible"
  for f in $(git diff --name-only "$BEFORE" origin/master -- database/ | grep -E '^database/lot-.*\.sql$' || true); do echo "  nouveau fichier : $f"; done
  (cd "$SITE" && php bin/migrate.php --dry-run 2>/dev/null || echo "  (bin/migrate.php pas encore deploye)")
  echo; echo "SIMULATION TERMINEE : rien n'a ete modifie."
  exit 0
fi
git merge --ff-only --quiet origin/master

step "2/7 Copie des fichiers vers le site (comme .cpanel.yml)"
/usr/bin/rsync -r --exclude=.git --exclude=.cpanel.yml --exclude=/.htaccess "$REPO/" "$SITE/" | tail -1 || true
[ -f "$SITE/.htaccess" ] || { echo "ALERTE : .htaccess racine absent du site !"; exit 3; }

step "3/7 Bibliotheques PHP (composer)"
cd "$SITE"
composer install --no-dev --optimize-autoloader --no-interaction --quiet
echo "OK"

step "4/7 Sauvegarde de la base avant migration"
php bin/backup-database.php --label=deploy

step "5/7 Migrations"
php bin/migrate.php

step "6/7 Controle des Cron (simulation)"
php -q cron-recurring-expenses.php --dry-run | tr -d '\n' ; echo
php -q cron-goal-reminders.php --dry-run | tr -d '\n' ; echo

step "7/7 Sauvegarde automatique de chaque nuit (Cron)"
LINE="30 2 * * * php -q $SITE/bin/backup-database.php >/dev/null 2>&1"
if crontab -l 2>/dev/null | grep -qF "bin/backup-database.php"; then
  echo "Deja en place."
else
  (crontab -l 2>/dev/null; echo "$LINE") | crontab -
  echo "Ajoutee : chaque nuit a 2 h 30 (heure serveur)."
fi

echo
echo "DEPLOYE : $(git -C "$REPO" rev-parse --short HEAD)"
