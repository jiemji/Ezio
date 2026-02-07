/**
 * EZIO - MODULE PARTAGÉ (Core)
 * Gère l'état global, la navigation et les utilitaires.
 */

const STORAGE_KEY = 'adminform_data_v1';
let IA_CONFIG = null;

// État Global de l'application accessible par tous les fichiers
let currentForm = { columns: [], rows: [], statics: [] };

// -- DOM ELEMENTS COMMUNS --
const auditView = document.getElementById('audit-view');
const creatorView = document.getElementById('creator-view');
const dashboardView = document.getElementById('dashboard-view');

const btnShowModels = document.getElementById('btnShowModels');
const modelsView = document.getElementById('models-view');

// -- NAVIGATION --
if (btnShowCreator) btnShowCreator.onclick = () => switchView('creator');
if (btnShowApp) btnShowApp.onclick = () => switchView('app');
if (btnShowDashboard) btnShowDashboard.onclick = () => switchView('dashboard');
if (btnShowModels) btnShowModels.onclick = () => switchView('models');

function switchView(view) {
    if (!creatorView || !auditView || !dashboardView || !modelsView) return;

    // 1. Masquer toutes les VUES (Contenu principal)
    [auditView, creatorView, dashboardView, modelsView].forEach(el => el.classList.add('hidden'));

    // 2. Afficher la VUE demandée
    // On ne touche PLUS à la visibilité des boutons (header), ils restent fixes.

    if (view === 'creator') {
        creatorView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
    }
    else if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.remove('hidden');
        if (typeof renderDashboard === 'function') renderDashboard();
    }
    else if (view === 'models') {
        modelsView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.add('hidden');
        if (typeof initModelManager === 'function') initModelManager();
    }
    else { // APP (Audit) - Vue par défaut
        auditView.classList.remove('hidden');
        if (toggleSidebarBtn) toggleSidebarBtn.classList.remove('hidden');
        if (typeof renderApp === 'function') renderApp();
    }
}

// -- LISTENERS GLOBAUX --
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

// -- UTILS --
function toSlug(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}