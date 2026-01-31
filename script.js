/**
 * AdminForm - Script Principal (Version Finale)
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
    } catch (err) { alert("JSON invalide."); }
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

// Gestion de la hauteur auto des textareas
function adjustTextareaHeight(el) {
    if (!el) return;
    el.style.height = 'auto'; // Reset pour calculer la réduction
    el.style.height = el.scrollHeight + 'px';
    
    // Si dépasse 96px (max-height CSS), on active le scroll
    if (el.scrollHeight > 96) {
        el.style.overflowY = 'auto';
    } else {
        el.style.overflowY = 'hidden';
    }
}

function escapeHtml(t) { 
    if(t == null) return "";
    if (typeof t === 'object') return ""; 
    const d = document.createElement('div'); 
    d.textContent = String(t); 
    return d.innerHTML; 
}

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
            
            // TYPE IA (Bouton GAUCHE)
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
            // TYPE QUESTION
            else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } 
            // DEFAULT
            else {
                html += `<td class="cell-reponse">
                    <input type="text" value="${escapeHtml(value)}" onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">
                </td>`;
            }
        });
        html += `</tr>`;
    });
    tableContainer.innerHTML = html + `</tbody></table>`;
    
    // Ajustement initial des hauteurs
    document.querySelectorAll('.ia-wrapper textarea').forEach(adjustTextareaHeight);
}

// -- UPDATES --

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

// -- IA LOGIC --

async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Erreur: config.json non chargé.");
    
    const colDef = currentForm.columns[colIndex];
    const params = colDef.params || {};
    
    // Formatage spécial QCM pour le contexte IA
    const formatValue = (val) => {
        if (Array.isArray(val)) {
            return val.map(item => `- ${item.label} : ${item.checked ? "[FAIT]" : "[A FAIRE]"}`).join("\n");
        }
        return val;
    };

    let contextData = "";
    
    // Logique de ciblage
    if (params.cibles && Array.isArray(params.cibles) && params.cibles.length > 0) {
        const parts = [];
        params.cibles.forEach(targetId => {
            const tIndex = currentForm.columns.findIndex(c => c.id === targetId);
            if (tIndex !== -1) {
                const label = currentForm.columns[tIndex].label;
                const rawVal = currentForm.rows[rowIndex][tIndex];
                parts.push(`${label}:\n${formatValue(rawVal)}`);
            }
        });
        contextData = parts.join("\n\n");
    } else {
        // Fallback global
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