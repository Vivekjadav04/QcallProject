<?php
require 'vendor/autoload.php';

use App\Config\Database;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

echo "🚀 Starting Real Data Seeding (Spam Reports & Global Numbers)...\n";

$db = Database::getInstance();

// 1. GET REAL USERS (To report the spam)
$users = $db->users->find([], ['limit' => 50])->toArray();
if (empty($users)) {
    echo "⚠️  No users found! Creating a 'System Admin' user first...\n";
    $result = $db->users->insertOne([
        'firstName' => 'System', 'lastName' => 'Admin', 
        'phoneNumber' => '+910000000000', 'accountType' => 'platinum'
    ]);
    $users[] = (object)['$_id' => $result->getInsertedId()];
}

// 2. DATASETS (For Realistic Variety)
$tags = ['Bank Fraud', 'Spam', 'Telemarketer', 'Robocall', 'Loan Scam', 'Lottery Scam', 'Politics', 'Harassment'];
$locations = ['Mumbai, Maharashtra', 'Delhi, India', 'Bangalore, Karnataka', 'Chennai, Tamil Nadu', 'Kolkata, WB', 'Pune, Maharashtra', 'Ahmedabad, Gujarat', 'Jaipur, Rajasthan', 'Hyderabad, Telangana'];
$comments = [
    "Called asking for OTP immediately.",
    "Claims to be from SBI Bank regarding KYC.",
    "Silent call, cut after 3 seconds.",
    "Selling credit cards aggressively.",
    "Fake lottery winner message.",
    "Pre-recorded message about personal loan.",
    "Threatening to block my bank account.",
    "Asked for UPI PIN.",
];

$reportsCreated = 0;
$globalUpdated = 0;

echo "🔄 Generating 100 Unique Spam Reports...\n";

for ($i = 0; $i < 100; $i++) {
    // A. Generate Random Data
    $phoneNumber = '+91' . rand(6000000000, 9999999999); // Realistic Indian Mobile
    $tag = $tags[array_rand($tags)];
    $location = $locations[array_rand($locations)];
    $comment = $comments[array_rand($comments)];
    $reporter = $users[array_rand($users)]; // Pick a random real user
    $spamScore = rand(40, 99); // Random Score for Global Number
    
    // B. Insert into 'spamreports' (For "Reports" Tab)
    try {
        $db->spamreports->insertOne([
            'phoneNumber' => $phoneNumber,
            'reportedBy' => $reporter->_id, // 🔒 Linking to Real User ID
            'tag' => $tag,
            'comment' => $comment,
            'location' => $location,
            'createdAt' => new UTCDateTime((time() - rand(0, 86400 * 30)) * 1000) // Random time in last 30 days
        ]);
        $reportsCreated++;
    } catch (Exception $e) {
        // Skip duplicates if any
        continue;
    }

    // C. Upsert into 'globalnumbers' (For "Dashboard" & "Spam Center")
    // We update the Global Number to reflect this new report
    $db->globalnumbers->updateOne(
        ['phoneNumber' => $phoneNumber],
        ['$set' => [
            'phoneNumber' => $phoneNumber,
            'likelyName' => "$tag Caller", // e.g. "Bank Fraud Caller"
            'location' => $location,
            'carrier' => 'Jio/Airtel',
            'spamScore' => $spamScore, // 🟢 Random Score (0-100)
            'tags' => [$tag, 'Unverified'],
            'lastReported' => new UTCDateTime(),
            'updatedAt' => new UTCDateTime()
        ],
        '$inc' => ['reportsCount' => 1] // Increment report counter
        ],
        ['upsert' => true] // Create if doesn't exist
    );
    $globalUpdated++;
}

echo "------------------------------------------------\n";
echo "✅ SUCCESS! Database Populated.\n";
echo "📊 Spam Reports Created: $reportsCreated\n";
echo "🌍 Global Numbers Updated: $globalUpdated\n";
echo "------------------------------------------------\n";
echo "👉 Now refresh your Admin Panel Dashboard!\n";