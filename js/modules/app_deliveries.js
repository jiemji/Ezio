import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { UI } from '../core/UIFactory.js';
import { IOManager } from '../core/IOManager.js';
import { Utils } from '../core/Utils.js';
import { DataUtils } from '../core/DataUtils.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';
import { Modal } from '../ui/Modal.js';
import { Sidebar } from '../ui/Sidebar.js';
import { ApiService } from '../api/api_ia.js';
import { downloadDeliveryWord } from './app_output_word.js';
import { downloadDeliveryPpt } from './app_outputppt.js';
import { showImpressionPopup } from './app_impression_logic.js';
import '../components/EzioDeliveryCard.js';

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

    store.subscribe('deliveries', () => {
        const deliveriesView = document.getElementById('deliveries-view');
        if (deliveriesView && !deliveriesView.classList.contains('hidden')) {
            renderSidebarList();
            // Optional: checking if main needs full render
            // renderMainView(); 
        }
    });

    setupDelegation();
}

function setupDelegation() {
    if (!els.main) return;

    const debouncedSave = Utils.debounce(() => { store.save(); }, 500);

    // 1. Card custom events — handled by <ezio-delivery-card> Web Component
    els.main.addEventListener('card-generate', (e) => {
        const delivery = currentForm.reports.find(d => d.id === selection.id);
        if (delivery) generateModule(delivery, e.detail.idx);
    });

    els.main.addEventListener('card-move', (e) => {
        const delivery = currentForm.reports.find(d => d.id === selection.id);
        if (delivery) moveModule(delivery, e.detail.idx, e.detail.direction);
    });

    els.main.addEventListener('card-remove', (e) => {
        const delivery = currentForm.reports.find(d => d.id === selection.id);
        if (delivery) removeModule(delivery, e.detail.idx);
    });

    els.main.addEventListener('card-config-change', () => {
        store.save();
    });

    // 2. Markdown editor change — result saved from <ezio-markdown-editor> inside <ezio-delivery-card>
    els.main.addEventListener('change', (e) => {
        const editorComponent = e.target.closest('ezio-markdown-editor');
        if (editorComponent && e.detail?.markdown !== undefined) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            const card = editorComponent.closest('ezio-delivery-card');
            if (delivery && card) {
                const idx = parseInt(card.dataset.idx);
                if (delivery.structure[idx]) {
                    delivery.structure[idx].result = e.detail.markdown;
                    store.save();
                }
            }
        }
    });

    // 3. Delivery name (header input — outside card components)
    els.main.onchange = (e) => {
        if (e.target.id === 'inpDlvName') {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) {
                delivery.name = e.target.value;
                store.save(); store.notify('deliveries');
                renderSidebarList();
            }
        }
    };

    els.main.oninput = (e) => {
        if (e.target.id === 'inpDlvName') {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) {
                delivery.name = e.target.value;
                debouncedSave();
            }
        }
    };
}

// Checkbox handlers removed — now handled internally by <ezio-delivery-card>
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

    const data = await Utils.safeFetch('config/reports.json');
    if (data) {
        availableTemplates = data.reports || [];
        availableModules = data.modules || [];
    }
}

async function loadModelsList() {
    const data = await Utils.safeFetch('config/models.json');
    if (data && Array.isArray(data)) {
        availableModels = data;
    }
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
                <button id="btnDownloadReport" class="btn-secondary small" style="margin-right:10px;">📥 Télécharger (MD)</button>
                <button id="btnImpression" class="btn-primary small" style="margin-right:10px;">Impression</button>
                <button id="btnDeleteDelivery" class="btn-danger small" style="margin-left:auto;">Supprimer</button>
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
    trackHTML += `</div>`;

    els.main.innerHTML = headerHTML + `<div class="dlv-editor-body">${trackHTML}</div>`;

    // Create <ezio-delivery-card> elements programmatically
    const context = {
        availableModels,
        availableModules,
        currentForm,
        hierarchy,
        totalInstances: instances.length
    };

    const track = els.main.querySelector('.dlv-horizontal-track');
    instances.forEach((inst, idx) => {
        const card = document.createElement('ezio-delivery-card');
        card.config = { instance: inst, idx, context };
        track.appendChild(card);
    });

    // Name change handled by delegation in setupDelegation


    document.getElementById('btnDownloadReport').addEventListener('click', async () => {
        const btn = document.getElementById('btnDownloadReport');
        const oldText = btn.innerHTML;
        btn.innerHTML = `<span class="rpt-loading">↻</span> Export...`;
        btn.disabled = true;
        try {
            await downloadDeliveryReport(delivery);
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    });

    document.getElementById('btnImpression').addEventListener('click', () => {
        showImpressionPopup(delivery);
    });

    document.getElementById('btnDeleteDelivery').addEventListener('click', () => {
        if (confirm("Supprimer ce livrable ?")) {
            currentForm.reports = currentForm.reports.filter(d => d.id !== selection.id);
            selection = { id: null };
            store.save(); store.notify('deliveries');
            renderSidebarList();
            renderMainView();
        }
    });

    // Old individual listeners removed - handled by delegation in setupDelegation()

    applyTableColumnWidths(els.main);
}

function applyTableColumnWidths(container) {
    if (!container || !currentForm || !currentForm.columns) return;
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
            const colName = th.textContent.trim();
            const colDef = currentForm.columns.find(c => c.label === colName);
            if (colDef) {
                let width = 'auto';
                const type = colDef.type || 'question';

                if (type === 'chapitre' || type === 'sous-chapitre') width = '100px';
                else if (type === 'reponse' || type === 'ia') width = '250px';
                else if (type === 'qcm' || type === 'combo') width = '120px';
                else if (type === 'popup') width = '200px';
                else if (type === 'question' || type === 'reference') {
                    const size = (colDef.params && colDef.params.size) || colDef.size || 'M';
                    if (size === 'S') width = '50px';
                    else if (size === 'L') width = '250px';
                    else width = '120px'; // default
                }

                if (width !== 'auto') {
                    th.style.minWidth = width;
                    th.style.width = width;
                }
            }
        });
    });
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

function moveModule(delivery, index, direction) {
    if (index + direction < 0 || index + direction >= delivery.structure.length) return;
    const temp = delivery.structure[index];
    delivery.structure[index] = delivery.structure[index + direction];
    delivery.structure[index + direction] = temp;
    store.save(); store.notify('deliveries');
    renderMainView();
}

function removeModule(delivery, index) {
    if (confirm("Retirer ce module du livrable ?")) {
        delivery.structure.splice(index, 1);
        store.save(); store.notify('deliveries');
        renderMainView();
    }
}

async function generateModule(delivery, index) {
    const instance = delivery.structure[index];
    const card = els.main.querySelector(`ezio-delivery-card[data-idx="${index}"]`);
    if (!card) return;

    const btn = card.querySelector('.btn-generate');
    const editorComponent = card.getEditor();

    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
    btn.disabled = true;
    if (editorComponent) editorComponent.value = '';

    try {
        const auditData = currentForm;
        if (!auditData.rows) throw new Error("Aucune donnée d'audit.");

        const contextData = AIContextBuilder.buildTable(instance.config.scope, instance.config.columns, auditData);

        const prompt = instance.config.ai.prompt || "Analyse ces données.";
        const agentName = instance.config.ai.model;

        if (!agentName) throw new Error("Aucun agent IA sélectionné.");

        const modelConfig = availableModels.find(m => m.nom === agentName);
        if (!modelConfig) throw new Error(`Configuration de l'agent '${agentName}' introuvable.`);

        const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: [prompt, contextData] } // Envoi sous forme tableau [Instruction, ContexteMD]
        ];

        const response = await ApiService.fetchLLM(modelConfig, messages);

        // Si l'option "Tableau" est cochée, on sauvegarde le tableau de contexte séparément
        let finalResult = response;
        if (instance.config.isTable) {
            instance.contextTable = contextData;
        } else {
            delete instance.contextTable;
        }

        instance.result = finalResult;
        store.save(); store.notify('deliveries');

        if (editorComponent) {
            editorComponent.value = finalResult;
            // Apply table column widths to the inner editor
            const innerEditor = editorComponent.querySelector('.dlv-card-result');
            if (innerEditor) applyTableColumnWidths(innerEditor);

            // Auto-expand to bottom of window
            requestAnimationFrame(() => {
                if (innerEditor) {
                    const rect = innerEditor.getBoundingClientRect();
                    const newHeight = window.innerHeight - rect.top - 40; // 40px margin bottom
                    if (newHeight > 300) {
                        innerEditor.style.height = newHeight + 'px';
                    }
                }
            });
        }

    } catch (e) {
        console.error("Generation Error", e);
        if (editorComponent) {
            editorComponent.htmlContent = `<div style="color:var(--danger)"> Erreur : ${e.message}</div>`;
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function handleAddDelivery() {

    const listHTML = availableTemplates.map(t => `
    <div class="template-item" data-id="${t.id}" style="padding:1rem; border-bottom:1px solid #eee; cursor:pointer;">
            <strong>${Utils.escapeHtml(t.name)}</strong>
            <div style="font-size:0.8rem; color:#666;">${t.structure ? t.structure.length : 0} modules</div>
        </div>
    `).join('');

    const content = `
    <p>Choisissez un modèle de rapport de base:</p>
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
    store.save(); store.notify('deliveries');

    selection = { id: newId };
    renderSidebarList();
    renderMainView();
}

export async function downloadDeliveryReport(delivery) {
    if (!delivery || !delivery.structure) return;

    let mdContent = `# ${delivery.name} \n\n`;

    for (let i = 0; i < delivery.structure.length; i++) {
        const inst = delivery.structure[i];
        const title = inst.name || 'Module';
        const content = inst.result || '(Aucun contenu)';

        mdContent += `## ${title} \n\n`;

        if (inst.config?.isTable) {
            // Toujours régénérer le tableau à la volée pour avoir les dernières données et couleurs
            inst.contextTable = AIContextBuilder.buildTable(inst.config.scope, inst.config.columns, currentForm);

            if (inst.contextTable) {
                mdContent += `${inst.contextTable} \n\n-- -\n\n`;
            }
        }

        mdContent += `${content} \n\n`;
        mdContent += `-- -\n\n`;
    }

    // Save one last time in case contextTables were updated
    store.save(); store.notify('deliveries');

    const filename = `${Utils.toSlug(delivery.name)}.md`;
    IOManager.downloadFile(mdContent, filename, 'text/markdown');
}
