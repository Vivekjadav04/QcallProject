<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use App\Auth\AuthService;
use MongoDB\BSON\UTCDateTime;

header('Content-Type: application/json');

try { AuthService::check(); } catch (Exception $e) { exit(json_encode(['success'=>false])); }

$db = Database::getInstance();

try {
    // 📅 DATE CALCULATIONS
    $startOfMonth = new UTCDateTime(strtotime('first day of this month 00:00:00') * 1000);

    // 1. MAIN COUNTERS
    $stats = [
        'total_users' => $db->users->countDocuments(),
        'new_users_month' => $db->users->countDocuments(['joinedAt' => ['$gte' => $startOfMonth]]),
        
        'total_reports' => $db->spamreports->countDocuments(),
        'reports_month' => $db->spamreports->countDocuments(['createdAt' => ['$gte' => $startOfMonth]]),

        'total_contacts' => $db->usercontacts->countDocuments(),
        'global_db' => $db->globalnumbers->countDocuments(),
    ];

    // 2. CHART DATA: Risk Distribution (Safe vs Spam)
    $safeCount = $db->globalnumbers->countDocuments(['spamScore' => ['$lt' => 40]]);
    $suspiciousCount = $db->globalnumbers->countDocuments(['spamScore' => ['$gte' => 40, '$lt' => 80]]);
    $dangerCount = $db->globalnumbers->countDocuments(['spamScore' => ['$gte' => 80]]);

    // 3. 🟢 NEW CHART DATA: Report Categories (Grouping by Tag)
    // This counts how many times "Scam", "Spam", "Telemarketing" appear in reports
    $pipeline = [
        ['$group' => ['_id' => '$tag', 'count' => ['$sum' => 1]]],
        ['$sort' => ['count' => -1]], // Highest first
        ['$limit' => 5] // Top 5 categories
    ];
    $tagCounts = $db->spamreports->aggregate($pipeline)->toArray();

    $cat_labels = [];
    $cat_data = [];
    foreach ($tagCounts as $tag) {
        $cat_labels[] = $tag->_id ?? 'Other'; // e.g. "Bank Fraud"
        $cat_data[] = $tag->count;            // e.g. 15
    }

    // 4. TABLE DATA (Global Numbers)
    $cursor = $db->globalnumbers->find([], ['limit' => 10, 'sort' => ['updatedAt' => -1]]);
    $tableData = [];
    foreach($cursor as $doc) {
        $tableData[] = [
            'phone' => $doc->phoneNumber,
            'name' => $doc->likelyName ?? 'Unknown',
            'score' => $doc->spamScore ?? 0,
            'date' => isset($doc->updatedAt) ? $doc->updatedAt->toDateTime()->format('M d') : '-'
        ];
    }

    echo json_encode([
        'success' => true, 
        'stats' => $stats,
        'charts' => [
            'risk' => [$safeCount, $suspiciousCount, $dangerCount],
            'growth' => [12, 19, 3, 5, 2, 3, 15], // Placeholder logic for line chart
            // 🟢 The New Data for your Chart
            'categories' => [
                'labels' => $cat_labels,
                'data' => $cat_data
            ]
        ],
        'table' => $tableData
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}