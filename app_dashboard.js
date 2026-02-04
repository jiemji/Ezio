/**
 * EZIO - MODULE DASHBOARD
 * Gère l'affichage des graphiques.
 * Focus : Analyse des données Combo (Global/Croisé Horizontal) et QCM (Horizontal).
 */

let chartsInstances = [];

// DOM Elements
const btnAddWidget = document.getElementById('btnAddWidget');
const kpiColSelect = document.getElementById('kpiColSelect');
const kpiTypeSelect = document.getElementById('kpiTypeSelect'); 
const dashboardGrid = document.getElementById('dashboardGrid');

// --- 1. INITIALISATION & LISTENERS ---

if (btnAddWidget) {
    btnAddWidget.onclick = () => {
        const colId = kpiColSelect.value;
        const vizType = kpiTypeSelect.value; 

        if (!colId) return alert("Veuillez choisir une colonne.");
        if (!vizType) return alert("Veuillez choisir un format de graphique.");

        const col = currentForm.columns.find(c => c.id === colId);
        if (!col) return;

        if (!currentForm.statics) currentForm.statics = [];
        
        currentForm.statics.push({
            id: `widget_${Date.now()}`,
            columnId: colId,
            vizType: vizType,
            title: `${col.label} - ${getVizLabel(vizType)}`
        });

        saveState();
        renderDashboard();
    };
}

// Adaptation dynamique du Type de Graphique selon la Colonne choisie
if (kpiColSelect) {
    kpiColSelect.onchange = () => {
        const colId = kpiColSelect.value;
        kpiTypeSelect.innerHTML = '<option value="">-- Format --</option>';
        
        if (!colId) return;

        const col = currentForm.columns.find(c => c.id === colId);
        if (!col) return;

        if (col.type === 'combo') {
            // Groupe 1 : Analyse Globale
            const grpGlobal = document.createElement('optgroup');
            grpGlobal.label = "Analyse Globale";
            grpGlobal.appendChild(new Option("Anneau (Donut)", "global_doughnut"));
            grpGlobal.appendChild(new Option("Camembert (Pie)", "global_pie"));
            grpGlobal.appendChild(new Option("Histogramme (Vertical)", "global_bar"));
            kpiTypeSelect.add(grpGlobal);

            // Groupe 2 : Analyse par Chapitre
            const grpCross = document.createElement('optgroup');
            grpCross.label = "Par Chapitre";
            grpCross.appendChild(new Option("Empilement Horizontal", "cross_stacked"));
            kpiTypeSelect.add(grpCross);
        } 
        else if (col.type === 'qcm') {
            // Groupe 3 : QCM
            kpiTypeSelect.add(new Option("Histogramme Horizontal (Top)", "qcm_horizontal"));
        }
    };
}

function getVizLabel(type) {
    if (type.includes('doughnut')) return "Global (Anneau)";
    if (type.includes('pie')) return "Global (Pie)";
    if (type.includes('stacked')) return "Par Chapitre";
    if (type.includes('horizontal')) return "Total (Horizontal)";
    if (type.includes('bar')) return "Global (Barres)";
    return "Analyse";
}

function updateKpiSelectors() {
    if (!kpiColSelect) return;
    const currentVal = kpiColSelect.value;
    
    kpiColSelect.innerHTML = '<option value="">-- Choisir une colonne --</option>';

    // Uniquement les colonnes de données analysables
    if (currentForm && currentForm.columns) {
        currentForm.columns.forEach(col => {
            if (['combo', 'qcm'].includes(col.type)) {
                const opt = document.createElement('option');
                opt.value = col.id;
                opt.innerText = `[${col.type.toUpperCase()}] ${col.label}`;
                kpiColSelect.appendChild(opt);
            }
        });
    }

    if (currentVal) {
        kpiColSelect.value = currentVal;
    } else {
        kpiTypeSelect.innerHTML = '<option value="">-- D\'abord choisir une colonne --</option>';
    }
}

// --- 2. MOTEUR DE RENDU ---

function renderDashboard() {
    updateKpiSelectors(); 

    if (!dashboardGrid) return;
    dashboardGrid.innerHTML = "";
    
    // Nettoyage instances
    chartsInstances.forEach(c => c.destroy());
    chartsInstances = [];

    if (!currentForm.statics || currentForm.statics.length === 0) {
        dashboardGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding: 3rem; border: 2px dashed var(--border); border-radius: 8px;">
            <h3>Tableau de bord vide</h3>
            <p>Sélectionnez une colonne ci-dessus pour générer un graphique.</p>
        </div>`;
        return;
    }

    currentForm.statics.forEach((widget, index) => {
        renderWidget(widget, index);
    });
}

function renderWidget(widget, index) {
    const card = document.createElement('div');
    card.className = 'widget-card';

    // AJOUT: Gestion de la largeur auto pour les graphs horizontaux
    if (widget.vizType === 'cross_stacked' || widget.vizType === 'qcm_horizontal') {
        card.classList.add('widget-wide');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<h3>${widget.title}</h3>`;
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon danger';
    btnDel.innerHTML = '🗑️';
    btnDel.onclick = () => {
        currentForm.statics.splice(index, 1);
        saveState();
        renderDashboard();
    };
    header.appendChild(btnDel);
    card.appendChild(header);

    // Canvas
    const canvasContainer = document.createElement('div');
    canvasContainer.style.flex = "1";
    canvasContainer.style.position = "relative";
    // Hauteur min adaptée pour les horizontaux
    canvasContainer.style.minHeight = card.classList.contains('widget-wide') ? "350px" : "250px"; 
    canvasContainer.style.padding = "10px";
    
    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    card.appendChild(canvasContainer);
    dashboardGrid.appendChild(card);

    // Generation Config
    const config = prepareChartConfig(widget);
    if (config) {
        chartsInstances.push(new Chart(canvas, config));
    } else {
        canvasContainer.innerHTML = "<div style='text-align:center; margin-top:50px; color:red'>Erreur: Colonne introuvable</div>";
    }
}

/**
 * Prépare la configuration Chart.js
 */
function prepareChartConfig(widget) {
    const col = currentForm.columns.find(c => c.id === widget.columnId);
    if (!col) return null;

    const colIndex = currentForm.columns.findIndex(c => c.id === widget.columnId);
    const rows = currentForm.rows;
    const options = col.params?.options || [];
    const vizType = widget.vizType;

    // --- 1. COMBO : CROISÉ PAR CHAPITRE (Stacked Bar HORIZONTAL) ---
    if (vizType === 'cross_stacked') {
        const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
        if (chapIdx === -1) return null;

        const chapters = [...new Set(rows.map(r => r[chapIdx] || "Sans chapitre"))];
        
        const datasets = options.map(opt => {
            const data = chapters.map(chap => {
                return rows.filter(r => (r[chapIdx] || "Sans chapitre") === chap && r[colIndex] === opt).length;
            });
            
            return {
                label: opt,
                data: data,
                backgroundColor: getComboColor(col.params?.colorScheme, opt, options) || '#ccc'
            };
        });

        return {
            type: 'bar',
            data: { labels: chapters, datasets: datasets },
            options: {
                indexAxis: 'y', // Horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, beginAtZero: true },
                    y: { stacked: true }
                },
                plugins: { legend: { position: 'bottom' } }
            }
        };
    }

    // --- 2. COMBO : GLOBAL (Pie, Doughnut, Bar) ---
    if (vizType.startsWith('global_')) {
        const counts = {};
        rows.forEach(r => {
            const val = r[colIndex] || "Non défini";
            counts[val] = (counts[val] || 0) + 1;
        });

        const labels = options.length > 0 
            ? options.filter(o => counts[o]) 
            : Object.keys(counts);
        
        Object.keys(counts).forEach(k => { if (!labels.includes(k)) labels.push(k); });

        const data = labels.map(l => counts[l]);
        const colors = labels.map(l => getComboColor(col.params?.colorScheme, l, options) || getColorByIndex(0));
        
        const type = vizType.split('_')[1]; // pie, doughnut, bar

        return {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Occurrences',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: type === 'bar' ? 'none' : 'right' } }
            }
        };
    }

    // --- 3. QCM : HORIZONTAL BAR (Item Axis Y) ---
    if (vizType === 'qcm_horizontal') {
        const counts = {};
        options.forEach(o => counts[o] = 0);

        rows.forEach(r => {
            const val = r[colIndex];
            if (Array.isArray(val)) {
                val.forEach(item => {
                    if (item.checked) counts[item.label] = (counts[item.label] || 0) + 1;
                });
            }
        });

        const labels = options;
        const data = labels.map(l => counts[l]);
        const color = '#3b82f6'; 

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sélections',
                    data: data,
                    backgroundColor: color,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        };
    }

    return null;
}

function getColorByIndex(i) {
    const palette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
    return palette[i % palette.length];
}