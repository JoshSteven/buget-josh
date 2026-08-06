<?php
// Copier vers notification-secrets.php, ou exécuter :
// node generate-vapid-keys.cjs mailto:votre-adresse@example.com
return [
    'vapid_public_key' => 'VOTRE_CLE_PUBLIQUE_VAPID',
    'vapid_private_key' => 'VOTRE_CLE_PRIVEE_VAPID',
    'vapid_subject' => 'mailto:votre-adresse@example.com',
];
