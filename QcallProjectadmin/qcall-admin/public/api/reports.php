<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use App\Auth\AuthService;

header('Content-Type: application/json');

try { AuthService::check(); } catch (Exception $e) { exit(json_encode(['success'=>false, 'message'=>'Unauthorized'])); }

$db = Database::getInstance();

// 🟢 OLD WORKING LOGIC (Untouched)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pipeline = [
            [
                '$lookup' => [
                    'from' => 'users',
                    'localField' => 'reportedBy',
                    'foreignField' => '_id',
                    'as' => 'reporter'
                ]
            ],
            [ '$unwind' => '$reporter' ],
            [ '$sort' => ['createdAt' => -1] ],
            [ '$limit' => 100 ] // Increased limit slightly so you have more data to filter
        ];

        $cursor = $db->spamreports->aggregate($pipeline);

        $data = [];
        foreach ($cursor as $doc) {
            $data[] = [
                'id' => (string)$doc->_id,
                'target_phone' => $doc->phoneNumber,
                'reporter_name' => ($doc->reporter->firstName ?? 'Unknown') . ' ' . ($doc->reporter->lastName ?? ''),
                'tag' => $doc->tag ?? 'Spam',
                'comment' => $doc->comment ?? '-',
                'date' => $doc->createdAt->toDateTime()->format('M d, Y h:i A')
            ];
        }

        echo json_encode(['success' => true, 'data' => $data]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}