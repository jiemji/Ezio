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

        // 5. Subscribe to Store for Menu State
        store.subscribe(() => {
            updateMenuState();
        });
        updateMenuState(); // Initial check
    }
};

function updateMenuState() {
    // Check if data is loaded (rows exist)
    const hasData = store.get().rows.length > 0;

    // Enable/Disable buttons based on state
    // Only File actions depend on data presence
    const buttonsToToggle = [
        DOM.saveBtn,
        DOM.exportBtn,
        DOM.resetBtn
    ];

    buttonsToToggle.forEach(btn => {
        if (btn) btn.disabled = !hasData;
    });

    // Configuration items should always be accessible (to allow creating new forms/agents)
    // We ensure they are enabled (in case HTML had disabled attribute)
    [DOM.btnShowCreator, DOM.btnShowModels, DOM.btnShowReports].forEach(btn => {
        if (btn) btn.disabled = false;
    });

    // Ensure Load button is always enabled
    if (DOM.loadBtn) DOM.loadBtn.disabled = false;
}

function setupGlobalListeners() {
    // Navigation Buttons
    if (DOM.btnShowCreator) DOM.btnShowCreator.onclick = () => switchView('creator');
    if (DOM.btnShowApp) DOM.btnShowApp.onclick = () => switchView('app');
    if (DOM.btnShowDashboard) DOM.btnShowDashboard.onclick = () => switchView('dashboard');
    if (DOM.btnShowModels) DOM.btnShowModels.onclick = () => switchView('models');
    if (DOM.btnShowReports) DOM.btnShowReports.onclick = () => switchView('reports');
    if (DOM.btnShowDeliveries) DOM.btnShowDeliveries.onclick = () => switchView('deliveries');

    // Sidebar
    // Sidebar
    // Sidebar
    // Main Menu Toggle
    if (DOM.toggleSidebarBtn && DOM.mainMenu) {
        DOM.toggleSidebarBtn.onclick = (e) => {
            e.stopPropagation();
            DOM.mainMenu.classList.toggle('hidden');
        };

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!DOM.mainMenu.classList.contains('hidden') && !DOM.mainMenu.contains(e.target) && e.target !== DOM.toggleSidebarBtn) {
                DOM.mainMenu.classList.add('hidden');
            }
        });

        // Close menu when clicking an item
        DOM.mainMenu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                DOM.mainMenu.classList.add('hidden');
            });
        });
    }

    // New Sidebar Logic (Handle & Pin)
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('sidebarHandle');
    const pinBtn = document.getElementById('pinSidebarBtn');

    if (sidebar && handle) {
        // Show on Handle Hover
        handle.addEventListener('mouseenter', () => {
            sidebar.classList.add('visible');
        });

        // Hide on Mouse Leave (if not pinned)
        sidebar.addEventListener('mouseleave', () => {
            if (!sidebar.classList.contains('pinned')) {
                sidebar.classList.remove('visible');
            }
        });

        // Also allow the sidebar to stay visible if we hover from handle to sidebar directly
        // The mouseleave on sidebar handles the exit.
    }

    if (pinBtn && sidebar) {
        pinBtn.onclick = () => {
            const isPinned = sidebar.classList.toggle('pinned');
            // If pinned, ensure it's visible (though logic implies it is)
            if (isPinned) sidebar.classList.add('visible');
            // Visual feedback on button is handled by CSS (rotate)
        };
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
