/**
 * EZIO - MODULE PARTAGÉ (Core)
 * Gère l'état global, la navigation et les utilitaires.
 */

let IA_CONFIG = null;

// État Global de l'application accessible par tous les fichiers
// -- DOM ELEMENTS COMMUNS --
const auditView = document.getElementById('audit-view');
const creatorView = document.getElementById('creator-view');
const dashboardView = document.getElementById('dashboard-view');
const modelsView = document.getElementById('models-view');
const reportsView = document.getElementById('reports-view');
const deliveriesView = document.getElementById('deliveries-view');

// -- UI ELEMENTS --
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const btnShowApp = document.getElementById('btnShowApp');
const btnShowCreator = document.getElementById('btnShowCreator');
const btnShowDashboard = document.getElementById('btnShowDashboard');
const btnShowModels = document.getElementById('btnShowModels');
const btnShowReports = document.getElementById('btnShowReports');
const btnShowDeliveries = document.getElementById('btnShowDeliveries');
const themeBtn = document.getElementById('themeBtn');
const btnDocs = document.getElementById('btnDocs');
const resetBtn = document.getElementById('resetBtn');
const loadBtn = document.getElementById('loadBtn');
const exportBtn = document.getElementById('exportBtn');
const saveBtn = document.getElementById('saveBtn');

// -- NOTES TOOL --
const btnToggleNotes = document.getElementById('btnToggleNotes');
const notesContainer = document.getElementById('notesContainer');
const btnCloseNotes = document.getElementById('btnCloseNotes');
const notesTextarea = document.getElementById('notesTextarea');

// -- STATE MANAGEMENT --
const STORAGE_KEY = 'ezio_audit_data';

// Initial State Schema
const INITIAL_STATE = {
    columns: [],
    rows: [],
    rowMeta: [],
    statics: [],
    notes: "",
    deliveries: [] // Ensure deliveries array exists
};

// Initialize Store
window.EzioStore = new Store(STORAGE_KEY, INITIAL_STATE);

// PROXY for Backward Compatibility (Read-Only access to state)
Object.defineProperty(window, 'EzioData', {
    get: function () { return window.EzioStore.get(); },
    configurable: true
});

// Alias for legacy code (write operations should go through Store)
let currentForm = window.EzioStore.get();

// Subscribe to update local reference
window.EzioStore.subscribe((newState) => {
    currentForm = newState;
    // Log for debugging
    // console.log("State Updated:", newState);
});

// -- INITIALISATION --
window.addEventListener('DOMContentLoaded', async () => {
    // 2. Thème
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        if (themeBtn) themeBtn.textContent = '🌙';
    }

    // 3. Charger les données (Déjà fait par Store constructor, mais on force update UI)
    loadState();

    // 4. Vue par défaut
    switchView('app');

    // ... (listeners)
});

// Legacy shim for saveState (redirects to Store)
function saveState() {
    window.EzioStore.save();
    window.EzioStore.notify(); // Force UI update if needed
}

// Legacy shim for loadState (mostly for initial render)
function loadState() {
    // Store already loaded from localStorage in constructor
    const state = window.EzioStore.get();

    // UI Updates based on state
    if (notesTextarea) notesTextarea.value = state.notes || "";

    // Rendu initial
    if (typeof renderApp === 'function') renderApp();
}

// -- NAVIGATION --
if (btnShowCreator) btnShowCreator.onclick = () => switchView('creator');
if (btnShowApp) btnShowApp.onclick = () => switchView('app');
if (btnShowDashboard) btnShowDashboard.onclick = () => switchView('dashboard');
if (btnShowModels) btnShowModels.onclick = () => switchView('models');
if (btnShowReports) btnShowReports.onclick = () => switchView('reports');
if (btnShowDeliveries) btnShowDeliveries.onclick = () => switchView('deliveries');

function switchView(view) {
    if (!creatorView || !auditView || !dashboardView || !modelsView) return;

    // 1. Masquer toutes les VUES (Contenu principal)
    // 1. Masquer toutes les VUES (Contenu principal)
    [auditView, creatorView, dashboardView, modelsView, reportsView, deliveriesView].forEach(el => el && el.classList.add('hidden'));

    // 2. Gestion de la visibilité des BOUTONS D'ACTION (Load/Save/Reset)
    // Visibles pour Audit et Dashboard, Cachés pour Creator et Models
    const actionBtns = [loadBtn, exportBtn, saveBtn, resetBtn];
    if (view === 'app' || view === 'dashboard') {
        actionBtns.forEach(btn => btn && btn.classList.remove('hidden'));
    } else {
        actionBtns.forEach(btn => btn && btn.classList.add('hidden'));
    }

    // 3. Gestion de l'état ACTIF des boutons de navigation
    // 3. Gestion de l'état ACTIF des boutons de navigation
    [btnShowApp, btnShowCreator, btnShowDashboard, btnShowModels, btnShowReports, btnShowDeliveries].forEach(btn => btn && btn.classList.remove('btn-active-view'));

    if (view === 'creator') {
        creatorView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
        if (btnShowCreator) btnShowCreator.classList.add('btn-active-view');
        // Sync with global state
        if (typeof loadFromGlobalState === 'function') {
            loadFromGlobalState(currentForm);
        }
    }
    else if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.remove('hidden');
        if (btnShowDashboard) btnShowDashboard.classList.add('btn-active-view');
        if (typeof renderDashboard === 'function') renderDashboard();
    }
    else if (view === 'models') {
        modelsView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
        if (btnShowModels) btnShowModels.classList.add('btn-active-view');
        if (typeof initModelManager === 'function') initModelManager();
    }
    else if (view === 'reports') {
        if (reportsView) reportsView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
        if (btnShowReports) btnShowReports.classList.add('btn-active-view');
        // Initialisation du module Reports
        if (typeof AppReports !== 'undefined' && typeof AppReports.init === 'function') {
            AppReports.init();
        }
    }
    else if (view === 'deliveries') {
        if (deliveriesView) deliveriesView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
        if (btnShowDeliveries) btnShowDeliveries.classList.add('btn-active-view');
        // Initialisation du module Livrables
        if (typeof AppDeliveries !== 'undefined' && typeof AppDeliveries.init === 'function') {
            AppDeliveries.init();
        }
    }
    else { // APP (Audit) - Vue par défaut
        auditView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.remove('hidden');
        if (btnShowApp) btnShowApp.classList.add('btn-active-view');
        if (typeof renderApp === 'function') renderApp();
    }
}

// -- LISTENERS GLOBAUX --
if (btnDocs) {
    btnDocs.onclick = () => window.open('docs/documentation.html', '_blank');
}

themeBtn.onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Rafraichir les vues si nécessaire
    if (!dashboardView.classList.contains('hidden') && typeof renderDashboard === 'function') renderDashboard();
};

if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = () => document.body.classList.toggle('menu-closed');
}

resetBtn.onclick = () => {
    if (confirm("Effacer toutes les données ?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload(); // Le rechargement relancera switchView('app') via DOMContentLoaded
    }
};

if (saveBtn) {
    saveBtn.onclick = () => {
        saveState();
        // Le comportement attendu est un export JSON
        downloadJSON(currentForm, 'ezio_data.json');
    };
}

// -- NOTES TOOL LISTENERS --
if (btnToggleNotes && notesContainer) {
    btnToggleNotes.onclick = () => {
        notesContainer.classList.toggle('hidden');
        if (!notesContainer.classList.contains('hidden')) {
            if (notesTextarea) notesTextarea.focus();
        }
    };

    // Drag Logic
    const notesHeader = notesContainer.querySelector('.notes-header');
    if (notesHeader) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        notesHeader.onmousedown = (e) => {
            if (e.target.closest('button')) return; // Ignore close button

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = notesContainer.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Switch to absolute positioning relative to viewport
            notesContainer.style.right = 'auto';
            notesContainer.style.bottom = 'auto';
            notesContainer.style.left = `${initialLeft}px`;
            notesContainer.style.top = `${initialTop}px`;
            notesContainer.style.transition = 'none'; // Disable transition for direct manipulation
        };

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            notesContainer.style.left = `${initialLeft + dx}px`;
            notesContainer.style.top = `${initialTop + dy}px`;
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                notesContainer.style.transition = ''; // Restore transition
            }
        });
    }
}

if (btnCloseNotes && notesContainer) {
    btnCloseNotes.onclick = () => notesContainer.classList.add('hidden');
}

if (notesTextarea) {
    notesTextarea.oninput = (e) => {
        // Update local reference and Store
        currentForm.notes = e.target.value;
        window.EzioStore.update({ notes: e.target.value });
    };
}

// -- UTILS --
function toSlug(str) {
    return Utils.toSlug(str);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}