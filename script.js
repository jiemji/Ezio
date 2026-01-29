/**
 * Logique de gestion du formulaire dynamique
 * Structure attendue : Array<{libelle: string, type: 'question'|'reponse', valeur: string}>[]
 */

let currentData = [];

document.getElementById('jsonInput').addEventListener('change', handleFileUpload);
document.getElementById('exportBtn').addEventListener('click', exportData);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            currentData = JSON.parse(e.target.result);
            renderTable(currentData);
        } catch (err) {
            alert("Erreur lors de la lecture du JSON. Vérifiez le format.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function renderTable(data) {
    const container = document.getElementById('tableContainer');
    if (!data.length) return;

    let html = `<table><thead><tr>`;
    
    // Génération des entêtes basées sur le premier objet
    data[0].forEach(col => {
        html += `<th>${col.libelle}</th>`;
    });
    html += `</tr></thead><tbody>`;

    // Génération des lignes
    data.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((col, colIndex) => {
            const isQuestion = col.type === 'question';
            const cellClass = isQuestion ? 'cell-question' : 'cell-reponse';
            
            html += `<td class="${cellClass}">`;
            if (isQuestion) {
                html += col.valeur;
            } else {
                html += `<input type="text" 
                                value="${col.valeur}" 
                                onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">`;
            }
            html += `</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Mise à jour de la base de données en mémoire
window.updateValue = (rowIndex, colIndex, newValue) => {
    currentData[rowIndex][colIndex].valeur = newValue;
};

// Exportation du fichier modifié
function exportData() {
    if (currentData.length === 0) return;
    
    const dataStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = "formulaire_modifie.json";
    link.click();
    URL.revokeObjectURL(url);
}