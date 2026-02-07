/**
 * MODULE MANAGER
 * Gestion des modèles IA (models.json) au sein de l'application.
 */

let modelsData = [];
let currentModelIndex = -1;

// Elements DOM (seront récupérés au premier chargement ou init)
const domModels = {
    list: null,
    empty: null,
    form: null,
    status: null,
    inputs: {}
};

// Initialisation appelée par app_shared.js lors du switchView
async function initModelManager() {
    // Liaison DOM
    domModels.list = document.getElementById('modelList');
    domModels.empty = document.getElementById('emptyState');
    domModels.form = document.getElementById('editForm');
    domModels.status = document.getElementById('statusMsg');

    domModels.inputs = {
        nom: document.getElementById('inpName'),
        description: document.getElementById('inpDesc'),
        prompt: document.getElementById('inpPrompt'),
        provider: document.getElementById('inpProvider'),
        model: document.getElementById('inpModelId'),
        endpoint: document.getElementById('inpEndpoint'),
        apikey: document.getElementById('inpApiKey'),
        temperature: document.getElementById('inpTemp'),
        context_length: document.getElementById('inpContext')
    };

    // Boutons
    document.getElementById('btnNewModel').onclick = createNewModel;
    document.getElementById('btnSaveModel').onclick = saveModelsToFile; // Sauvegarde JSON
    document.getElementById('btnDeleteModel').onclick = deleteCurrentModel;

    // Chargement données
    await loadModelsData();
    renderModelList();
}

async function loadModelsData() {
    try {
        const res = await fetch('models.json');
        if (res.ok) {
            modelsData = await res.json();
        } else {
            console.warn("models.json introuvable, initialisation vide ou défaut.");
            modelsData = [];
        }
    } catch (e) {
        console.error("Erreur chargement models.json:", e);
        modelsData = [];
    }
}

function renderModelList() {
    if (!domModels.list) return;
    domModels.list.innerHTML = "";

    modelsData.forEach((m, idx) => {
        const div = document.createElement('div');
        div.className = `model-item ${idx === currentModelIndex ? 'active' : ''}`;
        div.innerHTML = `<h4>${m.nom || 'Sans nom'}</h4><p>${m.provider} - ${m.model}</p>`;
        div.onclick = () => selectModelItem(idx);
        domModels.list.appendChild(div);
    });
}

function selectModelItem(idx) {
    currentModelIndex = idx;
    const m = modelsData[idx];

    domModels.empty.classList.add('hidden');
    domModels.form.classList.remove('hidden');

    // Remplissage Form
    domModels.inputs.nom.value = m.nom || "";
    domModels.inputs.description.value = m.description || "";
    domModels.inputs.prompt.value = m.prompt || "";
    domModels.inputs.provider.value = m.provider || "custom";
    domModels.inputs.model.value = m.model || "";
    domModels.inputs.endpoint.value = m.endpoint || "";
    domModels.inputs.apikey.value = m.apikey || "";
    domModels.inputs.temperature.value = m.temperature || 0.7;
    domModels.inputs.context_length.value = m.context_length || 4096;

    renderModelList();
}

function createNewModel() {
    const newModel = {
        nom: "Nouveau Modèle",
        description: "",
        prompt: "Tu es un assistant expert...",
        provider: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions",
        apikey: "",
        model: "gpt-4o",
        temperature: 0.7,
        context_length: 8192
    };
    modelsData.push(newModel);
    selectModelItem(modelsData.length - 1);
}

function saveModelInMemory() {
    if (currentModelIndex === -1) return;

    // Mise à jour de l'objet en mémoire depuis le formulaire
    const m = modelsData[currentModelIndex];
    m.nom = domModels.inputs.nom.value;
    m.description = domModels.inputs.description.value;
    m.prompt = domModels.inputs.prompt.value;
    m.provider = domModels.inputs.provider.value;
    m.model = domModels.inputs.model.value;
    m.endpoint = domModels.inputs.endpoint.value;
    m.apikey = domModels.inputs.apikey.value;
    m.temperature = parseFloat(domModels.inputs.temperature.value);
    m.context_length = parseInt(domModels.inputs.context_length.value);
}

// Sauvegarde fichier (Téléchargement) car pas d'accès disque écriture
function saveModelsToFile() {
    if (currentModelIndex !== -1) saveModelInMemory(); // Assurer que les dernières modifs sont prises en compte

    // Utilisation de la fonction downloadJSON disponible globalement (app_shared.js ou app_creator.js)
    // Si pas dispo, on refait une mini implémentation
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(modelsData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "models.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    showModelStatus("Fichier models.json généré. Veuillez remplacer l'ancien fichier.");
}

function deleteCurrentModel() {
    if (currentModelIndex === -1) return;
    if (!confirm("Supprimer ce modèle ?")) return;

    modelsData.splice(currentModelIndex, 1);
    currentModelIndex = -1;
    domModels.form.classList.add('hidden');
    domModels.empty.classList.remove('hidden');
    renderModelList();
}

function showModelStatus(msg) {
    if (!domModels.status) return;
    domModels.status.innerText = msg;
    domModels.status.style.display = 'block';
    setTimeout(() => { domModels.status.style.display = 'none'; }, 4000);
}
