/**
 * EZIO - MODULE AUDIT
 * Gère l'affichage du formulaire, la sidebar, les interactions utilisateur,
 * le tri par colonne et le filtrage.
 */

let activeFilters = { chapter: null, subChapter: null };
let columnFilters = {}; // Stocke les filtres par colonne: { colIndex: "valeur" }
let currentSort = { colIndex: -1, direction: 'asc' }; // { colIndex: 2, direction: 'asc' | 'desc' }
let currentSearch = ""; 

// DOM Elements spécifiques Audit
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');
const searchInput = document.getElementById('searchInput');
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');

// Listeners spécifiques
if (searchInput) {
    searchInput.oninput = (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderTable(); 
    };
}

if (exportBtn) {
    exportBtn.onclick = () => downloadJSON(currentForm, `export_${new Date().getTime()}.json`);
}

if (jsonInput) {
    jsonInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.columns && data.rows) {
                    currentForm = data;
                    if(!currentForm.statics) currentForm.statics = [];
                    
                    // Reset états
                    activeFilters = { chapter: null, subChapter: null };
                    columnFilters = {};
                    currentSort = { colIndex: -1, direction: 'asc' };
                    currentSearch = "";
                    searchInput.value = "";
                    
                    saveState();
                    if(typeof switchView === 'function') switchView('app');
                    renderApp();
                }
            } catch (err) { alert("Erreur JSON : " + err.message); }
        };
        reader.readAsText(file);
    };
}

// -- LOGIQUE DE RENDU --

function updateValue(r, c, val) { 
    // r est l'index original (absolu) dans currentForm.rows
    currentForm.rows[r][c] = val; 
    saveState(); 
}

function renderApp() {
    if (!currentForm.columns.length) return;
    if (sidebar) {
        sidebar.classList.remove('hidden');
        renderSidebar();
    }
    renderTable();
}

function renderSidebar() {
    if (!chapterList) return;
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

    // Bouton Vue Globale
    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${(!activeFilters.chapter) ? 'active' : ''}`;
    allItem.innerHTML = `<span>Vue Globale</span> <span class="count-badge">${totalCount}</span>`;
    allItem.onclick = () => { 
        activeFilters = { chapter: null, subChapter: null }; 
        columnFilters = {}; // Reset filtres colonnes si on change de vue (optionnel)
        renderApp(); 
    };
    chapterList.appendChild(allItem);

    // Arborescence
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

function handleSort(cIdx) {
    if (currentSort.colIndex === cIdx) {
        // Toggle direction: asc -> desc -> null (off)
        if (currentSort.direction === 'asc') currentSort.direction = 'desc';
        else if (currentSort.direction === 'desc') { currentSort.colIndex = -1; currentSort.direction = 'asc'; }
    } else {
        currentSort.colIndex = cIdx;
        currentSort.direction = 'asc';
    }
    renderTable();
}

function handleColumnFilter(cIdx, value) {
    if (value === "") {
        delete columnFilters[cIdx];
    } else {
        columnFilters[cIdx] = value;
    }
    renderTable();
}

function renderTable() {
    if (!tableContainer) return;
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

    // 1. HEADER & LOGIQUE DE TRI/FILTRE UI
    currentForm.columns.forEach((col, cIdx) => {
        if (col.visible === false) return;
        const th = document.createElement('th');
        th.className = getColClass(col) + " sortable-header";
        
        // Container Header
        const headerDiv = document.createElement('div');
        headerDiv.className = "th-header-content";
        
        // Label + Icone Tri
        const labelSpan = document.createElement('span');
        let sortIcon = "↕"; 
        if (currentSort.colIndex === cIdx) {
            sortIcon = currentSort.direction === 'asc' ? "▲" : "▼";
            th.classList.add('sorted');
        }
        labelSpan.innerText = `${col.label} ${sortIcon}`;
        labelSpan.style.cursor = "pointer";
        labelSpan.onclick = () => handleSort(cIdx);
        
        headerDiv.appendChild(labelSpan);

        // Ajout filtre pour Combo
        if (col.type === 'combo') {
            const selectFilter = document.createElement('select');
            selectFilter.className = "th-filter-select";
            selectFilter.onclick = (e) => e.stopPropagation(); // Empêcher le tri quand on clique le select
            
            // Option vide (Tout)
            selectFilter.appendChild(new Option("Tout", ""));
            
            // Options du combo
            const opts = col.params?.options || [];
            opts.forEach(opt => {
                const o = new Option(opt, opt);
                if (columnFilters[cIdx] === opt) o.selected = true;
                selectFilter.appendChild(o);
            });

            selectFilter.onchange = (e) => handleColumnFilter(cIdx, e.target.value);
            headerDiv.appendChild(selectFilter);
        }

        th.appendChild(headerDiv);
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // 2. PRÉPARATION DES DONNÉES (PIPELINE)
    const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    // Étape A: Mapping pour garder l'index original (CRITIQUE pour updateValue)
    let rowsToProcess = currentForm.rows.map((row, index) => ({ data: row, originalIndex: index }));

    // Étape B: Filtrage Structurel (Chapitre / Sous-Chapitre)
    if (activeFilters.chapter && chapIdx !== -1) {
        rowsToProcess = rowsToProcess.filter(item => item.data[chapIdx] === activeFilters.chapter);
    }
    if (activeFilters.subChapter && subChapIdx !== -1) {
        rowsToProcess = rowsToProcess.filter(item => item.data[subChapIdx] === activeFilters.subChapter);
    }

    // Étape C: Filtrage par Colonne (Combo)
    Object.keys(columnFilters).forEach(keyIdx => {
        const filterVal = columnFilters[keyIdx];
        const cIdx = parseInt(keyIdx);
        rowsToProcess = rowsToProcess.filter(item => item.data[cIdx] === filterVal);
    });

    // Étape D: Recherche Globale
    if (currentSearch) {
        rowsToProcess = rowsToProcess.filter(item => {
            const rowText = item.data.map(cell => {
                if (cell === null || cell === undefined) return "";
                if (typeof cell === 'object') return JSON.stringify(cell);
                return String(cell);
            }).join(" ").toLowerCase();
            return rowText.includes(currentSearch);
        });
    }

    // Étape E: Tri
    if (currentSort.colIndex !== -1) {
        rowsToProcess.sort((a, b) => {
            const valA = a.data[currentSort.colIndex];
            const valB = b.data[currentSort.colIndex];
            
            // Gestion des nuls
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            let comparison = 0;
            // Détection numérique ou string
            if (!isNaN(parseFloat(valA)) && isFinite(valA) && !isNaN(parseFloat(valB)) && isFinite(valB)) {
                comparison = parseFloat(valA) - parseFloat(valB);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return currentSort.direction === 'asc' ? comparison : -comparison;
        });
    }

    // 3. RENDU DES LIGNES
    const tbody = document.createElement('tbody');
    let visibleCount = 0;

    rowsToProcess.forEach((item) => {
        visibleCount++;
        const tr = document.createElement('tr');
        item.data.forEach((cell, cIdx) => {
            const col = currentForm.columns[cIdx];
            if (col.visible === false) return; 
            const td = document.createElement('td');
            td.className = getColClass(col);
            // On passe item.originalIndex (r) pour que l'édition cible la bonne ligne en mémoire
            renderCell(td, col, cell, item.originalIndex, cIdx);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    // 4. STATUS INDICATOR
    let status = [];
    if (activeFilters.chapter) status.push(`Chap: ${activeFilters.chapter}`);
    if (activeFilters.subChapter) status.push(`Sous-Chap: ${activeFilters.subChapter}`);
    if (Object.keys(columnFilters).length > 0) status.push(`Filtres actifs: ${Object.keys(columnFilters).length}`);
    if (status.length === 0) status.push("Vue Globale");
    if (currentSearch) status.push(`Rech: "${currentSearch}"`);
    if (statusIndicator) statusIndicator.innerText = `${status.join(' | ')} (${visibleCount} lignes)`;
}

// Fonction pour déterminer si le texte doit être blanc ou noir en fonction du fond
function getContrastColor(color) {
    if(!color) return '';
    let r, g, b;

    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (color.startsWith('rgb')) {
        const vals = color.match(/\d+/g);
        if(vals) {
            r = parseInt(vals[0]);
            g = parseInt(vals[1]);
            b = parseInt(vals[2]);
        }
    } else {
        return '';
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function getComboColor(scheme, value, options) {
    if (!scheme || !value || !options || options.length === 0) return '';
    
    const index = options.indexOf(value);
    if (index === -1) return '';

    const fixedSchemes = {
        'alert': ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#000000'],
        'rainbow': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7']
    };

    if (fixedSchemes[scheme]) {
        const colors = fixedSchemes[scheme];
        if (index >= colors.length) return colors[colors.length - 1];
        return colors[index];
    }
    
    const baseColors = {
        'blue': '59, 130, 246', 'green': '34, 197, 94', 'red': '239, 68, 68',
        'purple': '168, 85, 247', 'orange': '249, 115, 22', 'yellow': '234, 179, 8'
    };

    const rgb = baseColors[scheme];
    if (!rgb) return '';

    let alpha = 0.9; 
    if (options.length > 1) {
        const startAlpha = 0.1; const endAlpha = 0.9; 
        const step = (endAlpha - startAlpha) / (options.length - 1);
        alpha = startAlpha + (index * step);
    }

    alpha = Math.round(alpha * 100) / 100;
    return `rgba(${rgb}, ${alpha})`;
}

function renderCell(container, col, value, r, c) {
    switch (col.type) {
        case 'question': case 'chapitre': case 'sous-chapitre': case 'reference':
            container.classList.add('cell-readonly'); container.innerText = value || ""; break;
        case 'reponse':
            const txt = document.createElement('textarea'); txt.value = value || "";
            txt.oninput = (e) => updateValue(r, c, e.target.value); container.appendChild(txt); break;
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
                const colorScheme = col.params?.colorScheme;
                if (colorScheme && v) {
                    const bg = getComboColor(colorScheme, v, options);
                    sel.style.backgroundColor = bg;
                    if(bg) sel.style.color = getContrastColor(bg);
                    else sel.style.color = '';
                } else {
                    sel.style.backgroundColor = ''; sel.style.color = '';
                }
            };

            sel.onchange = (e) => { updateValue(r, c, e.target.value); updateBg(e.target.value); };
            updateBg(value); 
            container.appendChild(sel); break;
        case 'qcm':
            const qcmDiv = document.createElement('div'); qcmDiv.className = 'qcm-container';
            const items = Array.isArray(value) ? value : (col.params?.options||[]).map(o=>({label:o,checked:false}));
            items.forEach((item, iIdx) => {
                const l = document.createElement('label'); l.className = 'qcm-item';
                const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=item.checked;
                cb.onchange = (e) => { items[iIdx].checked = e.target.checked; updateValue(r, c, items); };
                l.appendChild(cb); l.append(item.label); qcmDiv.appendChild(l);
            });
            container.appendChild(qcmDiv); break;
        case 'popup':
            const w = document.createElement('div'); w.className = 'popup-wrapper';
            w.innerHTML = `<div class="popup-badge">Preuves</div><div class="popup-content">${value||"Vide"}</div>`;
            container.appendChild(w); break;
        case 'ia':
            const d = document.createElement('div'); d.className = 'ia-cell';
            const b = document.createElement('button'); b.className = 'btn-ia'; b.innerHTML = "✨ Générer";
            b.onclick = () => runIA(r, c, col, b);
            const res = document.createElement('div'); res.id=`ia-${r}-${c}`; res.className='ia-content';
            res.innerHTML = value ? marked.parse(value) : "";
            d.appendChild(b); d.appendChild(res); container.appendChild(d); break;
        default: container.innerText = value || ""; break;
    }
}

async function runIA(r, c, col, btn) {
    if (!IA_CONFIG) return alert("IA non configurée.");
    const fmt = (v, t) => { if (t === 'qcm' && Array.isArray(v)) return v.map(i => `${i.label}:${i.checked?'[x]':'[ ]'}`).join("\n"); return v; };
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
        updateValue(r, c, res); document.getElementById(`ia-${r}-${c}`).innerHTML = marked.parse(res);
    } catch (e) { alert("Erreur IA: " + e.message); }
    finally { btn.innerText = "✨ Générer"; btn.disabled = false; }
}