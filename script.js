/**
 * AdminForm Expert - Logique avec Intégration IA
 */

// CONFIGURATION API (Test)
const IA_CONFIG = {
    apiKey: "VOTRE_CLE_API_ICI", 
    model: "gpt-3.5-turbo",
    endpoint: "https://api.openai.com/v1/chat/completions"
};

let currentForm = { columns: [], rows: [] };

const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');
const tableContainer = document.getElementById('tableContainer');

jsonInput.addEventListener('change', handleFileUpload);
exportBtn.addEventListener('click', exportData);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            currentForm = JSON.parse(e.target.result);
            renderTable();
        } catch (err) {
            alert("Erreur de parsing JSON.");
        }
    };
    reader.readAsText(file);
}

function renderTable() {
    if (!currentForm.columns || !currentForm.rows) return;

    let html = `<table>
        <thead>
            <tr>${currentForm.columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
        </thead>
        <tbody>`;

    currentForm.rows.forEach((row, rowIndex) => {
        html += `<tr>`;
        row.forEach((value, colIndex) => {
            const config = currentForm.columns[colIndex];
            
            if (config.type === 'question') {
                html += `<td class="cell-question">${value}</td>`;
            } 
            else if (config.type === 'reponse') {
                html += `<td class="cell-reponse">
                            <input type="text" value="${escapeHtml(value)}" 
                            onchange="updateValue(${rowIndex}, ${colIndex}, this.value)">
                         </td>`;
            }
            else if (config.type === 'ia') {
                html += `<td class="cell-ia">
                            <div class="ia-wrapper">
                                <input type="text" id="ia-${rowIndex}-${colIndex}" value="${escapeHtml(value)}" readonly>
                                <button onclick="askIA(${rowIndex}, ${colIndex}, this)" class="btn-ia">🪄 IA</button>
                            </div>
                         </td>`;
            }
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}

/**
 * Appel API LLM
 */
async function askIA(rowIndex, colIndex, btnElement) {
    const config = currentForm.columns[colIndex];
    const promptBase = config.params?.requete || "Analyse ces données :";
    
    // Contexte : On envoie toutes les données de la ligne pour que l'IA comprenne le sujet
    const context = currentForm.rows[rowIndex].join(" | ");
    const fullPrompt = `Consigne: ${promptBase}\nDonnées: ${context}`;

    // UI Feedback
    btnElement.innerText = "⏳";
    btnElement.disabled = true;

    try {
        const response = await fetch(IA_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${IA_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: IA_CONFIG.model,
                messages: [{ role: "user", content: fullPrompt }],
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error("Réponse API non valide");

        const data = await response.json();
        const aiResult = data.choices[0].message.content.trim();

        // Update État et DOM
        updateValue(rowIndex, colIndex, aiResult);
        document.getElementById(`ia-${rowIndex}-${colIndex}`).value = aiResult;

    } catch (error) {
        console.error("Erreur IA:", error);
        alert("Erreur lors de l'appel à l'IA. Vérifiez la clé API et la connexion.");
    } finally {
        btnElement.innerText = "🪄 IA";
        btnElement.disabled = false;
    }
}

window.updateValue = (rowIndex, colIndex, newValue) => {
    currentForm.rows[rowIndex][colIndex] = newValue;
};

function exportData() {
    if (!currentForm.rows.length) return;
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_export_ia.json`;
    a.click();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}