/**
 * AdminForm Expert - Logique Client-Side
 */

// État global de l'application
let currentForm = {
    columns: [],
    rows: []
};

// Sélecteurs DOM
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const tableContainer = document.getElementById('tableContainer');

// Listeners
jsonInput.addEventListener('change', handleFileUpload);
exportBtn.addEventListener('click', exportData);

/**
 * Gère le chargement et la lecture du fichier JSON
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            
            // Validation basique de la structure optimisée
            if (!json.columns || !json.rows) {
                throw new Error("Format invalide : 'columns' ou 'rows' manquant.");
            }

            currentForm = json;
            renderTable();
        } catch (err) {
            alert("Erreur de format : " + err.message);
            console.error(err);
        }
    };
    reader.readAsText(file);
}

/**
 * Génère le rendu HTML de la table à partir de l'état
 */
function renderTable() {
    if (!currentForm.columns.length) return;

    let html = `<table>
        <thead>
            <tr>
                ${currentForm.columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const config = currentForm.columns[colIndex];
            const isQuestion = config.type === 'question';
            
            html += `<td class="${isQuestion ? 'cell-question' : 'cell-reponse'}">`;
            
            if (isQuestion) {
                html += value;
            } else {
                html += `<input type="text" 
                                value="${escapeHtml(value)}" 
                                data-row="${rowIndex}" 
                                data-col="${colIndex}"
                                oninput="updateValue(${rowIndex}, ${colIndex}, this.value)">`;
            }
            
            html += `</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}

/**
 * Met à jour l'état local lors de la saisie
 */
window.updateValue = (rowIndex, colIndex, newValue) => {
    currentForm.rows[rowIndex][colIndex] = newValue;
};

/**
 * Exporte l'état actuel en fichier JSON
 */
function exportData() {
    if (!currentForm.rows.length) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `form_export_${new Date().getTime()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Utilitaire pour sécuriser l'affichage
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}