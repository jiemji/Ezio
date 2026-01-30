/**
 * AdminForm Expert - Logique Client-Side
 * Gestionnaire d'interface et d'événements
 */

let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// -- INITIALISATION --

// Chargement de la configuration au démarrage
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            IA_CONFIG = await response.json();
            console.log("Config chargée :", IA_CONFIG.provider);
        }
    } catch (e) { 
        console.warn("Config non chargée (nécessaire pour l'IA)", e); 
    }
})();

// -- SÉLECTEURS DOM --
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const tableContainer = document.getElementById('tableContainer');

// -- LISTENERS --
jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        currentForm = JSON.parse(text);
        renderTable();
    } catch (err) { 
        alert("Erreur de lecture du fichier JSON. Vérifiez le format.");
        console.error(err);
    }
});

exportBtn.addEventListener('click', exportData);

// -- FONCTIONS D'AFFICHAGE --

function renderTable() {
    if (!currentForm.columns || !currentForm.rows) return;

    let html = `<table><thead><tr>`;
    currentForm.columns.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const colDef = currentForm.columns[colIndex];
            
            // Cellule IA
            if (colDef.type === 'ia') {
                html += `<td>
                    <div class="ia-wrapper">
                        <input type="text" id="ia-${rowIndex}-${colIndex}" value="${escapeHtml(value)}" readonly>
                        <button onclick="handleIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                    </div>
                </td>`;
            } 
            // Cellule Question (Lecture seule)
            else if (colDef.type === 'question') {
                html += `<td class="cell-question">${escapeHtml(value)}</td>`;
            } 
            // Cellule Réponse (Éditable)
            else {
                html += `<td class="cell-reponse">
                    <input type="text" 
                           value="${escapeHtml(value)}" 
                           onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">
                </td>`;
            }
        });
        html += `</tr>`;
    });

    tableContainer.innerHTML = html + `</tbody></table>`;
}

// -- LOGIQUE MÉTIER IA --

/**
 * Construit le contexte et appelle le service IA
 */
async function handleIA(rowIndex, colIndex, btn) {
    if (!IA_CONFIG) return alert("Fichier config.json introuvable ou invalide.");

    const colDef = currentForm.columns[colIndex];
    const params = colDef.params || {};
    
    // 1. Construction du contexte (Données)
    let contextData = "";
    
    // Si des cibles sont précisées dans le JSON (via les IDs des colonnes)
    if (params.cibles && Array.isArray(params.cibles) && params.cibles.length > 0) {
        const extractedData = [];
        
        params.cibles.forEach(targetId => {
            // On trouve l'index de la colonne qui correspond à l'ID demandé
            const targetColIndex = currentForm.columns.findIndex(c => c.id === targetId);
            
            if (targetColIndex !== -1) {
                const label = currentForm.columns[targetColIndex].label;
                const value = currentForm.rows[rowIndex][targetColIndex];
                extractedData.push(`${label}: ${value}`);
            }
        });
        
        if (extractedData.length === 0) {
            console.warn("Aucune colonne cible trouvée pour les IDs :", params.cibles);
            contextData = "Aucune donnée trouvée.";
        } else {
            contextData = extractedData.join("\n");
        }
    } else {
        // Comportement par défaut : On envoie toute la ligne brute
        contextData = currentForm.rows[rowIndex].join(" | ");
    }

    // 2. Construction du Prompt Final
    const prompt = `${params.requete || "Analyse les données suivantes :"}\n\n---\n${contextData}\n---`;

    // 3. Appel API et UI Feedback
    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const result = await window.ApiService.fetchLLM(IA_CONFIG, prompt);
        updateValue(rowIndex, colIndex, result);
        
        // Mise à jour visuelle du champ
        const inputField = document.getElementById(`ia-${rowIndex}-${colIndex}`);
        if (inputField) inputField.value = result;
        
    } catch (err) {
        alert("Erreur IA : " + err.message);
        console.error(err);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}

// -- UTILITAIRES --

window.updateValue = (r, c, v) => { 
    currentForm.rows[r][c] = v; 
};

function exportData() {
    if (!currentForm.rows.length) return;
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "export_donnees.json";
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}