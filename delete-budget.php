<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
try {
  $data=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
  if(empty($data['id'])) throw new RuntimeException('Budget manquant.');
  $c=require __DIR__.'/config.php';
  $pdo=new PDO("mysql:host={$c['host']};dbname={$c['database']};charset=utf8mb4",$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $q=$pdo->prepare('DELETE FROM budgets WHERE id=?');$q->execute([$data['id']]);
  if($q->rowCount()===0) throw new RuntimeException('Budget introuvable.');
  echo json_encode(['ok'=>true]);
} catch(Throwable $e) { http_response_code(422); echo json_encode(['error'=>$e->getMessage()]); }
