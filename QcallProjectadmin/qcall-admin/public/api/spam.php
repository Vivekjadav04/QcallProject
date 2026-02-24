<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use App\Auth\AuthService;
use MongoDB\BSON\Regex;

header('Content-Type: application/json');

try { AuthService::check(); } catch (Exception $e) { exit(json_encode(['success'=>false, 'message'=>'Unauthorized'])); }

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];

// 🟢 GET SPAM NUMBERS (Paginated & Filtered)
if ($method === 'GET') {
    $filter = [];
    
    // Filter: High Risk Only (> 60 Score)
    if (isset($_GET['filter']) && $_GET['filter'] === 'high_risk') {
        $filter['spamScore'] = ['$gte' => 60];
    }
    
    // Search Functionality
    if (!empty($_GET['search'])) {
        $filter['$or'] = [
            ['phoneNumber' => new Regex($_GET['search'], 'i')],
            ['likelyName' => new Regex($_GET['search'], 'i')]
        ];
    }

    // Fetch maximum 50 at a time to prevent crashing
    $cursor = $db->globalnumbers->find($filter, [
        'limit' => 50, 
        'sort' => ['spamScore' => -1] // Show highest risk first
    ]);

    $data = [];
    foreach ($cursor as $doc) {
        $data[] = [
            'id' => (string)$doc->_id,
            'phone' => $doc->phoneNumber,
            'name' => $doc->likelyName ?? 'Unknown',
            'score' => $doc->spamScore ?? 0,
            'location' => $doc->location ?? 'Unknown',
            'carrier' => $doc->carrier ?? '-',
            'reports_count' => $doc->reportsCount ?? 0,
            'tags' => isset($doc->tags) ? (array)$doc->tags : []
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
}

// 🔵 ACTION: BAN or VERIFY Number
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input['action'] === 'ban') {
        $db->globalnumbers->updateOne(
            ['phoneNumber' => $input['phone']],
            ['$set' => ['spamScore' => 100, 'likelyName' => '⛔ BANNED BY ADMIN']]
        );
    } 
    elseif ($input['action'] === 'verify') {
        $db->globalnumbers->updateOne(
            ['phoneNumber' => $input['phone']],
            ['$set' => ['spamScore' => 0, 'isVerified' => true]]
        );
    }
    
    echo json_encode(['success' => true]);
}