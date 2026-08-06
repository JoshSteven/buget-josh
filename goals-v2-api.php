<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
function goalFail(string $message,int $status=422):never{http_response_code($status);echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE);exit;}
function goalBody():array{try{$data=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);return is_array($data)?$data:[];}catch(Throwable){goalFail('Données invalides.');}}
function validGoalDate(string $date):bool{$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);return $parsed!==false&&$parsed->format('Y-m-d')===$date&&$date>='2026-07-01';}
try{
  $config=require __DIR__.'/config.php';
  $pdo=new PDO("mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $action=(string)($_GET['action']??'');
  if($_SERVER['REQUEST_METHOD']==='GET'){
    $tracks=$pdo->query('SELECT id,title,category FROM goal_tracks ORDER BY created_at')->fetchAll(PDO::FETCH_ASSOC);
    $tasks=$pdo->query("SELECT id,track_id,goal_month,DATE_FORMAT(target_date,'%Y-%m-%d') target_date,title,status,DATEDIFF(target_date,CURDATE()) days_remaining FROM goal_tasks ORDER BY COALESCE(target_date,CONCAT(goal_month,'-28')),created_at")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(compact('tracks','tasks'),JSON_UNESCAPED_UNICODE);exit;
  }
  if($_SERVER['REQUEST_METHOD']!=='POST')goalFail('Méthode non autorisée.',405);
  $data=goalBody();
  if($action==='track'){
    $title=trim((string)($data['title']??''));$category=trim((string)($data['category']??''));
    if($title===''||mb_strlen($title)>160)goalFail('Le nom de l’objectif est obligatoire et limité à 160 caractères.');
    if(mb_strlen($category)>80)goalFail('La catégorie est limitée à 80 caractères.');
    $pdo->prepare('INSERT INTO goal_tracks(id,title,category) VALUES(?,?,?)')->execute([$data['id'],$title,$category!==''?$category:null]);
  }elseif($action==='track_update'){
    $title=trim((string)($data['title']??''));$category=trim((string)($data['category']??''));
    if($title===''||mb_strlen($title)>160||mb_strlen($category)>80)goalFail('Nom ou catégorie invalide.');
    $q=$pdo->prepare('UPDATE goal_tracks SET title=?,category=? WHERE id=?');$q->execute([$title,$category!==''?$category:null,$data['id']]);if(!$q->rowCount()){ $exists=$pdo->prepare('SELECT id FROM goal_tracks WHERE id=?');$exists->execute([$data['id']]);if(!$exists->fetchColumn())goalFail('Objectif introuvable.',404); }
  }elseif($action==='track_delete'){
    $q=$pdo->prepare('DELETE FROM goal_tracks WHERE id=?');$q->execute([$data['id']]);if(!$q->rowCount())goalFail('Objectif introuvable.',404);
  }elseif($action==='task'||$action==='task_update'){
    $title=trim((string)($data['title']??''));$target=(string)($data['target_date']??'');
    if($title===''||mb_strlen($title)>200)goalFail('Le sous-objectif est obligatoire et limité à 200 caractères.');
    if(!validGoalDate($target))goalFail('Choisissez une date cible valide à partir de juillet 2026.');
    if($action==='task'){
      $track=(string)($data['track_id']??'');$check=$pdo->prepare('SELECT id FROM goal_tracks WHERE id=?');$check->execute([$track]);if(!$check->fetchColumn())goalFail('Objectif global introuvable.',404);
      $pdo->prepare('INSERT INTO goal_tasks(id,track_id,goal_month,target_date,title) VALUES(?,?,?,?,?)')->execute([$data['id'],$track,substr($target,0,7),$target,$title]);
    }else{
      $q=$pdo->prepare('UPDATE goal_tasks SET title=?,target_date=?,goal_month=? WHERE id=?');$q->execute([$title,$target,substr($target,0,7),$data['id']]);if(!$q->rowCount()){ $exists=$pdo->prepare('SELECT id FROM goal_tasks WHERE id=?');$exists->execute([$data['id']]);if(!$exists->fetchColumn())goalFail('Sous-objectif introuvable.',404); }
    }
  }elseif($action==='task_delete'){
    $q=$pdo->prepare('DELETE FROM goal_tasks WHERE id=?');$q->execute([$data['id']]);if(!$q->rowCount())goalFail('Sous-objectif introuvable.',404);
  }else goalFail('Action inconnue.',404);
  echo json_encode(['ok'=>true],JSON_UNESCAPED_UNICODE);
}catch(PDOException $error){if($error->getCode()==='23000')goalFail('Cet élément existe déjà ou est encore utilisé.');goalFail('Impossible de traiter la demande.',500);}catch(Throwable){goalFail('Impossible de traiter la demande.',500);}
