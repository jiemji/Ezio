/**
 * EZIO - MODULE RAPPORTS
 * Gestion de l'affichage et de la manipulation des rapports et modules.
 */

const AppReports = (() => {
    // État local
    let reportsData = {
        reports: [],
        modules: []
    };
    let currentFILE = null; // Pour stocker le fichier complet si chargé
    let selectedItemId = null;
    let selectedItemType = null; // 'report' ou 'module'

    // Éléments du DOM
    const els = {
        view: document.getElementById('reports-view'),
        sidebar: document.querySelector('#reports-view .reports-sidebar'),
        main: document.querySelector('#reports-view .report-editor') // On va probablement le remplacer/vider
    };

    /**
     * Initialisation du module
     */
    async function init() {
        console.log("Reports module init...");

        // 1. Reconstruire le DOM de la Sidebar pour correspondre au layout spécifique demandé
        // Header (Save) / Liste Rapports / Liste Modules
        setupSidebarStructure();

        // 2. Charger les données (reports.json)
        await loadReportsData();

        // 3. Rendu initial
        renderLists();
    }

    /**
     * Crée la structure HTML spécifique pour le menu en 3 parties
     */
    function setupSidebarStructure() {
        if (!els.sidebar) return;

        els.sidebar.innerHTML = `
            <!-- 1. Header Section -->
            <div class="rpt-sidebar-header">
                <h3>Rapports IA</h3>
                <button id="btnSaveReportsJson" class="btn-primary small" title="Télécharger reports.json">
                    💾 Sauver
                </button>
            </div>

            <!-- 2. Reports List Section -->
            <div class="rpt-section-reports">
                <div class="section-title">Mes Rapports</div>
                <div id="rptListReports" class="rpt-list-container">
                    <!-- Items injectés ici -->
                </div>
            </div>

            <!-- 3. Modules List Section -->
            <div class="rpt-section-modules">
                <div class="section-title">Bibliothèque Modules</div>
                <div id="rptListModules" class="rpt-list-container">
                    <!-- Items injectés ici -->
                </div>
            </div>
        `;

        // Attacher l'event listener sur le bouton Save fraîchement créé
        document.getElementById('btnSaveReportsJson').addEventListener('click', downloadReportsJson);
    }

    /**
     * Charge les données depuis reports.json
     */
    async function loadReportsData() {
        try {
            const response = await fetch('reports.json');
            if (!response.ok) throw new Error('Erreur chargement reports.json');
            currentFILE = await response.json();

            reportsData.reports = currentFILE.reports || [];
            reportsData.modules = currentFILE.modules || [];

            console.log("Données chargées:", reportsData);
        } catch (error) {
            console.error(error);
            alert("Impossible de charger reports.json");
        }
    }

    /**
     * Affiche les listes (Rapports et Modules)
     */
    function renderLists() {
        const listReports = document.getElementById('rptListReports');
        const listModules = document.getElementById('rptListModules');

        // Rendu Rapports
        listReports.innerHTML = '';
        reportsData.reports.forEach(rpt => {
            const el = createListItem(rpt, 'report');
            listReports.appendChild(el);
        });

        // Rendu Modules
        listModules.innerHTML = '';
        reportsData.modules.forEach(mod => {
            const el = createListItem(mod, 'module');
            listModules.appendChild(el);
        });
    }

    /**
     * Crée un élément HTML pour un item de liste
     */
    function createListItem(item, type) {
        const div = document.createElement('div');
        div.className = 'rpt-item';
        div.dataset.id = item.id;
        div.dataset.type = type;

        // Contenu simple : Nom
        div.innerHTML = `
            <span class="rpt-name">${item.name}</span>
        `;

        // Click Event -> Sélection
        div.addEventListener('click', () => {
            selectItem(item.id, type);
        });

        return div;
    }

    /**
     * Gestion de la sélection
     */
    function selectItem(id, type) {
        // Update state
        selectedItemId = id;
        selectedItemType = type;

        // Update UI (classes CSS)
        document.querySelectorAll('.rpt-item').forEach(el => {
            el.classList.remove('selected');
            if (el.dataset.id === id && el.dataset.type === type) {
                el.classList.add('selected');
            }
        });

        // Update Main View (Simple affichage pour confirmer)
        updateMainView(id, type);
    }

    /**
     * Met à jour la vue principale (droite)
     */
    function updateMainView(id, type) {
        // Pour l'instant on utilise 'reports-main' ou on réutilise '.report-editor' existant en le nettoyant
        // On va cibler le container main défini dans style_reports.css
        let mainContainer = document.querySelector('.reports-main');

        // Si la structure HTML de index.html n'a pas encore la classe .reports-main sur la partie droite, on l'ajuste
        // Le index.html a <main id="reportEditor" class="report-editor"> dans #reports-view
        // On va le forcer à utiliser notre classe pour le style
        if (!mainContainer) {
            const oldMain = document.querySelector('#reports-view .report-editor');
            if (oldMain) {
                oldMain.className = 'reports-main'; // Remplace 'report-editor' par notre classe CSS
                mainContainer = oldMain;
            } else {
                return; // Pas de container trouvé
            }
        }

        const item = (type === 'report')
            ? reportsData.reports.find(r => r.id === id)
            : reportsData.modules.find(m => m.id === id);

        if (!item) return;

        mainContainer.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="border-bottom: 2px solid var(--primary-color); padding-bottom: 1rem;">${item.name}</h1>
                <p><strong>ID:</strong> ${item.id}</p>
                <p><strong>Type:</strong> ${type === 'report' ? 'Rapport Complet' : 'Module Indépendant'}</p>
                
                <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                    <h3>Données Brutes (JSON)</h3>
                    <pre style="overflow: auto;">${JSON.stringify(item, null, 2)}</pre>
                </div>
            </div>
        `;
    }

    /**
     * Télécharge le fichier reports.json à jour
     */
    function downloadReportsJson() {
        if (!currentFILE) return;

        // Création du blob
        const dataStr = JSON.stringify(currentFILE, null, 4);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Lien de téléchargement
        const a = document.createElement('a');
        a.href = url;
        a.download = "reports.json";
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        init
    };

})();

// Auto-start si la vue est active ou au chargement global (géré par app_shared ou autre)
// Dans ce projet, le chargement est souvent déclenché par les boutons du menu.
// On écoute l'event 'show-reports' (supposition basée sur les autres fichiers) ou on expose init.

document.addEventListener('DOMContentLoaded', () => {
    // Si on a un bouton pour afficher les rapports, on hook dessus
    const btnShow = document.getElementById('btnShowReports');
    if (btnShow) {
        btnShow.addEventListener('click', () => {
            // On appelle init à chaque affichage pour rafraîchir ou une seule fois
            // Ici on va lazy load
            AppReports.init();
        });
    }
});
