<?php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Auth\AuthService;

// 1. Check Security
$user = AuthService::check(); 

// 2. Include Header
include 'includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
    <h3><i class="bi bi-people-fill text-primary"></i> User Management</h3>
    
    <div class="input-group w-auto">
        <input type="text" id="searchInput" class="form-control" placeholder="Search phone or name..." onkeyup="searchUsers()">
        <button class="btn btn-primary"><i class="bi bi-search"></i></button>
    </div>
</div>

<div class="card shadow-sm border-0">
    <div class="card-body p-0">
        <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
                <tr>
                    <th class="ps-4">Name</th>
                    <th>Phone Number</th>
                    <th>Plan</th>
                    <th>Joined</th>
                    <th class="text-end pe-4">Actions</th>
                </tr>
            </thead>
            <tbody id="users-table-body">
                </tbody>
        </table>
    </div>
    <div class="card-footer bg-white d-flex justify-content-end gap-2" id="pagination">
        </div>
</div>

<div class="modal fade" id="editUserModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Edit User</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="edit-id">
                <div class="mb-3">
                    <label>First Name</label>
                    <input type="text" id="edit-fname" class="form-control">
                </div>
                <div class="mb-3">
                    <label>Last Name</label>
                    <input type="text" id="edit-lname" class="form-control">
                </div>
                <div class="mb-3">
                    <label>Account Type</label>
                    <select id="edit-plan" class="form-select">
                        <option value="free">Free</option>
                        <option value="gold">Gold</option>
                        <option value="platinum">Platinum</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="saveUserChanges()">Save Changes</button>
            </div>
        </div>
    </div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', () => loadUsers(1));
</script>

<?php 
// 3. Include Footer
include 'includes/footer.php'; 
?>