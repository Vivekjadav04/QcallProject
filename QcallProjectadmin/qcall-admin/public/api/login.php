<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use Firebase\JWT\JWT;

header('Content-Type: application/json');

// 1. Get Input
$input = json_decode(file_get_contents('php://input'), true);
$email = $input['email'] ?? '';
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Email and Password are required']);
    exit;
}

// 2. Connect DB
$db = Database::getInstance();

// 3. Find Admin in 'admins' Collection (NOT users)
$admin = $db->admins->findOne(['email' => $email]);

if (!$admin) {
    echo json_encode(['success' => false, 'message' => 'Admin account not found.']);
    exit;
}

// 4. Verify Password
if (password_verify($password, $admin->password)) {
    
    // 5. Generate Token
    $payload = [
        'iss' => 'qcall-admin',
        'sub' => (string)$admin->_id,
        'email' => $admin->email,
        'role' => 'super_admin',
        'iat' => time(),
        'exp' => time() + (60 * 60 * 24) // 24 hours
    ];
    
    $jwt = JWT::encode($payload, $_ENV['JWT_SECRET'] ?? 'secret_key', 'HS256');

    // 🟢 CRITICAL: Set Cookie (So Dashboard can read it)
    setcookie("auth_token", $jwt, [
        'expires' => time() + 86400,
        'path' => '/',
        'domain' => '', 
        'secure' => false, // Set true if using HTTPS
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    echo json_encode(['success' => true]);

} else {
    echo json_encode(['success' => false, 'message' => 'Invalid password.']);
}