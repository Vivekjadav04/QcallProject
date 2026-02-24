import os

ROOT_DIR = "qcall-admin"

# 🟢 Your Provided MongoDB URI
MONGO_URI = "mongodb+srv://vivekjadav202:ld1ANq6KS9Zh3oTR@cluster0.sosdppr.mongodb.net/?appName=Cluster0"

files = {
    f"{ROOT_DIR}/composer.json": """{
    "require": {
        "mongodb/mongodb": "^1.15",
        "firebase/php-jwt": "^6.10",
        "vlucas/phpdotenv": "^5.6"
    },
    "autoload": {
        "psr-4": {
            "App\\\\": "app/"
        }
    }
}""",

    # 🟢 .ENV with YOUR Credentials
    f"{ROOT_DIR}/.env": f"""DB_URI="{MONGO_URI}"
DB_NAME="qcall_db"
JWT_SECRET="QCALL_SECURE_KEY_2026_CHANGE_ME"
APP_URL="http://localhost:8000"
""",

    # 🟢 DATABASE CONNECTION
    f"{ROOT_DIR}/app/Config/Database.php": """<?php
namespace App\\Config;

require_once __DIR__ . '/../../vendor/autoload.php';

use MongoDB\\Client;
use Dotenv\\Dotenv;

class Database {
    private static $instance = null;
    private $db;

    private function __construct() {
        $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
        $dotenv->load();

        try {
            $client = new Client($_ENV['DB_URI']);
            $this->db = $client->selectDatabase($_ENV['DB_NAME']);
        } catch (\\Exception $e) {
            die("Database Connection Error: " . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance == null) {
            self::$instance = new Database();
        }
        return self::$instance->db;
    }
}
""",

    # 🟢 AUTH SERVICE (REAL DB CHECK)
    f"{ROOT_DIR}/app/Auth/AuthService.php": """<?php
namespace App\\Auth;

use App\\Config\\Database;
use Firebase\\JWT\\JWT;
use Firebase\\JWT\\Key;
use Dotenv\\Dotenv;

class AuthService {
    private $db;
    private $jwt_secret;

    public function __construct() {
        if (!isset($_ENV['JWT_SECRET'])) {
             $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
             $dotenv->load();
        }
        $this->db = Database::getInstance();
        $this->jwt_secret = $_ENV['JWT_SECRET'];
    }

    public function login($email, $password) {
        // 1. Find user in MongoDB
        $user = $this->db->users->findOne(['email' => $email, 'role' => 'admin']);

        if (!$user) {
            return false;
        }

        // 2. Verify Password (using PHP's secure password_verify)
        // Note: The seeder script creates the password using password_hash()
        if (password_verify($password, $user->password)) {
            
            $payload = [
                'iss' => $_ENV['APP_URL'],
                'iat' => time(),
                'exp' => time() + (60*60*4), // 4 Hours
                'data' => [
                    'id' => (string)$user->_id,
                    'email' => $user->email,
                    'role' => 'admin'
                ]
            ];

            return JWT::encode($payload, $this->jwt_secret, 'HS256');
        }
        return false;
    }

    public static function check() {
        if (session_status() === PHP_SESSION_NONE) session_start();

        if (!isset($_SESSION['auth_token'])) {
            header("Location: index.php");
            exit();
        }

        if (!isset($_ENV['JWT_SECRET'])) {
             $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
             $dotenv->load();
        }

        try {
            $decoded = JWT::decode($_SESSION['auth_token'], new Key($_ENV['JWT_SECRET'], 'HS256'));
            return $decoded->data;
        } catch (\\Exception $e) {
            header("Location: logout.php");
            exit();
        }
    }
}
""",

    # 🟢 SEED SCRIPT (Create Admin User)
    f"{ROOT_DIR}/seed_admin.php": """<?php
require 'vendor/autoload.php';

use App\\Config\\Database;

echo "🌱 Seeding Admin User...\\n";

$db = Database::getInstance();
$users = $db->users;

$email = 'admin@qcall.com';
$password = 'admin123'; // The password you will use to login

// Check if exists
$exists = $users->findOne(['email' => $email]);

if ($exists) {
    echo "⚠️  Admin already exists!\\n";
} else {
    $result = $users->insertOne([
        'firstName' => 'Super',
        'lastName' => 'Admin',
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT), // Secure Hash
        'role' => 'admin',
        'createdAt' => new MongoDB\\BSON\\UTCDateTime()
    ]);
    echo "✅ Admin Created!\\n";
    echo "👉 User: admin@qcall.com\\n";
    echo "👉 Pass: admin123\\n";
}
""",

    # 🟢 API: LOGIN
    f"{ROOT_DIR}/public/api/login.php": """<?php
require_once __DIR__ . '/../../app/Auth/AuthService.php';
use App\\Auth\\AuthService;

header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['email']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'message' => 'Missing credentials']);
    exit;
}

$auth = new AuthService();
$token = $auth->login($input['email'], $input['password']);

if ($token) {
    session_start();
    $_SESSION['auth_token'] = $token;
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
}
""",

    # 🟢 API: STATS
    f"{ROOT_DIR}/public/api/stats.php": """<?php
require_once __DIR__ . '/../../app/Config/Database.php';
require_once __DIR__ . '/../../app/Auth/AuthService.php';
use App\\Config\\Database;
use App\\Auth\\AuthService;

header('Content-Type: application/json');

try {
    AuthService::check(); 
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = Database::getInstance();
$action = $_GET['action'] ?? 'stats';

if ($action === 'stats') {
    echo json_encode([
        'success' => true,
        'data' => [
            'users' => $db->users->countDocuments(),
            'spam' => $db->spamreports->countDocuments(),
            'high_risk' => $db->globalnumbers->countDocuments(['spamScore' => ['$gte' => 80]])
        ]
    ]);
} elseif ($action === 'recent_spam') {
    $reports = $db->spamreports->find([], ['limit' => 5, 'sort' => ['createdAt' => -1]]);
    $data = [];
    foreach($reports as $r) {
        $data[] = [
            'phoneNumber' => $r->phoneNumber,
            'tag' => $r->tag,
            'date' => $r->createdAt->toDateTime()->format('M d, Y')
        ];
    }
    echo json_encode(['success' => true, 'data' => $data]);
}
""",

    # 🟢 UI: AJAX LOGIC
    f"{ROOT_DIR}/public/assets/js/app.js": """
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`api/${endpoint}`, options);
        return await response.json();
    } catch (error) {
        return { success: false, message: "Network Error" };
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('alertMsg');
    
    msg.classList.add('d-none');
    
    const result = await apiCall('login.php', 'POST', { email, password });
    
    if (result.success) {
        window.location.href = 'dashboard.php';
    } else {
        msg.textContent = result.message;
        msg.classList.remove('d-none');
    }
}

async function loadDashboardStats() {
    const result = await apiCall('stats.php');
    if (result.success) {
        if(document.getElementById('count-users')) document.getElementById('count-users').innerText = result.data.users;
        if(document.getElementById('count-spam')) document.getElementById('count-spam').innerText = result.data.spam;
        if(document.getElementById('count-risk')) document.getElementById('count-risk').innerText = result.data.high_risk;
    }
}

async function loadRecentSpam() {
    const tableBody = document.getElementById('spam-table-body');
    if (!tableBody) return;
    const result = await apiCall('stats.php?action=recent_spam');
    if (result.success && result.data.length > 0) {
        tableBody.innerHTML = result.data.map(r => `<tr><td class='fw-bold'>${r.phoneNumber}</td><td>${r.tag || 'Spam'}</td><td>${r.date}</td><td><button class='btn btn-sm btn-danger'>Block</button></td></tr>`).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No Data</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (document.getElementById('stats-row')) { loadDashboardStats(); loadRecentSpam(); }
});
""",

    # 🟢 UI: LOGIN PAGE
    f"{ROOT_DIR}/public/index.php": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>QCall Admin Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-dark d-flex align-items-center justify-content-center vh-100">
    <div class="card p-4 shadow-lg" style="width: 400px;">
        <h3 class="text-center mb-4">QCall Admin</h3>
        <div id="alertMsg" class="alert alert-danger d-none"></div>
        <form id="loginForm">
            <div class="mb-3">
                <label>Email</label>
                <input type="email" id="email" class="form-control" placeholder="admin@qcall.com" required>
            </div>
            <div class="mb-3">
                <label>Password</label>
                <input type="password" id="password" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-primary w-100">Sign In</button>
        </form>
    </div>
    <script src="assets/js/app.js"></script>
</body>
</html>
""",

    # 🟢 UI: DASHBOARD PAGE
    f"{ROOT_DIR}/public/dashboard.php": """<?php
require_once __DIR__ . '/../app/Auth/AuthService.php';
use App\\Auth\\AuthService;
$user = AuthService::check(); 
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Dashboard | QCall</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <nav class="navbar navbar-dark bg-dark px-4">
        <a class="navbar-brand" href="#">QCall Panel</a>
        <div class="ms-auto text-white">
            <span class="me-3"><?= htmlspecialchars($user->email) ?></span>
            <a href="logout.php" class="btn btn-sm btn-danger">Logout</a>
        </div>
    </nav>
    <div class="container py-4">
        <div class="row" id="stats-row">
            <div class="col-md-4"><div class="card bg-primary text-white mb-3"><div class="card-body"><h5>Total Users</h5><h2 id="count-users">...</h2></div></div></div>
            <div class="col-md-4"><div class="card bg-danger text-white mb-3"><div class="card-body"><h5>Spam Reports</h5><h2 id="count-spam">...</h2></div></div></div>
            <div class="col-md-4"><div class="card bg-warning text-dark mb-3"><div class="card-body"><h5>High Risk Numbers</h5><h2 id="count-risk">...</h2></div></div></div>
        </div>
        <div class="card mt-4"><div class="card-header">Recent Reports</div><div class="card-body"><table class="table"><thead><tr><th>Number</th><th>Tag</th><th>Date</th><th>Action</th></tr></thead><tbody id="spam-table-body"><tr><td colspan="4" class="text-center">Loading...</td></tr></tbody></table></div></div>
    </div>
    <script src="assets/js/app.js"></script>
</body>
</html>
""",

    f"{ROOT_DIR}/public/logout.php": """<?php
session_start();
session_destroy();
header("Location: index.php");
exit();
"""
}

# Generate Files
print(f"🚀 Generating Admin Panel in {ROOT_DIR}...")
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ Created: {path}")

print("\\n🎉 Files Generated!")
"""

# Instructions for user
print("-" * 50)
print("👉 STEP 3: RUN THESE COMMANDS IN TERMINAL:")
print(f"   cd {ROOT_DIR}")
print("   composer install")
print("   php seed_admin.php   <-- This creates the Admin User in MongoDB")
print("   php -S localhost:8000 -t public")
print("-" * 50)
"""