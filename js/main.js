import { App } from './App.js';
import { initAudit } from './modules/app_audit.js';
import { initCreator } from './modules/app_creator.js';
import { initDashboard } from './modules/app_dashboard.js';
import { initModels } from './modules/app_models.js';
import { initReports } from './modules/app_reports.js';
import { initDeliveries } from './modules/app_deliveries.js';
import { initExport } from './modules/app_export.js';

// Initialize all modules
initAudit();
initCreator();
initDashboard();
initModels();
initReports();
initDeliveries();
initExport();

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
