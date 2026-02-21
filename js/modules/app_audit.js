import { DOM } from '../ui/DOM.js';
import { Utils } from '../core/Utils.js';
import { store, currentForm } from '../core/State.js'; // Imports live binding currentForm
import { switchView, registerModuleInit } from '../ui/Navigation.js';
import { Modal } from '../ui/Modal.js';

import { ApiService } from '../api/api_ia.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { DataUtils } from '../core/DataUtils.js';
import { AuditRenderer } from './AuditRenderer.js';

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
        UI.showToast("Format de fichier invalide (Colonnes ou lignes manquantes).", "danger");
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
        const subChapName = subChapColIdx !== -1 ? (row[subChapColIdx] ?? null) : null;

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

    const context = {
        currentForm,
        filters: { activeFilters, columnFilters, currentSearch, currentSort },
        actions: {
            handleSort,
            handleColumnFilter,
            duplicateRow,
            deleteRow,
            updateValue,
            runIA
        }
    };

    const stats = AuditRenderer.render(tableContainer, context);
    updateStatusIndicatorElements(stats?.visibleCount || 0);
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
    const parsedIndex = parseInt(rIndex, 10);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= currentForm.rows.length) return;
    rIndex = parsedIndex;

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
