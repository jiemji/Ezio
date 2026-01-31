/**
 * Logique Applicative - Avec Sauvegarde Locale (localStorage)
 */
const STORAGE_KEY = 'adminform_data_v1'; // Clé unique pour le stockage
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// -- INITIALISATION --

(async function init() {
    // 1. Charger Config API
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }

    // 2. Tenter de restaurer les données locales
    loadState();
})();

// -- SÉLECTEURS DOM --
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn'); // Nouveau
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator'); // Nouveau

// -- LISTENERS --

// Chargement fichier
jsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentForm = JSON.parse(await file.text());
        renderTable();
        saveState(); // Sauvegarde immédiate après chargement
        showStatus("Fichier chargé avec succès");
    } catch (err) { alert("JSON invalide."); }
    // Reset de l'input pour permettre de recharger le même fichier si besoin
    e.target.value = '';
});

// Export
exportBtn.addEventListener('click', () => {
    if (!currentForm.rows.length) return;
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${Date.now()}.json`;
    a.click();
});

// Reset (Nouveau)
resetBtn.addEventListener('click', () => {
    if (confirm("Voulez-vous vraiment tout effacer ? Cette action est irréversible.")) {
        localStorage.removeItem(STORAGE_KEY);
        currentForm = { columns: [], rows: [] };
        renderTable(); // Affiche vide ou empty state
        // On force le rechargement de l'empty state
        tableContainer.innerHTML = `<div class="empty-state"><p>Données effacées. Prêt pour un nouveau fichier.</p></div>`;
        showStatus("Session nettoyée");
    }
});

// -- GESTION DE L'ÉTAT (LOCAL STORAGE) --

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
                console.log("Données restaurées du localStorage");
            }
        } catch (e) {
            console.error("Erreur lecture sauvegarde", e);
            localStorage.removeItem(STORAGE_KEY); // Nettoyage si corrompu
        }
    }
}

function showStatus(msg) {
    if(statusIndicator) {
        statusIndicator.textContent = msg;
        statusIndicator.style.opacity = '1';
        setTimeout(() => { statusIndicator.style.opacity = '0.7'; }, 2000);
    }
}

// -- FONCTIONS D'AFFICHAGE --

function renderTable() {
    if (!currentForm.columns || !currentForm.columns.length) return;

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

// -- LOGIQUE IA --

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
        contextData = currentForm.rows[rowIndex].join(" | ");
    }

    const prompt = `${params.requete || "Analyse :"}\n\nDonnées contextuelles:\n${contextData}`;

    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const result = await window.ApiService.fetchLLM(IA_CONFIG, prompt);
        updateValue(rowIndex, colIndex, result); // Sauvegarde automatique incluse dans updateValue
        const input = document.getElementById(`ia-${rowIndex}-${colIndex}`);
        if(input) input.value = result;
    } catch (err) {
        alert("Erreur IA: " + err.message);
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}

// Mise à jour de la valeur ET sauvegarde
window.updateValue = (r, c, v) => { 
    currentForm.rows[r][c] = v; 
    saveState(); // Sauvegarde à chaque frappe/modif
};

function escapeHtml(t) { 
    if(t == null) return "";
    const d = document.createElement('div'); 
    d.textContent = String(t); 
    return d.innerHTML; 
}