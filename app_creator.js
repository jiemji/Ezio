/**
 * EZIO - MODULE CREATEUR
 * Gère l'import JSON et la configuration complète (IA, Combo, QCM, Couleurs).
 */

let creatorData = { headers: [], rows: [], configs: [] };

const csvInput = document.getElementById('csvInput');
const csvFileName = document.getElementById('csvFileName');
const creatorConfigDiv = document.getElementById('creatorConfig');
const configTable = document.getElementById('configTable');
const generateJsonBtn = document.getElementById('generateJsonBtn');

if(csvInput) {
    csvInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        csvFileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const jsonData = JSON.parse(evt.target.result);
                parseImportJSON(jsonData);
                renderCreatorTable();
            } catch (err) {
                alert("Erreur de lecture du JSON : " + err.message);
                console.error(err);
            }
        };
        // Lecture forcée en UTF-8 pour respecter les accents
        reader.readAsText(file, 'UTF-8');
    };
}

function parseImportJSON(data) {
    if (!Array.isArray(data) || data.length === 0) {
        alert("Le fichier doit être un tableau d'objets JSON.");
        return;
    }
    creatorData.headers = Object.keys(data[0]);
    creatorData.rows = data.map(obj => creatorData.headers.map(h => obj[h] || ""));
    creatorData.configs = creatorData.headers.map(h => ({
        label: h,
        visible: true,
        type: 'question',
        params: {} 
    }));
    if(creatorConfigDiv) creatorConfigDiv.classList.remove('hidden');
}

function renderCreatorTable() {
    if(!configTable) return;
    configTable.innerHTML = "";
    
    // 1. Labels
    let trLabels = document.createElement('tr');
    trLabels.innerHTML = `<td style="font-weight:bold; color:var(--primary);">Label Colonne</td>`;
    creatorData.headers.forEach(h => {
        const td = document.createElement('td');
        td.innerHTML = `<span class="config-label">${h}</span>`;
        trLabels.appendChild(td);
    });
    configTable.appendChild(trLabels);

    // 2. Visible
    let trVisible = document.createElement('tr');
    trVisible.innerHTML = `<td><strong>Visible ?</strong></td>`;
    creatorData.configs.forEach((cfg) => {
        const td = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = cfg.visible;
        cb.onchange = (e) => { cfg.visible = e.target.checked; };
        td.appendChild(cb);
        trVisible.appendChild(td);
    });
    configTable.appendChild(trVisible);

    // 3. Type
    let trType = document.createElement('tr');
    trType.innerHTML = `<td><strong>Type</strong></td>`;
    const types = ['question', 'chapitre', 'sous-chapitre', 'reponse', 'combo', 'qcm', 'popup', 'ia'];
    
    creatorData.configs.forEach((cfg, idx) => {
        const td = document.createElement('td');
        const sel = document.createElement('select');
        sel.className = 'config-input';
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.innerText = t.toUpperCase();
            if (t === cfg.type) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.onchange = (e) => { 
            cfg.type = e.target.value; 
            renderParamsCell(idx); 
        };
        td.appendChild(sel);
        trType.appendChild(td);
    });
    configTable.appendChild(trType);

    // 4. Params
    let trParams = document.createElement('tr');
    trParams.id = "tr-params";
    trParams.innerHTML = `<td><strong>Paramètres</strong></td>`;
    creatorData.configs.forEach((_, idx) => {
        const td = document.createElement('td');
        td.id = `params-cell-${idx}`;
        trParams.appendChild(td);
    });
    configTable.appendChild(trParams);
    
    creatorData.configs.forEach((_, idx) => renderParamsCell(idx));
}

function renderParamsCell(colIdx) {
    const cell = document.getElementById(`params-cell-${colIdx}`);
    if (!cell) return;
    cell.innerHTML = "";
    
    const cfg = creatorData.configs[colIdx];
    if (!cfg.params) cfg.params = {};
    const mkLabel = (txt) => { const l = document.createElement('span'); l.className = 'param-label'; l.innerText = txt; return l; };

    // Taille (pour Question)
    if (['question', 'reference'].includes(cfg.type)) {
        cell.appendChild(mkLabel("Taille"));
        const sel = document.createElement('select');
        sel.className = 'config-input';
        ['', 'S', 'M', 'L'].forEach(s => {
            const o = document.createElement('option');
            o.value = s; o.innerText = s || "-- Choisir --";
            if (cfg.params.size === s) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = (e) => cfg.params.size = e.target.value;
        cell.appendChild(sel);
    }
    
    // Combo / QCM (Restauration de la liste complète des couleurs)
    if (['combo'].includes(cfg.type)) {
        cell.appendChild(mkLabel("Options (une/ligne)"));
        const txt = document.createElement('textarea');
        txt.className = 'config-textarea';
        txt.value = Array.isArray(cfg.params.options) ? cfg.params.options.join('\n') : "";
        txt.onchange = (e) => { cfg.params.options = e.target.value.split('\n').map(x => x.trim()).filter(x => x); };
        cell.appendChild(txt);
        cell.appendChild(mkLabel("Schéma de Couleurs"));
        const cSel = document.createElement('select');
        cSel.className = 'config-input';
        
        const schemes = [
            {k:'', v:'Aucun'},
            {k:'alert3', v:'Alerte (3 coul)'}, 
            {k:'alert6', v:'Alerte (6 coul)'},  
            {k:'rainbow', v:'Arc-en-Ciel (7 coul.)'}, 
            {k:'blue', v:'Bleu (Dégradé)'},
            {k:'green', v:'Vert (Dégradé)'},
            {k:'red', v:'Rouge (Dégradé)'},
            {k:'purple', v:'Violet (Dégradé)'},
            {k:'orange', v:'Orange (Dégradé)'},
            {k:'yellow', v:'Jaune (Dégradé)'}
        ];

        schemes.forEach(sc => {
            const o = document.createElement('option');
            o.value = sc.k; o.innerText = sc.v;
            if (cfg.params.colorScheme === sc.k) o.selected = true;
            cSel.appendChild(o);
        });
        cSel.onchange = (e) => cfg.params.colorScheme = e.target.value;
        cell.appendChild(cSel);
    }
    
    // IA
    if (cfg.type === 'ia') {
        cell.appendChild(mkLabel("Prompt"));
        const pInp = document.createElement('textarea');
        pInp.className = 'config-textarea';
        pInp.value = cfg.params.requete || "";
        pInp.onchange = (e) => cfg.params.requete = e.target.value;
        cell.appendChild(pInp);
    }

    // QCM (Information seulement, extraction automatique par app_audit)
    if (cfg.type === 'qcm') {
        const info = document.createElement('div');
        info.className = 'param-info';
        info.style.fontSize = '0.8em';
        info.style.color = 'var(--primary)';
        info.innerText = "Mode automatique : les options seront extraites des données de la colonne.";
        cell.appendChild(info);
    }
}

if(generateJsonBtn) {
    generateJsonBtn.onclick = () => {
        const finalCols = creatorData.configs.map((cfg, idx) => {
            let colObj = { id: toSlug(cfg.label) || `col_${idx}`, label: cfg.label, type: cfg.type, visible: cfg.visible };
            if (Object.keys(cfg.params).length > 0) colObj.params = JSON.parse(JSON.stringify(cfg.params));
            return colObj;
        });

// Transformation des données : Conversion des QCM (String -> Array of Objects)
        const finalRows = creatorData.rows.map(row => {
            return row.map((val, idx) => {
                const cfg = creatorData.configs[idx];
                // Si la colonne est de type QCM et que la valeur est du texte
                if (cfg.type === 'qcm' && typeof val === 'string') {
                    return val.split('\n')
                        .map(item => item.trim())
                        .filter(item => item !== "")
                        .map(label => ({ label: label, checked: false }));
                }
                return val; // Sinon on garde la valeur originale
            });
        });

        const finalJson = { columns: finalCols, rows: finalRows, statics: [] };
        
        downloadJSON(finalJson, 'audit_config.json');
        
        if(confirm("JSON généré ! Charger dans l'application ?")) {
            currentForm = finalJson;
            saveState();
            switchView('app'); 
            renderApp();       
        }
    };
}