import { DOM } from './DOM.js';
import { currentForm } from '../core/State.js';

// Modules d'initialisation (seront importés dynamiquement ou passés en callback pour éviter les cycles)
// Pour l'instant, on utilise des événements ou on suppose que les fonctions sont globales (transition)
// Ou mieux : on exporte une fonction setModuleInits

let moduleInits = {};

export function registerModuleInit(name, initFn) {
    moduleInits[name] = initFn;
}

export function initRouter() {
    window.addEventListener('hashchange', handleHashChange);
    // Initial load
    handleHashChange();
}

function handleHashChange() {
    let hash = window.location.hash.substring(1); // remove '#'
    console.log('[Router] Hash changed to:', hash);
    if (!hash) {
        console.log('[Router] No hash, forcing to #app');
        // Default route
        hash = 'app';
        // Force the hash in the URL immediately so history is consistent
        window.history.replaceState(null, null, '#app');
    }
    console.log('[Router] Switching view to:', hash);
    switchView(hash, true); // true = called by router, don't update hash again
}

export function switchView(view, fromRouter = false) {
    if (!fromRouter) {
        window.location.hash = view;
        return; // The 'hashchange' event will trigger handleHashChange to do the actual switching
    }

    // 1. Masquer toutes les VUES
    [DOM.auditView, DOM.creatorView, DOM.dashboardView, DOM.modelsView, DOM.reportsView, DOM.deliveriesView, DOM.deliveriesV2View]
        .forEach(el => el && el.classList.add('hidden'));

    // 2. Boutons d'action : Désormais dans le menu global, ils ne doivent plus être masqués par vue.
    // La logique de désactivation (disabled) est gérée par App.js / State.js
    // On conserve le tableau si besoin pour d'autres usages, mais on ne toggle plus 'hidden'

    // 3. Reset Active State boutons nav
    [DOM.btnShowApp, DOM.btnShowCreator, DOM.btnShowDashboard, DOM.btnShowModels, DOM.btnShowReports, DOM.btnShowDeliveries]
        .forEach(btn => btn && btn.classList.remove('btn-active-view'));

    // 4. sidebar toggle visibility
    // LE MENU PRINCIPAL DOIT RESTER VISIBLE PARTOUT
    if (DOM.toggleSidebarBtn) DOM.toggleSidebarBtn.classList.remove('hidden');

    switch (view) {
        case 'creator':
            DOM.creatorView.classList.remove('hidden');
            if (DOM.btnShowCreator) DOM.btnShowCreator.classList.add('btn-active-view');
            moduleInits.creator && moduleInits.creator(currentForm);
            break;

        case 'dashboard':
            DOM.dashboardView.classList.remove('hidden');
            // if (DOM.toggleSidebarBtn) DOM.toggleSidebarBtn.classList.remove('hidden'); // Already visible
            if (DOM.btnShowDashboard) DOM.btnShowDashboard.classList.add('btn-active-view');
            moduleInits.dashboard && moduleInits.dashboard();
            break;

        case 'models':
            DOM.modelsView.classList.remove('hidden');
            if (DOM.btnShowModels) DOM.btnShowModels.classList.add('btn-active-view');
            moduleInits.models && moduleInits.models();
            break;

        case 'reports':
            if (DOM.reportsView) DOM.reportsView.classList.remove('hidden');
            if (DOM.btnShowReports) DOM.btnShowReports.classList.add('btn-active-view');
            moduleInits.reports && moduleInits.reports();
            break;

        case 'deliveries':
            if (DOM.deliveriesView) DOM.deliveriesView.classList.remove('hidden');
            if (DOM.btnShowDeliveries) DOM.btnShowDeliveries.classList.add('btn-active-view');
            moduleInits.deliveries && moduleInits.deliveries();
            break;

        case 'deliveries_v2':
            if (DOM.deliveriesV2View) DOM.deliveriesV2View.classList.remove('hidden');
            if (DOM.btnShowDeliveries) DOM.btnShowDeliveries.classList.add('btn-active-view');
            moduleInits.deliveries_v2 && moduleInits.deliveries_v2();
            break;

        case 'app':
        default:
            DOM.auditView.classList.remove('hidden');
            // if (DOM.toggleSidebarBtn) DOM.toggleSidebarBtn.classList.remove('hidden'); // Already visible
            if (DOM.btnShowApp) DOM.btnShowApp.classList.add('btn-active-view');
            moduleInits.audit && moduleInits.audit();
            break;
    }
}
