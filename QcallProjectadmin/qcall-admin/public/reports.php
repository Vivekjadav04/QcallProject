<?php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Auth\AuthService;
$user = AuthService::check(); 
include 'includes/header.php';
?>

<div class="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
    <div>
        <h3 class="mb-0 fw-bold d-flex align-items-center gap-2">
            <i class="ph-fill ph-flag-banner text-danger"></i> User Reports
        </h3>
        <p class="text-muted small mb-0">Real-time spam reports from users.</p>
    </div>
    
    <div class="d-flex gap-2 w-100 w-md-auto">
        <select id="filterCategory" class="form-select w-auto shadow-sm" onchange="applyFilters()">
            <option value="">All Categories</option>
        </select>

        <div class="input-group shadow-sm">
            <span class="input-group-text bg-white border-end-0"><i class="ph ph-magnifying-glass text-primary"></i></span>
            <input type="text" id="filterSearch" class="form-control border-start-0 ps-0" placeholder="Search Number, Name, or Location..." onkeyup="applyFilters()">
        </div>

        <button class="btn btn-primary px-3 shadow-sm" onclick="loadReports()">
            <i class="ph-bold ph-arrows-clockwise"></i>
        </button>
    </div>
</div>

<div class="card border-0 shadow-sm overflow-hidden">
    <div class="card-body p-0">
        <div class="table-responsive">
            <table class="table table-hover mb-0 align-middle">
                <thead class="bg-light">
                    <tr class="text-uppercase small text-muted">
                        <th class="ps-4 py-3">Reported Number</th>
                        <th class="py-3">Reported By</th>
                        <th class="py-3">Category</th>
                        <th class="py-3">Location</th> <th class="py-3">Comment</th>
                        <th class="text-end pe-4 py-3">Date</th>
                    </tr>
                </thead>
                <tbody id="reports-table-body">
                    </tbody>
            </table>
        </div>
    </div>
</div>

<script>
// 🟢 GLOBAL VARIABLE TO STORE DATA
let allReportsData = [];

async function loadReports() {
    const tableBody = document.getElementById('reports-table-body');
    
    // Skeleton Loading (assuming you have this function defined elsewhere)
    if (typeof getTableSkeleton === "function") {
        tableBody.innerHTML = getTableSkeleton(6, 5); // Updated to 6 columns
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>`;
    }

    // Fetch All Data 
    const result = await apiCall('reports.php');

    if (result.success) {
        allReportsData = result.data;
        
        // 🟢 POPULATE DYNAMIC DROPDOWN
        populateDynamicCategories(allReportsData);
        
        // Trigger Filter Logic
        applyFilters();
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${result.message}</td></tr>`;
    }
}

// 🟢 NEW FUNCTION: Extract unique tags and build the dropdown
function populateDynamicCategories(data) {
    const select = document.getElementById('filterCategory');
    
    // 1. Get all tags, remove empties, and make them unique using Set
    const allTags = data.map(item => item.tag).filter(tag => tag && tag.trim() !== '');
    const uniqueTags = [...new Set(allTags)].sort(); // Sort alphabetically

    // 2. Reset dropdown to just "All Categories"
    select.innerHTML = '<option value="">All Categories</option>';

    // 3. Add the unique tags dynamically
    uniqueTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        select.appendChild(option);
    });
}

// 🟢 CLIENT-SIDE FILTER LOGIC (Fast & Safe)
function applyFilters() {
    const search = document.getElementById('filterSearch').value.toLowerCase();
    const category = document.getElementById('filterCategory').value;
    const tableBody = document.getElementById('reports-table-body');

    // Filter the global data array
    const filtered = allReportsData.filter(item => {
        // Handle null/undefined values safely before calling toLowerCase()
        const targetPhone = (item.target_phone || '').toLowerCase();
        const reporterName = (item.reporter_name || '').toLowerCase();
        const comment = (item.comment || '').toLowerCase();
        const location = (item.location || '').toLowerCase(); // Added Location to search
            
        const matchesSearch = 
            targetPhone.includes(search) || 
            reporterName.includes(search) ||
            comment.includes(search) ||
            location.includes(search);
            
        const matchesCategory = category === "" || item.tag === category;

        return matchesSearch && matchesCategory;
    });

    // Render HTML
    if(filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No matching reports found.</td></tr>';
        return;
    }

    tableBody.innerHTML = filtered.map((item, index) => `
        <tr style="animation-delay: ${index * 0.05}s" class="stagger-row">
            <td class="ps-4">
                <span class="fw-bold text-danger font-monospace fs-6">${item.target_phone}</span>
            </td>
            
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-1 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                        <i class="ph-fill ph-user"></i>
                    </div>
                    <span class="fw-medium text-dark">${item.reporter_name || 'Anonymous'}</span>
                </div>
            </td>

            <td>
                <span class="badge bg-secondary bg-opacity-10 text-dark border px-2 py-1">
                    ${item.tag || 'Spam'}
                </span>
            </td>

            <td class="text-muted small">
                ${item.location ? `<i class="ph-fill ph-map-pin text-muted me-1"></i> ${item.location}` : '<span class="text-black-50">-</span>'}
            </td>

            <td class="text-muted small text-truncate" style="max-width: 250px;" title="${item.comment || ''}">
                ${item.comment || '<span class="text-black-50 fst-italic">No comment</span>'}
            </td>

            <td class="text-end pe-4 small text-muted font-monospace">
                ${item.date}
            </td>
        </tr>
    `).join('');
}

// Load on start
document.addEventListener('DOMContentLoaded', loadReports);
</script>

<?php include 'includes/footer.php'; ?>