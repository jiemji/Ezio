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
const auditControls = document.getElementById('auditControls');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const btnShowApp = document.getElementById('btnShowApp');
const btnShowCreator = document.getElementById('btnShowCreator');
const btnShowDashboard = document.getElementById('btnShowDashboard');
const themeBtn = document.getElementById('themeBtn');
const resetBtn = document.getElementById('resetBtn');

// -- INITIALISATION --
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Charger Config IA
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }
    
    // 2. Thème
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = '☀️';
    } else { themeBtn.textContent = '🌙'; }

    // 3. Charger les données
    loadState();
});

// -- GESTION DE L'ÉTAT (State Management) --
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentForm));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { 
        currentForm = JSON.parse(saved);
        // Migration compatibilité
        if(!currentForm.statics) currentForm.statics = [];
        
        // Appel à la fonction de rendu de l'audit (définie dans app_audit.js)
        if(typeof renderApp === 'function') renderApp();
    }
}

// -- NAVIGATION --
if(btnShowCreator) btnShowCreator.onclick = () => switchView('creator');
if(btnShowApp) btnShowApp.onclick = () => switchView('app');
if(btnShowDashboard) btnShowDashboard.onclick = () => switchView('dashboard');

function switchView(view) {
    if(!creatorView || !auditView || !dashboardView) return; 

    // Masquer tout
    [auditView, creatorView, dashboardView].forEach(el => el.classList.add('hidden'));
    
    // Reset Header
    btnShowApp.classList.remove('hidden');
    btnShowCreator.classList.remove('hidden');
    btnShowDashboard.classList.remove('hidden');
    auditControls.classList.add('hidden');
    toggleSidebarBtn.classList.remove('hidden');

    if (view === 'creator') {
        creatorView.classList.remove('hidden');
        btnShowCreator.classList.add('hidden');
        btnShowDashboard.classList.add('hidden');
        toggleSidebarBtn.classList.add('hidden');
    } 
    else if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        btnShowDashboard.classList.add('hidden');
        // Appel fonction dashboard (définie dans app_dashboard.js)
        if(typeof renderDashboard === 'function') renderDashboard();
    }
    else { // APP (Audit)
        auditView.classList.remove('hidden');
        auditControls.classList.remove('hidden');
        btnShowApp.classList.add('hidden');
        // Appel fonction audit (définie dans app_audit.js)
        if(typeof renderApp === 'function') renderApp();
    }
}

// -- LISTENERS GLOBAUX --
themeBtn.onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Rafraichir les vues si nécessaire
    if(!dashboardView.classList.contains('hidden') && typeof renderDashboard === 'function') renderDashboard(); 
};

toggleSidebarBtn.onclick = () => document.body.classList.toggle('menu-closed');

resetBtn.onclick = () => {
    if (confirm("Effacer toutes les données ?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
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