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

// -- UI ELEMENTS --
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const btnShowApp = document.getElementById('btnShowApp');
const btnShowCreator = document.getElementById('btnShowCreator');
const btnShowDashboard = document.getElementById('btnShowDashboard');
const btnShowModels = document.getElementById('btnShowModels');
const themeBtn = document.getElementById('themeBtn');
const resetBtn = document.getElementById('resetBtn');

// -- STATE MANAGEMENT --
const STORAGE_KEY = 'ezio_audit_data';
let currentForm = {
    columns: [],
    rows: [],
    statics: []
};

// -- INITIALISATION --
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Charger Config IA (Obsolète : géré via models.json maintenant)
    // IA_CONFIG est laissé à null ou peut être supprimé si inutilisé ailleurs


    // 2. Thème
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        if (themeBtn) themeBtn.textContent = '🌙';
    }

    // 3. Charger les données
    loadState();

    // 4. Vue par défaut
    // Si on a des données, on affiche l'audit, sinon le créateur (ou audit vide)
    switchView('app');

    // Listeners Globaux
    if (themeBtn) themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeBtn.textContent = isDark ? '☀️' : '🌙';
        // Rafraichir les vues si nécessaire
        if (!dashboardView.classList.contains('hidden') && typeof renderDashboard === 'function') renderDashboard();
    };

    if (resetBtn) resetBtn.onclick = () => {
        if (confirm("Tout effacer ?")) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    };

    if (toggleSidebarBtn) {
        toggleSidebarBtn.onclick = () => document.body.classList.toggle('menu-closed');
    }
});

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentForm));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            currentForm = JSON.parse(saved);
            if (!currentForm.statics) currentForm.statics = [];
            // Rendu initial si Audit est la vue active
            if (typeof renderApp === 'function') renderApp();
        } catch (e) {
            console.error("Erreur lecture sauvegarde", e);
        }
    }
}

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
        // Sync with global state
        if (typeof loadFromGlobalState === 'function') {
            loadFromGlobalState(currentForm);
        }
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