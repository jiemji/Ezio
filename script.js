/**
 * AdminForm - Script Principal (Version Corrective Combo Couleur)
 */
const STORAGE_KEY = 'adminform_data_v1';
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// -- INITIALISATION --
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }
    loadState();
})();

// -- DOM --
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');

// -- LISTENERS --
jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentForm = JSON.parse(await file.text());
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
        renderTable();
        tableContainer.innerHTML = `<div class="empty-state"><p>Données effacées.</p></div>`;
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

// -- FONCTIONS GLOBALES (Accessibles depuis le HTML) --

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

/**
 * Gestion du changement de Combo (Couleur + Valeur)
 */
window.handleComboChange = (r, c, selectEl) => {
    const val = selectEl.value;
    
    // Debug : Voir si la fonction est appelée
    console.log(`Changement Combo [Ligne ${r}, Col ${c}] -> Valeur: "${val}"`);

    // 1. Sauvegarde
    window.updateValue(r, c, val);
    
    // 2. Mise à jour visuelle immédiate
    const colDef = currentForm.columns[c];
    if (colDef && colDef.params && colDef.params.colors) {
        // On cherche la couleur correspondante, sinon blanc
        const newColor = colDef.params.colors[val] || '#ffffff';
        selectEl.style.backgroundColor = newColor;
        console.log(`Nouvelle couleur appliquée : ${newColor}`);
    } else {
        // Si pas de config couleur, on remet blanc
        selectEl.style.backgroundColor = '#ffffff';
    }
};

// -- RENDU PRINCIPAL --
function renderTable() {
    if (!currentForm.columns || !currentForm.columns.length) return;

    let html = `<table><thead><tr>`;
    currentForm.columns.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const colDef = currentForm.columns[colIndex];
            
            // TYPE IA
            if (colDef.type === 'ia') {
                html += `<td class="cell-ia-container"><div class="ia-wrapper">
                    <button onclick="handleIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                    <textarea id="ia-${rowIndex}-${colIndex}" rows="1" readonly>${escapeHtml(value)}</textarea>
                </div></td>`;
            } 
            // TYPE QCM
            else if (colDef.type === 'qcm') {
                html += `<td class="cell-qcm"><div class="qcm-wrapper">`;
                if (Array.isArray(value)) {
                    value.forEach((item, itemIndex) => {
                        const checkedAttr = item.checked ? 'checked' : '';
                        html += `
                            <label class="qcm-item">
                                <input type="checkbox" ${checkedAttr} 
                                onchange="updateQcmValue(${rowIndex}, ${colIndex}, ${itemIndex}, this.checked)">
                                <span>${escapeHtml(item.label)}</span>
                            </label>
                        `;
                    });
                } else { html += `<span style="color:red">Erreur format QCM</span>`; }
                html += `</div></td>`;
            }
            // TYPE COMBO (CORRIGÉ AVEC COULEUR)
            else if (colDef.type === 'combo') {
                const options = colDef.params?.options || [];
                const colors = colDef.params?.colors || {};
                // Calcul de la couleur initiale
                const currentColor = colors[value] || '#ffffff';

                html += `<td class="cell-combo">
                    <select 
                        style="background-color: ${currentColor}" 
                        onchange="handleComboChange(${rowIndex}, ${colIndex}, this)"
                    >
                        <option value="" disabled ${!value ? 'selected' : ''}>Choisir...</option>`;
                
                options.forEach(opt => {
                    const isSelected = String(value) === String(opt) ? 'selected' : '';
                    html += `<option value="${escapeHtml(opt)}" ${isSelected}>${escapeHtml(opt)}</option>`;
                });
                
                html += `</select></td>`;
            }
            // TYPE QUESTION
            else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } 
            // TYPE REPONSE
            else {
                html += `<td class="cell-reponse">
                    <textarea rows="1" oninput="adjustTextareaHeight(this)" 
                        onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">${escapeHtml(value)}</textarea>
                </td>`;
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
        if (type === 'qcm' && Array.isArray(val)) {
            return val.map(item => `- ${item.label} : ${item.checked ? "[FAIT]" : "[A FAIRE]"}`).join("\n");
        }
        if (type === 'combo') {
            return val ? `Sélectionné: "${val}"` : "Non sélectionné";
        }
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
                if (targetCol.type === 'combo' && targetCol.params?.options) {
                    valStr += ` (Options possibles: ${targetCol.params.options.join(', ')})`;
                }
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
        
        const input = document.getElementById(`ia-${rowIndex}-${colIndex}`);
        if(input) {
            input.value = result;
            adjustTextareaHeight(input);
        }
    } catch (err) {
        alert("Erreur IA: " + err.message);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}