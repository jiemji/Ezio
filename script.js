/**
 * EZIO - Script Principal
 * Version: 2.4 (Init Vide & Choix Explicite)
 */
const STORAGE_KEY = 'adminform_data_v1';
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

// État du mode création
let creatorData = {
    headers: [],
    rows: [],
    configs: [] 
};

// -- GESTION DES FILTRES --
let activeFilters = {
    chapter: null,
    subChapter: null
};
let currentSearch = ""; 

// -- DOM ELEMENTS --
const auditView = document.getElementById('audit-view');
const creatorView = document.getElementById('creator-view');
const auditControls = document.getElementById('auditControls');
const btnShowApp = document.getElementById('btnShowApp');
const btnShowCreator = document.getElementById('btnShowCreator');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const themeBtn = document.getElementById('themeBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const generateJsonBtn = document.getElementById('generateJsonBtn');
const jsonInput = document.getElementById('jsonInput');
const searchInput = document.getElementById('searchInput');
const csvInput = document.getElementById('csvInput');
const csvFileName = document.getElementById('csvFileName');
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');
const configTable = document.getElementById('configTable');
const creatorConfigDiv = document.getElementById('creatorConfig');

// -- INITIALISATION --
(async function init() {
    try {
        const response = await fetch('config.json');
        if (response.ok) IA_CONFIG = await response.json();
    } catch (e) { console.error("Config manquante", e); }
    
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = '☀️';
    } else {
        themeBtn.textContent = '🌙';
    }

    loadState();
})();

// -- NAVIGATION --
if(btnShowCreator) btnShowCreator.onclick = () => switchView('creator');
if(btnShowApp) btnShowApp.onclick = () => switchView('app');

function switchView(view) {
    if(!creatorView || !auditView) return; 

    if (view === 'creator') {
        auditView.classList.add('hidden');
        creatorView.classList.remove('hidden');
        if(auditControls) auditControls.classList.add('hidden');
        if(btnShowApp) btnShowApp.classList.remove('hidden');
        if(btnShowCreator) btnShowCreator.classList.add('hidden');
        toggleSidebarBtn.classList.add('hidden');
    } else {
        auditView.classList.remove('hidden');
        creatorView.classList.add('hidden');
        if(auditControls) auditControls.classList.remove('hidden');
        if(btnShowApp) btnShowApp.classList.add('hidden');
        if(btnShowCreator) btnShowCreator.classList.remove('hidden');
        toggleSidebarBtn.classList.remove('hidden');
    }
}

// -- LISTENERS APP --
themeBtn.onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderTable(); 
};

toggleSidebarBtn.onclick = () => document.body.classList.toggle('menu-closed');

searchInput.oninput = (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderTable(); 
};

jsonInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.columns && data.rows) {
                currentForm = data;
                activeFilters = { chapter: null, subChapter: null };
                currentSearch = "";
                searchInput.value = "";
                saveState();
                if(window.switchView) switchView('app');
                renderApp();
            }
        } catch (err) { alert("Erreur JSON : " + err.message); }
    };
    reader.readAsText(file);
};

exportBtn.onclick = () => downloadJSON(currentForm, `export_${new Date().getTime()}.json`);

resetBtn.onclick = () => {
    if (confirm("Effacer toutes les données ?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
};

// -- CREATOR MODE LOGIC --
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
    
    // Initialisation SANS forcer de params.size
    creatorData.configs = creatorData.headers.map(h => ({
        label: h,
        visible: true,
        type: 'question',
        params: {} // Vide par défaut
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
            // On ne touche PAS aux params ici, on laisse renderParamsCell gérer l'affichage
            renderParamsCell(idx); 
        };
        td.appendChild(sel);
        trType.appendChild(td);
    });
    configTable.appendChild(trType);

    // 4. Params Container
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

    // --- RENDU TAILLE (MODIFIÉ: Option vide par défaut) ---
    if (['question', 'reference'].includes(cfg.type)) {
        cell.appendChild(mkLabel("Taille"));
        const sel = document.createElement('select');
        sel.className = 'config-input';
        
        // 1. Option Vide (Sélectionnée si cfg.params.size n'existe pas)
        const emptyOpt = document.createElement('option');
        emptyOpt.value = "";
        emptyOpt.innerText = "-- Choisir --";
        if (!cfg.params.size) emptyOpt.selected = true;
        sel.appendChild(emptyOpt);
        
        // 2. Options S, M, L
        ['S', 'M', 'L'].forEach(s => {
            const o = document.createElement('option');
            o.value = s; o.innerText = s;
            if (cfg.params.size === s) o.selected = true;
            sel.appendChild(o);
        });
        
        sel.onchange = (e) => cfg.params.size = e.target.value;
        cell.appendChild(sel);
    }
    
    // --- RENDU COMBO / QCM ---
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
    
    // --- RENDU IA ---
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

function toSlug(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// -- GENERATION JSON --
if(generateJsonBtn) {
    generateJsonBtn.onclick = () => {
        const finalCols = creatorData.configs.map((cfg, idx) => {
            let colObj = { 
                id: toSlug(cfg.label) || `col_${idx}`, 
                label: cfg.label, 
                type: cfg.type, 
                visible: cfg.visible 
            };
            
            if (Object.keys(cfg.params).length > 0) {
                colObj.params = JSON.parse(JSON.stringify(cfg.params));
                
                // Gestion couleurs
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
            
            // --- EXTRACTION TAILLE ---
            if (colObj.params && colObj.params.size) { 
                // Si l'utilisateur a fait un choix, on l'utilise
                colObj.size = colObj.params.size; 
                delete colObj.params.size; 
            } else if (['question', 'reference'].includes(colObj.type)) {
                // Fallback sécurité export uniquement : si toujours vide, on met M
                // Cela n'impacte pas l'interface (restera vide) mais assure un JSON valide
                colObj.size = 'M';
            }

            return colObj;
        });

        // Construction des lignes
        const finalRows = creatorData.rows.map(row => {
            return row.map((cellVal, cIdx) => {
                const cfg = creatorData.configs[cIdx];
                if (cfg.type === 'qcm') return (cfg.params.options || []).map(opt => ({ label: opt, checked: false }));
                return cellVal;
            });
        });

        const finalJson = { columns: finalCols, rows: finalRows };
        downloadJSON(finalJson, 'audit_v2.json');
        
        if(confirm("JSON généré ! Voulez-vous le charger dans l'application ?")) {
            currentForm = finalJson;
            activeFilters = { chapter: null, subChapter: null };
            currentSearch = "";
            saveState();
            if(window.switchView) switchView('app');
            renderApp();
        }
    };
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// -- APP LOGIC (Rendu Table, Sidebar, etc.) --
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentForm)); }
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { currentForm = JSON.parse(saved); renderApp(); }
}
function updateValue(r, c, val) { currentForm.rows[r][c] = val; saveState(); }

function renderApp() {
    if (!currentForm.columns.length) return;
    sidebar.classList.remove('hidden');
    renderSidebar();
    renderTable();
}

function renderSidebar() {
    chapterList.innerHTML = "";
    const chapColIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapColIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    if (chapColIdx === -1) return; 

    const hierarchy = new Map();
    let totalCount = 0;

    currentForm.rows.forEach(row => {
        const chapName = row[chapColIdx] || "Sans chapitre";
        const subChapName = (subChapColIdx !== -1) ? (row[subChapColIdx] || null) : null;

        if (!hierarchy.has(chapName)) {
            hierarchy.set(chapName, { count: 0, subChapters: new Map() });
        }

        const chapObj = hierarchy.get(chapName);
        chapObj.count++;
        totalCount++;

        if (subChapName) {
            const currentSubCount = chapObj.subChapters.get(subChapName) || 0;
            chapObj.subChapters.set(subChapName, currentSubCount + 1);
        }
    });

    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${(!activeFilters.chapter) ? 'active' : ''}`;
    allItem.innerHTML = `<span>Vue Globale</span> <span class="count-badge">${totalCount}</span>`;
    allItem.onclick = () => { 
        activeFilters = { chapter: null, subChapter: null }; 
        renderApp(); 
    };
    chapterList.appendChild(allItem);

    hierarchy.forEach((data, chapName) => {
        const isChapActive = activeFilters.chapter === chapName;
        
        const liChap = document.createElement('li');
        liChap.className = `chapter-item ${isChapActive && !activeFilters.subChapter ? 'active' : ''}`;
        liChap.innerHTML = `<span>${chapName}</span> <span class="count-badge">${data.count}</span>`;
        
        liChap.onclick = (e) => {
            activeFilters = { chapter: chapName, subChapter: null };
            renderApp();
        };

        const subUl = document.createElement('ul');
        subUl.className = `sub-chapter-list ${isChapActive ? 'open' : ''}`;

        if (data.subChapters.size > 0) {
            data.subChapters.forEach((count, subName) => {
                const liSub = document.createElement('li');
                const isSubActive = isChapActive && activeFilters.subChapter === subName;
                liSub.className = `sub-chapter-item ${isSubActive ? 'active' : ''}`;
                liSub.innerText = `${subName} (${count})`;
                
                liSub.onclick = (e) => {
                    e.stopPropagation(); 
                    activeFilters = { chapter: chapName, subChapter: subName };
                    renderApp();
                };
                subUl.appendChild(liSub);
            });
        }

        const container = document.createElement('div');
        container.appendChild(liChap);
        if (data.subChapters.size > 0) container.appendChild(subUl);
        chapterList.appendChild(container);
    });
}

function renderTable() {
    tableContainer.innerHTML = "";
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    const getColClass = (col) => {
        if (col.type === 'chapitre' || col.type === 'sous-chapitre') return 'col-chapitre';
        if (col.type === 'popup') return 'col-popup';
        if (col.type === 'combo') return 'col-combo';
        if (col.type === 'qcm') return 'col-qcm';
        if (col.type === 'reponse') return 'col-reponse';
        if (col.type === 'ia') return 'col-ia';
        const size = col.size ? col.size.toUpperCase() : 'L';
        return size === 'S' ? 'col-s' : (size === 'M' ? 'col-m' : 'col-l');
    };

    currentForm.columns.forEach(col => {
        if (col.visible === false) return;
        const th = document.createElement('th');
        th.innerText = col.label;
        th.className = getColClass(col);
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');
    
    let visibleCount = 0;

    currentForm.rows.forEach((row, rIdx) => {
        if (activeFilters.chapter && chapIdx !== -1) {
            if (row[chapIdx] !== activeFilters.chapter) return;
        }
        if (activeFilters.subChapter && subChapIdx !== -1) {
            if (row[subChapIdx] !== activeFilters.subChapter) return;
        }

        if (currentSearch) {
            const rowText = row.map(cell => {
                if (cell === null || cell === undefined) return "";
                if (typeof cell === 'object') return JSON.stringify(cell);
                return String(cell);
            }).join(" ").toLowerCase();
            if (!rowText.includes(currentSearch)) return;
        }

        visibleCount++;
        const tr = document.createElement('tr');
        row.forEach((cell, cIdx) => {
            const col = currentForm.columns[cIdx];
            if (col.visible === false) return; 
            const td = document.createElement('td');
            td.className = getColClass(col);
            renderCell(td, col, cell, rIdx, cIdx);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    let status = [];
    if (activeFilters.chapter) status.push(`Chapitre: ${activeFilters.chapter}`);
    if (activeFilters.subChapter) status.push(`Sous-chapitre: ${activeFilters.subChapter}`);
    if (status.length === 0) status.push("Vue Globale");
    if (currentSearch) status.push(`Recherche: "${currentSearch}"`);
    statusIndicator.innerText = `${status.join(' | ')} (${visibleCount} lignes)`;
}

function renderCell(container, col, value, r, c) {
    switch (col.type) {
        case 'question':
        case 'chapitre':
        case 'sous-chapitre':
        case 'reference':
            container.classList.add('cell-readonly');
            container.innerText = value || "";
            break;

        case 'reponse':
            const txt = document.createElement('textarea');
            txt.value = value || "";
            txt.oninput = (e) => updateValue(r, c, e.target.value);
            container.appendChild(txt);
            break;

        case 'combo':
            const sel = document.createElement('select');
            const options = col.params?.options || [];
            sel.appendChild(new Option("--", ""));
            options.forEach(opt => {
                const o = new Option(opt, opt);
                if (opt === value) o.selected = true;
                sel.appendChild(o);
            });
            const updateBg = (v) => {
                const bg = (col.params?.colors || {})[v];
                sel.style.backgroundColor = bg || '';
                sel.style.color = bg ? '#1e293b' : '';
            };
            sel.onchange = (e) => { updateValue(r, c, e.target.value); updateBg(e.target.value); };
            updateBg(value); 
            container.appendChild(sel);
            break;

        case 'qcm':
            const qcmDiv = document.createElement('div');
            qcmDiv.className = 'qcm-container';
            const items = Array.isArray(value) ? value : (col.params?.options||[]).map(o=>({label:o,checked:false}));
            items.forEach((item, iIdx) => {
                const l = document.createElement('label'); l.className = 'qcm-item';
                const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=item.checked;
                cb.onchange = (e) => { items[iIdx].checked = e.target.checked; updateValue(r, c, items); };
                l.appendChild(cb); l.append(item.label); qcmDiv.appendChild(l);
            });
            container.appendChild(qcmDiv);
            break;

        case 'popup':
            const w = document.createElement('div'); w.className = 'popup-wrapper';
            w.innerHTML = `<div class="popup-badge">Preuves</div><div class="popup-content">${value||"Vide"}</div>`;
            container.appendChild(w);
            break;

        case 'ia':
            const d = document.createElement('div'); d.className = 'ia-cell';
            const b = document.createElement('button'); b.className = 'btn-ia'; b.innerHTML = "✨ Générer";
            b.onclick = () => runIA(r, c, col, b);
            const res = document.createElement('div'); res.id=`ia-${r}-${c}`; res.className='ia-content';
            res.innerHTML = value ? marked.parse(value) : "";
            d.appendChild(b); d.appendChild(res); container.appendChild(d);
            break;
            
        default: container.innerText = value || ""; break;
    }
}

async function runIA(r, c, col, btn) {
    if (!IA_CONFIG) return alert("IA non configurée.");
    const fmt = (v, t) => {
        if (t === 'qcm' && Array.isArray(v)) return v.map(i => `${i.label}:${i.checked?'[x]':'[ ]'}`).join("\n");
        return v;
    };
    let ctx = "";
    if (col.params?.cibles?.length) {
        ctx = col.params.cibles.map(tid => {
            const idx = currentForm.columns.findIndex(cl => cl.id === tid);
            if(idx === -1) return "";
            return `${currentForm.columns[idx].label}:\n${fmt(currentForm.rows[r][idx], currentForm.columns[idx].type)}`;
        }).join("\n\n");
    } else ctx = JSON.stringify(currentForm.rows[r]);

    btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await window.ApiService.fetchLLM(IA_CONFIG, `${col.params?.requete||"Analyse:"}\n\nContexte:\n${ctx}`);
        updateValue(r, c, res);
        document.getElementById(`ia-${r}-${c}`).innerHTML = marked.parse(res);
    } catch (e) { alert("Erreur IA: " + e.message); }
    finally { btn.innerText = "✨ Générer"; btn.disabled = false; }
}