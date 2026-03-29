import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { IOManager } from '../core/IOManager.js';
import { Utils } from '../core/Utils.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';
import { Modal } from '../ui/Modal.js';
import { ApiService } from '../api/api_ia.js';
import { showImpressionPopup } from './app_impression_logic.js';
import '../components/EzioMarkdownEditor.js';
import '../components/EzioDeliveryBlock.js';

let availableTemplates = [];
let availableModels = [];
let availableModules = [];
let selection = { id: null, moduleIndex: 0 };
let editorMaxWidth = '1050px'; // Par défaut : format A4 debout

const els = {
    container: null,
    sidebar: null,
    main: null
};

export function initDeliveriesV2() {
    registerModuleInit('deliveries_v2', renderDeliveriesModuleV2);
}

async function renderDeliveriesModuleV2() {
    els.container = document.getElementById('deliveries-v2-view');
    els.sidebar = document.querySelector('#deliveries-v2-view .deliveries-sidebar');
    els.main = document.querySelector('#deliveries-v2-view .deliveries-main');

    setupSidebar();
    await loadTemplates();
    await loadModelsList();

    if (!currentForm.reports) {
        currentForm.reports = [];
    }

    renderSidebarList();
    renderMainView();

    store.subscribe('deliveries_v2', () => {
        const deliveriesView = document.getElementById('deliveries-v2-view');
        if (deliveriesView && !deliveriesView.classList.contains('hidden')) {
            renderSidebarList();
            // We do not re-render MainView fully on store update to avoid text caret loss
            // Only re-render sidebar and titles
        }
    });
}

function setupSidebar() {
    if (!els.sidebar) return;

    els.sidebar.innerHTML = `
    <div class="dlv-sidebar-header" style="display:flex; justify-content:space-between; align-items:center; padding: 15px;">
        <h3 style="margin:0;font-size:1.1rem;color:var(--text-main);">Livrables</h3>
        <button id="btnAddDelivery-v2" class="btn-icon" title="Nouveau Livrable">➕</button>
    </div>
    <div id="dlvSidebarContainer-v2" style="flex:1; overflow-y:auto; padding: 10px;"></div>
    `;

    document.getElementById('btnAddDelivery-v2').addEventListener('click', handleAddDelivery);
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
    const container = document.getElementById('dlvSidebarContainer-v2');
    if (!container || !currentForm.reports) return;

    if (currentForm.reports.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding: 20px;">Aucun livrable. Cliquez sur ➕ pour commencer.</div>`;
        return;
    }

    let html = '';
    currentForm.reports.forEach(delivery => {
        const isDlvSelected = (selection.id === delivery.id);
        
        html += `<div class="dlv2-sidebar-group">
            <div class="dlv2-group-header" data-id="${delivery.id}">
                <span>${Utils.escapeHtml(delivery.name)}</span>
            </div>
            ${isDlvSelected ? `
            <ul class="dlv2-group-modules">
                ${(delivery.structure || []).map((mod, idx) => `
                    <li class="dlv2-module-item ${selection.moduleIndex === idx ? 'active' : ''}" data-idx="${idx}">
                        ${Utils.escapeHtml(mod.name || 'Module')}
                    </li>
                `).join('')}
            </ul>
            ` : ''}
        </div>`;
    });

    container.innerHTML = html;

    // Bind clicks
    container.querySelectorAll('.dlv2-group-header').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.getAttribute('data-id');
            if (selection.id !== id) {
                selection.id = id;
                selection.moduleIndex = 0; // reset to first module
                renderSidebarList();
                renderMainView();
            }
        });
    });

    container.querySelectorAll('.dlv2-module-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.getAttribute('data-idx'));
            if (selection.moduleIndex !== idx) {
                selection.moduleIndex = idx;
                renderSidebarList();
                renderMainView();
            }
        });
    });
}

function renderMainView() {
    if (!els.main) return;

    if (!selection.id) {
        els.main.innerHTML = `
        <div class="deliveries-empty-state">
            <p>Sélectionnez un livrable dans le menu de gauche.</p>
        </div>`;
        return;
    }

    const delivery = currentForm.reports.find(d => d.id === selection.id);
    if (!delivery) return;

    const moduleCount = delivery.structure ? delivery.structure.length : 0;
    const currentModule = (delivery.structure && moduleCount > 0) ? delivery.structure[selection.moduleIndex] : null;

    const headerHTML = `
        <div class="dlv2-header-bar" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
            <input type="text" id="inpDlvName-v2" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px; border:none; background:transparent;" value="${Utils.escapeHtml(delivery.name)}">
            <div class="dlv-actions" style="display:flex; align-items:center;">
                <button id="btnToggleWidth-v2" class="btn-icon" title="Basculer l'affichage" style="margin-right:15px; display:flex; align-items:center; justify-content:center; width:34px; height:34px;">
                    ${editorMaxWidth === '1550px' 
                        ? '<div style="width:20px; height:12px; border:2px solid currentColor; border-radius:2px;" title="Mode Allongé Actif"></div>' 
                        : '<div style="width:12px; height:20px; border:2px solid currentColor; border-radius:2px;" title="Mode Droit Actif"></div>'}
                </button>
                <button id="btnDownloadReport-v2" class="btn-secondary small" style="margin-right:10px;">📥 Télécharger (MD)</button>
                <button id="btnImpression-v2" class="btn-primary small" style="margin-right:10px;">Impression</button>
                <button id="btnDeleteDelivery-v2" class="btn-danger small">Supprimer</button>
            </div>
        </div>
    `;

    if (!currentModule) {
        els.main.innerHTML = headerHTML + `
        <div class="deliveries-empty-state">
            <p>Ce livrable ne contient aucun module.</p>
        </div>`;
        bindMainHeaderEvents(delivery);
        return;
    }

    // Migrate old result to blocks
    if (!currentModule.blocks) {
        currentModule.blocks = [];
        if (currentModule.result) {
            currentModule.blocks.push({ id: 'blk_' + Date.now(), type: 'text', content: currentModule.result });
            delete currentModule.result; // Migrate
        }
    }

    const canPrev = selection.moduleIndex > 0;
    const canNext = selection.moduleIndex < moduleCount - 1;

    // UI with Navigation Arrows and central Blocks wrapper
    els.main.innerHTML = headerHTML + `
        <div class="dlv2-editor-section" style="display:flex; flex-direction:column; height: 100%; position:relative;">
            <div class="dlv2-module-header" style="flex-shrink:0;">
                <h2 class="dlv2-module-title">${Utils.escapeHtml(currentModule.name || 'Module')}</h2>
            </div>
            
            <div class="dlv2-navigation-layout" style="flex:1; display:flex; padding-bottom: 70px;">
                <button id="btnPrevMod-v2" class="dlv2-nav-btn" ${!canPrev ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                
                <div class="dlv2-editor-wrapper" style="flex:1; overflow-y:auto; padding: 20px; display:flex; flex-direction:column; align-items:center;">
                    <div id="dlv2-blocks-container" style="display:flex; flex-direction:column; gap:20px; width:100%; max-width:${editorMaxWidth}; transition: max-width 0.3s ease;"></div>
                    <div style="height: 60px;"></div>
                </div>
                
                <button id="btnNextMod-v2" class="dlv2-nav-btn" ${!canNext ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
            </div>

            <!-- Global Block Addition Toolbar -->
            <div class="dlv2-global-toolbar" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--bg-secondary); padding: 10px 20px; border-radius: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: flex; gap: 15px; border: 1px solid var(--border); z-index: 10;">
                <button id="btnAddBlockText" class="btn-primary" style="border-radius: 20px;"><i class="fas fa-font"></i> Texte</button>
                <button id="btnAddBlockKPI" class="btn-secondary" style="border-radius: 20px;"><i class="fas fa-chart-pie"></i> Graphique</button>
                <button id="btnAddBlockSynth" class="btn-secondary" style="border-radius: 20px; color:var(--primary); border-color:var(--primary);"><i class="fas fa-magic"></i> Synthèse IA</button>
                <button id="btnAddBlockData" class="btn-secondary" style="border-radius: 20px;"><i class="fas fa-table"></i> Données</button>
            </div>
        </div>
    `;

    renderBlocks(currentModule);

    const checkPushBlock = (blockConfig) => {
        currentModule.blocks.push(blockConfig);
        store.save(); store.notify('deliveries_v2');
        renderMainView(); // Re-render entirely to show the new card
    };

    document.getElementById('btnAddBlockText')?.addEventListener('click', () => checkPushBlock({ id: 'blk_' + Date.now(), type: 'text', content: '' }));
    document.getElementById('btnAddBlockKPI')?.addEventListener('click', () => showModalKPI(null, currentModule));
    document.getElementById('btnAddBlockSynth')?.addEventListener('click', () => showModalSynthese(null, currentModule));
    document.getElementById('btnAddBlockData')?.addEventListener('click', () => showModalDataTable(null, currentModule));
        
    bindMainHeaderEvents(delivery);
}

function bindMainHeaderEvents(delivery) {
    const inpName = document.getElementById('inpDlvName-v2');
    if (inpName) {
        inpName.addEventListener('change', (e) => {
            delivery.name = e.target.value;
            store.save(); store.notify('deliveries_v2');
            renderSidebarList();
        });
    }

    document.getElementById('btnDownloadReport-v2')?.addEventListener('click', async (e) => {
        const btn = e.target;
        const oldText = btn.innerHTML;
        btn.innerHTML = `<span class="rpt-loading">↻</span> Export...`;
        btn.disabled = true;
        try { await downloadDeliveryReport(delivery); } 
        finally { btn.innerHTML = oldText; btn.disabled = false; }
    });

    document.getElementById('btnToggleWidth-v2')?.addEventListener('click', () => {
        editorMaxWidth = editorMaxWidth === '1550px' ? '1050px' : '1550px';
        renderMainView(); // Re-render to update the flex constraints and icon
    });

    document.getElementById('btnImpression-v2')?.addEventListener('click', () => {
        showImpressionPopup(delivery);
    });

    document.getElementById('btnDeleteDelivery-v2')?.addEventListener('click', () => {
        if (confirm("Supprimer ce livrable ?")) {
            currentForm.reports = currentForm.reports.filter(d => d.id !== selection.id);
            selection = { id: null, moduleIndex: 0 };
            store.save(); store.notify('deliveries_v2');
            renderSidebarList();
            renderMainView();
        }
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
        <p>Choisissez un modèle de rapport de base:</p>
        <div class="dlv-template-list" style="max-height:400px; overflow-y:auto; border:1px solid #ddd;">
            ${listHTML || '<div style="padding:1rem;">Aucun modèle disponible.</div>'}
        </div>
    `;

    const modal = new Modal('modalDlvTemplate-v2', 'Nouveau Livrable', content);
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
        let sourceId, config, sourceMod;
        if (typeof item === 'string') {
            sourceId = item;
            sourceMod = availableModules.find(m => m.id === sourceId);
            config = sourceMod ? JSON.parse(JSON.stringify(sourceMod.config || {})) : {};
        } else {
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
    store.save(); store.notify('deliveries_v2');

    selection = { id: newId, moduleIndex: 0 };
    renderSidebarList();
    renderMainView();
}


export async function downloadDeliveryReport(delivery) {
    if (!delivery || !delivery.structure) return;

    let mdContent = `# ${delivery.name} \n\n`;

    for (let i = 0; i < delivery.structure.length; i++) {
        const inst = delivery.structure[i];
        const title = inst.name || 'Module';

        mdContent += `## ${title} \n\n`;

        if (inst.blocks && inst.blocks.length > 0) {
            for (let block of inst.blocks) {
                if (block.type === 'text') {
                    mdContent += `${block.content || ''} \n\n`;
                } else if (block.type === 'synthese') {
                     mdContent += `### Synthèse IA\n${block.content || block.config?.result || ''} \n\n`;
                } else if (block.type === 'datatable') {
                     const t = AIContextBuilder.buildTable(block.config.scope, block.config.columns, currentForm);
                     if (t) mdContent += `${t} \n\n`;
                } else if (block.type === 'kpi') {
                     const ids = block.widgetIds || (block.widgetId ? [block.widgetId] : []);
                     ids.forEach(id => {
                         const widgetDef = (currentForm.statics || []).find(w => w.id === id);
                         const wName = widgetDef ? widgetDef.title : 'Graphique inconnu';
                         mdContent += `*[📊 Graphique à insérer : ${wName}]* \n\n`;
                     });
                }
            }
        } else if (inst.result) {
            mdContent += `${inst.result} \n\n`; // Legacy fallback
        }
        
        mdContent += `-- -\n\n`;
    }

    store.save(); store.notify('deliveries_v2');
    const filename = `${Utils.toSlug(delivery.name)}.md`;
    IOManager.downloadFile(mdContent, filename, 'text/markdown');
}

// --- Utils ---

function renderBlocks(currentModule) {
    const container = document.getElementById('dlv2-blocks-container');
    if (!container) return;
    container.innerHTML = '';

    if (!currentModule.blocks || currentModule.blocks.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 50px; color: var(--text-muted); border: 2px dashed var(--border); border-radius: 8px;">Ce module est vide. Ajoutez un bloc ci-dessous.</div>`;
        return;
    }

    currentModule.blocks.forEach(blockData => {
        const blockEl = document.createElement('ezio-delivery-block');
        blockEl.data = blockData;
        
        blockEl.addEventListener('block-delete', (e) => {
            if (confirm("Supprimer ce bloc ?")) {
                currentModule.blocks = currentModule.blocks.filter(b => b.id !== e.detail.id);
                store.save(); store.notify('deliveries_v2');
                renderMainView(); // Re-render to clear it
            }
        });
        
        blockEl.addEventListener('block-config', (e) => {
            const block = currentModule.blocks.find(b => b.id === e.detail.id);
            if (!block) return;
            if (block.type === 'kpi') showModalKPI(block, currentModule);
            if (block.type === 'datatable') showModalDataTable(block, currentModule);
            if (block.type === 'synthese') showModalSynthese(block, currentModule); // Pour changer rescope, model...
        });
        
        blockEl.addEventListener('block-refresh', (e) => {
            const block = currentModule.blocks.find(b => b.id === e.detail.id);
            if (block && block.type === 'synthese') {
                // Must be implemented below
                if(typeof regenerateSyntheseBlock === 'function') regenerateSyntheseBlock(block, blockEl);
            }
        });
        
        blockEl.addEventListener('block-change', (e) => {
            const bIndex = currentModule.blocks.findIndex(b => b.id === e.detail.id);
            if (bIndex > -1) {
                currentModule.blocks[bIndex] = blockEl.data; // Sync fresh data
                const debouncedSave = Utils.debounce(() => { store.save(); store.notify('deliveries_v2'); }, 500);
                debouncedSave();
            }
        });
        
        container.appendChild(blockEl);
    });
}

function showModalKPI(existingBlock, currentModule) {
    const kpis = currentForm.statics || [];
    if (kpis.length === 0) return UI.showToast("Aucun graphique KPI n'a été créé dans l'onglet Tableau de bord.", "warning");

    let currentIds = [];
    if (existingBlock) {
        currentIds = existingBlock.widgetIds || [];
        if (currentIds.length === 0 && existingBlock.widgetId) {
            currentIds = [existingBlock.widgetId];
        }
    }

    const itemsHtml = kpis.map(k => {
        const isChecked = currentIds.includes(k.id) ? 'checked' : '';
        return `
        <label class="kpi-checkbox-item" style="display:flex; align-items:center; width:100%; padding:10px; margin-bottom:5px; border:1px solid var(--border); background:var(--bg-secondary); border-radius:4px; cursor:pointer;">
            <input type="checkbox" value="${k.id}" ${isChecked} style="margin-right:15px; transform:scale(1.2);">
            <div>
                <b style="color:var(--text-main);">📊 ${Utils.escapeHtml(k.title)}</b><br>
                <small style="color:var(--text-muted);">${k.vizType}</small>
            </div>
        </label>
        `;
    }).join('');

    const m = new Modal('kpiInsertModal', existingBlock ? 'Changer les graphiques' : 'Insérer des graphiques', `
        <div style="max-height: 400px; overflow-y: auto; padding: 5px;">
            <p style="margin-bottom:15px; color:var(--text-muted);">Sélectionnez un ou plusieurs graphiques à inclure ensemble sur la largeur du document.</p>
            ${itemsHtml}
        </div>
    `, [
        { label: 'Annuler', class: 'btn-secondary', onClick: (e, modal) => modal.close() },
        { label: existingBlock ? 'Enregistrer' : 'Insérer', class: 'btn-primary', onClick: (e, modal) => {
            const selectedBoxes = Array.from(document.querySelectorAll('#kpiInsertModal input[type="checkbox"]:checked'));
            const selectedIds = selectedBoxes.map(cb => cb.value);
            
            if (selectedIds.length === 0) {
                 UI.showToast("Sélectionnez au moins un graphique.", "warning");
                 return;
            }
            
            if (existingBlock) {
                existingBlock.widgetIds = selectedIds;
                delete existingBlock.widgetId; // migration propre
            } else {
                currentModule.blocks.push({
                    id: 'blk_' + Date.now(),
                    type: 'kpi',
                    widgetIds: selectedIds
                });
            }
            store.save(); store.notify('deliveries_v2');
            renderMainView();
            modal.close();
        }}
    ]);
    m.render();
}

function showModalSynthese(existingBlock, currentModule) {
    const hierarchy = buildChapterHierarchy();
    
    // Config de base
    const blockConfig = existingBlock ? JSON.parse(JSON.stringify(existingBlock.config || {})) : {
        scope: { type: 'global', selection: [] },
        prompt: "Rédige une synthèse professionnelle de ces données d'audit.",
        model: availableModels.length > 0 ? availableModels[0].nom : ""
    };

    function renderSyntheseBody() {
        let html = `
            <div class="form-group" style="margin-bottom:10px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">Scope (Périmètre)</label>
                <select class="form-control slc-syn-scope" style="width:100%;">
                    <option value="global" ${blockConfig.scope.type === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                    <option value="chapter" ${blockConfig.scope.type === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                </select>
            </div>
        `;

        if (blockConfig.scope.type === 'chapter') {
            html += `<div class="chapter-selector-container" style="border:1px solid var(--border); background:var(--bg-color); padding:10px; border-radius:4px; max-height:200px; overflow-y:auto; margin-bottom:10px;">`;
            hierarchy.forEach(chap => {
                const allChecked = chap.subs.length > 0 ? chap.subs.every(s => blockConfig.scope.selection.includes(s)) : blockConfig.scope.selection.includes(chap.name);
                html += `
                    <div class="chap-item" style="margin-bottom:5px;">
                        <label style="font-weight:bold; display:flex; align-items:center;">
                            <input type="checkbox" class="chk-chapter" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                            ${Utils.escapeHtml(chap.name)}
                        </label>
                        <div class="sub-list" style="margin-left: 20px;">
                `;
                chap.subs.forEach(sub => {
                    const isChecked = blockConfig.scope.selection.includes(sub);
                    html += `
                        <label style="display:flex; align-items:center; font-size:0.9em; margin-bottom:2px;">
                            <input type="checkbox" class="chk-subchap" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
                            ${Utils.escapeHtml(sub)}
                        </label>
                    `;
                });
                html += `</div></div>`;
            });
            html += `</div>`;
        }

        html += `
            <div class="form-group" style="margin-top:10px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">Prompt / Consigne</label>
                <textarea class="form-control inp-prompt" style="width:100%; height:80px; resize:vertical;">${Utils.escapeHtml(blockConfig.prompt)}</textarea>
            </div>
            <div class="form-group" style="margin-top:10px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">Modèle IA</label>
                <select class="form-control slc-model" style="width:100%;">
                    ${availableModels.map(m => `<option value="${m.nom}" ${blockConfig.model === m.nom ? 'selected' : ''}>${m.nom}</option>`).join('')}
                </select>
            </div>
        `;
        return html;
    }

    const m = new Modal('syntheseModal', existingBlock ? 'Modifier Synthèse IA' : 'Générer Synthèse IA', `<div id="synModalBody"></div>`, [
        { label: 'Annuler', class: 'btn-secondary', onClick: (ev, modal) => modal.close() },
        { label: existingBlock ? 'Enregistrer & Régénérer' : 'Générer la synthèse', class: 'btn-primary', onClick: (ev, modal) => {
            if (existingBlock) {
                existingBlock.config = blockConfig;
                store.save(); store.notify('deliveries_v2');
                renderMainView(); // Il se re-rendra avec la nouvelle config
                regenerateSyntheseBlock(existingBlock); // on va relancer l'IA
            } else {
                const newBlock = {
                    id: 'blk_' + Date.now(),
                    type: 'synthese',
                    config: blockConfig,
                    content: "Génération en cours..." // Sera remplacé
                };
                currentModule.blocks.push(newBlock);
                store.save(); store.notify('deliveries_v2');
                renderMainView(); 
                regenerateSyntheseBlock(newBlock);
            }
            modal.close();
        }}
    ]);
    m.render();

    function bindBody() {
        const bodyEl = document.getElementById('synModalBody');
        bodyEl.innerHTML = renderSyntheseBody();

        bodyEl.querySelector('.slc-syn-scope').addEventListener('change', (ev) => {
            blockConfig.scope.type = ev.target.value;
            if (blockConfig.scope.type === 'global') blockConfig.scope.selection = [];
            bindBody();
        });

        bodyEl.querySelectorAll('.chk-chapter').forEach(cb => {
            cb.addEventListener('change', (ev) => {
                const chapName = ev.target.dataset.chap;
                const chap = hierarchy.find(c => c.name === chapName);
                if (ev.target.checked) {
                    if (chap.subs.length === 0) {
                        if (!blockConfig.scope.selection.includes(chapName)) blockConfig.scope.selection.push(chapName);
                    } else {
                        chap.subs.forEach(s => { if (!blockConfig.scope.selection.includes(s)) blockConfig.scope.selection.push(s); });
                    }
                } else {
                    if (chap.subs.length === 0) {
                        blockConfig.scope.selection = blockConfig.scope.selection.filter(s => s !== chapName);
                    } else {
                        blockConfig.scope.selection = blockConfig.scope.selection.filter(s => !chap.subs.includes(s));
                    }
                }
                bindBody();
            });
        });

        bodyEl.querySelectorAll('.chk-subchap').forEach(cb => {
            cb.addEventListener('change', (ev) => {
                const subName = ev.target.dataset.sub;
                if (ev.target.checked) {
                    if (!blockConfig.scope.selection.includes(subName)) blockConfig.scope.selection.push(subName);
                } else {
                    blockConfig.scope.selection = blockConfig.scope.selection.filter(s => s !== subName);
                }
                bindBody();
            });
        });

        bodyEl.querySelector('.inp-prompt').addEventListener('change', (ev) => blockConfig.prompt = ev.target.value);
        bodyEl.querySelector('.slc-model').addEventListener('change', (ev) => blockConfig.model = ev.target.value);
    }
    bindBody();
}

async function regenerateSyntheseBlock(block, blockEl = null) {
    if (blockEl) {
        blockEl.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Génération en cours...</div>';
    }
    try {
        const contexteData = AIContextBuilder.buildTable(block.config.scope, null, currentForm);
        let finalPrompt = "Voici les données :\\n" + contexteData + "\\n\\nConsigne : " + block.config.prompt;
        
        let messages = [
            { role: "system", content: "Tu es un expert en analyse d'audit." },
            { role: "user", content: finalPrompt }
        ];

        const agentName = block.config.model;
        const modelConfig = availableModels.find(m => m.nom === agentName);
        if (!modelConfig) throw new Error(`Configuration de l'agent '${agentName}' introuvable.`);
        
        const response = await ApiService.fetchLLM(modelConfig, messages);
        block.config.result = response;
        block.content = response;
        
        store.save(); store.notify('deliveries_v2');
        renderMainView();
    } catch (e) {
        console.error("Erreur de génération IA", e);
        block.content = "Erreur de génération : " + e.message;
        store.save(); store.notify('deliveries_v2');
        renderMainView();
    }
}

function showModalDataTable(existingBlock, currentModule) {
    const hierarchy = buildChapterHierarchy();
    const tempConfig = existingBlock ? JSON.parse(JSON.stringify(existingBlock.config)) : {
        scope: { type: 'global', selection: [] },
        columns: currentForm.columns ? currentForm.columns.map(c=>c.id) : []
    };
    
    function renderModalBody() {
        let html = `
            <div class="form-group" style="margin-bottom:10px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">Scope (Périmètre)</label>
                <select class="form-control slc-table-scope" style="width:100%;">
                    <option value="global" ${tempConfig.scope.type === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                    <option value="chapter" ${tempConfig.scope.type === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                </select>
            </div>
        `;

        if (tempConfig.scope.type === 'chapter') {
            html += `<div class="chapter-selector-container" style="border:1px solid var(--border); background:var(--bg-color); padding:10px; border-radius:4px; max-height:200px; overflow-y:auto; margin-bottom:10px;">`;
            hierarchy.forEach(chap => {
                const allChecked = chap.subs.length > 0 ? chap.subs.every(s => tempConfig.scope.selection.includes(s)) : tempConfig.scope.selection.includes(chap.name);
                html += `
                    <div class="chap-item" style="margin-bottom:5px;">
                        <label style="font-weight:bold; display:flex; align-items:center;">
                            <input type="checkbox" class="chk-chapter" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                            ${Utils.escapeHtml(chap.name)}
                        </label>
                        <div class="sub-list" style="margin-left: 20px;">
                `;
                chap.subs.forEach(sub => {
                    const isChecked = tempConfig.scope.selection.includes(sub);
                    html += `
                        <label style="display:flex; align-items:center; font-size:0.9em; margin-bottom:2px;">
                            <input type="checkbox" class="chk-subchap" data-chap="${Utils.escapeHtml(chap.name)}" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
                            ${Utils.escapeHtml(sub)}
                        </label>
                    `;
                });
                html += `</div></div>`;
            });
            html += `</div>`;
        }

        html += `
            <div class="form-group" style="margin-top:1rem;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">Colonnes à inclure</label>
                <div class="chapter-selector-container" style="max-height:150px; overflow-y:auto; border:1px solid var(--border); background:var(--bg-color); padding:10px; border-radius:4px;">
        `;
        (currentForm.columns || []).forEach(col => {
            const isChecked = tempConfig.columns.includes(col.id);
            html += `
                <label style="display:flex; align-items:center; margin-bottom:5px;">
                    <input type="checkbox" class="chk-col" data-colid="${col.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                    ${Utils.escapeHtml(col.label)}
                </label>
            `;
        });
        html += `</div></div>`;
        return html;
    }

    const m = new Modal('datatableModal', existingBlock ? 'Modifier table de données' :'Insérer une table de données', `<div id="dtModalBody"></div>`, [
        { label: 'Annuler', class: 'btn-secondary', onClick: (ev, modal) => modal.close() },
        { label: existingBlock ? 'Enregistrer' : 'Insérer', class: 'btn-primary', onClick: (ev, modal) => {
            if (tempConfig.columns.length === 0) return UI.showToast("Sélectionnez au moins une colonne.", "warning");
            
            if (existingBlock) {
                existingBlock.config = tempConfig;
            } else {
                currentModule.blocks.push({
                    id: 'blk_' + Date.now(),
                    type: 'datatable',
                    config: tempConfig
                });
            }
            store.save(); store.notify('deliveries_v2');
            renderMainView();
            modal.close();
        }}
    ]);
    m.render();

    function bindBody() {
        const bodyEl = document.getElementById('dtModalBody');
        bodyEl.innerHTML = renderModalBody();

        bodyEl.querySelector('.slc-table-scope').addEventListener('change', (ev) => {
            tempConfig.scope.type = ev.target.value;
            if (tempConfig.scope.type === 'global') tempConfig.scope.selection = [];
            bindBody();
        });

        bodyEl.querySelectorAll('.chk-chapter').forEach(cb => {
            cb.addEventListener('change', (ev) => {
                const chapName = ev.target.dataset.chap;
                const chap = hierarchy.find(c => c.name === chapName);
                if (!chap) return;
                if (ev.target.checked) {
                    if (chap.subs.length === 0) {
                        if (!tempConfig.scope.selection.includes(chapName)) tempConfig.scope.selection.push(chapName);
                    } else {
                        chap.subs.forEach(s => { if (!tempConfig.scope.selection.includes(s)) tempConfig.scope.selection.push(s); });
                    }
                } else {
                    if (chap.subs.length === 0) {
                        tempConfig.scope.selection = tempConfig.scope.selection.filter(s => s !== chapName);
                    } else {
                        tempConfig.scope.selection = tempConfig.scope.selection.filter(s => !chap.subs.includes(s));
                    }
                }
                bindBody();
            });
        });

        bodyEl.querySelectorAll('.chk-subchap').forEach(cb => {
            cb.addEventListener('change', (ev) => {
                const subName = ev.target.dataset.sub;
                if (ev.target.checked) {
                    if (!tempConfig.scope.selection.includes(subName)) tempConfig.scope.selection.push(subName);
                } else {
                    tempConfig.scope.selection = tempConfig.scope.selection.filter(s => s !== subName);
                }
                bindBody();
            });
        });

        bodyEl.querySelectorAll('.chk-col').forEach(cb => {
            cb.addEventListener('change', (ev) => {
                const colId = ev.target.dataset.colid;
                if (ev.target.checked) {
                    if (!tempConfig.columns.includes(colId)) tempConfig.columns.push(colId);
                } else {
                    tempConfig.columns = tempConfig.columns.filter(c => c !== colId);
                }
            });
        });
    }
    bindBody();
}

function buildChapterHierarchy() {
    if (!currentForm || !currentForm.rows || !currentForm.columns) return [];
    
    let colChapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    let colSubIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    if (colChapIdx === -1) return [];

    let hierarchyMap = new Map();

    currentForm.rows.forEach(row => {
        let chapName = row[colChapIdx];
        if (!chapName) return;

        let subName = colSubIdx !== -1 ? row[colSubIdx] : null;

        if (!hierarchyMap.has(chapName)) {
            hierarchyMap.set(chapName, new Set());
        }
        if (subName) {
            hierarchyMap.get(chapName).add(subName);
        }
    });

    let hierarchy = [];
    hierarchyMap.forEach((subs, name) => {
        hierarchy.push({ name, subs: Array.from(subs) });
    });

    return hierarchy;
}

