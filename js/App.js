import { DOM } from './ui/DOM.js';
import { store, currentForm } from './core/State.js';
import { Utils } from './core/Utils.js';
import { switchView, registerModuleInit } from './ui/Navigation.js';
import { initNotes } from './ui/Notes.js';

// Import Functional Modules (to register themselves)
// Note: In a real module system, we might want to import them here to ensure they run.
// usage: import './modules/app_audit.js';

export const App = {
    init: async () => {
        // 1. Theme
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            if (DOM.themeBtn) DOM.themeBtn.textContent = '☀️';
        } else {
            if (DOM.themeBtn) DOM.themeBtn.textContent = '🌙';
        }

        // 2. Event Listeners Globaux
        setupGlobalListeners();

        // 3. Init Notes
        initNotes();

        // 4. Load State & Initial Render
        // The store is already loaded in State.js
        // We just need to render the initial view

        // Wait for DOM (already waited by main.js usually)

        // Default View
        switchView('app');
    }
};

function setupGlobalListeners() {
    // Navigation Buttons
    if (DOM.btnShowCreator) DOM.btnShowCreator.onclick = () => switchView('creator');
    if (DOM.btnShowApp) DOM.btnShowApp.onclick = () => switchView('app');
    if (DOM.btnShowDashboard) DOM.btnShowDashboard.onclick = () => switchView('dashboard');
    if (DOM.btnShowModels) DOM.btnShowModels.onclick = () => switchView('models');
    if (DOM.btnShowReports) DOM.btnShowReports.onclick = () => switchView('reports');
    if (DOM.btnShowDeliveries) DOM.btnShowDeliveries.onclick = () => switchView('deliveries');

    // Sidebar
    if (DOM.toggleSidebarBtn) {
        DOM.toggleSidebarBtn.onclick = () => document.body.classList.toggle('menu-closed');
    }

    // Docs
    if (DOM.btnDocs) {
        DOM.btnDocs.onclick = () => window.open('docs/documentation.html', '_blank');
    }

    // Theme
    if (DOM.themeBtn) {
        DOM.themeBtn.onclick = () => {
            const isDark = document.body.classList.toggle('dark-mode');
            DOM.themeBtn.textContent = isDark ? '☀️' : '🌙';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');

            // Refresh dashboard if visible (handled by dashboard module internal subscription or re-render)
            if (!DOM.dashboardView.classList.contains('hidden')) {
                // If dashboard module is loaded, we might want to reload it.
                // For now, simple theme toggle works via CSS variables mostly.
                // Chart.js might need update, handled in dashboard module.
            }
        };
    }

    // Actions
    if (DOM.resetBtn) {
        DOM.resetBtn.onclick = () => {
            if (confirm("Effacer toutes les données ?")) {
                localStorage.removeItem(store.key);
                location.reload();
            }
        };
    }

    if (DOM.saveBtn) {
        DOM.saveBtn.onclick = () => {
            store.save();
            store.notify(); // Force UI update
            Utils.downloadJSON(store.get(), 'ezio_data.json');
        };
    }
}
