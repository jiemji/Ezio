import { registerModuleInit } from '../ui/Navigation.js';
import { Sidebar } from '../ui/Sidebar.js';
import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';

const STORAGE_KEY_REPORTS = 'ezio_reports_data';
let reportsData = {
    reports: [],
    modules: []
};
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
    const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
    if (saved) {
        try {
            reportsData = JSON.parse(saved);
            if (!reportsData.reports) reportsData.reports = [];
            if (!reportsData.modules) reportsData.modules = [];
            migrateReportsStructure();
            return;
        } catch (e) {
            console.error("AppReports: Error parsing LocalStorage", e);
        }
    }

    try {
        const res = await fetch('reports.json');
        if (res.ok) {
            const json = await res.json();
            reportsData.reports = json.reports || [];
            reportsData.modules = json.modules || [];
            migrateReportsStructure();
            saveToLocalStorage();
        }
    } catch (e) {
        console.error("AppReports: Error loading reports.json", e);
    }
}

function migrateReportsStructure() {
    let changed = false;
    reportsData.reports.forEach(rpt => {
        if (rpt.structure && rpt.structure.length > 0 && typeof rpt.structure[0] === 'string') {
            rpt.structure = rpt.structure.map(modId => {
                const originalMod = reportsData.modules.find(m => m.id === modId);
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

function renderReportEditor(rptId) {
    const report = reportsData.reports.find(r => r.id === rptId);
    if (!report) return;

    const headerHTML = `
        <div class="rpt-editor-header">
            <input type="text" id="inpRptName" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${Utils.escapeHtml(report.name)}">
            <div class="rpt-actions">
                <button id="btnAddModuleToRpt" class="btn-primary small">+ Ajouter un module</button>
                ${report.deletable !== false ? `<button id="btnDeleteReport" class="btn-danger small" style="margin-left:10px;">🗑️</button>` : ''}
            </div>
        </div>
    `;

    let listHTML = `<div class="rpt-vertical-list">`;
    if (!report.structure || report.structure.length === 0) {
        listHTML += `<div style="padding:2rem; color:var(--text-muted);">Ce modèle est vide. Ajoutez des modules.</div>`;
    } else {
        report.structure.forEach((inst, idx) => {
            const sourceMod = reportsData.modules.find(m => m.id === inst.sourceId) || { name: 'Module Inconnu', type: '?' };
            listHTML += `
                <div class="rpt-template-item">
                    <span class="rpt-template-idx">${idx + 1}.</span>
                    <span class="rpt-template-name">${Utils.escapeHtml(sourceMod.name)}</span>
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

    document.getElementById('inpRptName').addEventListener('change', (e) => {
        report.name = e.target.value;
        saveToLocalStorage();
        renderSidebarLists();
    });

    document.getElementById('btnAddModuleToRpt').addEventListener('click', () => showAddModuleModal(report));

    const btnDel = document.getElementById('btnDeleteReport');
    if (btnDel) {
        btnDel.addEventListener('click', () => {
            if (confirm('Supprimer ce modèle ?')) {
                reportsData.reports = reportsData.reports.filter(r => r.id !== rptId);
                selection = { id: null, type: null };
                saveToLocalStorage();
                renderSidebarLists();
                renderMainView();
            }
        });
    }

    els.main.querySelectorAll('.btn-move-up').forEach(btn => btn.onclick = () => moveModule(report, parseInt(btn.dataset.idx), -1));
    els.main.querySelectorAll('.btn-move-down').forEach(btn => btn.onclick = () => moveModule(report, parseInt(btn.dataset.idx), 1));
    els.main.querySelectorAll('.btn-remove-mod').forEach(btn => btn.onclick = () => removeModule(report, parseInt(btn.dataset.idx)));
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

function renderModuleEditor(modId) {
    const module = reportsData.modules.find(m => m.id === modId);
    if (!module) return;

    if (!module.config) module.config = {};
    if (!module.config.ai) module.config.ai = {};
    if (!module.config.scope) module.config.scope = {};

    const scopeType = module.config.scope.type || 'global';
    const aiModel = module.config.ai.model || '';
    const aiPrompt = module.config.ai.prompt || '';

    const modelOptions = availableModels.map(m =>
        `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom} (${m.provider})</option>`
    ).join('');

    els.main.innerHTML = `
        <div class="editor-container" style="padding: 2rem; max-width: 900px; margin: 0 auto;">
            <header style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                <label class="form-label" style="display:block; color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Nom du module (Bibliothèque)</label>
                <input type="text" id="inpModName" class="form-control" style="font-size: 1.5rem; font-weight: bold; width: 100%;" value="${Utils.escapeHtml(module.name)}">
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
                <textarea id="txtModPrompt" class="form-control" rows="8" placeholder="Instructions pour l'IA... (ex: Analyse les risques...)">${Utils.escapeHtml(aiPrompt)}</textarea>
            </div>

            <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                 ${module.deletable !== false ? `<button id="btnDeleteModule" class="btn-danger">Supprimer ce module</button>` : ''}
            </div>
        </div>
    `;

    const saveAll = () => {
        module.name = document.getElementById('inpModName').value;
        module.type = document.getElementById('slcModType').value;
        module.config.scope.type = document.getElementById('slcModScope').value;
        module.config.ai.model = document.getElementById('slcModLinkModel').value;
        module.config.ai.prompt = document.getElementById('txtModPrompt').value;
        saveToLocalStorage();
        renderSidebarLists();
    };

    ['inpModName', 'slcModType', 'slcModScope', 'slcModLinkModel', 'txtModPrompt'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveAll);
    });

    const btnDel = document.getElementById('btnDeleteModule');
    if (btnDel) {
        btnDel.addEventListener('click', () => {
            if (confirm('Supprimer ce module ?')) {
                reportsData.modules = reportsData.modules.filter(m => m.id !== modId);
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
    Utils.downloadJSON(reportsData, 'reports.json');
}
