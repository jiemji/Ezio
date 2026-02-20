import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';
import { Sidebar } from '../ui/Sidebar.js';
import { ApiService } from '../api/api_ia.js';
import { downloadDeliveryWord } from './app_output_word.js';
import { downloadDeliveryPpt } from './app_outputppt.js';
import { showImpressionPopup } from './app_impression_logic.js';

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
    setupDelegation(); // Attach delegated listeners once
}

function setupDelegation() {
    if (!els.main) return;

    // Debounced Save for text inputs
    const debouncedSave = Utils.debounce(() => {
        store.save();
    }, 500);

    // 1. CLICK Delegation
    els.main.onclick = (e) => {
        const target = e.target;

        // Buttons: Generate, Move, Remove, Collapse
        if (target.classList.contains('btn-toggle-collapse')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            const idx = parseInt(target.dataset.idx);
            if (delivery && delivery.structure[idx]) {
                const isCollapsed = delivery.structure[idx].config.collapsed;
                delivery.structure[idx].config.collapsed = !isCollapsed;
                store.save(); // Save state

                // Direct DOM update
                const wrapper = target.closest('.dlv-card-body').querySelector('.dlv-inputs-wrapper');
                if (wrapper) wrapper.style.display = !isCollapsed ? 'none' : 'block';

                target.innerText = !isCollapsed ? '▶' : '▼';
            }
            return;
        }

        if (target.classList.contains('btn-generate')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) generateModule(delivery, parseInt(target.dataset.idx));
            return;
        }
        if (target.classList.contains('btn-move-left')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) moveModule(delivery, parseInt(target.dataset.idx), -1);
            return;
        }
        if (target.classList.contains('btn-move-right')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) moveModule(delivery, parseInt(target.dataset.idx), 1);
            return;
        }
        if (target.classList.contains('btn-remove-mod')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery) removeModule(delivery, parseInt(target.dataset.idx));
            return;
        }

        // Checkboxes: Chapter, SubChap, Col, FormatTable
        if (target.classList.contains('chk-chapter')) {
            handleChapterCheck(target);
            return;
        }
        if (target.classList.contains('chk-subchap')) {
            handleSubChapCheck(target);
            return;
        }
        if (target.classList.contains('chk-col')) {
            handleColCheck(target);
            return;
        }
        if (target.classList.contains('chk-format-table')) {
            const idx = parseInt(target.dataset.idx);
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            if (delivery && delivery.structure[idx]) {
                if (!delivery.structure[idx].config) delivery.structure[idx].config = {};
                delivery.structure[idx].config.isTable = target.checked;
                store.save();
            }
            return;
        }
        if (target.classList.contains('btn-md-format')) {
            const action = target.getAttribute('data-action');
            const idx = parseInt(target.getAttribute('data-idx'));
            handleMdFormatting(action, idx);
            return;
        }
    };

    // 2. CHANGE Delegation (Selects)
    els.main.onchange = (e) => {
        const target = e.target;
        const delivery = currentForm.reports.find(d => d.id === selection.id);
        if (!delivery) return;

        // Delivery Name
        if (target.id === 'inpDlvName') {
            delivery.name = target.value;
            store.save();
            renderSidebarList();
            return;
        }

        const idx = parseInt(target.dataset.idx);
        if (isNaN(idx) || !delivery.structure[idx]) return;

        // Prompt (also handled in input for debounce, but change ensures final save)
        if (target.classList.contains('txt-inst-prompt')) {
            delivery.structure[idx].config.ai.prompt = target.value;
            store.save();
            return;
        }

        // Model
        if (target.classList.contains('slc-inst-model')) {
            delivery.structure[idx].config.ai.model = target.value;
            store.save();
            return;
        }

        // Scope Type
        if (target.classList.contains('slc-inst-scope')) {
            delivery.structure[idx].config.scope.type = target.value;
            if (target.value === 'global') {
                delivery.structure[idx].config.scope.selection = [];
            }
            store.save();
            renderMainView();
            return;
        }
    };

    // 3. INPUT Delegation (Debounced Text)
    els.main.oninput = (e) => {
        const target = e.target;
        const delivery = currentForm.reports.find(d => d.id === selection.id);
        if (!delivery) return;

        if (target.classList.contains('txt-inst-prompt')) {
            const idx = parseInt(target.dataset.idx);
            if (delivery.structure[idx]) {
                delivery.structure[idx].config.ai.prompt = target.value;
                debouncedSave();
            }
        }
        // Delivery Name Debounce
        if (target.id === 'inpDlvName') {
            delivery.name = target.value;
            debouncedSave();
            // Note: Sidebar update might be delayed, which is fine
        }
    };

    // 4. BLUR Delegation (ContentEditable)
    els.main.addEventListener('blur', (e) => {
        const target = e.target;
        if (target.classList.contains('dlv-card-result')) {
            const delivery = currentForm.reports.find(d => d.id === selection.id);
            const card = target.closest('.dlv-card');
            if (delivery && card) {
                const idx = parseInt(card.dataset.idx);
                if (delivery.structure[idx]) {
                    delivery.structure[idx].result = htmlToMarkdown(target.innerHTML);
                    store.save();
                }
            }
        }
    }, true); // Capture phase for blur
}

function htmlToMarkdown(html) {
    if (!html) return '';

    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Clean up empty tags and weird spaces
    temp.innerHTML = temp.innerHTML.replace(/\u200B/g, '');

    function parseNodeToMd(node, listLevel = 0, isOrdered = false, counter = { val: 1 }) {
        let md = '';
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];

            if (child.nodeType === 3) { // Text node
                md += child.textContent;
            } else if (child.nodeType === 1) { // Element node
                const tag = child.tagName.toLowerCase();

                switch (tag) {
                    case 'b':
                    case 'strong':
                        md += '**' + parseNodeToMd(child) + '**';
                        break;
                    case 'i':
                    case 'em':
                        md += '*' + parseNodeToMd(child) + '*';
                        break;
                    case 'h1': md += '\n# ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'h2': md += '\n## ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'h3': md += '\n### ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'h4': md += '\n#### ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'h5': md += '\n##### ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'h6': md += '\n###### ' + parseNodeToMd(child) + '\n\n'; break;
                    case 'p':
                    case 'div':
                        md += '\n' + parseNodeToMd(child) + '\n';
                        break;
                    case 'br':
                        md += '\n';
                        break;
                    case 'ul':
                        md += '\n' + parseNodeToMd(child, listLevel + 1, false) + '\n';
                        break;
                    case 'ol':
                        md += '\n' + parseNodeToMd(child, listLevel + 1, true, { val: 1 }) + '\n';
                        break;
                    case 'li':
                        const indent = '  '.repeat(Math.max(0, listLevel - 1));
                        const bullet = isOrdered ? `${counter.val++}. ` : '- ';
                        md += '\n' + indent + bullet + parseNodeToMd(child, listLevel, isOrdered, counter);
                        break;
                    default:
                        md += parseNodeToMd(child, listLevel, isOrdered, counter);
                }
            }
        }
        return md;
    }

    let markdown = parseNodeToMd(temp).trim();
    // Normalize multiple newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    return markdown;
}

function handleMdFormatting(action, idx) {
    const delivery = currentForm.reports.find(d => d.id === selection.id);
    if (!delivery) return;

    const editor = els.main.querySelector(`#dlv-editor-${idx}`);
    if (!editor) return;

    editor.focus();

    if (action === 'bold') {
        document.execCommand('bold', false, null);
    } else if (action === 'h-up' || action === 'h-down') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.focusNode;
        if (!node) return;

        // Find closest block element
        const blockNode = node.nodeType === 3 ? node.parentNode : node;
        const blockWrapper = blockNode.closest('h1, h2, h3, h4, h5, h6, p, div');
        let currentTag = blockWrapper ? blockWrapper.tagName.toLowerCase() : 'p';
        if (currentTag === 'div' || currentTag === 'li') currentTag = 'p';

        let newTag = currentTag;

        if (action === 'h-up') { // [+] Minimum size is H2 (Level 2), default is P
            // Decreasing # -> Heading up (larger size, smaller heading number)
            if (currentTag === 'p' || currentTag === 'h4') newTag = 'h3';
            else if (currentTag === 'h3') newTag = 'h2';
            else if (currentTag === 'h2') newTag = 'h2'; // Max size requested
        } else if (action === 'h-down') { // [-] Back towards normal text
            // Increasing # -> Heading down (smaller size, larger heading number)
            if (currentTag === 'h2') newTag = 'h3';
            else if (currentTag === 'h3') newTag = 'h4';
            else if (currentTag === 'h4') newTag = 'p'; // Back to standard text
        }

        if (newTag !== currentTag) {
            document.execCommand('formatBlock', false, '<' + newTag.toUpperCase() + '>');
        }
    } else if (action === 'indent-up') {
        document.execCommand('insertUnorderedList', false, null);
    } else if (action === 'indent-down') {
        // Technically outdent, but standard insertUnorderedList toggles it. 
        // We'll trust native contenteditable behavior for nested lists and outdents.
        document.execCommand('outdent', false, null);
    } else if (action === 'list-num') {
        document.execCommand('insertOrderedList', false, null);
    }

    // Save parsed Markdown back
    if (delivery.structure[idx]) {
        delivery.structure[idx].result = htmlToMarkdown(editor.innerHTML);
        store.save();
    }
}

// Helper functions for checkboxes to keep delegation clean
function handleChapterCheck(target) {
    const delivery = currentForm.reports.find(d => d.id === selection.id);
    const idx = parseInt(target.dataset.idx);
    const chapName = target.getAttribute('data-chap');
    const hierarchy = buildChapterHierarchy();
    const chap = hierarchy.find(c => c.name === chapName);

    if (!delivery || !chap) return;

    let currentSelection = delivery.structure[idx].config.scope.selection || [];

    if (target.checked) {
        chap.subs.forEach(s => {
            if (!currentSelection.includes(s)) currentSelection.push(s);
        });
    } else {
        currentSelection = currentSelection.filter(s => !chap.subs.includes(s));
    }

    delivery.structure[idx].config.scope.selection = currentSelection;
    store.save();
    renderMainView();
}

function handleSubChapCheck(target) {
    const delivery = currentForm.reports.find(d => d.id === selection.id);
    const idx = parseInt(target.dataset.idx);
    const subName = target.getAttribute('data-sub');
    if (!delivery) return;

    let currentSelection = delivery.structure[idx].config.scope.selection || [];

    if (target.checked) {
        if (!currentSelection.includes(subName)) currentSelection.push(subName);
    } else {
        currentSelection = currentSelection.filter(s => s !== subName);
    }

    delivery.structure[idx].config.scope.selection = currentSelection;
    store.save();
    renderMainView();
}

function handleColCheck(target) {
    const delivery = currentForm.reports.find(d => d.id === selection.id);
    const idx = parseInt(target.dataset.idx);
    const colId = target.getAttribute('data-colid');
    if (!delivery) return;

    let currentCols = delivery.structure[idx].config.columns || [];

    if (target.checked) {
        if (!currentCols.includes(colId)) currentCols.push(colId);
    } else {
        currentCols = currentCols.filter(c => c !== colId);
    }

    delivery.structure[idx].config.columns = currentCols;
    store.save();
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

    const data = await Utils.safeFetch('reports.json');
    if (data) {
        availableTemplates = data.reports || [];
        availableModules = data.modules || [];
    }
}

async function loadModelsList() {
    const data = await Utils.safeFetch('models.json');
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

        const isCollapsed = inst.config.collapsed || false;

        trackHTML += `
            <div class="dlv-card ${isCollapsed ? 'collapsed' : ''}" data-idx="${idx}">
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
                        <div style="display:flex; align-items:center; margin-bottom:5px;">
                            <label style="margin-bottom:0; margin-right: 10px;">Scope (Périmètre)</label>
                            <button class="btn-toggle-collapse" data-idx="${idx}" title="Replier/Déplier" style="padding:0; border:none; background:none; cursor:pointer;">
                                ${isCollapsed ? '▶' : '▼'}
                            </button>
                        </div>
                        
                        <div class="dlv-inputs-wrapper" style="${isCollapsed ? 'display:none;' : ''}">
                            <select class="form-control slc-inst-scope" data-idx="${idx}">
                                <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                                <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                            </select>

                            ${renderChapterSelector(idx, scopeType, hierarchy, inst.config.scope.selection || [])}

                            <div class="form-group" style="margin-top:1rem;">
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
                    </div>
                </div>
                <div class="dlv-card-footer">
                     <button class="btn-primary small btn-generate" data-idx="${idx}" style="width:100%;">Tester / Générer</button>
                     <div class="dlv-md-toolbar" style="margin-top: 15px; display: flex; gap: 5px; flex-wrap: wrap;">
                         <button class="btn-secondary small btn-md-format" data-action="h-up" data-idx="${idx}" title="Niveau de titre +">[+]</button>
                         <button class="btn-secondary small btn-md-format" data-action="h-down" data-idx="${idx}" title="Niveau de titre -">[-]</button>
                         <button class="btn-secondary small btn-md-format" data-action="indent-down" data-idx="${idx}" title="Désindenter">[<]</button>
                         <button class="btn-secondary small btn-md-format" data-action="indent-up" data-idx="${idx}" title="Indenter">[>]</button>
                         <button class="btn-secondary small btn-md-format" data-action="list-num" data-idx="${idx}" title="Liste numérotée">[1.]</button>
                         <button class="btn-secondary small btn-md-format" data-action="bold" data-idx="${idx}" title="Gras">[G]</button>
                     </div>
                     <div class="dlv-card-result form-control" id="dlv-editor-${idx}" contenteditable="true" style="width:100%; min-height:300px; max-height: 600px; overflow-y:auto; margin-top: 5px; text-align: left;">${inst.result ? (window.marked ? window.marked.parse(inst.result) : inst.result) : ''}</div>
                </div>
            </div>
        `;
    });
    trackHTML += `</div>`;

    els.main.innerHTML = headerHTML + `<div class="dlv-editor-body">${trackHTML}</div>`;

    // Name change handled by delegation in setupDelegation


    document.getElementById('btnDownloadReport').addEventListener('click', () => {
        downloadDeliveryReport(delivery);
    });

    document.getElementById('btnImpression').addEventListener('click', () => {
        showImpressionPopup(delivery);
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

    // Old individual listeners removed - handled by delegation in setupDelegation()
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
            // Utilisation d'un séparateur markdown standard au lieu de balises HTML
            finalResult = contextData + "\n\n---\n\n" + response;
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
