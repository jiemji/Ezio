/**
 * AdminForm Expert - Logique Client-Side avec Intégration IA
 */

let currentForm = { columns: [], rows: [] };

// CONFIGURATION IA (En dur pour le test)
const IA_CONFIG = {
    apiKey: "VOTRE_CLE_API_ICI",
    model: "gpt-3.5-turbo", // ou "mixtral-8x7b-32768" pour Groq, etc.
    endpoint: "https://api.openai.com/v1/chat/completions"
};

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
            alert("Erreur de format JSON.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function renderTable() {
    if (!currentForm.columns.length) return;

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
                            oninput="updateValue(${rowIndex}, ${colIndex}, this.value)">
                         </td>`;
            }
            else if (config.type === 'ia') {
                html += `<td class="cell-ia">
                            <div class="ia-wrapper">
                                <input type="text" id="cell-${rowIndex}-${colIndex}" value="${escapeHtml(value)}" readonly>
                                <button onclick="askIA(${rowIndex}, ${colIndex})" class="btn-ia">🪄 IA</button>
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
 * Fonction d'appel au LLM
 */
async function askIA(rowIndex, colIndex) {
    const config = currentForm.columns[colIndex];
    const promptBase = config.params?.requete || "Analyse ces données :";
    
    // On récupère le contexte de la ligne (toutes les valeurs) pour aider l'IA
    const context = currentForm.rows[rowIndex].join(" | ");
    const fullPrompt = `${promptBase}\nDonnées de contexte : ${context}`;

    const btn = event.target;
    btn.innerText = "⏳...";
    btn.disabled = true;

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
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiResult = data.choices[0].message.content.trim();

        // Mise à jour de l'état et du DOM
        updateValue(rowIndex, colIndex, aiResult);
        document.getElementById(`cell-${rowIndex}-${colIndex}`).value = aiResult;

    } catch (error) {
        console.error("Erreur IA:", error);
        alert("Erreur lors de l'appel à l'IA. Vérifiez votre clé API.");
    } finally {
        btn.innerText = "🪄 IA";
        btn.disabled = false;
    }
}

window.updateValue = (rowIndex, colIndex, newValue) => {
    currentForm.rows[rowIndex][colIndex] = newValue;
};

function exportData() {
    const blob = new Blob([JSON.stringify(currentForm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_ia_${new Date().getTime()}.json`;
    a.click();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}