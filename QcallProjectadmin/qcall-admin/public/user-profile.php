<?php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Auth\AuthService;
$user = AuthService::check(); 
include 'includes/header.php';
?>

<div class="mb-4">
    <a href="users.php" class="btn btn-light shadow-sm text-muted">
        <i class="ph-bold ph-arrow-left"></i> Back to Users
    </a>
</div>

<div id="profile-content" class="row g-4">
    <div class="col-12 text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 text-muted">Loading user profile...</p>
    </div>
</div>

<script>
async function loadUserProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        window.location.href = 'users.php';
        return;
    }

    // 🟢 FETCH DATA: Get both user details and available plans
    const [result, plansResult] = await Promise.all([
        apiCall(`user-details.php?id=${userId}`),
        apiCall(`get-plans.php`)
    ]);

    if (result.success) {
        const u = result.data;
        const plans = plansResult.success ? plansResult.data : [];
        const initials = (u.firstName[0] + (u.lastName ? u.lastName[0] : '')).toUpperCase();
        
        // Badge Logic
        let badgeClass = 'bg-secondary';
        if(u.type.toLowerCase() === 'platinum') badgeClass = 'bg-info text-white';
        if(u.type.toLowerCase() === 'gold') badgeClass = 'bg-warning text-dark';

        // 🟢 RENDER FULL PROFILE
        document.getElementById('profile-content').innerHTML = `
            <div class="col-md-4">
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body text-center p-4">
                        <div class="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white shadow-glow mb-3" 
                             style="width: 100px; height: 100px; font-size: 36px; font-weight: bold;">
                            ${initials}
                        </div>
                        
                        <h4 class="fw-bold text-dark mb-1">${u.firstName} ${u.lastName}</h4>
                        <span class="badge ${badgeClass} px-3 py-2 rounded-pill mb-4">${u.type.toUpperCase()} Member</span>

                        <div class="text-start mt-3 border-top pt-3">
                            <div class="mb-3">
                                <label class="small text-muted fw-bold text-uppercase">Email</label>
                                <div class="d-flex align-items-center gap-2 text-dark fw-medium">
                                    <i class="ph-fill ph-envelope-simple text-primary"></i> ${u.email}
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="small text-muted fw-bold text-uppercase">Phone</label>
                                <div class="d-flex align-items-center gap-2 text-dark fw-medium">
                                    <i class="ph-fill ph-phone text-primary"></i> ${u.phone}
                                </div>
                            </div>
                            <div>
                                <label class="small text-muted fw-bold text-uppercase">Joined</label>
                                <div class="d-flex align-items-center gap-2 text-dark fw-medium">
                                    <i class="ph-fill ph-calendar text-primary"></i> ${u.joined}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm border-start border-4 border-warning mb-4">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="ph-bold ph-crown text-warning me-2"></i>Management Console</h6>
                        
                        <div class="mb-3">
                            <label class="small fw-bold text-muted text-uppercase mb-1">Subscription Plan</label>
                            <select id="planSelector" class="form-select border-0 bg-light">
                                <option value="Free" ${u.type === 'Free' ? 'selected' : ''}>Free Plan</option>
                                ${plans.map(p => `<option value="${p.plan_name}" ${u.type === p.plan_name ? 'selected' : ''}>${p.plan_name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="small fw-bold text-muted text-uppercase mb-1">Status</label>
                            <select id="statusSelector" class="form-select border-0 bg-light">
                                <option value="Active" ${(u.subscription && u.subscription.status === 'Active') ? 'selected' : ''}>Active</option>
                                <option value="Expired" ${(u.subscription && u.subscription.status === 'Expired') ? 'selected' : ''}>Expired</option>
                            </select>
                        </div>

                        <button onclick="updateSubscription('${u.id}')" id="updateBtn" class="btn btn-warning w-100 fw-bold py-2 shadow-sm">
                            Update & Sync App
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-8">
                <div class="row g-3 mb-4">
                    <div class="col-6">
                        <div class="p-3 bg-white rounded-3 shadow-sm border d-flex align-items-center justify-content-between">
                            <div>
                                <h6 class="text-muted small text-uppercase mb-1">Reports</h6>
                                <h3 class="fw-bold mb-0 text-danger">${u.stats.reports}</h3>
                            </div>
                            <div class="bg-danger bg-opacity-10 p-2 rounded-circle text-danger"><i class="ph-fill ph-flag-banner fs-3"></i></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="p-3 bg-white rounded-3 shadow-sm border d-flex align-items-center justify-content-between">
                            <div>
                                <h6 class="text-muted small text-uppercase mb-1">Contacts</h6>
                                <h3 class="fw-bold mb-0 text-success">${u.stats.contacts}</h3>
                            </div>
                            <div class="bg-success bg-opacity-10 p-2 rounded-circle text-success"><i class="ph-fill ph-address-book fs-3"></i></div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white border-bottom-0 pt-3 pb-0">
                        <ul class="nav nav-tabs card-header-tabs" id="profileTabs" role="tablist">
                            <li class="nav-item">
                                <button class="nav-link active fw-bold" id="contacts-tab" data-bs-toggle="tab" data-bs-target="#contacts" type="button">
                                    <i class="ph-bold ph-address-book me-1"></i> Synced Contacts (${u.uploaded_contacts.length})
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link fw-bold text-danger" id="reports-tab" data-bs-toggle="tab" data-bs-target="#reports" type="button">
                                    <i class="ph-bold ph-warning me-1"></i> Spam Reports
                                </button>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="card-body p-0">
                        <div class="tab-content" id="profileTabsContent">
                            <div class="tab-pane fade show active" id="contacts" role="tabpanel">
                                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-hover mb-0 align-middle">
                                        <thead class="bg-light sticky-top">
                                            <tr>
                                                <th class="ps-4">Name</th>
                                                <th>Phone Number</th>
                                                <th class="text-end pe-4">Synced Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${u.uploaded_contacts.length > 0 ? u.uploaded_contacts.map(c => `
                                                <tr>
                                                    <td class="ps-4 fw-bold text-dark">${c.name}</td>
                                                    <td class="font-monospace text-primary">${c.phone}</td>
                                                    <td class="text-end pe-4 small text-muted">${c.updated}</td>
                                                </tr>
                                            `).join('') : '<tr><td colspan="3" class="text-center py-4 text-muted">No contacts synced yet.</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="reports" role="tabpanel">
                                <table class="table table-hover mb-0 align-middle">
                                    <thead class="bg-light">
                                        <tr>
                                            <th class="ps-4">Target Number</th>
                                            <th>Tag</th>
                                            <th class="text-end pe-4">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${u.recent_reports.length > 0 ? u.recent_reports.map(r => `
                                            <tr>
                                                <td class="ps-4 fw-bold font-monospace text-danger">${r.target}</td>
                                                <td><span class="badge bg-secondary bg-opacity-10 text-dark">${r.tag}</span></td>
                                                <td class="text-end pe-4 text-muted small">${r.date}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="3" class="text-center py-4 text-muted">No reports submitted.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-4 text-end">
                    <button class="btn btn-danger" onclick="deleteUser('${u.id}')"><i class="ph-bold ph-trash"></i> Delete Account</button>
                </div>
            </div>
        `;
    } else {
        document.getElementById('profile-content').innerHTML = `<div class="col-12 text-center text-danger pt-5"><h4>${result.message}</h4></div>`;
    }
}

// 🟢 NEW FUNCTION: Sync Plan Changes
async function updateSubscription(userId) {
    const btn = document.getElementById('updateBtn');
    const planName = document.getElementById('planSelector').value;
    const status = document.getElementById('statusSelector').value;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Syncing...';

    const result = await apiCall('update-user-plan.php', 'POST', {
        user_id: userId,
        plan_name: planName,
        status: status
    });

    if (result.success) {
        // Use SweetAlert if your project has it, or standard Alert
        alert(`Success: User is now ${planName}`);
        loadUserProfile();
    } else {
        alert("Error: " + result.message);
        btn.disabled = false;
        btn.innerHTML = 'Update & Sync App';
    }
}

async function deleteUser(id) {
    if(!confirm("Are you sure? This cannot be undone.")) return;
    const result = await apiCall('users.php', 'DELETE', { id });
    if(result.success) window.location.href = 'users.php';
}

document.addEventListener('DOMContentLoaded', loadUserProfile);
</script>

<?php include 'includes/footer.php'; ?>