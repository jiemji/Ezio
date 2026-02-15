import { DOM } from '../ui/DOM.js';
import { Utils } from '../core/Utils.js';
import { store, currentForm } from '../core/State.js'; // Imports live binding currentForm
import { switchView, registerModuleInit } from '../ui/Navigation.js';
import { Modal } from '../ui/Modal.js';

import { ApiService } from '../api/api_ia.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { DataUtils } from '../core/DataUtils.js';

let activeFilters = { chapter: null, subChapter: null };
let columnFilters = {};
let currentSort = { colIndex: -1, direction: 'asc' };
let currentSearch = "";
let auditAvailableModels = [];

export function initAudit() {
    registerModuleInit('audit', renderAudit);

    // Initial Load Models
    loadModels();

    // Search Listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentSearch = e.target.value.toLowerCase();
            renderTable();
        };
    }

    // Load Button Logic (Modal)
    if (DOM.loadBtn) {
        DOM.loadBtn.onclick = openLoadModal;
    }

    // Global Listener for Store updates to re-render if visible
    store.subscribe(() => {
        if (!DOM.auditView.classList.contains('hidden')) {
            renderAudit();
        }
    });

    // Expose loadRemoteTemplate for legacy or internal use if needed, 
    // but better to keep it internal or exported if other modules need it.
}

export function renderAudit() {
    if (!currentForm.columns.length) {
        // Maybe render empty state?
        // renderTable() handles it?
    }

    // Sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
        renderSidebar();
    }
    renderTable();
    updateStatusIndicator();
}

// --- LOGIC ---

function openLoadModal() {
    const content = `
        <div class="load-options" style="display:flex; gap:2rem;">
            <div class="load-section" style="flex:1;">
                <h4>Modèles (Templates)</h4>
                <ul id="templateList" class="template-list" style="max-height:200px; overflow-y:auto; border:1px solid #eee; padding:0.5rem; list-style:none;">
                    <li>Chargement...</li>
                </ul>
            </div>
            <div class="load-section" style="flex:1; border-left:1px solid #ddd; padding-left:2rem;">
                <h4>Fichier Local</h4>
                <p>Importez un fichier .json depuis votre ordinateur.</p>
                <input type="file" id="jsonInputModal" accept=".json" class="form-control">
            </div>
        </div>
    `;

    const modal = new Modal('modalLoad', 'Charger un Audit', content);
    modal.render();

    // Bind File Input
    const fileInput = document.getElementById('jsonInputModal');
    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    applyLoadedData(data, "Fichier local chargé");
                    modal.close();
                    UI.showToast("Import réussi !", "success");
                } catch (err) {
                    UI.showToast("Erreur JSON: " + err.message, "danger");
                }
            };
            reader.readAsText(file);
        };
    }

    // Fetch Templates (Async/Await)
    (async () => {
        const templates = await Utils.safeFetch('./templates/templates.json');
        const list = document.getElementById('templateList');
        if (list) {
            if (!templates || templates.length === 0) {
                list.innerHTML = "<li>Aucun modèle trouvé (ou erreur chargement).</li>";
                return;
            }
            list.innerHTML = templates.map(t =>
                `<li style="padding:5px; cursor:pointer; border-bottom:1px solid #eee;" data-file="${t.filename}">
                    <strong>${Utils.escapeHtml(t.name)}</strong>
                </li>`
            ).join('');

            list.querySelectorAll('li').forEach(li => {
                li.onclick = async () => {
                    await loadRemoteTemplate(li.dataset.file);
                    modal.close();
                };
            });
        }
    })();
}

async function loadRemoteTemplate(filename) {
    const data = await Utils.safeFetch(`./templates/${filename}`);
    if (data) {
        applyLoadedData(data, `Modèle chargé : ${filename}`);
        UI.showToast(`Modèle ${filename} chargé`, "success");
    } else {
        UI.showToast(`Erreur : Impossible de charger le modèle ${filename}.`, "danger");
    }
}

function applyLoadedData(data, message) {
    if (!data.columns || !data.rows) {
        alert("Format de fichier invalide (Colonnes ou lignes manquantes).");
        return;
    }

    // Helper to ensure structure matches expectation
    const newState = { ...data };
    if (!newState.statics) newState.statics = [];
    if (!newState.rowMeta) newState.rowMeta = [];
    while (newState.rowMeta.length < newState.rows.length) {
        newState.rowMeta.push({});
    }
    if (!newState.notes) newState.notes = "";

    // Update Store
    store.set(newState);

    // Reset local state
    activeFilters = { chapter: null, subChapter: null };
    columnFilters = {};
    currentSort = { colIndex: -1, direction: 'asc' };
    currentSearch = "";
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = "";

    switchView('app');
    // renderAudit() will be called by subscription or switchView

    // UI Feedback
    const statusIndicator = document.getElementById('statusIndicator'); // Not in DOM.js yet, assume global or add
    // Wait, statusIndicator is used in renderApp. It's usually in the footer or header?
    // In original code: const statusIndicator = document.getElementById('statusIndicator');
    // I should add it to DOM.js or get it here.
}

function renderSidebar() {
    const chapterList = document.getElementById('chapterList');
    if (!chapterList) return;
    chapterList.innerHTML = "";

    const chapColIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapColIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    if (chapColIdx === -1) return;

    const hierarchy = new Map();
    let totalCount = 0;

    currentForm.rows.forEach(row => {
        const chapName = row[chapColIdx] || "Sans chapitre";
        const subChapName = (subChapColIdx !== -1) ? (row[subChapColIdx] || null) : null;

        if (!hierarchy.has(chapName)) {
            hierarchy.set(chapName, { count: 0, subChapters: new Map() });
        }

        const chapObj = hierarchy.get(chapName);
        chapObj.count++;
        totalCount++;

        if (subChapName) {
            const currentSubCount = chapObj.subChapters.get(subChapName) || 0;
            chapObj.subChapters.set(subChapName, currentSubCount + 1);
        }
    });

    // All
    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${(!activeFilters.chapter) ? 'active' : ''}`;
    allItem.innerHTML = `<span>Vue Globale</span> <span class="count-badge">${totalCount}</span>`;
    allItem.onclick = () => {
        activeFilters = { chapter: null, subChapter: null };
        columnFilters = {};
        renderAudit();
    };
    chapterList.appendChild(allItem);

    // Hierarchy
    hierarchy.forEach((data, chapName) => {
        const isChapActive = activeFilters.chapter === chapName;
        const liChap = document.createElement('li');
        liChap.className = `chapter-item ${isChapActive && !activeFilters.subChapter ? 'active' : ''}`;
        liChap.innerHTML = `<span>${chapName}</span> <span class="count-badge">${data.count}</span>`;
        liChap.onclick = () => {
            activeFilters = { chapter: chapName, subChapter: null };
            renderAudit();
        };

        const subUl = document.createElement('ul');
        subUl.className = `sub-chapter-list ${isChapActive ? 'open' : ''}`;

        if (data.subChapters.size > 0) {
            data.subChapters.forEach((count, subName) => {
                const liSub = document.createElement('li');
                const isSubActive = isChapActive && activeFilters.subChapter === subName;
                liSub.className = `sub-chapter-item ${isSubActive ? 'active' : ''}`;
                liSub.innerText = `${subName} (${count})`;
                liSub.onclick = (e) => {
                    e.stopPropagation();
                    activeFilters = { chapter: chapName, subChapter: subName };
                    renderAudit();
                };
                subUl.appendChild(liSub);
            });
        }
        const container = document.createElement('div');
        container.appendChild(liChap);
        if (data.subChapters.size > 0) container.appendChild(subUl);
        chapterList.appendChild(container);
    });
}

function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    // PIPELINE (Filter & Sort) via DataUtils
    const rowsToProcess = DataUtils.processRows(
        currentForm.rows,
        currentForm.columns,
        activeFilters,
        columnFilters,
        currentSearch,
        currentSort
    );

    // BUILD HTML
    let html = '<table><thead><tr>';

    // Action Column Header
    html += '<th class="col-actions"></th>';

    // Columns Headers
    currentForm.columns.forEach((col, cIdx) => {
        if (col.visible === false) return;
        const colClass = getColClass(col);
        let sortClass = 'sortable-header';
        let sortIcon = '↕';

        if (currentSort.colIndex === cIdx) {
            sortClass += ' sorted';
            sortIcon = currentSort.direction === 'asc' ? '▲' : '▼';
        }

        html += `<th class="${colClass} ${sortClass}" data-colidx="${cIdx}">
            <div class="th-header-content">
                <span class="th-label">${Utils.escapeHtml(col.label)} ${sortIcon}</span>`;

        if (col.type === 'combo') {
            const opts = col.params?.options || [];
            html += `<select class="th-filter-select" data-colidx="${cIdx}" onclick="event.stopPropagation()">
                <option value="">Tout</option>
                ${opts.map(opt => `<option value="${Utils.escapeHtml(opt)}" ${columnFilters[cIdx] === opt ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`).join('')}
            </select>`;
        }

        html += `</div></th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows
    rowsToProcess.forEach((item) => {
        const r = item.originalIndex;
        const meta = currentForm.rowMeta[r] || {};

        html += `<tr>`;

        // Actions
        html += `<td class="col-actions">
            <div class="action-buttons-container">
                <button class="btn-row-action btn-add-row" data-r="${r}" title="Dupliquer">+</button>
                ${meta.isAdded ? `<button class="btn-row-action btn-delete-row" data-r="${r}" title="Supprimer">🗑️</button>` : ''}
            </div>
        </td>`;

        // Cells
        item.data.forEach((cell, cIdx) => {
            const col = currentForm.columns[cIdx];
            if (col.visible === false) return;
            html += `<td class="${getColClass(col)}">${renderCellHtml(col, cell, r, cIdx)}</td>`;
        });

        html += `</tr>`;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;

    // ATTACH EVENTS
    attachTableEvents(tableContainer);

    // Update Indicators
    updateStatusIndicatorElements(rowsToProcess.length);
}

function getColClass(col) {
    if (col.type === 'chapitre' || col.type === 'sous-chapitre') return 'col-chapitre';
    if (col.type === 'popup') return 'col-popup';
    if (col.type === 'combo') return 'col-combo';
    if (col.type === 'qcm') return 'col-qcm';
    if (col.type === 'reponse') return 'col-reponse';
    if (col.type === 'ia') return 'col-ia';
    const size = col.size ? col.size.toUpperCase() : 'L';
    return size === 'S' ? 'col-s' : (size === 'M' ? 'col-m' : 'col-l');
}

function renderCellHtml(col, value, r, c) {
    const valStr = (value === null || value === undefined) ? '' : value;

    switch (col.type) {
        case 'question':
            const meta = currentForm.rowMeta[r] || {};
            if (meta.isAdded) {
                return `<textarea class="editable-question" data-r="${r}" data-c="${c}">${Utils.escapeHtml(valStr)}</textarea>`;
            } else {
                return Utils.escapeHtml(valStr);
            }

        case 'chapitre':
        case 'sous-chapitre':
        case 'reference':
            return Utils.escapeHtml(valStr);

        case 'reponse':
            return `<textarea class="inp-reponse" data-r="${r}" data-c="${c}">${Utils.escapeHtml(valStr)}</textarea>`;

        case 'combo':
            const options = col.params?.options || [];
            const colorScheme = col.params?.colorScheme;
            let bg = '', color = '';

            if (colorScheme && value) {
                bg = Utils.getComboColor(colorScheme, value, options);
                color = Utils.getContrastColor(bg);
            }

            const style = bg ? `style="background-color:${bg}; color:${color};"` : '';

            return `<select class="inp-combo" data-r="${r}" data-c="${c}" ${style}>
                <option value="">--</option>
                ${options.map(opt => `<option value="${Utils.escapeHtml(opt)}" ${opt === value ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`).join('')}
            </select>`;

        case 'qcm':
            const items = Array.isArray(value) ? value : (col.params?.options || []).map(o => ({ label: o, checked: false }));
            return `<div class="qcm-container">
                ${items.map((item, i) => `
                    <label class="qcm-item">
                        <input type="checkbox" class="inp-qcm" data-r="${r}" data-c="${c}" data-i="${i}" ${item.checked ? 'checked' : ''}>
                        ${Utils.escapeHtml(item.label)}
                    </label>
                `).join('')}
            </div>`;

        case 'popup':
            // Note: Keeping window.marked dependency logic
            let rawContent = valStr;
            if (typeof rawContent === 'string') rawContent = rawContent.replace(/\\n/g, '\n');
            const renderedContent = window.marked ? window.marked.parse(rawContent, { breaks: true }) : Utils.escapeHtml(rawContent);
            return `<div class="popup-wrapper">
                ${UI.renderBadge('Preuves', Config.COLORS.INFO)}
                <div class="popup-content">${renderedContent}</div>
            </div>`;

        case 'ia':
            // Only simplified rendering for now, full functionality needs re-binding
            return `<div class="ia-cell">
                <button class="btn-ia" data-r="${r}" data-c="${c}" title="Générer IA">✨</button>
                <textarea class="ia-textarea" data-r="${r}" data-c="${c}" placeholder="IA...">${Utils.escapeHtml(valStr)}</textarea>
            </div>`;

        default:
            return Utils.escapeHtml(valStr);
    }
}

function attachTableEvents(container) {
    // Sort
    container.querySelectorAll('.th-label').forEach(el => {
        el.parentElement.onclick = () => handleSort(parseInt(el.parentElement.parentElement.dataset.colidx));
    });

    // Column Filters
    container.querySelectorAll('.th-filter-select').forEach(el => {
        el.onchange = (e) => handleColumnFilter(parseInt(el.dataset.colidx), e.target.value);
    });

    // Row Actions
    container.querySelectorAll('.btn-add-row').forEach(btn => {
        btn.onclick = () => duplicateRow(parseInt(btn.dataset.r));
    });
    container.querySelectorAll('.btn-delete-row').forEach(btn => {
        btn.onclick = () => deleteRow(parseInt(btn.dataset.r));
    });

    // Inputs: Reponse
    container.querySelectorAll('.inp-reponse, .editable-question').forEach(el => {
        el.oninput = (e) => updateValue(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c), e.target.value);
    });

    // Inputs: Combo
    container.querySelectorAll('.inp-combo').forEach(el => {
        el.onchange = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);
            const val = e.target.value;
            updateValue(r, c, val);

            // Visual update for combo color
            const col = currentForm.columns[c];
            if (col.params?.colorScheme) {
                const options = col.params.options || [];
                const bg = Utils.getComboColor(col.params.colorScheme, val, options);
                e.target.style.backgroundColor = bg;
                e.target.style.color = Utils.getContrastColor(bg);
            }
        };
    });

    // Inputs: QCM
    container.querySelectorAll('.inp-qcm').forEach(el => {
        el.onchange = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);
            // Re-read current value to update specific item
            let currentVal = currentForm.rows[r][c];
            if (!Array.isArray(currentVal)) {
                const col = currentForm.columns[c];
                currentVal = (col.params?.options || []).map(o => ({ label: o, checked: false }));
            }
            const itemIdx = parseInt(e.target.dataset.i);
            if (currentVal[itemIdx]) {
                currentVal[itemIdx].checked = e.target.checked;
                updateValue(r, c, currentVal);
            }
        };
    });

    // Inputs: IA
    container.querySelectorAll('.ia-textarea').forEach(el => {
        el.oninput = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);
            updateValue(r, c, e.target.value);
            // Update preview
            const preview = document.getElementById(`ia-${r}-${c}`);
            if (preview) preview.innerHTML = window.marked ? window.marked.parse(e.target.value) : e.target.value;
        };
    });

    container.querySelectorAll('.btn-ia').forEach(btn => {
        btn.onclick = () => {
            const r = parseInt(btn.dataset.r);
            const c = parseInt(btn.dataset.c);
            const col = currentForm.columns[c];
            const txt = btn.parentElement.querySelector('.ia-textarea');
            const preview = document.getElementById(`ia-${r}-${c}`);
            runIA(r, c, col, btn, txt, preview);
        };
    });
}

function updateStatusIndicatorElements(visibleCount) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;

    let status = [];
    if (activeFilters.chapter) status.push(`Chap: ${activeFilters.chapter}`);
    if (activeFilters.subChapter) status.push(`Sous-Chap: ${activeFilters.subChapter}`);
    if (Object.keys(columnFilters).length > 0) status.push(`Filtres actifs: ${Object.keys(columnFilters).length}`);
    if (status.length === 0) status.push("Vue Globale");
    if (currentSearch) status.push(`Rech: "${currentSearch}"`);
    statusIndicator.innerText = `${status.join(' | ')} (${visibleCount} lignes)`;
}

function updateStatusIndicator() {
    // Wrapper if needed
}

function handleSort(cIdx) {
    if (currentSort.colIndex === cIdx) {
        if (currentSort.direction === 'asc') currentSort.direction = 'desc';
        else if (currentSort.direction === 'desc') { currentSort.colIndex = -1; currentSort.direction = 'asc'; }
    } else {
        currentSort.colIndex = cIdx;
        currentSort.direction = 'asc';
    }
    renderTable();
}

function handleColumnFilter(cIdx, value) {
    if (value === "") delete columnFilters[cIdx];
    else columnFilters[cIdx] = value;
    renderTable();
}

function updateValue(r, c, val) {
    currentForm.rows[r][c] = val;
    store.save(); // Direct save
    // No need to full re-render for simple update? 
    // The original code does saveState() but not renderApp() inside updateValue.
}

async function runIA(r, c, col, btn, textareaInput, previewDiv) {
    const modelName = col.params?.modele;
    if (!modelName) return UI.showToast("Aucun modèle IA configuré pour cette colonne.", "warning");

    const modelConfig = auditAvailableModels.find(m => m.nom === modelName);
    if (!modelConfig) return UI.showToast(`Le modèle '${modelName}' est introuvable.`, "danger");

    const fmt = (v, t) => { if (t === 'qcm' && Array.isArray(v)) return v.map(i => `${i.label}:${i.checked ? '[x]' : '[ ]'}`).join("\n"); return v; };
    const contextData = {};

    if (col.params?.colonnes?.length) {
        col.params.colonnes.forEach(colLabel => {
            const idx = currentForm.columns.findIndex(cl => cl.label === colLabel);
            if (idx !== -1) {
                const val = currentForm.rows[r][idx];
                contextData[colLabel] = fmt(val, currentForm.columns[idx].type);
            }
        });
    }

    const messages = [
        { "role": "system", "content": modelConfig.prompt || "Tu es un assistant expert." },
        { "role": "user", "content": [col.params?.requete || "Analyse :", contextData] }
    ];

    const originalIcon = btn.innerHTML;
    btn.innerHTML = "⏳"; btn.disabled = true;
    try {
        const res = await ApiService.fetchLLM(modelConfig, messages);
        updateValue(r, c, res);
        if (textareaInput) textareaInput.value = res;
        if (previewDiv && window.marked) previewDiv.innerHTML = window.marked.parse(res);
    } catch (e) {
        UI.showToast("Erreur IA: " + e.message, "danger");
    } finally {
        btn.innerHTML = originalIcon; btn.disabled = false;
    }
}

async function loadModels() {
    const data = await Utils.safeFetch('models.json');
    if (data && Array.isArray(data)) {
        auditAvailableModels = data;
    } else {
        console.warn("Impossible de charger models.json ou format invalide");
    }
}

function duplicateRow(rIndex) {
    rIndex = parseInt(rIndex, 10);
    if (isNaN(rIndex) || rIndex < 0 || rIndex >= currentForm.rows.length) return;

    const sourceRow = currentForm.rows[rIndex];
    const newRow = [...sourceRow];

    currentForm.columns.forEach((col, cIdx) => {
        if (col.type === 'reponse' || col.type === 'ia') {
            newRow[cIdx] = "";
        } else if (col.type === 'combo') {
            newRow[cIdx] = "";
        } else if (col.type === 'qcm') {
            if (Array.isArray(newRow[cIdx])) {
                newRow[cIdx] = newRow[cIdx].map(item => ({ ...item, checked: false }));
            } else if (col.params?.options) {
                newRow[cIdx] = col.params.options.map(o => ({ label: o, checked: false }));
            } else {
                newRow[cIdx] = [];
            }
        }
    });

    currentForm.rows.splice(rIndex + 1, 0, newRow);
    const newMeta = { isAdded: true };
    currentForm.rowMeta.splice(rIndex + 1, 0, newMeta);
    store.save(); // Direct save
    renderTable();
}

function deleteRow(rIndex) {
    if (rIndex < 0 || rIndex >= currentForm.rows.length) return;
    const meta = currentForm.rowMeta[rIndex];
    if (!meta || !meta.isAdded) {
        UI.showToast("Impossible de supprimer une ligne d'origine.", "warning");
        return;
    }
    if (confirm("Supprimer cette ligne ?")) {
        currentForm.rows.splice(rIndex, 1);
        currentForm.rowMeta.splice(rIndex, 1);
        store.save();
        renderTable();
    }
}
