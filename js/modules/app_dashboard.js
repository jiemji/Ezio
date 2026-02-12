import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';

let chartsInstances = [];

export function initDashboard() {
    registerModuleInit('dashboard', renderDashboard);

    const btnAddWidget = document.getElementById('btnAddWidget');
    const kpiColSelect = document.getElementById('kpiColSelect');

    if (btnAddWidget) {
        btnAddWidget.onclick = () => {
            const kpiColSelect = document.getElementById('kpiColSelect');
            const kpiTypeSelect = document.getElementById('kpiTypeSelect');

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

            store.save(); // Direct save
            renderDashboard();
        };
    }

    if (kpiColSelect) {
        kpiColSelect.onchange = () => {
            const kpiTypeSelect = document.getElementById('kpiTypeSelect');
            const colId = kpiColSelect.value;
            kpiTypeSelect.innerHTML = '<option value="">-- Format --</option>';

            if (!colId) return;

            const col = currentForm.columns.find(c => c.id === colId);
            if (!col) return;

            if (col.type === 'combo') {
                const grpGlobal = document.createElement('optgroup');
                grpGlobal.label = "Analyse Globale";
                grpGlobal.appendChild(new Option("Anneau (Donut)", "global_doughnut"));
                grpGlobal.appendChild(new Option("Camembert (Pie)", "global_pie"));
                grpGlobal.appendChild(new Option("Histogramme (Vertical)", "global_bar"));
                kpiTypeSelect.add(grpGlobal);

                const grpCross = document.createElement('optgroup');
                grpCross.label = "Par Chapitre";
                grpCross.appendChild(new Option("Empilement Horizontal", "cross_stacked"));
                kpiTypeSelect.add(grpCross);
            }
        };
    }

    // Subscribe to store updates
    store.subscribe(() => {
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView && !dashboardView.classList.contains('hidden')) {
            renderDashboard();
        }
    });
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
    const kpiColSelect = document.getElementById('kpiColSelect');
    const kpiTypeSelect = document.getElementById('kpiTypeSelect');

    if (!kpiColSelect) return;
    const currentVal = kpiColSelect.value;

    kpiColSelect.innerHTML = '<option value="">-- Choisir une colonne --</option>';

    if (currentForm && currentForm.columns) {
        currentForm.columns.forEach(col => {
            if (['combo'].includes(col.type)) {
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

function renderDashboard() {
    updateKpiSelectors();

    const dashboardGrid = document.getElementById('dashboardGrid');
    if (!dashboardGrid) return;
    dashboardGrid.innerHTML = "";

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
        renderWidget(widget, index, dashboardGrid);
    });
}

function renderWidget(widget, index, container) {
    const card = document.createElement('div');
    card.className = 'widget-card';

    if (widget.vizType === 'cross_stacked') {
        card.classList.add('widget-wide');
    }

    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<h3>${Utils.escapeHtml(widget.title)}</h3>`;

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon danger';
    btnDel.innerHTML = '🗑️';
    btnDel.onclick = () => {
        currentForm.statics.splice(index, 1);
        store.save(); // Direct save
        renderDashboard();
    };
    header.appendChild(btnDel);
    card.appendChild(header);

    const canvasContainer = document.createElement('div');
    canvasContainer.style.flex = "1";
    canvasContainer.style.position = "relative";
    canvasContainer.style.minHeight = card.classList.contains('widget-wide') ? "350px" : "250px";
    canvasContainer.style.padding = "10px";

    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    card.appendChild(canvasContainer);
    container.appendChild(card);

    const config = prepareChartConfig(widget);
    if (config) {
        // Assume Chart is global (loaded via CDN as per Utils/Knowledge)
        if (window.Chart) {
            chartsInstances.push(new window.Chart(canvas, config));
        } else {
            canvasContainer.innerHTML = "Chart.js library not loaded.";
        }
    } else {
        canvasContainer.innerHTML = "<div style='text-align:center; margin-top:50px; color:red'>Erreur: Colonne introuvable</div>";
    }
}

function prepareChartConfig(widget) {
    const col = currentForm.columns.find(c => c.id === widget.columnId);
    if (!col) return null;

    const colIndex = currentForm.columns.findIndex(c => c.id === widget.columnId);
    const rows = currentForm.rows;
    const options = col.params?.options || [];
    const vizType = widget.vizType;

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
                indexAxis: 'y',
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

        const type = vizType.split('_')[1];

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
    return null;
}

function getColorByIndex(i) {
    const palette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
    return palette[i % palette.length];
}

function getComboColor(scheme, value, options) {
    // Re-use logic from app_audit.js or better, move to Utils.js
    // For now, duplicate to avoid cross-module dependency issues if not in Utils
    // Or simpler: move to Utils.js?
    // Let's rely on duplication for speed, as Utils is already refactored.
    // Or better: Use Utils.getComboColor? It is not in Utils.js yet.
    // I will duplicate logic here.

    if (!scheme || !value || !options || options.length === 0) return '';
    const index = options.indexOf(value);
    if (index === -1) return '';
    const fixedSchemes = {
        'alert6': ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#000000'],
        'alert3': ['#22c55e', '#eab308', '#ef4444'],
        'rainbow': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7']
    };
    if (fixedSchemes[scheme]) {
        const colors = fixedSchemes[scheme];
        if (index >= colors.length) return colors[colors.length - 1];
        return colors[index];
    }

    // Gradients
    const baseColors = {
        'blue': '59, 130, 246', 'green': '34, 197, 94', 'red': '239, 68, 68',
        'purple': '168, 85, 247', 'orange': '249, 115, 22', 'yellow': '234, 179, 8'
    };
    const rgb = baseColors[scheme];
    if (rgb) {
        let alpha = 0.9;
        if (options.length > 1) {
            const startAlpha = 0.1; const endAlpha = 0.9;
            const step = (endAlpha - startAlpha) / (options.length - 1);
            alpha = startAlpha + (index * step);
        }
        return `rgba(${rgb}, ${alpha})`;
    }
    return '';
}