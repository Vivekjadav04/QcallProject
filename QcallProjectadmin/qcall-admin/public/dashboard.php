<?php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Auth\AuthService;
$user = AuthService::check(); 
include 'includes/header.php';
?>

<div class="row g-3 mb-4">
    <div class="col-md-3">
        <div class="stat-card p-3 h-100">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="text-muted text-uppercase small fw-bold mb-1">New Users</h6>
                    <h3 class="fw-bold mb-0 text-primary" id="val-new-users">...</h3>
                </div>
                <div class="bg-primary bg-opacity-10 p-2 rounded-circle text-primary">
                    <i class="ph-fill ph-user-plus fs-3"></i>
                </div>
            </div>
            <div class="mt-3 pt-2 border-top">
                 <small class="text-muted">Total: <span id="val-total-users" class="fw-bold">...</span></small>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="stat-card p-3 h-100">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="text-muted text-uppercase small fw-bold mb-1">Reports</h6>
                    <h3 class="fw-bold mb-0 text-danger" id="val-reports-month">...</h3>
                </div>
                <div class="bg-danger bg-opacity-10 p-2 rounded-circle text-danger">
                    <i class="ph-fill ph-flag-banner fs-3"></i>
                </div>
            </div>
            <div class="mt-3 pt-2 border-top">
                 <small class="text-muted">Total: <span id="val-total-reports" class="fw-bold">...</span></small>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="stat-card p-3 h-100">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="text-muted text-uppercase small fw-bold mb-1">Contacts</h6>
                    <h3 class="fw-bold mb-0 text-success" id="val-contacts">...</h3>
                </div>
                <div class="bg-success bg-opacity-10 p-2 rounded-circle text-success">
                    <i class="ph-fill ph-address-book fs-3"></i>
                </div>
            </div>
            <div class="mt-3 pt-2 border-top">
                 <small class="text-success fw-bold"><i class="ph-bold ph-trend-up"></i> Live Feed</small>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="stat-card p-3 h-100">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="text-muted text-uppercase small fw-bold mb-1">Global DB</h6>
                    <h3 class="fw-bold mb-0 text-dark" id="val-global">...</h3>
                </div>
                <div class="bg-dark bg-opacity-10 p-2 rounded-circle text-dark">
                    <i class="ph-fill ph-globe-hemisphere-west fs-3"></i>
                </div>
            </div>
            <div class="mt-3 pt-2 border-top">
                 <small class="text-muted">Active Records</small>
            </div>
        </div>
    </div>
</div>

<div class="card border-0 shadow-sm mb-4">
    <div class="card-header bg-white border-0 pb-0 pt-3">
        <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
            <i class="ph-fill ph-chart-line-up text-primary"></i> Database Growth Analytics
        </h6>
    </div>
    <div class="card-body">
        <canvas id="growthChart" height="80"></canvas>
    </div>
</div>

<div class="row g-3 mb-4">
    <div class="col-md-6">
        <div class="card h-100 border-0 shadow-sm p-3">
            <div class="card-header bg-white border-0 pb-0">
                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
                    <i class="ph-fill ph-shield-check text-success"></i> Risk Distribution
                </h6>
            </div>
            <div class="card-body d-flex justify-content-center">
                <div style="height: 250px; width: 100%;">
                    <canvas id="riskChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <div class="col-md-6">
        <div class="card h-100 border-0 shadow-sm p-3">
            <div class="card-header bg-white border-0 pb-0">
                <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
                    <i class="ph-fill ph-chart-pie-slice text-warning"></i> Report Categories
                </h6>
            </div>
            <div class="card-body d-flex justify-content-center">
                <div style="height: 250px; width: 100%;">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="card border-0 shadow-sm">
    <div class="card-header bg-white py-3">
         <h6 class="mb-0 fw-bold">Recent Updates</h6>
    </div>
    <div class="card-body p-0">
        <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
                <tr>
                    <th class="ps-4">Number</th>
                    <th>Identified As</th>
                    <th>Risk Score</th>
                    <th class="text-end pe-4">Updated</th>
                </tr>
            </thead>
            <tbody id="dash-table"></tbody>
        </table>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>document.addEventListener('DOMContentLoaded', loadFullDashboard);</script>

<?php include 'includes/footer.php'; ?>