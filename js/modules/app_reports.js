import { registerModuleInit } from '../ui/Navigation.js';
import { Sidebar } from '../ui/Sidebar.js';
import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';
import { reportsStore, reportsData } from '../core/State.js';
import { Schemas } from '../core/Schemas.js';
import { ReportsRenderer } from './ReportsRenderer.js';

let availableModels = [];
let selection = { id: null, type: null };

let reportsSidebar = null;
let modulesSidebar = null;

const els = {
    sidebar: null,
    main: null
};

export function initReports() {
    registerModuleInit('reports', renderReportsModule);
}

async function renderReportsModule() {
    els.sidebar = document.querySelector('#reports-view .reports-sidebar');
    els.main = document.querySelector('#reports-view .reports-main');

    setupSidebar();

    // Subscribe to store updates to auto-refresh UI
    reportsStore.subscribe(() => {
        // Only re-render if we are visible? 
        // For now, simple re-render of lists is enough
        renderSidebarLists();
        // If the selected item was deleted or changed, we might need to handle it?
        // But for now, let's keep renderMainView manual or check if selection exists
    });

    await loadData();
    await loadModelsList();
    renderSidebarLists();
    renderMainView();
}

function setupSidebar() {
    if (!els.sidebar) return;

    els.sidebar.innerHTML = `
        <div class="rpt-sidebar-header">
            <h3>Rapports IA</h3>
            <button id="btnSaveReportsDisk" class="btn-primary small" title="Télécharger reports.json">
                💾 Sauver
            </button>
        </div>
        <div id="rptSidebarReports"></div>
        <div id="rptSidebarModules"></div>
    `;

    reportsSidebar = new Sidebar('rptSidebarReports', '', [], {
        listTitle: 'Mes Rapports',
        onAddClick: handleAddReport,
        onItemClick: (item) => {
            selection = { id: item.id, type: 'report' };
            renderSidebarLists();
            renderMainView();
        }
    });

    modulesSidebar = new Sidebar('rptSidebarModules', '', [], {
        listTitle: 'Bibliothèque Modules',
        onAddClick: handleAddModule,
        onItemClick: (item) => {
            selection = { id: item.id, type: 'module' };
            renderSidebarLists();
            renderMainView();
        },
        itemRenderer: (item) => `
            <span class="item-name">${Utils.escapeHtml(item.name || 'Sans nom')}</span>
            <small style="color:var(--text-muted); font-size:0.75rem;">(${item.type || '?'})</small>
        `
    });

    reportsSidebar.render();
    modulesSidebar.render();

    const btnSave = document.getElementById('btnSaveReportsDisk');
    if (btnSave) btnSave.addEventListener('click', downloadReportsJSON);
}

async function loadData() {
    // Data is already loaded by State.js constructor, but we might want to check for defaults if empty
    if (reportsData.reports.length === 0 && reportsData.modules.length === 0) {
        const json = await Utils.safeFetch('config/reports.json', {}, Schemas.REPORTS_DATA);
        if (json) {
            reportsStore.set({
                reports: json.reports || [],
                modules: json.modules || []
            });
            migrateReportsStructure();
        }
    } else {
        migrateReportsStructure();
    }
}

function migrateReportsStructure() {
    let changed = false;
    // deep copy to avoid mutating state directly if we were strict, but here we modify and then set
    // actually, reportsData is a reference from State.js. 
    // To be clean with Store, we should clone, modify, then set.

    const newState = JSON.parse(JSON.stringify(reportsData));

    newState.reports.forEach(rpt => {
        if (rpt.structure && rpt.structure.length > 0 && typeof rpt.structure[0] === 'string') {
            rpt.structure = rpt.structure.map(modId => {
                const originalMod = newState.modules.find(m => m.id === modId);
                const baseConfig = originalMod ? JSON.parse(JSON.stringify(originalMod.config || {})) : {};
                return {
                    sourceId: modId,
                    instanceId: Utils.generateId('inst'),
                    config: baseConfig
                };
            });
            changed = true;
        }
    });

    if (changed) {
        reportsStore.set(newState);
    }
}

async function loadModelsList() {
    const data = await Utils.safeFetch('config/models.json');
    if (data && Array.isArray(data)) {
        availableModels = data;
    }
}

function saveToLocalStorage() {
    // We update the store with the current 'reportsData' object
    // Since 'reportsData' is a reference to the store's state (via export let), 
    // and we might have mutated it directly in other functions (which is bad practice but common in legacy refactor),
    // we should ideally clone-modify-set. 
    // BUT, for this step, to be safe and ensure the Store saves:
    reportsStore.set(reportsData);

    // Note: The Store class handles the actual localStorage.setItem
}

function renderSidebarLists() {
    if (reportsSidebar) {
        reportsSidebar.setSelection(selection.type === 'report' ? selection.id : null);
        reportsSidebar.setItems(reportsData.reports);
    }
    if (modulesSidebar) {
        modulesSidebar.setSelection(selection.type === 'module' ? selection.id : null);
        modulesSidebar.setItems(reportsData.modules);
    }
}

function renderMainView() {
    if (!els.main) return;

    const context = {
        selection,
        data: {},
        availableModels,
        actions: {
            onAddModuleToReport: () => {
                const report = reportsData.reports.find(r => r.id === selection.id);
                if (report) showAddModuleModal(report);
            },
            onDeleteReport: () => {
                if (confirm('Supprimer ce modèle ?')) {
                    reportsData.reports = reportsData.reports.filter(r => r.id !== selection.id);
                    selection = { id: null, type: null };
                    saveToLocalStorage();
                    renderSidebarLists();
                    renderMainView();
                }
            },
            onMoveModule: (index, dir) => {
                const report = reportsData.reports.find(r => r.id === selection.id);
                if (report) {
                    if (index + dir < 0 || index + dir >= report.structure.length) return;
                    const temp = report.structure[index];
                    report.structure[index] = report.structure[index + dir];
                    report.structure[index + dir] = temp;
                    saveToLocalStorage();
                    renderMainView();
                }
            },
            onRemoveModule: (index) => {
                const report = reportsData.reports.find(r => r.id === selection.id);
                if (report && confirm("Retirer ce module du modèle ?")) {
                    report.structure.splice(index, 1);
                    saveToLocalStorage();
                    renderMainView();
                }
            },
            onDeleteModule: () => {
                if (confirm('Supprimer ce module ?')) {
                    reportsData.modules = reportsData.modules.filter(m => m.id !== selection.id);
                    reportsData.reports.forEach(r => {
                        if (r.structure) {
                            r.structure = r.structure.filter(inst => inst.sourceId !== selection.id);
                        }
                    });
                    selection = { id: null, type: null };
                    saveToLocalStorage();
                    renderSidebarLists();
                    renderMainView();
                }
            },
            onUpdateReportName: (newName) => {
                const report = reportsData.reports.find(r => r.id === selection.id);
                if (report) {
                    report.name = newName;
                    saveToLocalStorage();
                    renderSidebarLists();
                }
            },
            onUpdateModule: (modData) => {
                const module = reportsData.modules.find(m => m.id === selection.id);
                if (module) {
                    module.name = modData.name;
                    module.type = modData.type;
                    if (!module.config) module.config = { scope: {}, ai: {} };
                    module.config.scope.type = modData.scopeType;
                    module.config.ai.model = modData.aiModel;
                    module.config.ai.prompt = modData.aiPrompt;
                    saveToLocalStorage();
                    renderSidebarLists();
                }
            }
        }
    };

    if (selection.type === 'report') {
        context.data.report = reportsData.reports.find(r => r.id === selection.id);
        context.data.modules = reportsData.modules;
    } else if (selection.type === 'module') {
        context.data.module = reportsData.modules.find(m => m.id === selection.id);
    }

    ReportsRenderer.render(els.main, context);
}

// Old render functions removed by ReportsRenderer refactor.

function handleAddReport() {
    const modal = new Modal('modalNewReport', 'Nouveau Rapport',
        `<p>Entrez le nom du nouveau rapport :</p>
         <input type="text" id="inpNewReportName" class="form-control" style="width:100%" placeholder="Ex: Audit Complet...">`,
        [
            { label: 'Annuler', class: 'btn-secondary', onClick: (e, m) => m.close() },
            {
                label: 'Créer', class: 'btn-primary', onClick: (e, m) => {
                    const name = document.getElementById('inpNewReportName').value;
                    if (!name) return;

                    const newId = Utils.generateId('rpt');
                    reportsData.reports.push({
                        id: newId,
                        name: name,
                        deletable: true,
                        structure: []
                    });
                    saveToLocalStorage();
                    selection = { id: newId, type: 'report' };
                    renderSidebarLists();
                    renderMainView();
                    m.close();
                }
            }
        ]
    );
    modal.render();
    setTimeout(() => {
        const inp = document.getElementById('inpNewReportName');
        if (inp) inp.focus();
    }, 100);
}

function handleAddModule() {
    const modal = new Modal('modalNewModule', 'Nouveau Module',
        `<p>Entrez le nom du nouveau module :</p>
         <input type="text" id="inpNewModuleName" class="form-control" style="width:100%" placeholder="Ex: Analyse Financière...">`,
        [
            { label: 'Annuler', class: 'btn-secondary', onClick: (e, m) => m.close() },
            {
                label: 'Créer', class: 'btn-primary', onClick: (e, m) => {
                    const name = document.getElementById('inpNewModuleName').value;
                    if (!name) return;

                    const newId = Utils.generateId('mod');
                    reportsData.modules.push({
                        id: newId,
                        name: name,
                        type: 'analysis',
                        deletable: true,
                        config: {
                            scope: { type: 'global' },
                            ai: { model: '', prompt: '' }
                        }
                    });
                    saveToLocalStorage();
                    selection = { id: newId, type: 'module' };
                    renderSidebarLists();
                    renderMainView();
                    m.close();
                }
            }
        ]
    );
    modal.render();
    setTimeout(() => {
        const inp = document.getElementById('inpNewModuleName');
        if (inp) inp.focus();
    }, 100);
}

function showAddModuleModal(report) {
    const listItems = reportsData.modules.map(m => `
        <div class="template-item" data-id="${m.id}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <strong>${Utils.escapeHtml(m.name)}</strong> <small>(${m.type})</small>
        </div>
    `).join('');

    const content = `
        <p>Cliquez sur un module pour l'ajouter à "${Utils.escapeHtml(report.name)}"</p>
        <div style="border:1px solid var(--border); border-radius:4px; max-height:400px; overflow-y:auto;">
            ${listItems || '<div style="padding:1rem;">Aucun module disponible.</div>'}
        </div>
    `;

    const modal = new Modal('modalAddModToRpt', 'Ajouter un module', content);
    modal.render();

    if (modal.element) {
        modal.element.querySelectorAll('.template-item').forEach(item => {
            item.onclick = () => {
                const modId = item.dataset.id;
                const sourceMod = reportsData.modules.find(m => m.id === modId);
                const instance = {
                    sourceId: modId,
                    instanceId: Utils.generateId('inst'),
                    config: JSON.parse(JSON.stringify(sourceMod.config || {}))
                };
                report.structure.push(instance);
                saveToLocalStorage();
                renderReportEditor(report.id);
                modal.close();
            };
        });
    }
}

function downloadReportsJSON() {
    // Create a deep copy to avoid modifying the active state
    const dataToExport = JSON.parse(JSON.stringify(reportsData));

    // Simplify the structure for export (just module IDs)
    dataToExport.reports.forEach(rpt => {
        if (rpt.structure && Array.isArray(rpt.structure)) {
            rpt.structure = rpt.structure.map(item => {
                // If it's already a string (shouldn't be in memory, but safe to check), keep it
                if (typeof item === 'string') return item;
                // Otherwise extract the sourceId
                return item.sourceId;
            });
        }
    });

    Utils.downloadJSON(dataToExport, 'reports.json');
}
