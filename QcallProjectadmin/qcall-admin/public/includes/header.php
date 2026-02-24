<?php
$current_page = basename($_SERVER['PHP_SELF']);
$user_email = isset($user->email) ? $user->email : 'Admin';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QCall Admin</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-light">

<nav class="navbar navbar-expand-lg navbar-dark px-4 mb-4 sticky-top glass-header shadow-sm">
    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="dashboard.php">
        <i class="ph-fill ph-circles-three-plus text-primary fs-3"></i> 
        <span>QCall <span class="text-primary">Panel</span></span>
    </a>
    
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
    </button>
    
    <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto align-items-center gap-3">
            
            <li class="nav-item">
                <a class="nav-link d-flex align-items-center gap-2 <?= ($current_page == 'dashboard.php') ? 'active text-white fw-bold' : 'text-white-50' ?>" href="dashboard.php">
                    <i class="ph ph-squares-four fs-5"></i> Dashboard
                </a>
            </li>

            <li class="nav-item">
                <a class="nav-link d-flex align-items-center gap-2 <?= ($current_page == 'users.php') ? 'active text-white fw-bold' : 'text-white-50' ?>" href="users.php">
                    <i class="ph ph-users fs-5"></i> Users
                </a>
            </li>

            <li class="nav-item">
                <a class="nav-link d-flex align-items-center gap-2 <?= ($current_page == 'plans.php') ? 'active text-white fw-bold' : 'text-white-50' ?>" href="plans.php">
                    <i class="ph ph-currency-circle-dollar fs-5"></i> Plans
                </a>
            </li>

            <li class="nav-item">
                <a class="nav-link d-flex align-items-center gap-2 <?= ($current_page == 'spam-center.php') ? 'active text-white fw-bold' : 'text-white-50' ?>" href="spam-center.php">
                    <i class="ph ph-shield-warning fs-5"></i> Spam Center
                </a>
            </li>

            <li class="nav-item">
                <a class="nav-link d-flex align-items-center gap-2 <?= ($current_page == 'reports.php') ? 'active text-white fw-bold' : 'text-white-50' ?>" href="reports.php">
                    <i class="ph ph-flag fs-5"></i> Reports
                </a>
            </li>
            
            <li class="nav-item border-start border-secondary ps-3 ms-2 d-flex align-items-center">
                <div class="d-flex flex-column text-end me-3 lh-1 d-none d-lg-block">
                    <span class="text-white small fw-bold">Admin</span>
                    <span class="text-white-50" style="font-size: 10px;"><?= htmlspecialchars($user_email) ?></span>
                </div>
                <a href="logout.php" class="btn btn-sm btn-danger rounded-pill px-3">
                    <i class="ph-bold ph-sign-out"></i> Logout
                </a>
            </li>
        </ul>
    </div>
</nav>

<div class="container-fluid px-4">