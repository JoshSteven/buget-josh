<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/goal-reminder-service.php';
function notificationFail(string $message, int $status = 422): never { http_response_code($status); echo json_encode(['error'=>$message], JSON_UNESCAPED_UNICODE); exit; }
function notificationBody(): array { try { $data=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR); return is_array($data)?$data:[]; } catch(Throwable) { notificationFail('Données invalides.'); } }

try {
    $config=require __DIR__.'/config.php';$notificationConfig=is_file(__DIR__.'/notification-secrets.php')?require __DIR__.'/notification-secrets.php':[];
    $pdo=new PDO("mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $action=(string)($_GET['action']??'reminders');
    if($_SERVER['REQUEST_METHOD']==='GET') {
        if($action==='config') {
            $public=(string)(getenv('BUDGET_JOSH_VAPID_PUBLIC_KEY')?:($notificationConfig['vapid_public_key']??($config['vapid_public_key']??'')));
            echo json_encode(['available'=>$public!=='','publicKey'=>$public],JSON_UNESCAPED_UNICODE);exit;
        }
        materializeGoalReminders($pdo);
        $rows=$pdo->query("SELECT r.id,r.reminder_type,r.due_date,r.read_at,t.id task_id,t.title task_title,t.target_date,g.id track_id,g.title track_title,DATEDIFF(t.target_date,CURDATE()) days_remaining FROM goal_reminders r JOIN goal_tasks t ON t.id=r.task_id JOIN goal_tracks g ON g.id=t.track_id ORDER BY (r.read_at IS NULL) DESC,r.due_date DESC,r.created_at DESC LIMIT 50")->fetchAll(PDO::FETCH_ASSOC);
        foreach($rows as &$row){$message=goalReminderMessage($row['reminder_type'],$row['task_title'],$row['track_title'],max(0,(int)$row['days_remaining']));$row+=$message;}unset($row);
        echo json_encode(['reminders'=>$rows,'unread'=>count(array_filter($rows,fn($r)=>$r['read_at']===null))],JSON_UNESCAPED_UNICODE);exit;
    }
    if($_SERVER['REQUEST_METHOD']!=='POST')notificationFail('Méthode non autorisée.',405);
    $data=notificationBody();
    if($action==='read') {
        $id=(string)($data['id']??'');if($id==='')notificationFail('Rappel introuvable.');
        $q=$pdo->prepare('UPDATE goal_reminders SET read_at=COALESCE(read_at,NOW()) WHERE id=?');$q->execute([$id]);if(!$q->rowCount())notificationFail('Rappel introuvable.',404);
    } elseif($action==='subscribe') {
        $endpoint=(string)($data['endpoint']??'');$keys=$data['keys']??[];$p256dh=(string)($keys['p256dh']??'');$auth=(string)($keys['auth']??'');
        if($endpoint===''||strlen($endpoint)>2048||parse_url($endpoint,PHP_URL_SCHEME)!=='https'||$p256dh===''||$auth==='')notificationFail('Abonnement push invalide.');
        $q=$pdo->prepare('INSERT INTO push_subscriptions(id,endpoint_hash,endpoint,p256dh,auth_token,content_encoding) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint),p256dh=VALUES(p256dh),auth_token=VALUES(auth_token),content_encoding=VALUES(content_encoding),updated_at=NOW()');
        $q->execute([goalUuid(),hash('sha256',$endpoint),$endpoint,$p256dh,$auth,(string)($data['contentEncoding']??'aes128gcm')]);
    } elseif($action==='unsubscribe') {
        $endpoint=(string)($data['endpoint']??'');if($endpoint==='')notificationFail('Abonnement introuvable.');
        $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([hash('sha256',$endpoint)]);
    } else notificationFail('Action inconnue.',404);
    echo json_encode(['ok'=>true],JSON_UNESCAPED_UNICODE);
} catch(Throwable $error) { notificationFail('Impossible de gérer les notifications.',500); }
