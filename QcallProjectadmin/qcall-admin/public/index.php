<?php
// 1. Redirect if already logged in
if (isset($_COOKIE['auth_token'])) {
    header("Location: dashboard.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | QCall Admin</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="login-body">

    <div class="shape shape-1"></div>
    <div class="shape shape-2"></div>

    <div class="login-container">
        <div class="card glass-login border-0 shadow-lg">
            <div class="card-body p-5">
                
                <div class="text-center mb-4">
                    <div class="logo-circle mx-auto mb-3">
                        <i class="ph-fill ph-circles-three-plus text-white display-4"></i>
                    </div>
                    <h2 class="fw-bold text-dark">QCall <span class="text-primary">Admin</span></h2>
                    <p class="text-muted small">Secure Access Portal</p>
                </div>

                <div id="alertMsg" class="alert alert-danger d-none text-center small py-2"></div>

                <form id="loginForm">
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-uppercase text-muted">Email Address</label>
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0"><i class="ph ph-envelope-simple text-primary"></i></span>
                            <input type="email" id="email" class="form-control border-start-0 ps-0" placeholder="admin@qcall.com" required>
                        </div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label small fw-bold text-uppercase text-muted">Password</label>
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0"><i class="ph ph-lock-key text-primary"></i></span>
                            <input type="password" id="password" class="form-control border-start-0 ps-0" placeholder="••••••••" required>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 py-2 fw-bold shadow-sm btn-login">
                        Sign In <i class="ph-bold ph-arrow-right ms-2"></i>
                    </button>
                </form>

                <div class="text-center mt-4">
                    <small class="text-muted">Protected by QCall Security Systems &copy; <?= date('Y') ?></small>
                </div>
            </div>
        </div>
    </div>

    <script src="assets/js/app.js"></script>
</body>
</html>