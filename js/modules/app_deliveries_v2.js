import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { IOManager } from '../core/IOManager.js';
import { Utils } from '../core/Utils.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';
import { Modal } from '../ui/Modal.js';
import { ApiService } from '../api/api_ia.js';
import { showImpressionPopup } from './app_impression_logic.js';
import '../components/EzioMarkdownEditor.js';

let availableTemplates = [];
let availableModels = [];
let availableModules = [];
let selection = { id: null, moduleIndex: 0 };
let editorMaxWidth = '1024px'; // Par défaut : format A4 debout

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
        <div class="dlv2-header-bar">
            <input type="text" id="inpDlvName-v2" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px; border:none; background:transparent;" value="${Utils.escapeHtml(delivery.name)}">
            <div class="dlv-actions">
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

    const canPrev = selection.moduleIndex > 0;
    const canNext = selection.moduleIndex < moduleCount - 1;

    // UI with Navigation Arrows and central Editor wrapper
    els.main.innerHTML = headerHTML + `
        <div class="dlv2-editor-section">
            <div class="dlv2-module-header">
                <h2 class="dlv2-module-title">${Utils.escapeHtml(currentModule.name || 'Module')}</h2>
            </div>
            
            <div class="dlv2-navigation-layout">
                <button id="btnPrevMod-v2" class="dlv2-nav-btn" ${!canPrev ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                
                <div class="dlv2-editor-wrapper">
                    <!-- Markdown Editor injected here securely -->
                    <ezio-markdown-editor id="mdEditor-v2" editor-id="editor-inst-v2" min-height="100%"></ezio-markdown-editor>
                </div>
                
                <button id="btnNextMod-v2" class="dlv2-nav-btn" ${!canNext ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    `;

    // Initialize Editor Value securely via JS property
    const editorEl = document.getElementById('mdEditor-v2');
    if (editorEl) {
        // Need to wait 1 tick for the component to be ready
        setTimeout(() => {
            editorEl.value = currentModule.result || '';
             // Bind Change Event for Auto-save
            editorEl.addEventListener('change', (e) => {
                 if (e.detail && e.detail.markdown !== undefined) {
                    currentModule.result = e.detail.markdown;
                    const debouncedSave = Utils.debounce(() => { store.save(); store.notify('deliveries_v2'); }, 500);
                    debouncedSave();
                 }
            });

            // Add layout width toggles to the internal toolbar
            const toolbar = editorEl.querySelector('.dlv-md-toolbar');
            if (toolbar && !toolbar.querySelector('.layout-toggles')) {
                // Ajout des 3 boutons centraux (Données, KPI, Synthèse)
                const centralTools = document.createElement('div');
                centralTools.className = 'module-actions';
                centralTools.style.display = 'flex';
                centralTools.style.gap = '5px';
                centralTools.style.marginLeft = '15px'; // Espacement par rapport aux boutons de formatage
                
                centralTools.innerHTML = `
                    <button class="btn-secondary small" id="btnModData-v2" title="Données" style="padding: 4px 8px;"><i class="fas fa-database"></i></button>
                    <button class="btn-secondary small" id="btnModKPI-v2" title="KPI" style="padding: 4px 8px;"><i class="fas fa-chart-bar"></i></button>
                    <button class="btn-secondary small" id="btnModSynth-v2" title="Synthèse" style="padding: 4px 8px;"><i class="fas fa-pen"></i></button>
                `;
                toolbar.appendChild(centralTools);

                // --- Modal Datatable ---
                let savedRangeData = null;
                document.getElementById('btnModData-v2').addEventListener('mousedown', () => {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) savedRangeData = sel.getRangeAt(0).cloneRange();
                });

                document.getElementById('btnModData-v2').addEventListener('click', (evClick) => {
                    evClick.stopPropagation();
                    const hierarchy = buildChapterHierarchy();
                    const tempConfig = {
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

                    const m = new Modal('datatableModal', 'Insérer une table de données', `<div id="dtModalBody"></div>`, [
                        { label: 'Annuler', class: 'btn-secondary', onClick: (ev, modal) => modal.close() },
                        { label: 'Insérer', class: 'btn-primary', onClick: (ev, modal) => {
                            if (tempConfig.columns.length === 0) return UI.showToast("Sélectionnez au moins une colonne.", "warning");
                            insertDatatableAtCursor(tempConfig, editorEl, savedRangeData);
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
                });
                // --- Fin Modal Datatable ---

                // --- Modal KPI ---
                let savedRange = null;
                document.getElementById('btnModKPI-v2').addEventListener('mousedown', () => {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                        savedRange = sel.getRangeAt(0).cloneRange();
                    }
                });

                document.getElementById('btnModKPI-v2').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const kpis = currentForm.statics || [];
                    if (kpis.length === 0) return UI.showToast("Aucun graphique KPI n'a été créé dans l'onglet Tableau de bord.", "warning");

                    const itemsHtml = kpis.map(k => `
                        <button class="menu-btn kpi-insert-btn" data-id="${k.id}" data-title="${Utils.escapeHtml(k.title)}" style="text-align:left; width:100%; padding:10px; margin-bottom:5px; border:1px solid var(--border); background:var(--bg-secondary); border-radius:4px; cursor:pointer; color:var(--text-main);">
                            <b>📊 ${Utils.escapeHtml(k.title)}</b><br>
                            <small style="color:var(--text-muted);">${k.vizType}</small>
                        </button>
                    `).join('');

                    const m = new Modal('kpiInsertModal', 'Insérer un graphique', `<div>${itemsHtml}</div>`, [
                        { label: 'Annuler', class: 'btn-secondary', onClick: (e, modal) => modal.close() }
                    ]);
                    m.render();

                    document.querySelectorAll('#kpiInsertModal .kpi-insert-btn').forEach(b => {
                        b.addEventListener('click', () => {
                            insertKPIAtCursor(b.dataset.id, b.dataset.title, editorEl, savedRange);
                            m.close();
                        });
                    });
                });
                // --- Fin Modal KPI ---

                // --- Modal Synthèse IA ---
                let savedRangeSynthese = null;
                document.getElementById('btnModSynth-v2').addEventListener('mousedown', () => {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) savedRangeSynthese = sel.getRangeAt(0).cloneRange();
                });

                document.getElementById('btnModSynth-v2').addEventListener('click', (evClick) => {
                    evClick.stopPropagation();
                    const hierarchy = buildChapterHierarchy();
                    const tempConfig = {
                        scope: { type: 'global', selection: [] },
                        columns: currentForm.columns ? currentForm.columns.map(c=>c.id) : [],
                        prompt: "Rédige une synthèse professionnelle de ces données d'audit.",
                        model: availableModels.length > 0 ? availableModels[0].nom : ""
                    };
                    
                    function renderSyntheseBody() {
                        let html = `
                            <div class="form-group" style="margin-bottom:10px;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Scope (Périmètre)</label>
                                <select class="form-control slc-syn-scope" style="width:100%;">
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
                                            <input type="checkbox" class="chk-syn-chapter" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                                            ${Utils.escapeHtml(chap.name)}
                                        </label>
                                        <div class="sub-list" style="margin-left: 20px;">
                                `;
                                chap.subs.forEach(sub => {
                                    const isChecked = tempConfig.scope.selection.includes(sub);
                                    html += `
                                        <label style="display:flex; align-items:center; font-size:0.9em; margin-bottom:2px;">
                                            <input type="checkbox" class="chk-syn-subchap" data-chap="${Utils.escapeHtml(chap.name)}" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
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
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Colonnes à inclure (Contexte IA)</label>
                                <div class="chapter-selector-container" style="max-height:100px; overflow-y:auto; border:1px solid var(--border); background:var(--bg-color); padding:10px; border-radius:4px;">
                        `;
                        (currentForm.columns || []).forEach(col => {
                            const isChecked = tempConfig.columns.includes(col.id);
                            html += `
                                <label style="display:flex; align-items:center; margin-bottom:5px;">
                                    <input type="checkbox" class="chk-syn-col" data-colid="${col.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                                    ${Utils.escapeHtml(col.label)}
                                </label>
                            `;
                        });
                        html += `</div></div>`;

                        html += `
                            <div class="form-group" style="margin-top:1rem;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Prompt IA</label>
                                <textarea class="form-control txt-syn-prompt" rows="3" style="width:100%; box-sizing:border-box;">${Utils.escapeHtml(tempConfig.prompt)}</textarea>
                            </div>
                            <div class="form-group" style="margin-top:1rem;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Modèle IA</label>
                                <select class="form-control slc-syn-model" style="width:100%;">
                                    <option value="">Sélectionnez un agent...</option>
                                    ${availableModels.map(m => `<option value="${m.nom}" ${m.nom === tempConfig.model ? 'selected' : ''}>${m.nom}</option>`).join('')}
                                </select>
                            </div>
                        `;
                        return html;
                    }

                    const m = new Modal('syntheseModal', 'Générer une Synthèse IA', `<div id="synModalBody"></div>`, [
                        { label: 'Annuler', class: 'btn-secondary', onClick: (ev, modal) => modal.close() },
                        { label: 'Générer', class: 'btn-primary', onClick: async (ev, modal) => {
                            if (!tempConfig.model) return UI.showToast("Sélectionnez un modèle IA.", "warning");
                            if (!tempConfig.prompt.trim()) return UI.showToast("Le prompt ne peut pas être vide.", "warning");
                            
                            const btn = ev.target;
                            const ogText = btn.innerHTML;
                            btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
                            btn.disabled = true;

                            try {
                                const contextData = AIContextBuilder.buildTable(tempConfig.scope, tempConfig.columns, currentForm);
                                const modelConfig = availableModels.find(mod => mod.nom === tempConfig.model);
                                if (!modelConfig) throw new Error("Agent introuvable");
                                
                                const messages = [
                                    { role: 'system', content: tempConfig.prompt },
                                    { role: 'user', content: [tempConfig.prompt, contextData] }
                                ];
                                
                                const response = await ApiService.fetchLLM(modelConfig, messages);
                                tempConfig.result = response;
                                insertSyntheseAtCursor(tempConfig, editorEl, savedRangeSynthese);
                                modal.close();
                            } catch (e) {
                                UI.showToast(`Erreur : ${e.message}`, "danger");
                                btn.innerHTML = ogText;
                                btn.disabled = false;
                            }
                        }}
                    ]);
                    m.render();

                    function bindBody() {
                        const bodyEl = document.getElementById('synModalBody');
                        bodyEl.innerHTML = renderSyntheseBody();

                        bodyEl.querySelector('.slc-syn-scope').addEventListener('change', (ev) => {
                            tempConfig.scope.type = ev.target.value;
                            if (tempConfig.scope.type === 'global') tempConfig.scope.selection = [];
                            bindBody();
                        });

                        bodyEl.querySelectorAll('.chk-syn-chapter').forEach(cb => {
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

                        bodyEl.querySelectorAll('.chk-syn-subchap').forEach(cb => {
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

                        bodyEl.querySelectorAll('.chk-syn-col').forEach(cb => {
                            cb.addEventListener('change', (ev) => {
                                const colId = ev.target.dataset.colid;
                                if (ev.target.checked) {
                                    if (!tempConfig.columns.includes(colId)) tempConfig.columns.push(colId);
                                } else {
                                    tempConfig.columns = tempConfig.columns.filter(c => c !== colId);
                                }
                            });
                        });

                        bodyEl.querySelector('.txt-syn-prompt').addEventListener('input', e => tempConfig.prompt = e.target.value);
                        bodyEl.querySelector('.slc-syn-model').addEventListener('change', e => tempConfig.model = e.target.value);
                    }
                    bindBody();
                });
                
                // --- Fin Modal Synthèse IA ---

                const toggleWrapper = document.createElement('div');
                toggleWrapper.className = 'layout-toggles';
                toggleWrapper.style.marginLeft = 'auto'; // push to right align
                toggleWrapper.style.display = 'flex';
                toggleWrapper.style.gap = '5px';
                
                toggleWrapper.innerHTML = `
                    <button class="btn-secondary small" id="btnLayoutWide-v2" title="Format Paysage (1500px)" style="padding: 4px 8px; display:flex; align-items:center;">
                        <div style="width: 16px; height: 10px; border: 2px solid currentColor; border-radius: 2px;"></div>
                    </button>
                    <button class="btn-secondary small" id="btnLayoutNarrow-v2" title="Format Portrait (1024px)" style="padding: 4px 8px; display:flex; align-items:center;">
                        <div style="width: 10px; height: 16px; border: 2px solid currentColor; border-radius: 2px;"></div>
                    </button>
                `;
                toolbar.appendChild(toggleWrapper);

                const wrapper = document.querySelector('.dlv2-editor-wrapper');
                if (wrapper) wrapper.style.maxWidth = editorMaxWidth; // Restore preferred state

                document.getElementById('btnLayoutWide-v2').addEventListener('click', (e) => {
                    e.stopPropagation();
                    editorMaxWidth = '1500px';
                    if (wrapper) wrapper.style.maxWidth = editorMaxWidth;
                });
                document.getElementById('btnLayoutNarrow-v2').addEventListener('click', (e) => {
                    e.stopPropagation();
                    editorMaxWidth = '1024px';
                    if (wrapper) wrapper.style.maxWidth = editorMaxWidth;
                });
            }
        }, 50);
    }

    // Bind Navigation and Generation Actions
    document.getElementById('btnPrevMod-v2')?.addEventListener('click', () => {
        if (canPrev) {
            selection.moduleIndex--;
            renderSidebarList();
            renderMainView();
        }
    });

    document.getElementById('btnNextMod-v2')?.addEventListener('click', () => {
        if (canNext) {
            selection.moduleIndex++;
            renderSidebarList();
            renderMainView();
        }
    });

    document.getElementById('btnGenIA-v2')?.addEventListener('click', () => {
        generateModule(delivery, selection.moduleIndex);
    });
    
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

async function generateModule(delivery, index) {
    const instance = delivery.structure[index];
    const editorComponent = document.getElementById('mdEditor-v2');
    const btn = document.getElementById('btnGenIA-v2');
    
    if (!editorComponent || !btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
    btn.disabled = true;
    editorComponent.value = '';

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
            { role: 'user', content: [prompt, contextData] }
        ];

        const response = await ApiService.fetchLLM(modelConfig, messages);

        if (instance.config.isTable) {
            instance.contextTable = contextData;
        } else {
            delete instance.contextTable;
        }

        instance.result = response;
        store.save(); store.notify('deliveries_v2');

        editorComponent.value = response;

    } catch (e) {
        console.error("Generation Error", e);
        editorComponent.htmlContent = `<div style="color:var(--danger)"> Erreur : ${e.message}</div>`;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
            inst.contextTable = AIContextBuilder.buildTable(inst.config.scope, inst.config.columns, currentForm);
            if (inst.contextTable) {
                mdContent += `${inst.contextTable} \n\n-- -\n\n`;
            }
        }

        mdContent += `${content} \n\n`;
        mdContent += `-- -\n\n`;
    }

    store.save(); store.notify('deliveries_v2');
    const filename = `${Utils.toSlug(delivery.name)}.md`;
    IOManager.downloadFile(mdContent, filename, 'text/markdown');
}

// --- Utils ---
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

function insertDatatableAtCursor(config, editorComponent, savedRange) {
    const editableDiv = editorComponent.querySelector('.dlv-card-result');
    if (!editableDiv) return;

    editableDiv.focus();

    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    } else {
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const b64Config = btoa(encodeURIComponent(JSON.stringify(config)));
    const htmlBadge = `<div contenteditable="false" class="datatable-placeholder" data-config="${b64Config}" style="margin: 20px 0; border: 1px solid var(--border); background:var(--bg-secondary); padding:10px; border-radius:8px; max-height:450px; overflow-y:auto; overflow-x:auto;">📊 Macro Table Dynamics (${Utils.escapeHtml(config.scope.type)})</div><br>`;
    
    document.execCommand('insertHTML', false, htmlBadge);
    
    // Déclenche la sauvegarde silencieuse interne de l'éditeur Markdown
    editableDiv.dispatchEvent(new Event('blur')); 

    // Force la réinterprétation intégrale pour le rendu de la Data Table générée à la volée !
    setTimeout(() => {
        editorComponent.value = editorComponent.value;
    }, 100);
}

function insertKPIAtCursor(id, title, editorComponent, savedRange) {
    const editableDiv = editorComponent.querySelector('.dlv-card-result');
    if (!editableDiv) return;

    editableDiv.focus();

    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    } else {
        // Fallback en fin de texte
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // Injection via execCommand pour préserver la fonction Undo/Redo du navigateur
    const htmlBadge = `<div contenteditable="false" style="margin: 20px 0; padding: 10px; background: var(--bg-secondary); border-radius: 8px; user-select: none; display: block; overflow: hidden; max-height: 450px;"><ezio-widget data-id="${id}" readonly="true"></ezio-widget></div><br>`;
    
    document.execCommand('insertHTML', false, htmlBadge);
    
    // Déclenche la sauvegarde silencieuse interne de l'éditeur Markdown
    editableDiv.dispatchEvent(new Event('blur')); 
}

function insertTextAtCursor(text, editorComponent, savedRange) {
    const editableDiv = editorComponent.querySelector('.dlv-card-result');
    if (!editableDiv) return;

    editableDiv.focus();

    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    } else {
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const htmlText = String(text).replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, htmlText);
    
    editableDiv.dispatchEvent(new Event('blur')); 
}

function insertSyntheseAtCursor(config, editorComponent, savedRange) {
    const editableDiv = editorComponent.querySelector('.dlv-card-result');
    if (!editableDiv) return;

    editableDiv.focus();

    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    } else {
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const b64Config = btoa(encodeURIComponent(JSON.stringify(config)));
    const tmpHtml = window.marked.parse(config.result || "Aucun résultat généré.");
    
    const htmlBadge = `<div contenteditable="false" class="synthese-placeholder" data-config="${b64Config}" style="margin: 20px 0; border: 2px solid var(--primary-color); border-left-width: 6px; background:var(--bg-color); padding:15px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--border);">
            <span style="font-weight:bold; color:var(--primary-color); font-size:1.1em;">✨ Synthèse IA</span>
            <span style="font-size:0.8em; color:var(--text-muted); background:var(--bg-secondary); padding:2px 8px; border-radius:12px;">Modèle : ${Utils.escapeHtml(config.model)}</span>
        </div>
        <div class="synthese-content" style="color:var(--text-main); opacity:0.9;">
            ${tmpHtml}
        </div>
    </div><br>`;
    
    document.execCommand('insertHTML', false, htmlBadge);
    
    editableDiv.dispatchEvent(new Event('blur')); 
    
    setTimeout(() => {
        editorComponent.value = editorComponent.value;
    }, 100);
}
