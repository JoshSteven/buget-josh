<?php
declare(strict_types=1); header('Content-Type: application/json; charset=utf-8');
try {
  $d=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
  if(empty($d['id']) || !in_array($d['status']??'', ['planned','realised','cancelled'],true)) throw new RuntimeException('Statut invalide.');
  $c=require __DIR__.'/config.php'; $pdo=new PDO("mysql:host={$c['host']};dbname={$c['database']};charset=utf8mb4",$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $pdo->prepare('UPDATE entries SET status=? WHERE id=?')->execute([$d['status'],$d['id']]);
  echo json_encode(['ok'=>true]);
} catch(Throwable $e) { http_response_code(422); echo json_encode(['error'=>$e->getMessage()]); }
