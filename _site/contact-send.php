<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '{}', true);
if (!is_array($data)) {
    $data = $_POST;
}

$name = trim((string)($data['name'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$message = trim((string)($data['message'] ?? ''));
$website = trim((string)($data['website'] ?? ''));

if ($website !== '') {
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($message === '' || mb_strlen($message) < 5) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Wiadomość jest za krótka.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Nieprawidłowy adres e-mail.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (mb_strlen($name) > 120 || mb_strlen($email) > 190 || mb_strlen($message) > 8000) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Dane są zbyt długie.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$to = 'fitpo50tce@gmail.com';
$subject = 'Kontakt z formularza FitPo50' . ($name !== '' ? ' - ' . $name : '');
$lines = [
    'Źródło: fitpo50.pl/o-mnie.html',
    'Data: ' . date('Y-m-d H:i:s'),
];
if ($name !== '') {
    $lines[] = 'Imię: ' . $name;
}
if ($email !== '') {
    $lines[] = 'E-mail: ' . $email;
}
$lines[] = '';
$lines[] = 'Wiadomość:';
$lines[] = $message;
$body = implode("\n", $lines);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: FitPo50 <no-reply@fitpo50.pl>',
    'Reply-To: ' . ($email !== '' ? $email : 'fitpo50tce@gmail.com'),
];

$sent = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Wysyłka nie powiodła się.'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);

