/**
 * EZIO - MODULE RAPPORTS
 * Gestion de l'affichage, de la création et de l'édition des rapports et modules.
 */

const AppReports = (() => {
    // -- ETAT LOCAL --
    const STORAGE_KEY_REPORTS = 'ezio_reports_data';
    let reportsData = {
        reports: [],
        modules: []
    };
    let availableModels = []; // Chargé depuis models.json
    let selection = { id: null, type: null }; // { id, type: 'report'|'module' }

    // -- DOM ELEMENTS --
    const els = {
        sidebar: document.querySelector('#reports-view .reports-sidebar'),
        main: document.querySelector('#reports-view .reports-main'),
        // On stockera les références dynamiques ici
        listReports: null,
        listModules: null
    };

    /**
     * Initialisation principale
     */
    async function init() {
        console.log("AppReports: Init...");

        // 1. Setup global UI structure (Sidebar)
        setupSidebar();

        // 2. Charger les données (Local ou JSON)
        await loadData();
        await loadModelsList();

        // 3. Rendu initial
        renderSidebarLists();
        renderMainView();
    }

    /**
     * Structure de la Sidebar
     */
    function setupSidebar() {
        if (!els.sidebar) return;

        els.sidebar.innerHTML = `
            <!-- Header Section -->
            <div class="rpt-sidebar-header">
                <h3>Rapports IA</h3>
                <button id="btnSaveReportsDisk" class="btn-primary small" title="Télécharger reports.json">
                    💾 Sauver
                </button>
            </div>

            <!-- Reports List Section -->
            <div class="rpt-section-reports">
                <div class="section-title">
                    <span>Mes Rapports</span>
                    <button id="btnAddReport" class="btn-icon-small" title="Nouveau Rapport">+</button>
                </div>
                <div id="rptListReports" class="rpt-list-container"></div>
            </div>

            <!-- Modules List Section -->
            <div class="rpt-section-modules">
                <div class="section-title">
                    <span>Bibliothèque Modules</span>
                    <button id="btnAddModule" class="btn-icon-small" title="Nouveau Module">+</button>
                </div>
                <div id="rptListModules" class="rpt-list-container"></div>
            </div>
        `;

        // Bind References
        els.listReports = document.getElementById('rptListReports');
        els.listModules = document.getElementById('rptListModules');

        // Bind Events
        document.getElementById('btnSaveReportsDisk').addEventListener('click', downloadReportsJSON);
        document.getElementById('btnAddReport').addEventListener('click', handleAddReport);
        document.getElementById('btnAddModule').addEventListener('click', handleAddModule);
    }

    /**
     * Chargement des données
     */
    async function loadData() {
        const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
        if (saved) {
            try {
                reportsData = JSON.parse(saved);
                // Ensure structure
                if (!reportsData.reports) reportsData.reports = [];
                if (!reportsData.modules) reportsData.modules = [];

                // MIGRATION DATA : Transform module IDs strings to Objects if needed
                migrateReportsStructure();

                console.log("AppReports: Loaded from LocalStorage");
                return;
            } catch (e) {
                console.error("AppReports: Error parsing LocalStorage", e);
            }
        }

        // Fallback: reports.json
        try {
            const res = await fetch('reports.json');
            if (res.ok) {
                const json = await res.json();
                reportsData.reports = json.reports || [];
                reportsData.modules = json.modules || [];

                // MIGRATION DATA
                migrateReportsStructure();

                console.log("AppReports: Loaded from reports.json");
                saveToLocalStorage(); // Sync immediate
            }
        } catch (e) {
            console.error("AppReports: Error loading reports.json", e);
        }
    }

    /**
     * Migration logic: convert ["mod1", "mod2"] to [{sourceId: "mod1", config: {...}}, ...]
     */
    function migrateReportsStructure() {
        let changed = false;
        reportsData.reports.forEach(rpt => {
            if (rpt.structure && rpt.structure.length > 0 && typeof rpt.structure[0] === 'string') {
                console.log(`AppReports: Migrating report ${rpt.id} structure...`);
                rpt.structure = rpt.structure.map(modId => {
                    // Try to find original config to copy as default
                    const originalMod = reportsData.modules.find(m => m.id === modId);
                    const baseConfig = originalMod ? JSON.parse(JSON.stringify(originalMod.config || {})) : {};

                    return {
                        sourceId: modId,
                        instanceId: 'inst_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        config: baseConfig
                    };
                });
                changed = true;
            }
        });
        if (changed) saveToLocalStorage();
    }

    async function loadModelsList() {
        try {
            const res = await fetch('models.json');
            if (res.ok) availableModels = await res.json();
        } catch (e) {
            console.warn("AppReports: Impossible de charger models.json");
        }
    }

    function saveToLocalStorage() {
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reportsData));
    }

    /**
     * Rendu de la Sidebar
     */
    function renderSidebarLists() {
        if (!els.listReports || !els.listModules) return;

        // Rapports
        els.listReports.innerHTML = '';
        reportsData.reports.forEach(r => {
            const el = createListItem(r, 'report');
            els.listReports.appendChild(el);
        });

        // Modules
        els.listModules.innerHTML = '';
        reportsData.modules.forEach(m => {
            const el = createListItem(m, 'module');
            els.listModules.appendChild(el);
        });
    }

    function createListItem(item, type) {
        const div = document.createElement('div');
        div.className = 'rpt-item';
        if (selection.id === item.id && selection.type === type) {
            div.classList.add('selected');
        }

        div.innerHTML = `<span class="rpt-name">${escapeHtml(item.name || 'Sans nom')}</span>`;

        div.addEventListener('click', () => {
            selection = { id: item.id, type: type };
            renderSidebarLists(); // Re-render for selection highlight (could be optimized)
            renderMainView();
        });

        return div;
    }

    /**
     * Rendu Vue Principale (Editor)
     */
    function renderMainView() {
        if (!els.main) return;

        if (!selection.id) {
            els.main.innerHTML = `
                <div class="reports-empty-state">
                    <p>Sélectionnez un rapport ou un module pour commencer.</p>
                </div>`;
            return;
        }

        if (selection.type === 'report') {
            renderReportEditor(selection.id);
        } else {
            renderModuleEditor(selection.id);
        }
    }

    /**
     * EDITEUR DE RAPPORT (Horizontal Layout)
     */
    /**
     * EDITEUR DE RAPPORT (Vertical List - Template Definition)
     */
    function renderReportEditor(rptId) {
        const report = reportsData.reports.find(r => r.id === rptId);
        if (!report) return;

        // Header
        const headerHTML = `
            <div class="rpt-editor-header">
                <input type="text" id="inpRptName" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${escapeHtml(report.name)}">
                <div class="rpt-actions">
                    <button id="btnAddModuleToRpt" class="btn-primary small">+ Ajouter un module</button>
                    ${report.deletable !== false ? `<button id="btnDeleteReport" class="btn-danger small" style="margin-left:10px;">🗑️</button>` : ''}
                </div>
            </div>
        `;

        // Body (Vertical List)
        let listHTML = `<div class="rpt-vertical-list">`;

        if (!report.structure || report.structure.length === 0) {
            listHTML += `<div style="padding:2rem; color:var(--text-muted);">Ce modèle est vide. Ajoutez des modules.</div>`;
        } else {
            report.structure.forEach((inst, idx) => {
                const sourceMod = reportsData.modules.find(m => m.id === inst.sourceId) || { name: 'Module Inconnu', type: '?' };

                listHTML += `
                    <div class="rpt-template-item">
                        <span class="rpt-template-idx">${idx + 1}.</span>
                        <span class="rpt-template-name">${escapeHtml(sourceMod.name)}</span>
                        <div class="rpt-template-actions">
                             ${idx > 0 ? `<button class="btn-icon-action btn-move-up" data-idx="${idx}" title="Monter">▲</button>` : ''}
                             ${idx < report.structure.length - 1 ? `<button class="btn-icon-action btn-move-down" data-idx="${idx}" title="Descendre">▼</button>` : ''}
                             <button class="btn-icon-action danger btn-remove-mod" data-idx="${idx}" title="Retirer">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }
        listHTML += `</div>`;

        els.main.innerHTML = headerHTML + `<div class="rpt-editor-body vertical">${listHTML}</div>`;

        // -- EVENTS --
        document.getElementById('inpRptName').addEventListener('change', (e) => {
            report.name = e.target.value;
            saveToLocalStorage();
            renderSidebarLists();
        });

        document.getElementById('btnAddModuleToRpt').addEventListener('click', () => showAddModuleModal(report));

        if (document.getElementById('btnDeleteReport')) {
            document.getElementById('btnDeleteReport').addEventListener('click', () => {
                if (confirm('Supprimer ce modèle ?')) {
                    reportsData.reports = reportsData.reports.filter(r => r.id !== rptId);
                    selection = { id: null, type: null };
                    saveToLocalStorage();
                    renderSidebarLists();
                    renderMainView();
                }
            });
        }

        // List Actions
        els.main.querySelectorAll('.btn-move-up').forEach(btn => {
            btn.onclick = () => moveModule(report, parseInt(btn.dataset.idx), -1);
        });
        els.main.querySelectorAll('.btn-move-down').forEach(btn => {
            btn.onclick = () => moveModule(report, parseInt(btn.dataset.idx), 1);
        });
        els.main.querySelectorAll('.btn-remove-mod').forEach(btn => {
            btn.onclick = () => removeModule(report, parseInt(btn.dataset.idx));
        });
    }

    function moveModule(report, index, direction) {
        if (index + direction < 0 || index + direction >= report.structure.length) return;
        const temp = report.structure[index];
        report.structure[index] = report.structure[index + direction];
        report.structure[index + direction] = temp;
        saveToLocalStorage();
        renderReportEditor(report.id);
    }

    function removeModule(report, index) {
        if (confirm("Retirer ce module du modèle ?")) {
            report.structure.splice(index, 1);
            saveToLocalStorage();
            renderReportEditor(report.id);
        }
    }

    /**
     * EDITEUR DE MODULE (Bibliothèque)
     * Reste globalement inchangé, c'est l'édition de la "classe" module
     */
    function renderModuleEditor(modId) {
        const module = reportsData.modules.find(m => m.id === modId);
        if (!module) return;

        // Config defaults
        if (!module.config) module.config = {};
        if (!module.config.ai) module.config.ai = {};
        if (!module.config.scope) module.config.scope = {};

        const scopeType = module.config.scope.type || 'global';
        const aiModel = module.config.ai.model || '';
        const aiPrompt = module.config.ai.prompt || '';

        // Options Modèles
        const modelOptions = availableModels.map(m =>
            `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom} (${m.provider})</option>`
        ).join('');

        els.main.innerHTML = `
            <div class="editor-container" style="padding: 2rem; max-width: 900px; margin: 0 auto;">
                <header style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <label class="form-label" style="display:block; color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Nom du module (Bibliothèque)</label>
                    <input type="text" id="inpModName" class="form-control" style="font-size: 1.5rem; font-weight: bold; width: 100%;" value="${escapeHtml(module.name)}">
                </header>

                <div class="form-row">
                    <div class="form-col">
                        <div class="form-group">
                            <label>Type</label>
                            <select id="slcModType" class="form-control">
                                <option value="analysis" ${module.type === 'analysis' ? 'selected' : ''}>Analyse IA</option>
                                <option value="raw" ${module.type === 'raw' ? 'selected' : ''}>Données Brutes</option>
                            </select>
                        </div>
                    </div>
                     <div class="form-col">
                        <div class="form-group">
                            <label>Portée (Scope)</label>
                            <select id="slcModScope" class="form-control">
                                <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global</option>
                                <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Chapitre Spécifique</option>
                            </select>
                        </div>
                    </div>
                </div>

                <hr style="margin: 2rem 0; border:0; border-top:1px solid var(--border);">

                <h3>Configuration par défaut</h3>
                <p class="text-muted" style="margin-bottom:1rem; font-size:0.9rem;">Ces réglages seront appliqués par défaut lorsque vous ajoutez ce module un à rapport.</p>

                <div class="form-group">
                    <label>Modèle IA</label>
                    <select id="slcModLinkModel" class="form-control">
                        <option value="">-- Choisir un modèle --</option>
                        ${modelOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>Prompt / Instructions</label>
                    <textarea id="txtModPrompt" class="form-control" rows="8" placeholder="Instructions pour l'IA... (ex: Analyse les risques...)">${escapeHtml(aiPrompt)}</textarea>
                </div>

                <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                     ${module.deletable !== false ? `<button id="btnDeleteModule" class="btn-danger">Supprimer ce module</button>` : ''}
                </div>
            </div>
        `;

        // Events logic (same as before)
        const saveAll = () => {
            module.name = document.getElementById('inpModName').value;
            module.type = document.getElementById('slcModType').value;
            module.config.scope.type = document.getElementById('slcModScope').value;
            module.config.ai.model = document.getElementById('slcModLinkModel').value;
            module.config.ai.prompt = document.getElementById('txtModPrompt').value;
            saveToLocalStorage();
            renderSidebarLists();
        };

        const inputs = ['inpModName', 'slcModType', 'slcModScope', 'slcModLinkModel', 'txtModPrompt'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('change', saveAll);
            // Optional: input listener
        });

        if (document.getElementById('btnDeleteModule')) {
            document.getElementById('btnDeleteModule').addEventListener('click', () => {
                if (confirm('Supprimer ce module ? Il sera retiré de tous les rapports.')) {
                    // Remove from modules
                    reportsData.modules = reportsData.modules.filter(m => m.id !== modId);
                    // Remove from all reports -> We must check instances now
                    reportsData.reports.forEach(r => {
                        if (r.structure) {
                            r.structure = r.structure.filter(inst => inst.sourceId !== modId);
                        }
                    });

                    selection = { id: null, type: null };
                    saveToLocalStorage();
                    renderSidebarLists();
                    renderMainView();
                }
            });
        }
    }

    /**
     * Actions: Add Items
     */
    function handleAddReport(e) {
        e.stopPropagation();
        const name = prompt("Nom du nouveau rapport :");
        if (!name) return;

        const newId = 'rpt_' + Date.now();
        const newRpt = {
            id: newId,
            name: name,
            deletable: true,
            structure: []
        };
        reportsData.reports.push(newRpt);
        saveToLocalStorage();

        // Select it
        selection = { id: newId, type: 'report' };
        renderSidebarLists();
        renderMainView();
    }

    function handleAddModule(e) {
        e.stopPropagation();
        const name = prompt("Nom du nouveau module :");
        if (!name) return;

        const newId = 'mod_' + Date.now();
        const newMod = {
            id: newId,
            name: name,
            type: 'analysis',
            deletable: true,
            config: {
                scope: { type: 'global' },
                ai: {
                    model: '',
                    prompt: ''
                }
            }
        };
        reportsData.modules.push(newMod);
        saveToLocalStorage();

        selection = { id: newId, type: 'module' };
        renderSidebarLists();
        renderMainView();
    }

    function showAddModuleModal(report) {
        // ... existing logic but adding object instance structure ...
        // Create simple Modal UI on the fly
        const modalId = 'modalAddModToRpt';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.display = 'block';

        const listItems = reportsData.modules.map(m => `
            <div class="template-item" data-id="${m.id}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <strong>${escapeHtml(m.name)}</strong> <small>(${m.type})</small>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-height:80vh; overflow-y:auto;">
                <span class="close-modal" style="float:right; cursor:pointer; font-size:1.5rem;">&times;</span>
                <h3>Ajouter un module</h3>
                <p>Cliquez sur un module pour l'ajouter à "${escapeHtml(report.name)}"</p>
                <div style="border:1px solid var(--border); border-radius:4px; max-height:400px; overflow-y:auto;">
                    ${listItems || '<div style="padding:1rem;">Aucun module disponible.</div>'}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        modal.querySelector('.close-modal').onclick = () => modal.remove();

        modal.querySelectorAll('.template-item').forEach(item => {
            item.onclick = () => {
                const modId = item.dataset.id;

                // NEW: Create Instance Object
                const sourceMod = reportsData.modules.find(m => m.id === modId);
                const instance = {
                    sourceId: modId,
                    instanceId: 'inst_' + Date.now() + Math.random().toString(36).substr(2, 9), // Unique ID for this instance
                    config: JSON.parse(JSON.stringify(sourceMod.config || {})) // Copy config
                };

                report.structure.push(instance);
                saveToLocalStorage();
                renderReportEditor(report.id);
                modal.remove();
            };
        });

        window.onclick = (event) => {
            if (event.target === modal) modal.remove();
        };
    }

    /**
     * Actions: Download
     */
    function downloadReportsJSON() {
        if (!reportsData) return;
        const dataStr = JSON.stringify(reportsData, null, 4);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "reports.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * GENERATION IA
     */
    // Generation Logic removed (Moved to AppDeliveries)

    /**
     * Commons
     */
    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    return {
        init
    };
})();

// No auto-init here, executed by app_shared.js
