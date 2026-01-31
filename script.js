/**
 * Logique Applicative & Gestion UI
 */
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// Chargement Config
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }
})();

// DOM
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const tableContainer = document.getElementById('tableContainer');

jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentForm = JSON.parse(await file.text());
        renderTable();
    } catch (err) { alert("JSON invalide."); }
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

function renderTable() {
    if (!currentForm.columns) return;
    let html = `<table><thead><tr>`;
    currentForm.columns.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const colDef = currentForm.columns[colIndex];
            
            if (colDef.type === 'ia') {
                html += `<td><div class="ia-wrapper">
                    <input type="text" id="ia-${rowIndex}-${colIndex}" value="${escapeHtml(value)}" readonly>
                    <button onclick="handleIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                </div></td>`;
            } else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } else {
                html += `<td class="cell-reponse">
                    <input type="text" value="${escapeHtml(value)}" onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">
                </td>`;
            }
        });
        html += `</tr>`;
    });
    tableContainer.innerHTML = html + `</tbody></table>`;
}

async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Erreur: config.json non chargé.");
    
    const colDef = currentForm.columns[colIndex];
    const params = colDef.params || {};
    let contextData = "";

    // Logique de ciblage
    if (params.cibles && Array.isArray(params.cibles) && params.cibles.length > 0) {
        const parts = [];
        params.cibles.forEach(targetId => {
            const tIndex = currentForm.columns.findIndex(c => c.id === targetId);
            if (tIndex !== -1) {
                parts.push(`${currentForm.columns[tIndex].label}: ${currentForm.rows[rowIndex][tIndex]}`);
            }
        });
        contextData = parts.join("\n");
    } else {
        // Fallback : toute la ligne
        contextData = currentForm.rows[rowIndex].join(" | ");
    }

    const prompt = `${params.requete || "Analyse :"}\n\nDonnées contextuelles:\n${contextData}`;

    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const result = await window.ApiService.fetchLLM(IA_CONFIG, prompt);
        updateValue(rowIndex, colIndex, result);
        const input = document.getElementById(`ia-${rowIndex}-${colIndex}`);
        if(input) input.value = result;
    } catch (err) {
        alert("Erreur IA: " + err.message);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}

window.updateValue = (r, c, v) => { currentForm.rows[r][c] = v; };
function escapeHtml(t) { 
    if(t == null) return "";
    const d = document.createElement('div'); 
    d.textContent = String(t); 
    return d.innerHTML; 
}