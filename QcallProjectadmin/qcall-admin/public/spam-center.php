<?php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Auth\AuthService;
$user = AuthService::check(); 
include 'includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
    <div>
        <h3 class="mb-0"><i class="bi bi-shield-exclamation text-danger"></i> Spam Center</h3>
        <p class="text-muted small">Manage global spam database & risk scores</p>
    </div>
    
    <div class="d-flex gap-2">
        <input type="text" id="spamSearch" class="form-control" placeholder="Search Number..." onkeyup="searchSpam()">
        
        <div class="btn-group">
            <button class="btn btn-outline-secondary active" id="btn-all" onclick="loadSpamData('all')">All</button>
            <button class="btn btn-outline-danger" id="btn-risk" onclick="loadSpamData('high_risk')">High Risk</button>
        </div>
    </div>
</div>

<div class="card border-0 shadow-sm">
    <div class="card-header bg-white py-3">
        <div class="row fw-bold text-muted small text-uppercase">
            <div class="col-3 ps-4">Identity</div>
            <div class="col-3">Risk Analysis</div>
            <div class="col-3">Details</div>
            <div class="col-3 text-end pe-4">Actions</div>
        </div>
    </div>
    
    <div class="card-body p-0" id="spam-list-body">
        </div>
</div>

<script>
let currentFilter = 'all';

async function loadSpamData(filter = 'all') {
    currentFilter = filter;
    
    // Toggle Active Button State
    document.getElementById('btn-all').classList.toggle('active', filter === 'all');
    document.getElementById('btn-risk').classList.toggle('active', filter === 'high_risk');
    document.getElementById('btn-all').classList.toggle('btn-primary', filter === 'all'); // Visual cue
    document.getElementById('btn-all').classList.toggle('btn-outline-secondary', filter !== 'all');

    const container = document.getElementById('spam-list-body');
    const search = document.getElementById('spamSearch').value;

    // ☠️ SKELETON LOADER (Custom for this layout)
    container.innerHTML = `
        <div class="p-4 border-bottom"><div class="skeleton skeleton-text w-50"></div><div class="skeleton skeleton-text w-25"></div></div>
        <div class="p-4 border-bottom"><div class="skeleton skeleton-text w-50"></div><div class="skeleton skeleton-text w-25"></div></div>
        <div class="p-4 border-bottom"><div class="skeleton skeleton-text w-50"></div><div class="skeleton skeleton-text w-25"></div></div>
    `;

    // Fetch Data
    const result = await apiCall(`spam.php?filter=${filter}&search=${encodeURIComponent(search)}`);

    if (result.success) {
        if(result.data.length === 0) {
            container.innerHTML = '<div class="text-center py-5 text-muted">No records found.</div>';
            return;
        }

        container.innerHTML = result.data.map((item, index) => {
            // Determine Colors
            let colorClass = 'bg-success';
            let riskLabel = 'Safe';
            if(item.score > 40) { colorClass = 'bg-warning'; riskLabel = 'Moderate'; }
            if(item.score > 75) { colorClass = 'bg-danger'; riskLabel = 'Critical'; }

            return `
            <div class="row align-items-center border-bottom py-3 m-0 hover-bg stagger-row" style="animation-delay: ${index * 0.05}s">
                
                <div class="col-3 ps-4">
                    <h6 class="mb-0 fw-bold font-monospace text-dark">${item.phone}</h6>
                    <small class="text-primary">${item.name}</small>
                </div>

                <div class="col-3">
                    <div class="d-flex justify-content-between small mb-1">
                        <span class="fw-bold">${item.score}/100</span>
                        <span class="badge ${colorClass}">${riskLabel}</span>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar ${colorClass}" style="width: ${item.score}%"></div>
                    </div>
                </div>

                <div class="col-3">
                    <div class="small text-muted"><i class="bi bi-geo-alt"></i> ${item.location}</div>
                    <div class="mt-1">
                        ${item.tags.map(t => `<span class="badge bg-light text-dark border me-1">${t}</span>`).join('')}
                    </div>
                </div>

                <div class="col-3 text-end pe-4">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-success" onclick="updateSpam('${item.phone}', 'verify')" title="Mark Safe">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="updateSpam('${item.phone}', 'ban')" title="Ban Number">
                            <i class="bi bi-slash-circle"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }
}

// Search with Debounce
let timer;
function searchSpam() {
    clearTimeout(timer);
    timer = setTimeout(() => loadSpamData(currentFilter), 400);
}

// Action Handler
async function updateSpam(phone, action) {
    if(!confirm(`Are you sure you want to ${action.toUpperCase()} this number?`)) return;
    await apiCall('spam.php', 'POST', { phone, action });
    loadSpamData(currentFilter); // Refresh list
}

// Init
document.addEventListener('DOMContentLoaded', () => loadSpamData('all'));
</script>

<style>
.hover-bg:hover { background-color: #f8f9fa; }
</style>

<?php include 'includes/footer.php'; ?>