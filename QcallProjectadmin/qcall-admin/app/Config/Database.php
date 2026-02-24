<?php
namespace App\Config;

require_once __DIR__ . '/../../vendor/autoload.php';

use MongoDB\Client;
use Dotenv\Dotenv;

class Database {
    private static $instance = null;
    private $db;

    private function __construct() {
        $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
        $dotenv->load();

        try {
            // 🟢 FORCE "test" DATABASE
            // Your .env might say "qcall_db", but this overrides it to match your screenshot
            $dbName = "test"; 

            $client = new Client($_ENV['DB_URI']);
            $this->db = $client->selectDatabase($dbName);
            
        } catch (\Exception $e) {
            die(json_encode(['success' => false, 'message' => "DB Connection Failed: " . $e->getMessage()]));
        }
    }

    public static function getInstance() {
        if (self::$instance == null) {
            self::$instance = new Database();
        }
        return self::$instance->db;
    }
}