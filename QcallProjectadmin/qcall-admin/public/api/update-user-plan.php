<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['user_id']) || !isset($data['plan_name'])) {
    exit(json_encode(['success' => false, 'message' => 'Missing required data']));
}

try {
    $db = Database::getInstance();
    $features = [];

    // 1. Fetch features from the Master Plan document
    if ($data['plan_name'] !== 'Free') {
        $plan = $db->subscription_plans->findOne(['plan_name' => $data['plan_name']]);
        if ($plan && isset($plan['features'])) {
            $features = (array)$plan['features'];
        }
    }

    // 2. Sync everything to the User document
    $db->users->updateOne(
        ['_id' => new ObjectId($data['user_id'])],
        ['$set' => [
            'accountType' => $data['plan_name'],
            'subscription' => [
                'planName' => $data['plan_name'],
                'status' => $data['status'],
                'activeFeatures' => $features, // 🟢 AUTO-SYNCED FEATURES
                'updatedAt' => new UTCDateTime()
            ]
        ]]
    );

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}