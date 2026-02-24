<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use App\Auth\AuthService;
use MongoDB\BSON\ObjectId;

header('Content-Type: application/json');

try { AuthService::check(); } catch (Exception $e) { exit(json_encode(['success'=>false, 'message'=>'Unauthorized'])); }

$db = Database::getInstance();

if (!isset($_GET['id'])) {
    exit(json_encode(['success' => false, 'message' => 'User ID required']));
}

try {
    $userId = new ObjectId($_GET['id']);

    // 1. Fetch User Info
    $user = $db->users->findOne(['_id' => $userId]);
    if (!$user) {
        exit(json_encode(['success' => false, 'message' => 'User not found']));
    }

    // 2. Fetch Stats
    $contactsCount = $db->usercontacts->countDocuments(['userId' => $userId]);
    $reportsCount = $db->spamreports->countDocuments(['reportedBy' => $userId]);

    // 3. Fetch Recent Reports (Limit 5)
    $reportCursor = $db->spamreports->find(
        ['reportedBy' => $userId],
        ['limit' => 5, 'sort' => ['createdAt' => -1]]
    );
    $reports = [];
    foreach ($reportCursor as $doc) {
        $reports[] = [
            'target' => $doc->phoneNumber,
            'tag' => $doc->tag ?? 'Spam',
            'date' => $doc->createdAt->toDateTime()->format('M d, Y')
        ];
    }

    // 🟢 4. FETCH UPLOADED CONTACTS (New Feature)
    // We limit to 500 to prevent browser crashing if they have 5,000+ contacts
    $contactCursor = $db->usercontacts->find(
        ['userId' => $userId],
        ['limit' => 500, 'sort' => ['contactName' => 1]] 
    );
    
    $contacts = [];
    foreach ($contactCursor as $doc) {
        $contacts[] = [
            'name' => $doc->contactName ?? 'Unknown',
            'phone' => $doc->phoneNumber,
            'updated' => isset($doc->updatedAt) ? $doc->updatedAt->toDateTime()->format('M d, Y') : '-'
        ];
    }

    $data = [
        'id' => (string)$user->_id,
        'firstName' => $user->firstName,
        'lastName' => $user->lastName,
        'email' => $user->email ?? 'No Email',
        'phone' => $user->phoneNumber ?? 'No Phone',
        'type' => $user->accountType ?? 'Free',
        'joined' => $user->joinedAt ? $user->joinedAt->toDateTime()->format('F d, Y') : 'Unknown',
        'stats' => [
            'contacts' => $contactsCount,
            'reports' => $reportsCount
        ],
        'recent_reports' => $reports,
        'uploaded_contacts' => $contacts // <--- Sending this to frontend
    ];

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Invalid User ID']);
}