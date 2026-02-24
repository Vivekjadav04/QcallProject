<?php
session_start();

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../app/Config/Database.php'; // Import your DB class
include __DIR__ . '/includes/header.php';

use App\Config\Database;

// ==========================================
// 🎨 THE FEATURE PALETTE
// ==========================================
$FEATURE_PALETTE = [
    'no_ads' => 'Remove All Ads',
    'golden_caller_id' => 'Golden Caller ID Overlay',
    'auto_block_spam' => 'Auto-Block Top Spammers',
    'who_viewed_me' => 'Who Viewed My Profile',
    'incognito_search' => 'Incognito Number Search',
    'premium_badge' => 'Premium Blue Tick Badge'
];

// ==========================================
// 🔌 MONGODB CONNECTION
// ==========================================
try {
    // Get the database instance using your class
    $db = Database::getInstance();
    $plansCollection = $db->subscription_plans;
} catch (Exception $e) {
    die("<div class='container mt-4'><div class='alert alert-danger shadow-sm'><b>Critical Database Error:</b><br>" . $e->getMessage() . "</div></div>");
}

$message = '';

// ==========================================
// ⚙️ HANDLE FORM SUBMISSIONS (Create, Update, Delete)
// ==========================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // -- DELETE PLAN --
    if (isset($_POST['action']) && $_POST['action'] === 'delete') {
        try {
            $deleteId = new MongoDB\BSON\ObjectId($_POST['plan_id']);
            $plansCollection->deleteOne(['_id' => $deleteId]);
            $message = "<div class='alert alert-success shadow-sm rounded-3 border-0 border-start border-success border-4'>Plan deleted successfully.</div>";
        } catch (Exception $e) {
            $message = "<div class='alert alert-danger shadow-sm'>Error deleting plan: " . $e->getMessage() . "</div>";
        }
    }
    
    // -- CREATE OR UPDATE PLAN --
    if (isset($_POST['action']) && in_array($_POST['action'], ['create', 'update'])) {
        $plan_name = trim($_POST['plan_name']);
        $price = floatval($_POST['price']);
        $duration_days = intval($_POST['duration_days']);
        $raw_features = isset($_POST['features']) ? $_POST['features'] : [];
        $features = array_values(array_intersect($raw_features, array_keys($FEATURE_PALETTE)));

        if (!empty($plan_name) && $price >= 0 && $duration_days > 0) {
            try {
                if ($_POST['action'] === 'create') {
                    // CREATE
                    $plansCollection->insertOne([
                        'plan_name' => $plan_name,
                        'price' => $price,
                        'duration_days' => $duration_days,
                        'features' => $features,
                        'status' => 'active',
                        'created_at' => new MongoDB\BSON\UTCDateTime()
                    ]);
                    $message = "<div class='alert alert-success shadow-sm rounded-3 border-0 border-start border-success border-4'>Plan <b>{$plan_name}</b> created successfully!</div>";
                } else if ($_POST['action'] === 'update') {
                    // UPDATE
                    $updateId = new MongoDB\BSON\ObjectId($_POST['plan_id']);
                    $plansCollection->updateOne(
                        ['_id' => $updateId],
                        ['$set' => [
                            'plan_name' => $plan_name,
                            'price' => $price,
                            'duration_days' => $duration_days,
                            'features' => $features
                        ]]
                    );
                    $message = "<div class='alert alert-success shadow-sm rounded-3 border-0 border-start border-success border-4'>Plan <b>{$plan_name}</b> updated successfully!</div>";
                }
            } catch (Exception $e) {
                $message = "<div class='alert alert-danger shadow-sm'>Error saving plan: " . $e->getMessage() . "</div>";
            }
        } else {
            $message = "<div class='alert alert-warning shadow-sm'>Please fill all fields correctly.</div>";
        }
    }
}

// ==========================================
// 🔍 FETCH EDIT STATE & ALL PLANS
// ==========================================
$editPlan = null;
if (isset($_GET['edit'])) {
    try {
        $editPlan = $plansCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($_GET['edit'])]);
    } catch (Exception $e) {
        $message = "<div class='alert alert-danger'>Invalid Edit ID.</div>";
    }
}

$existingPlans = [];
try {
    $existingPlans = $plansCollection->find([], ['sort' => ['price' => 1]]);
} catch (Exception $e) {
    $message = "<div class='alert alert-danger'>Error fetching plans: " . $e->getMessage() . "</div>";
}
?>

<div class="container-fluid px-4 py-4">
    
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold text-dark mb-0">Subscription Plans</h2>
            <p class="text-muted small">Create and manage pricing tiers for QCall users.</p>
        </div>
        <?php if ($editPlan): ?>
            <a href="plans.php" class="btn btn-outline-secondary rounded-pill px-4">
                <i class="ph ph-plus"></i> Create New Plan
            </a>
        <?php endif; ?>
    </div>

    <?= $message ?>

    <div class="row g-4">
        
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-header bg-white border-bottom-0 pt-4 pb-0 px-4">
                    <h5 class="fw-bold text-primary mb-0">
                        <i class="ph-fill ph-<?= $editPlan ? 'pencil-simple' : 'plus-circle' ?> me-2"></i>
                        <?= $editPlan ? 'Edit Plan' : 'Create New Plan' ?>
                    </h5>
                </div>
                <div class="card-body p-4">
                    <form method="POST" action="plans.php">
                        <input type="hidden" name="action" value="<?= $editPlan ? 'update' : 'create' ?>">
                        <?php if ($editPlan): ?>
                            <input type="hidden" name="plan_id" value="<?= (string)$editPlan['_id'] ?>">
                        <?php endif; ?>

                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small text-uppercase tracking-wider">Plan Name</label>
                            <input type="text" name="plan_name" class="form-control form-control-lg bg-light border-0" required 
                                   value="<?= $editPlan ? htmlspecialchars($editPlan['plan_name']) : '' ?>" 
                                   placeholder="e.g. QCall Premium">
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small text-uppercase tracking-wider">Price (INR)</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-light border-0">₹</span>
                                    <input type="number" step="0.01" name="price" class="form-control form-control-lg bg-light border-0" required 
                                           value="<?= $editPlan ? $editPlan['price'] : '' ?>" placeholder="99">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small text-uppercase tracking-wider">Duration</label>
                                <div class="input-group">
                                    <input type="number" name="duration_days" class="form-control form-control-lg bg-light border-0" required 
                                           value="<?= $editPlan ? $editPlan['duration_days'] : '30' ?>" placeholder="30">
                                    <span class="input-group-text bg-light border-0">Days</span>
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="form-label fw-semibold text-muted small text-uppercase tracking-wider mb-3">Premium Features</label>
                            <div class="d-flex flex-column gap-2">
                                <?php 
                                $currentFeatures = $editPlan ? (array)$editPlan['features'] : [];
                                foreach ($FEATURE_PALETTE as $key => $label): 
                                    $isChecked = in_array($key, $currentFeatures) ? 'checked' : '';
                                ?>
                                    <div class="form-check form-switch custom-switch">
                                        <input class="form-check-input shadow-none" type="checkbox" role="switch" 
                                               id="feat_<?= $key ?>" name="features[]" value="<?= $key ?>" <?= $isChecked ?>>
                                        <label class="form-check-label ps-2 text-dark" for="feat_<?= $key ?>"><?= htmlspecialchars($label) ?></label>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-lg w-100 rounded-pill shadow-sm fw-bold">
                            <?= $editPlan ? 'Update Plan' : 'Save Plan to Database' ?>
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-lg-8">
            <div class="row g-3">
                <?php foreach ($existingPlans as $plan): ?>
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden position-relative hover-lift">
                            
                            <div class="position-absolute top-0 end-0 p-3 d-flex gap-2">
                                <a href="plans.php?edit=<?= (string)$plan['_id'] ?>" class="btn btn-sm btn-light text-primary rounded-circle shadow-sm" title="Edit">
                                    <i class="ph-bold ph-pencil-simple"></i>
                                </a>
                                <form method="POST" action="plans.php" class="d-inline" onsubmit="return confirm('Are you sure you want to delete this plan?');">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="plan_id" value="<?= (string)$plan['_id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" title="Delete">
                                        <i class="ph-bold ph-trash"></i>
                                    </button>
                                </form>
                            </div>

                            <div class="card-body p-4">
                                <div class="d-flex align-items-center mb-3">
                                    <div class="bg-primary bg-opacity-10 p-3 rounded-circle me-3">
                                        <i class="ph-fill ph-crown text-primary fs-3"></i>
                                    </div>
                                    <div>
                                        <h5 class="fw-bold mb-0 text-dark"><?= htmlspecialchars($plan['plan_name']) ?></h5>
                                        <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1 mt-1">
                                            ₹<?= number_format($plan['price'], 2) ?> / <?= $plan['duration_days'] ?> Days
                                        </span>
                                    </div>
                                </div>

                                <hr class="border-light">

                                <p class="text-muted small text-uppercase tracking-wider fw-semibold mb-2">Included Features:</p>
                                <div class="d-flex flex-wrap gap-2">
                                    <?php 
                                    $planFeatures = (array)$plan['features']; 
                                    if (empty($planFeatures)): ?>
                                        <span class="badge bg-light text-muted border fw-normal"><i class="ph ph-minus me-1"></i> No premium features</span>
                                    <?php else: 
                                        foreach ($planFeatures as $featKey): 
                                            $label = isset($FEATURE_PALETTE[$featKey]) ? $FEATURE_PALETTE[$featKey] : $featKey;
                                    ?>
                                        <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-normal px-2 py-1">
                                            <i class="ph-bold ph-check me-1"></i> <?= htmlspecialchars($label) ?>
                                        </span>
                                    <?php endforeach; endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>

                <?php if (empty((array)$existingPlans)): ?>
                    <div class="col-12 text-center py-5">
                        <i class="ph-fill ph-empty text-muted" style="font-size: 60px; opacity: 0.3;"></i>
                        <h5 class="text-muted mt-3">No plans available</h5>
                        <p class="text-muted small">Create your first subscription plan using the form.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>

    </div>
</div>

<style>
    /* Premium UI Additions */
    .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; }
    .tracking-wider { letter-spacing: 0.05em; }
    .custom-switch .form-check-input { width: 40px; height: 20px; cursor: pointer; }
    .custom-switch .form-check-input:checked { background-color: #10B981; border-color: #10B981; }
    .custom-switch .form-check-label { cursor: pointer; padding-top: 2px; }
</style>

<?php include __DIR__ . '/includes/footer.php'; ?>