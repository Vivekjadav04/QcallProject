<?php
namespace App\Auth;

use App\Config\Database;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Dotenv\Dotenv;

class AuthService {
    private $db;
    private $jwt_secret;

    public function __construct() {
        // Load Env if not loaded
        if (!isset($_ENV['JWT_SECRET'])) {
             $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
             $dotenv->load();
        }
        $this->db = Database::getInstance();
        $this->jwt_secret = $_ENV['JWT_SECRET'] ?? 'secret_key';
    }

    // 🟢 1. LOGIN METHOD (Updated to use 'admins' collection)
    public function login($email, $password) {
        // Look in 'admins' collection, NOT 'users'
        $admin = $this->db->admins->findOne(['email' => $email]);

        if (!$admin) {
            return false;
        }

        // Verify Hash
        if (password_verify($password, $admin->password)) {
            
            $payload = [
                'iss' => 'qcall-admin',
                'iat' => time(),
                'exp' => time() + (60 * 60 * 24), // 24 Hours
                'data' => [
                    'id' => (string)$admin->_id,
                    'email' => $admin->email,
                    'role' => 'admin'
                ]
            ];

            return JWT::encode($payload, $this->jwt_secret, 'HS256');
        }
        return false;
    }

    // 🟢 2. CHECK METHOD (Updated to read COOKIE)
    public static function check() {
        // A. Check for Cookie (Preferred)
        if (isset($_COOKIE['auth_token'])) {
            $token = $_COOKIE['auth_token'];
        } 
        // B. Check for Session (Fallback)
        elseif (isset($_SESSION['auth_token'])) {
            $token = $_SESSION['auth_token'];
        } 
        // C. Neither found -> Redirect
        else {
            self::redirect('index.php');
        }

        // Ensure Secret is Loaded
        if (!isset($_ENV['JWT_SECRET'])) {
             $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
             $dotenv->load();
        }

        try {
            // D. Decode & Verify
            $key = $_ENV['JWT_SECRET'] ?? 'secret_key';
            $decoded = JWT::decode($token, new Key($key, 'HS256'));

            // E. Return User Object (Standardized)
            // We handle both structure formats (direct properties or inside 'data')
            if (isset($decoded->data)) {
                return $decoded->data;
            } else {
                return (object) [
                    'id' => $decoded->sub ?? $decoded->id,
                    'email' => $decoded->email,
                    'role' => $decoded->role ?? 'admin'
                ];
            }

        } catch (\Exception $e) {
            // Token Invalid -> Logout
            self::logout();
        }
    }

    public static function redirect($url) {
        if (!headers_sent()) {
            header("Location: $url");
            exit();
        }
        echo "<script>window.location.href='$url';</script>";
        exit();
    }

    public static function logout() {
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
        setcookie("auth_token", "", time() - 3600, "/");
        self::redirect('index.php');
    }
}