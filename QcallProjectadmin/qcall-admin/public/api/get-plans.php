<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
header('Content-Type: application/json');

try {
    $db = Database::getInstance();
    // Fetch active plans from your subscription collection
    $cursor = $db->subscription_plans->find(['status' => 'active']);
    
    $plans = [];
    foreach ($cursor as $p) {
        $plans[] = [
            'plan_name' => $p['plan_name'],
            'features' => (array)($p['features'] ?? [])
        ];
    }
    
    echo json_encode(['success' => true, 'data' => $plans]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'data' => []]);
}