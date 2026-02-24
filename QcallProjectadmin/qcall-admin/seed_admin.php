<?php
require 'vendor/autoload.php';

use App\Config\Database;

$db = Database::getInstance();

$email = 'admin@qcall.com';
$password = 'admin'; // Default password

// 1. Check if admin exists
$existing = $db->admins->findOne(['email' => $email]);

if ($existing) {
    // Update existing password
    $db->admins->updateOne(
        ['email' => $email],
        ['$set' => ['password' => password_hash($password, PASSWORD_DEFAULT)]]
    );
    echo "✅ Updated existing Admin password.\n";
} else {
    // Create new Admin
    $db->admins->insertOne([
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'role' => 'super_admin',
        'createdAt' => new MongoDB\BSON\UTCDateTime()
    ]);
    echo "🎉 Created new Admin account.\n";
}

echo "---------------------------------\n";
echo "📧 Email: $email\n";
echo "🔑 Pass:  $password\n";
echo "---------------------------------\n";