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

    if (!currentForm.deliveries) {
        currentForm.deliveries = [];
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
    if (deliveriesSidebar && currentForm.deliveries) {
        deliveriesSidebar.setItems(currentForm.deliveries);
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

    const delivery = currentForm.deliveries.find(d => d.id === selection.id);
    if (!delivery) return;

    const headerHTML = `
        <div class="dlv-editor-header">
            <input type="text" id="inpDlvName" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${Utils.escapeHtml(delivery.name)}">
            <div class="dlv-actions">
                <button id="btnDeleteDelivery" class="btn-danger small" style="margin-left:10px;">🗑️ Supprimer ce Livrable</button>
            </div>
        </div>
    `;

    let trackHTML = `<div class="dlv-horizontal-track">`;
    const instances = delivery.structure || [];

    if (instances.length === 0) {
        trackHTML += `<div style="padding:2rem;">Ce livrable est vide.</div>`;
    }

    instances.forEach((inst, idx) => {
        const sourceMod = (availableModules || []).find(m => m.id === inst.sourceId) || { name: 'Module', type: '?' };

        const config = inst.config || {};
        const aiPrompt = config.ai ? (config.ai.prompt || '') : '';
        const aiModel = config.ai ? (config.ai.model || '') : '';

        trackHTML += `
            <div class="dlv-card" data-idx="${idx}">
                <div class="dlv-card-header">
                     <div class="dlv-card-nav">
                        ${idx > 0 ? `<button class="btn-card-action btn-move-left" data-idx="${idx}" title="Reculer">&lt;</button>` : ''}
                        <span style="font-weight:bold; font-size:0.9rem;">${idx + 1}. ${Utils.escapeHtml(sourceMod.name)}</span>
                        ${idx < instances.length - 1 ? `<button class="btn-card-action btn-move-right" data-idx="${idx}" title="Avancer">&gt;</button>` : ''}
                     </div>
                     <div class="dlv-card-actions">
                        <button class="btn-card-action danger btn-remove-mod" data-idx="${idx}" title="Retirer du livrable">🗑️</button>
                     </div>
                </div>
                <div class="dlv-card-body">
                    <div class="form-group">
                        <label>Prompt IA (Instance)</label>
                        <textarea class="form-control txt-inst-prompt" data-idx="${idx}" rows="6">${Utils.escapeHtml(aiPrompt)}</textarea>
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
                     <div class="dlv-card-result">${inst.result ? (window.marked ? window.marked.parse(inst.result) : inst.result) : ''}</div>
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

    document.getElementById('btnDeleteDelivery').addEventListener('click', () => {
        if (confirm("Supprimer ce livrable ?")) {
            currentForm.deliveries = currentForm.deliveries.filter(d => d.id !== selection.id);
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

function bindConfigInputs(delivery) {
    els.main.querySelectorAll('.txt-inst-prompt').forEach(txt => {
        txt.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (!delivery.structure[idx].config.ai) delivery.structure[idx].config.ai = {};
            delivery.structure[idx].config.ai.prompt = e.target.value;
            store.save();
        };
    });
    els.main.querySelectorAll('.slc-inst-model').forEach(slc => {
        slc.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (!delivery.structure[idx].config.ai) delivery.structure[idx].config.ai = {};
            delivery.structure[idx].config.ai.model = e.target.value;
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

        const contextData = await buildContext(instance.config.scope, auditData);

        const prompt = instance.config.ai.prompt || "Analyse ces données.";
        const modelKey = instance.config.ai.model;

        if (!modelKey) throw new Error("Aucun modèle IA sélectionné.");

        const modelConfig = availableModels.find(m => m.model === modelKey);
        if (!modelConfig) throw new Error(`Configuration du modèle '${modelKey}' introuvable.`);

        const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(contextData) }
        ];

        const response = await ApiService.fetchLLM(modelConfig, messages);

        instance.result = response;
        store.save();

        resultContainer.innerHTML = window.marked ? window.marked.parse(response) : response;

    } catch (e) {
        console.error("Generation Error", e);
        resultContainer.innerHTML = `<div style="color:var(--danger)">Erreur : ${e.message}</div>`;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function buildContext(scope, data) {
    const labels = data.columns.map(c => c.label);
    let rows = data.rows;
    return rows.map(row => {
        const obj = {};
        row.forEach((cell, idx) => {
            const label = labels[idx] || `Col_${idx}`;
            if (cell !== null && cell !== "") obj[label] = cell;
        });
        return obj;
    });
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
        let sourceId, config;

        if (typeof item === 'string') {
            sourceId = item;
            const sourceMod = availableModules.find(m => m.id === sourceId);
            config = sourceMod ? JSON.parse(JSON.stringify(sourceMod.config || {})) : {};
        } else {
            sourceId = item.sourceId;
            config = JSON.parse(JSON.stringify(item.config || {}));
        }

        return {
            sourceId: sourceId,
            instanceId: 'inst_' + Date.now() + Math.random().toString(36).substr(2, 5),
            config: config,
            result: null
        };
    });

    const newDelivery = {
        id: newId,
        name: template.name + ' (Copie)',
        created: new Date().toISOString(),
        structure: structureClone
    };

    if (!currentForm.deliveries) currentForm.deliveries = [];
    currentForm.deliveries.push(newDelivery);
    store.save();

    selection = { id: newId };
    renderSidebarList();
    renderMainView();
}
