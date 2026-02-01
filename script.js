/**
 * AdminForm - Script Principal (Version Dark Mode + Fix Contraste Combo)
 */
const STORAGE_KEY = 'adminform_data_v1';
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// Gestion des filtres
let activeChapterFilter = null; 
let activeSubChapterFilter = null;

// -- DOM --
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const themeBtn = document.getElementById('themeBtn');
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');

// -- INITIALISATION --
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }
    
    // Application du thème sauvegardé
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = '☀️';
    } else {
        themeBtn.textContent = '🌙';
    }

    loadState();
})();

// -- LISTENERS --

// Changement de Thème
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
});

jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentForm = JSON.parse(await file.text());
        activeChapterFilter = null;
        activeSubChapterFilter = null;
        renderTable();
        saveState();
        showStatus("Fichier chargé");
    } catch (err) { alert("JSON invalide: " + err.message); }
    e.target.value = '';
});

exportBtn.addEventListener('click', () => {
    if (!currentForm.rows.length) return;
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${Date.now()}.json`;
    a.click();
});

resetBtn.addEventListener('click', () => {
    if (confirm("Tout effacer ?")) {
        localStorage.removeItem(STORAGE_KEY);
        currentForm = { columns: [], rows: [] };
        
        activeChapterFilter = null;
        activeSubChapterFilter = null;

        tableContainer.innerHTML = `<div class="empty-state"><p>Données effacées.</p></div>`;
        
        // Nettoyage UI Sidebar
        sidebar.classList.add('hidden');
        chapterList.innerHTML = '';
        
        showStatus("Session nettoyée");
    }
});

// -- STATE & UI HELPERS --
function saveState() {
    if (currentForm.columns.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentForm));
        showStatus("Sauvegardé");
    }
}
function loadState() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            currentForm = JSON.parse(savedData);
            if (currentForm.columns && currentForm.rows) {
                renderTable();
                showStatus("Session restaurée");
            }
        } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    }
}
function showStatus(msg) {
    if(statusIndicator) {
        statusIndicator.textContent = msg;
        statusIndicator.style.opacity = '1';
        setTimeout(() => { statusIndicator.style.opacity = '0.7'; }, 2000);
    }
}
function adjustTextareaHeight(el) {
    if (!el) return;
    el.style.height = 'auto'; 
    el.style.height = el.scrollHeight + 'px';
    const maxHeight = parseInt(window.getComputedStyle(el).maxHeight);
    if (el.scrollHeight > maxHeight) { el.style.overflowY = 'auto'; } 
    else { el.style.overflowY = 'hidden'; }
}
function escapeHtml(t) { 
    if(t == null) return "";
    if (typeof t === 'object') return ""; 
    const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML; 
}

// -- FONCTIONS GLOBALES --
window.updateValue = (r, c, v) => { 
    currentForm.rows[r][c] = v; 
    saveState(); 
};
window.updateQcmValue = (r, c, itemIndex, isChecked) => {
    if (currentForm.rows[r][c] && currentForm.rows[r][c][itemIndex]) {
        currentForm.rows[r][c][itemIndex].checked = isChecked;
        saveState();
    }
};

// GESTION INTELLIGENTE DES COULEURS COMBO
window.handleComboChange = (r, c, selectEl) => {
    const val = selectEl.value;
    window.updateValue(r, c, val);
    const colDef = currentForm.columns[c];
    
    if (colDef && colDef.params && colDef.params.colors) {
        const newColor = colDef.params.colors[val];
        
        if (newColor) {
            // Si couleur définie (ex: pastel), on force le texte en foncé
            selectEl.style.backgroundColor = newColor;
            selectEl.style.color = '#1e293b'; 
        } else {
            // Sinon on reset pour utiliser le style CSS (Blanc en dark mode)
            selectEl.style.backgroundColor = ''; 
            selectEl.style.color = ''; 
        }
    } else {
        selectEl.style.backgroundColor = '';
        selectEl.style.color = '';
    }
};

// -- GESTION HIERARCHIE --
function setupSidebar(chapColIndex, subChapColIndex) {
    const hierarchy = new Map();
    
    currentForm.rows.forEach(row => {
        const chapName = String(row[chapColIndex] || "Sans chapitre");
        if (!hierarchy.has(chapName)) {
            hierarchy.set(chapName, { count: 0, subChapters: new Map() });
        }
        const chapData = hierarchy.get(chapName);
        chapData.count++;

        if (subChapColIndex !== -1) {
            const subName = String(row[subChapColIndex] || "");
            if (subName) {
                if (!chapData.subChapters.has(subName)) {
                    chapData.subChapters.set(subName, 0);
                }
                chapData.subChapters.set(subName, chapData.subChapters.get(subName) + 1);
            }
        }
    });

    let html = `
        <li class="chapter-item ${activeChapterFilter === null ? 'active' : ''}" 
            onclick="setFilter(null, null)">
            Tout afficher <span class="chapter-count">${currentForm.rows.length}</span>
        </li>
    `;

    hierarchy.forEach((data, chapName) => {
        const isChapActive = activeChapterFilter === chapName && activeSubChapterFilter === null;
        const safeChap = chapName.replace(/'/g, "\\'"); 
        
        html += `
            <li class="chapter-item ${isChapActive ? 'active' : ''}" 
                onclick="setFilter('${safeChap}', null)">
                ${escapeHtml(chapName)} 
                <span class="chapter-count">${data.count}</span>
            </li>
        `;

        if (data.subChapters.size > 0) {
            html += `<ul class="sub-chapter-list">`;
            data.subChapters.forEach((subCount, subName) => {
                const isSubActive = activeChapterFilter === chapName && activeSubChapterFilter === subName;
                const safeSub = subName.replace(/'/g, "\\'");
                html += `
                    <li class="sub-chapter-item ${isSubActive ? 'active' : ''}"
                        onclick="setFilter('${safeChap}', '${safeSub}'); event.stopPropagation();">
                        ${escapeHtml(subName)}
                        <span class="chapter-count" style="font-size:0.75em; padding:1px 5px;">${subCount}</span>
                    </li>
                `;
            });
            html += `</ul>`;
        }
    });

    chapterList.innerHTML = html;
    sidebar.classList.remove('hidden');
}

window.setFilter = (chapName, subChapName) => {
    activeChapterFilter = chapName;
    activeSubChapterFilter = subChapName;
    renderTable();
}

// -- RENDU PRINCIPAL --
function renderTable() {
    if (!currentForm.columns || !currentForm.columns.length) return;

    const chapColIndex = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapColIndex = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');
    
    if (chapColIndex !== -1) {
        setupSidebar(chapColIndex, subChapColIndex);
    } else {
        sidebar.classList.add('hidden');
        activeChapterFilter = null;
        activeSubChapterFilter = null;
    }

    let html = `<table><thead><tr>`;
    currentForm.columns.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        if (activeChapterFilter !== null && chapColIndex !== -1) {
            const rowChap = String(row[chapColIndex] || "Sans chapitre");
            if (rowChap !== activeChapterFilter) return;
            if (activeSubChapterFilter !== null && subChapColIndex !== -1) {
                const rowSub = String(row[subChapColIndex] || "");
                if (rowSub !== activeSubChapterFilter) return;
            }
        }

        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const colDef = currentForm.columns[colIndex];
            
            if (colDef.type === 'ia') {
                let renderedContent = "";
                try { renderedContent = value ? marked.parse(String(value)) : ""; } 
                catch(e) { renderedContent = escapeHtml(value); }

                html += `<td class="cell-ia-container"><div class="ia-wrapper">
                    <button onclick="handleIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                    <div id="ia-${rowIndex}-${colIndex}" class="markdown-view">${renderedContent}</div>
                </div></td>`;
            } 
            else if (colDef.type === 'qcm') {
                html += `<td class="cell-qcm"><div class="qcm-wrapper">`;
                if (Array.isArray(value)) {
                    value.forEach((item, itemIndex) => {
                        const checkedAttr = item.checked ? 'checked' : '';
                        html += `<label class="qcm-item"><input type="checkbox" ${checkedAttr} onchange="updateQcmValue(${rowIndex}, ${colIndex}, ${itemIndex}, this.checked)"><span>${escapeHtml(item.label)}</span></label>`;
                    });
                } else { html += `<span style="color:red">Erreur format</span>`; }
                html += `</div></td>`;
            }
            // MODIFICATION COMBO : Gestion de l'affichage initial
            else if (colDef.type === 'combo') {
                const options = colDef.params?.options || [];
                const colors = colDef.params?.colors || {};
                const currentColor = colors[value] || ''; 
                
                // Si une couleur est définie, on l'applique ET on force le texte en foncé
                let styleAttr = '';
                if (currentColor) {
                    styleAttr = `style="background-color: ${currentColor}; color: #1e293b;"`;
                }

                html += `<td class="cell-combo"><select ${styleAttr} onchange="handleComboChange(${rowIndex}, ${colIndex}, this)"><option value="" disabled ${!value ? 'selected' : ''}>Choisir...</option>`;
                options.forEach(opt => {
                    const isSelected = String(value) === String(opt) ? 'selected' : '';
                    html += `<option value="${escapeHtml(opt)}" ${isSelected}>${escapeHtml(opt)}</option>`;
                });
                html += `</select></td>`;
            }
            else if (colDef.type === 'chapitre' || colDef.type === 'sous-chapitre') {
                 html += `<td class="cell-question"><strong>${escapeHtml(value)}</strong></td>`;
            }
            else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } 
            else {
                html += `<td class="cell-reponse"><textarea rows="1" oninput="adjustTextareaHeight(this)" onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">${escapeHtml(value)}</textarea></td>`;
            }
        });
        html += `</tr>`;
    });
    tableContainer.innerHTML = html + `</tbody></table>`;
    document.querySelectorAll('textarea').forEach(adjustTextareaHeight);
}

// -- IA LOGIC --
async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Erreur: config.json non chargé.");
    
    const colDef = currentForm.columns[colIndex];
    const params = colDef.params || {};
    
    const formatValue = (val, type, params) => {
        if (type === 'qcm' && Array.isArray(val)) return val.map(item => `- ${item.label} : ${item.checked ? "[FAIT]" : "[A FAIRE]"}`).join("\n");
        if (type === 'combo') return val ? `Sélectionné: "${val}"` : "Non sélectionné";
        return val;
    };

    let contextData = "";
    if (params.cibles && Array.isArray(params.cibles) && params.cibles.length > 0) {
        const parts = [];
        params.cibles.forEach(targetId => {
            const tIndex = currentForm.columns.findIndex(c => c.id === targetId);
            if (tIndex !== -1) {
                const targetCol = currentForm.columns[tIndex];
                const rawVal = currentForm.rows[rowIndex][tIndex];
                let valStr = formatValue(rawVal, targetCol.type, targetCol.params);
                if (targetCol.type === 'combo' && targetCol.params?.options) valStr += ` (Options possibles: ${targetCol.params.options.join(', ')})`;
                parts.push(`${targetCol.label}:\n${valStr}`);
            }
        });
        contextData = parts.join("\n\n");
    } else {
        contextData = currentForm.rows[rowIndex].map(v => formatValue(v)).join("\n | \n");
    }

    const prompt = `${params.requete || "Analyse :"}\n\nDonnées contextuelles:\n${contextData}`;

    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const result = await window.ApiService.fetchLLM(IA_CONFIG, prompt);
        updateValue(rowIndex, colIndex, result);
        const container = document.getElementById(`ia-${rowIndex}-${colIndex}`);
        if(container) container.innerHTML = marked.parse(result);
    } catch (err) {
        alert("Erreur IA: " + err.message);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}