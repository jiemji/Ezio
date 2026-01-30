/**
 * Logique Applicative principale
 */
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// Initialisation : Chargement de la config externe
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config non chargée", e); }
})();

// DOM Elements
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const tableContainer = document.getElementById('tableContainer');

jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        currentForm = JSON.parse(text);
        renderTable();
    } catch (err) { alert("Erreur de lecture du fichier."); }
});

function renderTable() {
    if (!currentForm.columns || !currentForm.rows) return;

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
            } else {
                const isQ = colDef.type === 'question';
                html += `<td class="${isQ ? 'cell-question' : 'cell-reponse'}">
                    ${isQ ? value : `<input type="text" value="${escapeHtml(value)}" onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">`}
                </td>`;
            }
        });
        html += `</tr>`;
    });

    tableContainer.innerHTML = html + `</tbody></table>`;
}

async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Configuration config.json introuvable.");

    const colDef = currentForm.columns[colIndex];
    const context = currentForm.rows[rowIndex].join(" | ");
    const prompt = `${colDef.params?.requete || "Analyse :"}\nDonnées : ${context}`;

    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const result = await window.ApiService.fetchLLM(IA_CONFIG, prompt);
        updateValue(rowIndex, colIndex, result);
        document.getElementById(`ia-${rowIndex}-${colIndex}`).value = result;
    } catch (err) {
        alert(err.message);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}

window.updateValue = (r, c, v) => { currentForm.rows[r][c] = v; };

function exportData() {
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "export_data.json";
    a.click();
}

exportBtn.addEventListener('click', exportData);

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}