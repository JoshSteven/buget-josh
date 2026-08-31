# Objectifs datés et notifications

## Mise en production

1. Sauvegarder la base MySQL.
2. Exécuter `database/lot-5-objectives-notifications.sql` après les lots 2 et 4.
3. Installer les dépendances PHP :

   ```bash
   php composer.phar install --no-dev --optimize-autoloader
   ```

4. Générer les clés VAPID sur une machine sûre :

   ```bash
   node generate-vapid-keys.cjs mailto:admin@brightlightmind.online
   ```

5. Copier `notification-secrets.php` sur le serveur à la racine de l’application. Ce fichier contient la clé privée et ne doit jamais être ajouté à Git.
6. Dans cPanel, créer une tâche Cron quotidienne, par exemple à 08:00 heure de Ouagadougou :

   ```bash
   php -q /home/UTILISATEUR/public_html/CHEMIN/cron-goal-reminders.php
   ```

7. Tester d’abord le Cron sans envoi :

   ```bash
   php -q /home/UTILISATEUR/public_html/CHEMIN/cron-goal-reminders.php --dry-run
   ```

## Rythme

- rappel de suivi chaque lundi lorsqu’il reste plus de sept jours ;
- rappel dédié à J−7 ;
- rappel dédié à J−1 ;
- aucun nouveau rappel après l’échéance.

Les rappels sont dédupliqués par sous-objectif, type et date. Le centre de notifications interne fonctionne même sans autorisation système. Le Web Push nécessite HTTPS, une autorisation accordée par l’utilisateur, les clés VAPID et le Cron serveur.

## Diagnostic depuis l’application

Dans **Mes objectifs → Rappels** :

1. choisir **Activer les notifications** sur l’appareil concerné ;
2. accepter l’autorisation du navigateur ;
3. choisir **Tester maintenant** sans attendre une échéance ;
4. vérifier que la notification « Test Budget Josh » apparaît.

Le test échoue explicitement si l’appareil n’est pas enregistré, si les clés VAPID sont absentes, si l’abonnement a expiré ou si le service Push refuse le message. Un abonnement expiré est retiré de la base et doit être recréé avec **Activer les notifications**.

Le test immédiat valide l’abonnement, VAPID, la bibliothèque PHP, le service Push et le Service Worker. Il ne valide pas le déclenchement automatique du Cron, qui doit être vérifié séparément avec `--dry-run`, puis par un passage réel à une date de rappel.

## Fichiers sensibles

- `config.php` : identifiants MySQL, ignoré par Git ;
- `notification-secrets.php` : clés VAPID, ignoré par Git ;
- `notification-secrets.example.php` : exemple sans secret, versionné.
