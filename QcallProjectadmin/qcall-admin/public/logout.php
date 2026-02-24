<?php
// 1. Initialize Session
session_start();

// 2. Clear Session Data
$_SESSION = array();

// 3. Destroy the Session
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}
session_destroy();

// 🟢 CRITICAL FIX: Delete the 'auth_token' Cookie
// We set the expiration time to the past (time() - 3600), forcing the browser to delete it.
setcookie("auth_token", "", time() - 3600, "/");

// 4. Redirect to Login Page
header("Location: index.php");
exit();
?>