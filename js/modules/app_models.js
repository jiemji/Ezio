import { registerModuleInit } from '../ui/Navigation.js';
import { ApiService } from '../api/api_ia.js';
import { Sidebar } from '../ui/Sidebar.js';
import { Utils } from '../core/Utils.js';

let modelsData = [];
let currentModelIndex = -1;
let modelsSidebar = null;

const domModels = {
    list: null,
    empty: null,
    form: null,
    status: null,
    inputs: {}
};

export function initModels() {
    registerModuleInit('models', renderModelManager);

    // Initial Bindings
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

    const btnNewModel = document.getElementById('btnNewModel');
    if (btnNewModel) btnNewModel.onclick = createNewModel;

    const btnSaveModel = document.getElementById('btnSaveModel');
    if (btnSaveModel) btnSaveModel.onclick = saveModelsToFile;

    const btnDeleteModel = document.getElementById('btnDeleteModel');
    if (btnDeleteModel) btnDeleteModel.onclick = deleteCurrentModel;

    const btnTestConnection = document.getElementById('btnTestConnection');
    if (btnTestConnection) btnTestConnection.onclick = testConnection;
}

async function renderModelManager() {
    await loadModelsData();
    renderModelList();
}

async function loadModelsData() {
    try {
        const res = await fetch('models.json');
        if (res.ok) {
            modelsData = await res.json();
        } else {
            console.warn("models.json introuvable.");
            modelsData = [];
        }
    } catch (e) {
        modelsData = [];
    }
}

function renderModelList() {
    if (!domModels.list) return;

    if (!modelsSidebar) {
        modelsSidebar = new Sidebar('modelList', '', [], {
            onAddClick: null,
            onItemClick: (item) => selectModelItem(item.id),
            hideListTitle: true,
            itemRenderer: (item) => `<h4>${Utils.escapeHtml(item.nom || 'Sans nom')}</h4><p>${Utils.escapeHtml(item.provider)} - ${Utils.escapeHtml(item.model)}</p>`
        });
    }

    const sidebarItems = modelsData.map((m, i) => ({ ...m, id: i }));
    modelsSidebar.setItems(sidebarItems);
    modelsSidebar.setSelection(currentModelIndex);
    modelsSidebar.render();
}

function selectModelItem(idx) {
    currentModelIndex = idx;
    const m = modelsData[idx];

    domModels.empty.classList.add('hidden');
    domModels.form.classList.remove('hidden');

    domModels.inputs.nom.value = m.nom || "";
    domModels.inputs.description.value = m.description || "";
    domModels.inputs.prompt.value = m.prompt || "";
    domModels.inputs.provider.value = m.provider || "custom";
    domModels.inputs.model.value = m.model || "";
    domModels.inputs.endpoint.value = m.endpoint || "";
    domModels.inputs.apikey.value = m.apikey || "";
    domModels.inputs.temperature.value = m.temperature || 0.7;
    domModels.inputs.context_length.value = m.context_length || 4096;

    const dl = document.getElementById('modelListOptions');
    if (dl) dl.innerHTML = "";

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

function saveModelsToFile() {
    if (currentModelIndex !== -1) saveModelInMemory();
    Utils.downloadJSON(modelsData, 'models.json');
    showModelStatus("Fichier models.json généré.", "success");
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

async function testConnection() {
    saveModelInMemory(); // Update in-memory to test current values
    const config = {
        provider: domModels.inputs.provider.value,
        endpoint: domModels.inputs.endpoint.value,
        apiKey: domModels.inputs.apikey.value
    };

    showModelStatus("Test en cours...", "info");
    domModels.inputs.model.value = "";

    try {
        const models = await ApiService.listModels(config);
        const dataList = document.getElementById('modelListOptions');
        if (dataList) {
            dataList.innerHTML = "";
            models.forEach(modelId => {
                const opt = document.createElement('option');
                opt.value = modelId;
                dataList.appendChild(opt);
            });
        }
        showModelStatus(`Succès ! ${models.length} modèles.`, "success");
        domModels.inputs.model.focus();
    } catch (e) {
        showModelStatus("Erreur : " + e.message, "error");
    }
}

function showModelStatus(msg, type = 'info') {
    if (!domModels.status) return;
    domModels.status.innerText = msg;
    domModels.status.style.display = 'block';
    if (type === 'error') domModels.status.style.backgroundColor = '#fca5a5';
    else if (type === 'success') domModels.status.style.backgroundColor = '#86efac';
    else domModels.status.style.backgroundColor = '#bae6fd';
    setTimeout(() => { domModels.status.style.display = 'none'; }, 4000);
}
