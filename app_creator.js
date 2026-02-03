/**
 * EZIO - MODULE CREATEUR
 * Gère l'import CSV et la configuration de la structure du JSON.
 */

let creatorData = { headers: [], rows: [], configs: [] };

// DOM Elements spécifiques Creator
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
            parseCSV(evt.target.result);
            renderCreatorTable();
        };
        reader.readAsText(file);
    };
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 1) return;
    const separator = lines[0].includes(';') ? ';' : ',';
    const rawRows = lines.map(line => line.split(separator).map(c => c.trim()));
    
    creatorData.headers = rawRows[0];
    creatorData.rows = rawRows.slice(1);
    
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

    // Taille
    if (['question', 'reference'].includes(cfg.type)) {
        cell.appendChild(mkLabel("Taille"));
        const sel = document.createElement('select');
        sel.className = 'config-input';
        
        const emptyOpt = document.createElement('option');
        emptyOpt.value = ""; emptyOpt.innerText = "-- Choisir --";
        if (!cfg.params.size) emptyOpt.selected = true;
        sel.appendChild(emptyOpt);
        
        ['S', 'M', 'L'].forEach(s => {
            const o = document.createElement('option');
            o.value = s; o.innerText = s;
            if (cfg.params.size === s) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = (e) => cfg.params.size = e.target.value;
        cell.appendChild(sel);
    }
    
    // Combo / QCM
    if (['combo', 'qcm'].includes(cfg.type)) {
        cell.appendChild(mkLabel("Options (une/ligne)"));
        const txt = document.createElement('textarea');
        txt.className = 'config-textarea';
        txt.value = Array.isArray(cfg.params.options) ? cfg.params.options.join('\n') : "";
        txt.onchange = (e) => { cfg.params.options = e.target.value.split('\n').map(x => x.trim()).filter(x => x); };
        cell.appendChild(txt);
        
        if (cfg.type === 'combo') {
            cell.appendChild(mkLabel("Couleurs"));
            const cSel = document.createElement('select');
            cSel.className = 'config-input';
            [{k:'',v:'Aucun'},{k:'traffic',v:'Feux'},{k:'blue',v:'Bleu'},{k:'red',v:'Rouge'}].forEach(sc => {
                const o = document.createElement('option');
                o.value = sc.k; o.innerText = sc.v;
                if (cfg.params.colorScheme === sc.k) o.selected = true;
                cSel.appendChild(o);
            });
            cSel.onchange = (e) => cfg.params.colorScheme = e.target.value;
            cell.appendChild(cSel);
        }
    }
    
    // IA
    if (cfg.type === 'ia') {
        cell.appendChild(mkLabel("Prompt"));
        const pInp = document.createElement('textarea');
        pInp.className = 'config-textarea';
        pInp.value = cfg.params.requete || "";
        pInp.onchange = (e) => cfg.params.requete = e.target.value;
        cell.appendChild(pInp);
        
        cell.appendChild(mkLabel("Cibles"));
        const targetDiv = document.createElement('div');
        targetDiv.className = 'config-checkbox-group';
        creatorData.headers.forEach((h, hIdx) => {
            if (hIdx === colIdx) return;
            const d = document.createElement('div');
            d.className = 'config-checkbox-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            const slug = toSlug(h);
            const currentTargets = cfg.params.cibles || [];
            if (currentTargets.includes(slug)) cb.checked = true;
            cb.onchange = (e) => {
                if (!cfg.params.cibles) cfg.params.cibles = [];
                if (e.target.checked) { if (!cfg.params.cibles.includes(slug)) cfg.params.cibles.push(slug); } 
                else { cfg.params.cibles = cfg.params.cibles.filter(x => x !== slug); }
            };
            d.appendChild(cb); d.appendChild(document.createTextNode(h));
            targetDiv.appendChild(d);
        });
        cell.appendChild(targetDiv);
    }
}

if(generateJsonBtn) {
    generateJsonBtn.onclick = () => {
        const finalCols = creatorData.configs.map((cfg, idx) => {
            let colObj = { id: toSlug(cfg.label) || `col_${idx}`, label: cfg.label, type: cfg.type, visible: cfg.visible };
            
            if (Object.keys(cfg.params).length > 0) {
                colObj.params = JSON.parse(JSON.stringify(cfg.params));
                if (cfg.type === 'combo' && colObj.params.colorScheme) {
                    const s = colObj.params.colorScheme;
                    let c = {};
                    if (s === 'traffic') c = { "Conforme": "#dcfce7", "Oui": "#dcfce7", "Partiellement conforme": "#ffedd5", "Non-Conforme": "#fee2e2", "Non": "#fee2e2" };
                    else if (s === 'blue') c = { "Oui": "#dbeafe", "Non": "#e2e8f0" };
                    else if (s === 'red') c = { "Oui": "#fee2e2", "Non": "#dcfce7" };
                    if (Object.keys(c).length > 0) colObj.params.colors = c;
                    delete colObj.params.colorScheme;
                }
            }
            if (colObj.params && colObj.params.size) { colObj.size = colObj.params.size; delete colObj.params.size; }
            else if (['question', 'reference'].includes(colObj.type)) { colObj.size = 'M'; } // Fallback sécurité export

            return colObj;
        });

        const finalRows = creatorData.rows.map(row => {
            return row.map((cellVal, cIdx) => {
                const cfg = creatorData.configs[cIdx];
                if (cfg.type === 'qcm') return (cfg.params.options || []).map(opt => ({ label: opt, checked: false }));
                return cellVal;
            });
        });

        const finalJson = { columns: finalCols, rows: finalRows, statics: [] };
        downloadJSON(finalJson, 'audit_v3.json');
        
        if(confirm("JSON généré ! Charger dans l'application ?")) {
            currentForm = finalJson;
            saveState();
            switchView('app'); // Utilise fonction globale
            renderApp();       // Utilise fonction audit
        }
    };
}