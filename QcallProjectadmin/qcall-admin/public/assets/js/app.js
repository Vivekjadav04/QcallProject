/**
 * ------------------------------------------------------------------
 * 1. CORE UTILITIES
 * ------------------------------------------------------------------
 */

// Global Chart Instances (To prevent memory leaks/duplicates)
let growthChartInstance = null;
let riskChartInstance = null;
let categoryChartInstance = null;
let currentPage = 1;

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`api/${endpoint}`, options);
        return await response.json();
    } catch (error) {
        return { success: false, message: "Network Error" };
    }
}

/**
 * 🟢 HELPER: Generate Skeleton HTML
 */
function getTableSkeleton(rows = 5, cols = 5) {
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `<tr>`;
        for (let j = 0; j < cols; j++) {
            const content = j === 0 
                ? '<div class="d-flex align-items-center"><div class="skeleton skeleton-avatar me-2"></div><div class="skeleton skeleton-text" style="width: 100px;"></div></div>'
                : '<div class="skeleton skeleton-text"></div>';
            html += `<td class="py-3">${content}</td>`;
        }
        html += `</tr>`;
    }
    return html;
}

/**
 * 🟢 HELPER: Animate Rows One by One
 */
function animateRows(containerId) {
    const rows = document.querySelectorAll(`#${containerId} tr`);
    rows.forEach((row, index) => {
        row.classList.add('stagger-row');
        row.style.animationDelay = `${index * 0.05}s`;
    });
}

function setText(id, val) {
    if(document.getElementById(id)) document.getElementById(id).innerText = val;
}

/**
 * ------------------------------------------------------------------
 * 2. LOGIN LOGIC
 * ------------------------------------------------------------------
 */
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('alertMsg');
    
    msg.classList.add('d-none');
    
    const result = await apiCall('login.php', 'POST', { email, password });
    
    if (result.success) {
        window.location.href = 'dashboard.php';
    } else {
        msg.textContent = result.message;
        msg.classList.remove('d-none');
    }
}

/**
 * ------------------------------------------------------------------
 * 3. DASHBOARD LOGIC (LUXURY CHARTS)
 * ------------------------------------------------------------------
 */

async function loadFullDashboard() {
    // 1. Show Skeletons for Text
    const counters = ['val-new-users', 'val-total-users', 'val-reports-month', 'val-total-reports', 'val-contacts', 'val-global'];
    counters.forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = '<div class="skeleton skeleton-text w-50"></div>';
    });

    // 2. Show Skeleton for Table
    const tableBody = document.getElementById('dash-table');
    if (tableBody) tableBody.innerHTML = getTableSkeleton(5, 4);

    // 3. Fetch Real Data
    const result = await apiCall('stats.php');

    if (!result.success) return;

    // 4. Populate Text Counters
    const s = result.stats;
    setText('val-new-users', s.new_users_month);
    setText('val-total-users', s.total_users);
    setText('val-reports-month', s.reports_month);
    setText('val-total-reports', s.total_reports);
    setText('val-contacts', s.total_contacts);
    setText('val-global', s.global_db);

    // 5. Render Recent Data Table
    if (tableBody) {
        if (result.table.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No recent activity.</td></tr>';
        } else {
            tableBody.innerHTML = result.table.map((row, index) => `
                <tr class="stagger-row" style="animation-delay: ${index * 0.05}s">
                    <td class="ps-4 fw-bold font-monospace">${row.phone}</td>
                    <td>${row.name}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="progress flex-grow-1 me-2" style="height:5px; max-width:80px;">
                                <div class="progress-bar ${row.score > 70 ? 'bg-danger' : 'bg-success'}" style="width:${row.score}%"></div>
                            </div>
                            <small class="text-muted fw-bold">${row.score}</small>
                        </div>
                    </td>
                    <td class="text-end pe-4 text-muted small">${row.date}</td>
                </tr>
            `).join('');
        }
    }

    // 6. Render Charts
    renderCharts(result.charts);
}

function renderCharts(data) {
    // A. Growth Chart (Luxury Gradient Line)
    const ctx1 = document.getElementById('growthChart');
    if (ctx1) {
        if (growthChartInstance) growthChartInstance.destroy();
        
        const ctx = ctx1.getContext('2d');
        // Create Gradient Fade
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)'); // Transparent

        growthChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'New Data Points',
                    data: data.growth,
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, // Smooth Curve
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { borderDash: [5, 5] }, beginAtZero: true },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // B. Risk Chart (Donut - Restored)
    const ctx2 = document.getElementById('riskChart');
    if (ctx2) {
        if (riskChartInstance) riskChartInstance.destroy();
        riskChartInstance = new Chart(ctx2.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Safe', 'Suspicious', 'Critical'],
                datasets: [{
                    data: data.risk,
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    hoverOffset: 6,
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { position: 'right' } } 
            }
        });
    }

    // C. Categories Chart (Polar Area - Modern)
    const ctx3 = document.getElementById('categoryChart');
    if (ctx3) {
        if (categoryChartInstance) categoryChartInstance.destroy();
        
        categoryChartInstance = new Chart(ctx3.getContext('2d'), {
            type: 'polarArea',
            data: {
                labels: data.categories.labels, 
                datasets: [{
                    data: data.categories.data,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.7)', // Indigo
                        'rgba(239, 68, 68, 0.7)',  // Red
                        'rgba(245, 158, 11, 0.7)', // Amber
                        'rgba(16, 185, 129, 0.7)', // Emerald
                        'rgba(139, 92, 246, 0.7)'  // Purple
                    ],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { r: { ticks: { display: false } } }, // Hide radial ticks
                plugins: { legend: { position: 'right' } } 
            }
        });
    }
}

/**
 * ------------------------------------------------------------------
 * 4. USER MANAGEMENT LOGIC
 * ------------------------------------------------------------------
 */

async function loadUsers(page = 1) {
    currentPage = page;
    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
    const tableBody = document.getElementById('users-table-body');
    const pagination = document.getElementById('pagination');

    if (!tableBody) return;

    // Show skeleton
    tableBody.innerHTML = getTableSkeleton(5, 5);

    const result = await apiCall(`users.php?page=${page}&search=${encodeURIComponent(search)}`);

    if (result.success) {
        if (result.data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No users found.</td></tr>';
        } else {
            tableBody.innerHTML = result.data.map(u => `
                <tr>
                    <td class="ps-4">
                        <a href="user-profile.php?id=${u.id}" class="d-flex align-items-center text-decoration-none text-dark">
                            <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width:35px; height:35px; font-size:14px;">
                                ${u.name.charAt(0)}
                            </div>
                            <div class="d-flex flex-column">
                                <span class="fw-bold user-select-none">${u.name}</span>
                                <span class="text-muted small" style="font-size: 11px;">View Profile</span>
                            </div>
                        </a>
                    </td>
                    <td>${u.phone}</td>
                    <td>
                        <span class="badge ${u.type === 'platinum' ? 'bg-info' : (u.type === 'gold' ? 'bg-warning text-dark' : 'bg-secondary')}">
                            ${u.type.toUpperCase()}
                        </span>
                    </td>
                    <td>${u.joined}</td>
                    <td class="text-end pe-4">
                        <a href="user-profile.php?id=${u.id}" class="btn btn-sm btn-outline-primary me-1"><i class="ph-bold ph-eye"></i></a>
                        
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick='openEditModal(${JSON.stringify(u)})'><i class="ph-bold ph-pencil-simple"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')"><i class="ph-bold ph-trash"></i></button>
                    </td>
                </tr>
            `).join('');
            
            animateRows('users-table-body');
        }

        // Pagination
        const totalPages = result.pagination.pages;
        let navHtml = '';
        if (page > 1) navHtml += `<button class="btn btn-sm btn-outline-secondary" onclick="loadUsers(${page - 1})">Previous</button>`;
        navHtml += `<span class="btn btn-sm disabled mx-2">Page ${page} of ${totalPages}</span>`;
        if (page < totalPages) navHtml += `<button class="btn btn-sm btn-outline-secondary" onclick="loadUsers(${page + 1})">Next</button>`;
        pagination.innerHTML = navHtml;
    }
}

// Search Wrapper with debounce
let searchTimeout;
function searchUsers() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(1), 300);
}

// OPEN EDIT MODAL
function openEditModal(user) {
    document.getElementById('edit-id').value = user.id;
    const nameParts = user.name.split(' ');
    document.getElementById('edit-fname').value = nameParts[0] || '';
    document.getElementById('edit-lname').value = nameParts.slice(1).join(' ') || '';
    document.getElementById('edit-plan').value = user.type;

    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
}

// SAVE CHANGES
async function saveUserChanges() {
    const id = document.getElementById('edit-id').value;
    const firstName = document.getElementById('edit-fname').value;
    const lastName = document.getElementById('edit-lname').value;
    const accountType = document.getElementById('edit-plan').value;

    const result = await apiCall('users.php', 'POST', { id, firstName, lastName, accountType });

    if (result.success) {
        const modalEl = document.getElementById('editUserModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        loadUsers(currentPage);
    } else {
        alert("Failed to update: " + result.message);
    }
}

// DELETE USER
async function deleteUser(id) {
    if(!confirm("Are you sure you want to permanently delete this user?")) return;
    const result = await apiCall('users.php', 'DELETE', { id });
    if (result.success) {
        loadUsers(currentPage);
    } else {
        alert("Failed to delete user.");
    }
}

/**
 * ------------------------------------------------------------------
 * 5. EVENT LISTENERS
 * ------------------------------------------------------------------
 */
document.addEventListener('DOMContentLoaded', () => {
    // Login Page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Dashboard Page (Detects new chart elements)
    if (document.getElementById('growthChart')) { 
        loadFullDashboard(); 
    }
    
    // Users Page is loaded automatically via script tag in users.php
});