<?php
require_once __DIR__ . '/../../vendor/autoload.php';
use App\Config\Database;
use App\Auth\AuthService;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\Regex;

header('Content-Type: application/json');

// 🔒 Security Check
try {
    AuthService::check(); 
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];

// 🟢 GET USERS (With Search & Pagination)
if ($method === 'GET') {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = 10;
    $skip = ($page - 1) * $limit;
    $search = $_GET['search'] ?? '';

    $filter = [];
    if (!empty($search)) {
        // Search by Name OR Phone
        $filter = [
            '$or' => [
                ['phoneNumber' => new Regex($search, 'i')],
                ['firstName' => new Regex($search, 'i')],
                ['lastName' => new Regex($search, 'i')]
            ]
        ];
    }

    try {
        $totalUsers = $db->users->countDocuments($filter);
        $usersCursor = $db->users->find($filter, [
            'limit' => $limit,
            'skip' => $skip,
            'sort' => ['joinedAt' => -1]
        ]);

        $users = [];
        foreach ($usersCursor as $u) {
            $users[] = [
                'id' => (string)$u->_id,
                'name' => trim(($u->firstName ?? '') . ' ' . ($u->lastName ?? '')) ?: 'Unknown',
                'phone' => $u->phoneNumber,
                'type' => $u->accountType ?? 'free',
                'joined' => isset($u->joinedAt) ? $u->joinedAt->toDateTime()->format('M d, Y') : '-'
            ];
        }

        echo json_encode([
            'success' => true,
            'data' => $users,
            'pagination' => [
                'total' => $totalUsers,
                'pages' => ceil($totalUsers / $limit),
                'current' => $page
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// 🔴 DELETE USER (Ban)
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['id'])) {
        echo json_encode(['success' => false, 'message' => 'ID Required']);
        exit;
    }

    try {
        $db->users->deleteOne(['_id' => new ObjectId($input['id'])]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Delete Failed']);
    }
}

// 🔵 UPDATE USER (e.g. Upgrade to Gold)
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['id'])) {
        echo json_encode(['success' => false, 'message' => 'ID Required']);
        exit;
    }

    try {
        $updateData = [];
        if(isset($input['firstName'])) $updateData['firstName'] = $input['firstName'];
        if(isset($input['lastName'])) $updateData['lastName'] = $input['lastName'];
        if(isset($input['accountType'])) $updateData['accountType'] = $input['accountType'];

        $db->users->updateOne(
            ['_id' => new ObjectId($input['id'])],
            ['$set' => $updateData]
        );
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Update Failed']);
    }
}