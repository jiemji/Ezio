/**
 * AdminForm - Script Principal
 * Mise à jour : Ajout Barre de Recherche Globale
 */
const STORAGE_KEY = 'adminform_data_v1';
let IA_CONFIG = null;
let currentForm = { columns: [], rows: [] };

let activeChapterFilter = null; 
let currentSearch = ""; // État de la recherche

// -- DOM --
const jsonInput = document.getElementById('jsonInput');
const searchInput = document.getElementById('searchInput'); // NOUVEAU
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const themeBtn = document.getElementById('themeBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');

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

// -- LISTENERS --
themeBtn.onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderTable(); 
};

toggleSidebarBtn.onclick = () => {
    document.body.classList.toggle('menu-closed');
};

// Listener Recherche
searchInput.oninput = (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderTable(); // Re-render immédiat à la frappe
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
                activeChapterFilter = null; // Reset filtre
                currentSearch = "";         // Reset recherche
                searchInput.value = "";
                saveState();
                renderApp();
            }
        } catch (err) { alert("Erreur JSON : " + err.message); }
    };
    reader.readAsText(file);
};

exportBtn.onclick = () => {
    const dataStr = JSON.stringify(currentForm, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${new Date().getTime()}.json`;
    a.click();
};

resetBtn.onclick = () => {
    if (confirm("Effacer toutes les données ?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
};

// -- STATE --
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentForm));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        currentForm = JSON.parse(saved);
        renderApp();
    }
}

function updateValue(r, c, val) {
    currentForm.rows[r][c] = val;
    saveState();
}

// -- RENDERING --
function renderApp() {
    if (!currentForm.columns.length) return;
    sidebar.classList.remove('hidden');
    renderSidebar();
    renderTable();
}

function renderSidebar() {
    chapterList.innerHTML = "";
    const chapColIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    
    if (chapColIdx === -1) return;

    const chapterMap = new Map();
    currentForm.rows.forEach(row => {
        const chapName = row[chapColIdx] || "Sans chapitre";
        chapterMap.set(chapName, (chapterMap.get(chapName) || 0) + 1);
    });

    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${!activeChapterFilter ? 'active' : ''}`;
    allItem.innerText = `Tous les chapitres (${currentForm.rows.length})`;
    allItem.onclick = () => { activeChapterFilter = null; renderApp(); };
    chapterList.appendChild(allItem);

    chapterMap.forEach((count, ch) => {
        const li = document.createElement('li');
        li.className = `chapter-item ${activeChapterFilter === ch ? 'active' : ''}`;
        li.innerText = `${ch} (${count})`;
        li.onclick = () => { activeChapterFilter = ch; renderApp(); };
        chapterList.appendChild(li);
    });
}

function renderTable() {
    tableContainer.innerHTML = "";
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    const getColClass = (col) => {
        switch (col.type) {
            case 'chapitre': return 'col-chapitre';
            case 'popup': return 'col-popup';
            case 'combo': return 'col-combo';
            case 'qcm': return 'col-qcm';
            case 'reponse': return 'col-reponse';
            case 'ia': return 'col-ia';
            case 'question':
                const size = col.size ? col.size.toUpperCase() : 'L';
                if (size === 'S') return 'col-s';
                if (size === 'M') return 'col-m';
                return 'col-l';
            default: return 'col-l';
        }
    };

    // 1. En-têtes
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
    
    let visibleCount = 0;

    currentForm.rows.forEach((row, rIdx) => {
        // A. Filtre Chapitre
        if (activeChapterFilter && chapIdx !== -1 && row[chapIdx] !== activeChapterFilter) return;

        // B. Filtre Recherche (Texte Global)
        if (currentSearch) {
            // On transforme toute la ligne en une chaîne de caractères pour chercher dedans
            // On inclut même les colonnes cachées (ex: mot clé dans un domaine caché)
            const rowText = row.map(cell => {
                if (cell === null || cell === undefined) return "";
                if (typeof cell === 'object') return JSON.stringify(cell); // Pour QCM/Objets
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
    
    // Mise à jour de l'indicateur
    let status = activeChapterFilter ? `Filtre : ${activeChapterFilter}` : "Affichage complet";
    if (currentSearch) status += ` | Recherche : "${currentSearch}" (${visibleCount} résultats)`;
    statusIndicator.innerText = status;
}

function renderCell(container, col, value, r, c) {
    switch (col.type) {
        case 'question':
        case 'chapitre':
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
            
            const emptyOpt = document.createElement('option');
            emptyOpt.value = ""; emptyOpt.innerText = "--";
            sel.appendChild(emptyOpt);

            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if (opt === value) o.selected = true;
                sel.appendChild(o);
            });

            const updateBg = (v) => {
                const colors = col.params?.colors || {};
                const bgColor = colors[v];
                if (bgColor) {
                    sel.style.backgroundColor = bgColor;
                    sel.style.color = '#1e293b'; 
                } else {
                    sel.style.backgroundColor = '';
                    sel.style.color = ''; 
                }
            };

            sel.onchange = (e) => {
                updateValue(r, c, e.target.value);
                updateBg(e.target.value);
            };
            updateBg(value); 
            container.appendChild(sel);
            break;

        case 'qcm':
            const qcmDiv = document.createElement('div');
            qcmDiv.className = 'qcm-container';
            const items = Array.isArray(value) ? value : [];
            items.forEach((item, iIdx) => {
                const label = document.createElement('label');
                label.className = 'qcm-item';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = item.checked;
                cb.onchange = (e) => {
                    items[iIdx].checked = e.target.checked;
                    updateValue(r, c, items);
                };
                label.appendChild(cb);
                label.append(item.label);
                qcmDiv.appendChild(label);
            });
            container.appendChild(qcmDiv);
            break;

        case 'popup':
            const wrap = document.createElement('div');
            wrap.className = 'popup-wrapper';
            const badge = document.createElement('div');
            badge.className = 'popup-badge';
            badge.innerText = "Preuves";
            const content = document.createElement('div');
            content.className = 'popup-content';
            content.innerText = value || "Aucune preuve.";
            wrap.appendChild(badge);
            wrap.appendChild(content);
            container.appendChild(wrap);
            break;

        case 'ia':
            const iaDiv = document.createElement('div');
            iaDiv.className = 'ia-cell';
            const btn = document.createElement('button');
            btn.className = 'btn-ia';
            btn.innerHTML = "✨ Générer";
            btn.onclick = () => runIA(r, c, col, btn);
            
            const resDiv = document.createElement('div');
            resDiv.id = `ia-${r}-${c}`;
            resDiv.className = 'ia-content';
            resDiv.innerHTML = value ? marked.parse(value) : "";
            
            iaDiv.appendChild(btn);
            iaDiv.appendChild(resDiv);
            container.appendChild(iaDiv);
            break;
            
        default:
            container.classList.add('cell-readonly');
            container.innerText = value || "";
            break;
    }
}

async function runIA(r, c, col, btn) {
    if (!IA_CONFIG) return alert("IA non configurée.");

    const fmt = (v, t, p) => {
        if (t === 'qcm' && Array.isArray(v)) return v.map(i => `- ${i.label}: ${i.checked?'[X]':'[ ]'}`).join("\n");
        if (t === 'combo') return v ? `Choix: "${v}"` : "Non fait";
        return v;
    };

    let ctx = "";
    if (col.params?.cibles?.length) {
        ctx = col.params.cibles.map(tid => {
            const idx = currentForm.columns.findIndex(cl => cl.id === tid);
            if(idx === -1) return "";
            const tCol = currentForm.columns[idx];
            return `${tCol.label}:\n${fmt(currentForm.rows[r][idx], tCol.type, tCol.params)}`;
        }).join("\n\n");
    } else {
        ctx = currentForm.rows[r].map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(" | ");
    }

    btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await window.ApiService.fetchLLM(IA_CONFIG, `${col.params?.requete||"Analyse:"}\n\nContexte:\n${ctx}`);
        updateValue(r, c, res);
        document.getElementById(`ia-${r}-${c}`).innerHTML = marked.parse(res);
    } catch (e) { alert("Erreur IA: " + e.message); }
    finally { btn.innerText = "✨ Générer"; btn.disabled = false; }
}