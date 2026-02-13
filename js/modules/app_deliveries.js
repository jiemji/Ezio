import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';
import { Sidebar } from '../ui/Sidebar.js';
import { ApiService } from '../api/api_ia.js';

let availableTemplates = [];
let availableModels = [];
let availableModules = [];
let selection = { id: null };
let deliveriesSidebar = null;

const els = {
    container: null,
    sidebar: null,
    main: null
};

export function initDeliveries() {
    registerModuleInit('deliveries', renderDeliveriesModule);
}

async function renderDeliveriesModule() {
    els.container = document.getElementById('deliveries-view');
    els.sidebar = document.querySelector('#deliveries-view .deliveries-sidebar');
    els.main = document.querySelector('#deliveries-view .deliveries-main');

    setupSidebar();
    await loadTemplates();
    await loadModelsList();

    if (!currentForm.reports) {
        currentForm.reports = [];
    }

    renderSidebarList();
    renderMainView();
}

function setupSidebar() {
    if (!els.sidebar) return;

    els.sidebar.innerHTML = `
        <div class="dlv-sidebar-header">
            <h3>Livrables</h3>
        </div>
        <div id="dlvSidebarContainer" style="flex:1; display:flex; flex-direction:column; overflow:hidden;"></div>
    `;

    deliveriesSidebar = new Sidebar('dlvSidebarContainer', '', [], {
        listTitle: 'Mes Livrables',
        onAddClick: handleAddDelivery,
        onItemClick: (item) => {
            selection = { id: item.id };
            renderSidebarList();
            renderMainView();
        },
        itemRenderer: (item) => `
            <span class="dlv-name">${Utils.escapeHtml(item.name)}</span>
            <span class="dlv-date">${new Date(item.created).toLocaleDateString()}</span>
        `
    });
    deliveriesSidebar.render();
}

async function loadTemplates() {
    const saved = localStorage.getItem('ezio_reports_data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            availableTemplates = data.reports || [];
            availableModules = data.modules || [];
            return;
        } catch (e) { }
    }

    try {
        const res = await fetch('reports.json');
        if (res.ok) {
            const json = await res.json();
            availableTemplates = json.reports || [];
            availableModules = json.modules || [];
        }
    } catch (e) { }
}

async function loadModelsList() {
    try {
        const res = await fetch('models.json');
        if (res.ok) availableModels = await res.json();
    } catch (e) { }
}

function renderSidebarList() {
    if (deliveriesSidebar && currentForm.reports) {
        deliveriesSidebar.setItems(currentForm.reports);
        deliveriesSidebar.setSelection(selection.id);
    }
}

function renderMainView() {
    if (!els.main) return;

    if (!selection.id) {
        els.main.innerHTML = `
            <div class="deliveries-empty-state">
                <p>Sélectionnez un livrable pour voir son contenu ou en créer un nouveau.</p>
            </div>`;
        return;
    }

    const delivery = currentForm.reports.find(d => d.id === selection.id);
    if (!delivery) return;

    const headerHTML = `
        <div class="dlv-editor-header">
            <input type="text" id="inpDlvName" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${Utils.escapeHtml(delivery.name)}">
            <div class="dlv-actions">
                <button id="btnDownloadReport" class="btn-secondary small" style="margin-right:10px;">📥 Télécharger le Rapport</button>
                <button id="btnDeleteDelivery" class="btn-danger small" style="margin-left:10px;">🗑️ Supprimer ce Livrable</button>
            </div>
        </div>
    `;

    let trackHTML = `<div class="dlv-horizontal-track">`;
    const instances = delivery.structure || [];

    // Pre-calculate chapter hierarchy for the selector
    const hierarchy = buildChapterHierarchy();

    if (instances.length === 0) {
        trackHTML += `<div style="padding:2rem;">Ce livrable est vide.</div>`;
    }

    instances.forEach((inst, idx) => {
        const sourceModName = inst.name || ((availableModules || []).find(m => m.id === inst.sourceId) || { name: 'Module' }).name;

        // Ensure config structure exists
        if (!inst.config) inst.config = {};
        if (!inst.config.ai) inst.config.ai = {};
        if (!inst.config.scope) inst.config.scope = { type: 'global', selection: [] };

        const aiPrompt = inst.config.ai.prompt || '';
        const aiModel = inst.config.ai.model || '';
        const scopeType = inst.config.scope.type || 'global';

        // Initialize columns config if missing (default to all)
        if (!inst.config.columns) {
            inst.config.columns = (currentForm.columns || []).map(c => c.id);
        }

        trackHTML += `
            <div class="dlv-card" data-idx="${idx}">
                <div class="dlv-card-header">
                     <div class="dlv-card-nav">
                        ${idx > 0 ? `<button class="btn-card-action btn-move-left" data-idx="${idx}" title="Reculer">&lt;</button>` : ''}
                        <span style="font-weight:bold; font-size:0.9rem;">${idx + 1}. ${Utils.escapeHtml(sourceModName)}</span>
                        ${idx < instances.length - 1 ? `<button class="btn-card-action btn-move-right" data-idx="${idx}" title="Avancer">&gt;</button>` : ''}
                     </div>
                     <div class="dlv-card-actions">
                        <button class="btn-card-action danger btn-remove-mod" data-idx="${idx}" title="Retirer du livrable">🗑️</button>
                     </div>
                </div>
                <div class="dlv-card-body">
                    <div class="form-group">
                        <label>Scope (Périmètre)</label>
                        <select class="form-control slc-inst-scope" data-idx="${idx}">
                            <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                            <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                        </select>
                    </div>

                    ${renderChapterSelector(idx, scopeType, hierarchy, inst.config.scope.selection || [])}

                    <div class="form-group">
                        <label>Colonnes à inclure</label>
                        ${renderColumnSelector(idx, inst.config.columns)}
                    </div>

                    <div class="form-group" style="display:flex; align-items:center; margin-top:10px;">
                        <input type="checkbox" class="chk-format-table" data-idx="${idx}" ${inst.config.isTable ? 'checked' : ''} id="chkTable_${idx}" style="margin-right:8px;">
                        <label for="chkTable_${idx}" style="margin-bottom:0; cursor:pointer;">Tableau (Format de sortie)</label>
                    </div>

                    <div class="form-group">
                        <label>Prompt IA</label>
                        <textarea class="form-control txt-inst-prompt" data-idx="${idx}" rows="5">${Utils.escapeHtml(aiPrompt)}</textarea>
                    </div>
                     <div class="form-group">
                        <label>Modèle IA</label>
                        <select class="form-control slc-inst-model" data-idx="${idx}">
                            <option value="">-- Défaut --</option>
                            ${availableModels.map(m => `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="dlv-card-footer">
                     <button class="btn-primary small btn-generate" data-idx="${idx}" style="width:100%;">Tester / Générer</button>
                     <div class="dlv-card-result" contenteditable="true">${inst.result ? (window.marked ? window.marked.parse(inst.result) : inst.result) : ''}</div>
                </div>
            </div>
        `;
    });
    trackHTML += `</div>`;

    els.main.innerHTML = headerHTML + `<div class="dlv-editor-body">${trackHTML}</div>`;

    document.getElementById('inpDlvName').addEventListener('change', (e) => {
        delivery.name = e.target.value;
        store.save();
        renderSidebarList();
    });

    document.getElementById('btnDownloadReport').addEventListener('click', () => {
        downloadDeliveryReport(delivery);
    });

    document.getElementById('btnDeleteDelivery').addEventListener('click', () => {
        if (confirm("Supprimer ce livrable ?")) {
            currentForm.reports = currentForm.reports.filter(d => d.id !== selection.id);
            selection = { id: null };
            store.save();
            renderSidebarList();
            renderMainView();
        }
    });

    els.main.querySelectorAll('.btn-generate').forEach(btn => btn.onclick = () => generateModule(delivery, parseInt(btn.dataset.idx)));
    els.main.querySelectorAll('.btn-move-left').forEach(btn => btn.onclick = () => moveModule(delivery, parseInt(btn.dataset.idx), -1));
    els.main.querySelectorAll('.btn-move-right').forEach(btn => btn.onclick = () => moveModule(delivery, parseInt(btn.dataset.idx), 1));
    els.main.querySelectorAll('.btn-remove-mod').forEach(btn => btn.onclick = () => removeModule(delivery, parseInt(btn.dataset.idx)));

    bindConfigInputs(delivery);
}

function buildChapterHierarchy() {
    // Determine indexes for 'chapitre' and 'sous-chapitre' columns
    let chapColIdx = -1;
    let subChapColIdx = -1;

    (currentForm.columns || []).forEach((col, idx) => {
        if (col.type === 'chapitre') chapColIdx = idx;
        if (col.type === 'sous-chapitre') subChapColIdx = idx;
    });

    if (chapColIdx === -1) return [];

    const tree = {}; // Map<ChapterName, Set<SubChapterName>>

    (currentForm.rows || []).forEach(row => {
        const chap = row[chapColIdx] || 'Indéfini';
        const sub = (subChapColIdx !== -1) ? (row[subChapColIdx] || 'Général') : 'Général';

        if (!tree[chap]) tree[chap] = new Set();
        tree[chap].add(sub);
    });

    return Object.keys(tree).map(chap => ({
        name: chap,
        subs: Array.from(tree[chap])
    }));
}

function renderChapterSelector(idx, scopeType, hierarchy, selection) {
    if (scopeType !== 'chapter') return '';

    let html = `<div class="chapter-selector-container">`;

    hierarchy.forEach((chap, cIdx) => {
        // Check if all subs are selected to determine chapter check state
        const allChecked = chap.subs.every(s => selection.includes(s));
        const someChecked = !allChecked && chap.subs.some(s => selection.includes(s));

        html += `
            <div class="chap-item">
                <label style="font-weight:bold; display:flex; align-items:center;">
                    <input type="checkbox" class="chk-chapter" data-idx="${idx}" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                    ${Utils.escapeHtml(chap.name)}
                </label>
                <div class="sub-list" style="margin-left: 20px;">
        `;

        chap.subs.forEach(sub => {
            const isChecked = selection.includes(sub);
            html += `
                <label style="display:flex; align-items:center; font-size:0.9em;">
                    <input type="checkbox" class="chk-subchap" data-idx="${idx}" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
                    ${Utils.escapeHtml(sub)}
                </label>
            `;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    return html;
}

function renderColumnSelector(idx, selectedCols) {
    let html = `<div class="chapter-selector-container" style="max-height:150px;">`; // Reuse container style

    (currentForm.columns || []).forEach(col => {
        const isChecked = selectedCols.includes(col.id);
        html += `
            <label style="display:flex; align-items:center; margin-bottom:5px;">
                <input type="checkbox" class="chk-col" data-idx="${idx}" data-colid="${col.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                ${Utils.escapeHtml(col.label)}
            </label>
        `;
    });

    html += `</div>`;
    return html;
}

function bindConfigInputs(delivery) {
    const main = els.main;

    // Prompt
    main.querySelectorAll('.txt-inst-prompt').forEach(txt => {
        txt.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            delivery.structure[idx].config.ai.prompt = e.target.value;
            store.save();
        };
    });

    // Model
    main.querySelectorAll('.slc-inst-model').forEach(slc => {
        slc.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            delivery.structure[idx].config.ai.model = e.target.value;
            store.save();
        };
    });

    // Scope Type
    main.querySelectorAll('.slc-inst-scope').forEach(slc => {
        slc.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            delivery.structure[idx].config.scope.type = e.target.value;
            if (e.target.value === 'global') {
                delivery.structure[idx].config.scope.selection = []; // Clear selection if global
            }
            store.save();
            renderMainView(); // Re-render to show/hide checkboxes
        };
    });

    // Chapter Checkbox (Parent)
    main.querySelectorAll('.chk-chapter').forEach(chk => {
        chk.onclick = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const chapName = e.target.getAttribute('data-chap');
            const hierarchy = buildChapterHierarchy(); // Rebuild is fast enough
            const chap = hierarchy.find(c => c.name === chapName);

            if (!chap) return;

            let currentSelection = delivery.structure[idx].config.scope.selection || [];

            if (e.target.checked) {
                // Add all subs of this chapter
                chap.subs.forEach(s => {
                    if (!currentSelection.includes(s)) currentSelection.push(s);
                });
            } else {
                // Remove all subs of this chapter
                currentSelection = currentSelection.filter(s => !chap.subs.includes(s));
            }

            delivery.structure[idx].config.scope.selection = currentSelection;
            store.save();
            renderMainView(); // Refresh UI states
        };
    });

    // Sub-chapter Checkbox (Child)
    main.querySelectorAll('.chk-subchap').forEach(chk => {
        chk.onclick = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const subName = e.target.getAttribute('data-sub');
            let currentSelection = delivery.structure[idx].config.scope.selection || [];

            if (e.target.checked) {
                if (!currentSelection.includes(subName)) currentSelection.push(subName);
            } else {
                currentSelection = currentSelection.filter(s => s !== subName);
            }

            delivery.structure[idx].config.scope.selection = currentSelection;
            store.save();
            renderMainView(); // Refresh UI states
        };
    });

    // Column Checkbox
    main.querySelectorAll('.chk-col').forEach(chk => {
        chk.onclick = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const colId = e.target.getAttribute('data-colid');
            let currentCols = delivery.structure[idx].config.columns || [];

            if (e.target.checked) {
                if (!currentCols.includes(colId)) currentCols.push(colId);
            } else {
                currentCols = currentCols.filter(c => c !== colId);
            }

            delivery.structure[idx].config.columns = currentCols;
            store.save();
            // No need to re-render main view for columns, state is visual enough
        };
    });

    // Table Format Checkbox
    main.querySelectorAll('.chk-format-table').forEach(chk => {
        chk.onclick = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (!delivery.structure[idx].config) delivery.structure[idx].config = {};
            delivery.structure[idx].config.isTable = e.target.checked;
            store.save();
        };
    });

    // Result Edit (Blur)
    main.querySelectorAll('.dlv-card-result').forEach(div => {
        div.onblur = (e) => {
            const card = div.closest('.dlv-card');
            if (!card) return;
            const idx = parseInt(card.dataset.idx);
            // Save innerHTML to preserve formatting edits
            delivery.structure[idx].result = div.innerHTML;
            store.save();
        };
    });
}

function moveModule(delivery, index, direction) {
    if (index + direction < 0 || index + direction >= delivery.structure.length) return;
    const temp = delivery.structure[index];
    delivery.structure[index] = delivery.structure[index + direction];
    delivery.structure[index + direction] = temp;
    store.save();
    renderMainView();
}

function removeModule(delivery, index) {
    if (confirm("Retirer ce module du livrable ?")) {
        delivery.structure.splice(index, 1);
        store.save();
        renderMainView();
    }
}

async function generateModule(delivery, index) {
    const instance = delivery.structure[index];
    const card = els.main.querySelector(`.dlv-card[data-idx="${index}"]`);
    if (!card) return;

    const btn = card.querySelector('.btn-generate');
    const resultContainer = card.querySelector('.dlv-card-result');

    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
    btn.disabled = true;
    resultContainer.innerHTML = '';

    try {
        const auditData = currentForm;
        if (!auditData.rows) throw new Error("Aucune donnée d'audit.");

        const contextData = await buildContext(instance.config.scope, instance.config.columns, auditData);

        const prompt = instance.config.ai.prompt || "Analyse ces données.";
        const modelKey = instance.config.ai.model;

        if (!modelKey) throw new Error("Aucun modèle IA sélectionné.");

        const modelConfig = availableModels.find(m => m.model === modelKey);
        if (!modelConfig) throw new Error(`Configuration du modèle '${modelKey}' introuvable.`);

        const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: [prompt, contextData] } // Envoi sous forme tableau [Instruction, ContexteMD]
        ];

        const response = await ApiService.fetchLLM(modelConfig, messages);

        // Si l'option "Tableau" est cochée, on préfixe la réponse avec le tableau de contexte
        let finalResult = response;
        if (instance.config.isTable) {
            // Utilisation de balises HTML <br> pour forcer l'espacement visuel après le tableau Markdown
            finalResult = contextData + "\n\n<br><br>\n\n" + response;
        }

        instance.result = finalResult;
        store.save();

        resultContainer.innerHTML = window.marked ? window.marked.parse(finalResult) : finalResult;

    } catch (e) {
        console.error("Generation Error", e);
        resultContainer.innerHTML = `<div style="color:var(--danger)">Erreur : ${e.message}</div>`;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function buildContext(scope, columnsIds, data) {
    if (!data || !data.rows || !data.columns) return "";

    // 1. Filtrer les colonnes à inclure
    const colsToInclude = [];
    data.columns.forEach((col, idx) => {
        if (columnsIds.includes(col.id)) {
            colsToInclude.push({ label: col.label, index: idx });
        }
    });

    if (colsToInclude.length === 0) return "Aucune donnée (aucune colonne sélectionnée).";

    // 2. Filtrer les lignes (Scope)
    let rows = data.rows;
    if (scope && scope.type === 'chapter' && scope.selection && scope.selection.length > 0) {
        const chapColIdx = data.columns.findIndex(c => c.type === 'chapitre');
        const subChapColIdx = data.columns.findIndex(c => c.type === 'sous-chapitre');

        rows = rows.filter(row => {
            const chap = row[chapColIdx];
            const sub = row[subChapColIdx];
            return scope.selection.includes(chap) || scope.selection.includes(sub);
        });
    }

    if (rows.length === 0) return "Aucune donnée (aucun chapitre correspondant).";

    // 3. Construire le Tableau Markdown
    // Header
    const headers = colsToInclude.map(c => c.label);
    let md = "| " + headers.join(" | ") + " |\n";
    md += "| " + headers.map(() => "---").join(" | ") + " |\n";

    // Rows
    rows.forEach(row => {
        const cells = colsToInclude.map(c => {
            let val = row[c.index];
            if (val === null || val === undefined) val = "";
            // Nettoyage basique pour ne pas casser le tableau MD
            val = String(val).replace(/\n/g, "<br>").replace(/\|/g, "\\|");
            return val;
        });
        md += "| " + cells.join(" | ") + " |\n";
    });

    return md;
}

function handleAddDelivery() {

    const listHTML = availableTemplates.map(t => `
        <div class="template-item" data-id="${t.id}" style="padding:1rem; border-bottom:1px solid #eee; cursor:pointer;">
            <strong>${Utils.escapeHtml(t.name)}</strong>
            <div style="font-size:0.8rem; color:#666;">${t.structure ? t.structure.length : 0} modules</div>
        </div>
    `).join('');

    const content = `
        <p>Choisissez un modèle de rapport de base :</p>
        <div class="dlv-template-list" style="max-height:400px; overflow-y:auto; border:1px solid #ddd;">
            ${listHTML || '<div style="padding:1rem;">Aucun modèle disponible.</div>'}
        </div>
    `;

    const modal = new Modal('modalDlvTemplate', 'Nouveau Livrable', content);
    modal.render();

    if (modal.element) {
        modal.element.querySelectorAll('.template-item').forEach(item => {
            item.onclick = () => {
                const tplId = item.dataset.id;
                createDeliveryFromTemplate(tplId);
                modal.close();
            };
        });
    }
}

function createDeliveryFromTemplate(tplId) {
    const template = availableTemplates.find(t => t.id === tplId);
    if (!template) return;

    const newId = 'dlv_' + Date.now();

    const structureClone = (template.structure || []).map(item => {
        // Handle both old format (object) and new format (string ID)
        let sourceId, config, sourceMod;

        if (typeof item === 'string') {
            sourceId = item;
            sourceMod = availableModules.find(m => m.id === sourceId);
            config = sourceMod ? JSON.parse(JSON.stringify(sourceMod.config || {})) : {};
        } else {
            // New format (object)
            sourceId = item.sourceId;
            sourceMod = availableModules.find(m => m.id === sourceId);
            config = item.config || (sourceMod ? JSON.parse(JSON.stringify(sourceMod.config || {})) : {});
        }

        return {
            sourceId: sourceId,
            name: sourceMod ? sourceMod.name : 'Module Inconnu',
            config: config,
            result: ''
        };
    });

    const newDelivery = {
        id: newId,
        name: template.name + ' - ' + new Date().toLocaleDateString(),
        created: new Date().toISOString(),
        structure: structureClone
    };

    if (!currentForm.reports) currentForm.reports = [];
    currentForm.reports.push(newDelivery);
    store.save();

    selection = { id: newId };
    renderSidebarList();
    renderMainView();
}

function downloadDeliveryReport(delivery) {
    if (!delivery || !delivery.structure) return;

    let mdContent = `# ${delivery.name}\n\n`;

    delivery.structure.forEach(inst => {
        const title = inst.name || 'Module';
        const content = inst.result || '(Aucun contenu)';

        mdContent += `## ${title}\n\n`;
        mdContent += `${content}\n\n`;
        mdContent += `---\n\n`;
    });

    const filename = `${Utils.toSlug(delivery.name)}.md`;
    Utils.downloadFile(mdContent, filename, 'text/markdown');
}

