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
    document.getElementById('btnTestConnection').onclick = testConnection;

    // Chargement données
    await loadModelsData();
    renderModelList();
}

/**
 * Teste la connexion et récupère la liste des modèles
 */
async function testConnection() {
    const config = {
        provider: domModels.inputs.provider.value,
        endpoint: domModels.inputs.endpoint.value,
        apiKey: domModels.inputs.apikey.value
    };

    showModelStatus("Test de connexion en cours...", "info");

    // On vide le champ pour que la datalist affiche toutes les suggestions
    domModels.inputs.model.value = "";

    try {
        const models = await ApiService.listModels(config);
        console.log("DEBUG app_models: Models returned:", models);

        // Remplissage du DataList
        const dataList = document.getElementById('modelListOptions');
        if (!dataList) {
            console.error("DEBUG app_models: Element #modelListOptions introuvable !");
            showModelStatus("Erreur interne : DataList introuvable", "error");
            return;
        }

        dataList.innerHTML = "";

        if (models.length === 0) {
            showModelStatus("Connexion réussie, mais aucun modèle trouvé.", "warning");
            return;
        }

        models.forEach(modelId => {
            const opt = document.createElement('option');
            opt.value = modelId;
            dataList.appendChild(opt);
        });

        showModelStatus(`Succès ! ${models.length} modèles trouvés.`, "success");

        // On rend le focus au champ pour faciliter la saisie/choix
        domModels.inputs.model.focus();

    } catch (e) {
        showModelStatus("Erreur : " + e.message, "error");
    }
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

    // Reset du DataList quand on change de modèle pour éviter la confusion ?
    // Non, on le laisse vide ou utilisateur doit re-tester s'il veut la liste à jour
    document.getElementById('modelListOptions').innerHTML = "";

    renderModelList();
}

function createNewModel() {
    const newModel = {
        nom: "Nouveau Modèle",
        description: "",
        prompt: "Tu es un assistant expert...",
        provider: "lmstudio",
        endpoint: "http://localhost:1234/v1/chat/completions",
        apikey: "not-needed",
        model: "model-identifier",
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

    showModelStatus("Fichier models.json généré. Veuillez remplacer l'ancien fichier.", "success");
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

function showModelStatus(msg, type = 'info') {
    if (!domModels.status) return;
    domModels.status.innerText = msg;
    domModels.status.style.display = 'block';

    // Style basique selon type
    if (type === 'error') domModels.status.style.backgroundColor = '#fca5a5';
    else if (type === 'success') domModels.status.style.backgroundColor = '#86efac';
    else domModels.status.style.backgroundColor = '#bae6fd'; // info

    domModels.status.style.color = '#1e293b';

    setTimeout(() => { domModels.status.style.display = 'none'; }, 4000);
}
