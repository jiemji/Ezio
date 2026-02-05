/**
 * EZIO - MODULE AUDIT
 * Gère l'affichage du formulaire, la sidebar, les interactions utilisateur,
 * le tri par colonne et le filtrage.
 */

let activeFilters = { chapter: null, subChapter: null };
let columnFilters = {}; 
let currentSort = { colIndex: -1, direction: 'asc' }; 
let currentSearch = ""; 

const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');
const searchInput = document.getElementById('searchInput');
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');

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
                    activeFilters = { chapter: null, subChapter: null };
                    renderApp();
                }
            } catch (err) { alert("Erreur JSON : " + err.message); }
        };
        reader.readAsText(file);
    };
}

function renderApp() {
    if (!currentForm.columns.length) return;
    if (sidebar) {
        sidebar.classList.remove('hidden');
        renderSidebar();
    }
    renderTable();
}

function renderTable() {
    if (!currentForm.columns.length) return;
    tableContainer.innerHTML = '';
    const table = document.createElement('table');
    
    // 1. HEADER
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    currentForm.columns.forEach((col, idx) => {
        const th = document.createElement('th');
        th.textContent = col.name;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 2. BODY
    const tbody = document.createElement('tbody');
    
    // Filtrage simple pour l'exemple
    const filteredRows = currentForm.rows.filter(row => {
        const matchesSidebar = (!activeFilters.chapter || row[0] === activeFilters.chapter);
        return matchesSidebar;
    });

    filteredRows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        row.forEach((cellValue, colIndex) => {
            const td = document.createElement('td');
            const colDef = currentForm.columns[colIndex];

            if (colDef.type === 'qcm') {
                // LOGIQUE DYNAMIQUE : On sépare par \n pour créer les items
                const options = String(cellValue).split('\n').map(s => s.trim()).filter(s => s !== "");
                if (options.length > 0) {
                    const container = document.createElement('div');
                    container.className = "qcm-group";
                    options.forEach((opt, optIdx) => {
                        const label = document.createElement('label');
                        label.style.display = "block";
                        const radio = document.createElement('input');
                        radio.type = "radio";
                        radio.name = `qcm_${rowIndex}_${colIndex}`;
                        radio.value = opt;
                        label.appendChild(radio);
                        label.appendChild(document.createTextNode(" " + opt));
                        container.appendChild(label);
                    });
                    td.appendChild(container);
                } else {
                    td.textContent = cellValue;
                }
            } else if (colDef.type === 'color') {
                td.style.backgroundColor = cellValue;
                td.textContent = cellValue;
            } else {
                td.textContent = cellValue;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
}

function renderSidebar() {
    if (!chapterList) return;
    chapterList.innerHTML = "";
    const chapters = [...new Set(currentForm.rows.map(r => r[0]))];
    chapters.forEach(ch => {
        const li = document.createElement('li');
        li.textContent = ch;
        li.className = activeFilters.chapter === ch ? "active" : "";
        li.onclick = () => {
            activeFilters.chapter = (activeFilters.chapter === ch) ? null : ch;
            renderSidebar();
            renderTable();
        };
        chapterList.appendChild(li);
    });
}