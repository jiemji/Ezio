/**
 * Logique Applicative - Support QCM
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

// -- SÉLECTEURS --
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

// -- STATE MANAGEMENT --

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
    if (el.scrollHeight > 96) {
        el.style.overflowY = 'auto';
    } else {
        el.style.overflowY = 'hidden';
    }
}

// -- RENDU TABLEAU --

function renderTable() {
    if (!currentForm.columns || !currentForm.columns.length) return;

    let html = `<table><thead><tr>`;
    currentForm.columns.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const colDef = currentForm.columns[colIndex];
            
            // --- TYPE IA ---
            if (colDef.type === 'ia') {
                html += `<td><div class="ia-wrapper">
                    <textarea id="ia-${rowIndex}-${colIndex}" rows="1" readonly>${escapeHtml(value)}</textarea>
                    <button onclick="handleIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                </div></td>`;
            } 
            // --- TYPE QCM (NOUVEAU) ---
            else if (colDef.type === 'qcm') {
                html += `<td><div class="qcm-wrapper">`;
                
                // Vérification que 'value' est bien un tableau
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
                } else {
                    html += `<span style="color:red">Erreur format QCM</span>`;
                }
                
                html += `</div></td>`;
            }
            // --- TYPE QUESTION ---
            else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } 
            // --- TYPE REPONSE (DEFAULT) ---
            else {
                html += `<td class="cell-reponse">
                    <input type="text" value="${escapeHtml(value)}" onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">
                </td>`;
            }
        });
        html += `</tr>`;
    });
    tableContainer.innerHTML = html + `</tbody></table>`;

    document.querySelectorAll('.ia-wrapper textarea').forEach(adjustTextareaHeight);
}

// -- LOGIQUE DE MISE A JOUR --

// Mise à jour standard (Texte)
window.updateValue = (r, c, v) => { 
    currentForm.rows[r][c] = v; 
    saveState(); 
};

// Mise à jour spécifique QCM (Nouveau)
window.updateQcmValue = (r, c, itemIndex, isChecked) => {
    // On met à jour uniquement la propriété 'checked' de l'objet spécifique dans le tableau
    if (currentForm.rows[r][c] && currentForm.rows[r][c][itemIndex]) {
        currentForm.rows[r][c][itemIndex].checked = isChecked;
        saveState();
        
        // Optionnel : console log pour vérifier
        console.log(`Ligne ${r}, Col ${c}, Item ${itemIndex} -> ${isChecked}`);
    }
};

// -- LOGIQUE IA --

async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Erreur: config.json non chargé.");
    
    const colDef = currentForm.columns[colIndex];
    const params = colDef.params || {};
    let contextData = "";

    // Fonction helper pour formater la valeur selon son type
    const formatValue = (val) => {
        if (Array.isArray(val)) {
            // Si c'est un QCM, on le formate proprement pour l'IA
            return val.map(item => `- ${item.label} : ${item.checked ? "[FAIT]" : "[A FAIRE]"}`).join("\n");
        }
        return val;
    };

    if (params.cibles && Array.isArray(params.cibles) && params.cibles.length > 0) {
        const parts = [];
        params.cibles.forEach(targetId => {
            const tIndex = currentForm.columns.findIndex(c => c.id === targetId);
            if (tIndex !== -1) {
                const rawVal = currentForm.rows[rowIndex][tIndex];
                parts.push(`${currentForm.columns[tIndex].label}:\n${formatValue(rawVal)}`);
            }
        });
        contextData = parts.join("\n\n");
    } else {
        // Fallback global : on map toute la ligne en gérant les objets
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

function escapeHtml(t) { 
    if(t == null) return "";
    // Si t est un objet/tableau (cas QCM mal géré), on évite le crash
    if (typeof t === 'object') return ""; 
    
    const d = document.createElement('div'); 
    d.textContent = String(t); 
    return d.innerHTML; 
}