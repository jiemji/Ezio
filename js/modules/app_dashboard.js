import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';

let chartsMap = new Map(); // Store chart instances by widget ID

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

            if (!colId) return UI.showToast("Veuillez choisir une colonne.", "warning");
            if (!vizType) return UI.showToast("Veuillez choisir un format de graphique.", "warning");

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

    if (!currentForm.statics || currentForm.statics.length === 0) {
        dashboardGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding: 3rem; border: 2px dashed var(--border); border-radius: 8px;">
            <h3>Tableau de bord vide</h3>
            <p>Sélectionnez une colonne ci-dessus pour générer un graphique.</p>
        </div>`;
        chartsMap.forEach(chart => chart.destroy());
        chartsMap.clear();
        return;
    }

    // Clean up empty state if present
    const emptyState = dashboardGrid.querySelector('div[style*="grid-column: 1/-1"]');
    if (emptyState) dashboardGrid.innerHTML = '';

    const currentIds = currentForm.statics.map(w => w.id);

    // 1. Remove widgets that no longer exist
    Array.from(dashboardGrid.children).forEach(card => {
        const id = card.dataset.id;
        if (!currentIds.includes(id)) {
            // Destroy chart
            if (chartsMap.has(id)) {
                chartsMap.get(id).destroy();
                chartsMap.delete(id);
            }
            // Remove DOM
            card.remove();
        }
    });

    // 2. Add or Update widgets
    currentForm.statics.forEach((widget, index) => {
        let card = dashboardGrid.querySelector(`.widget-card[data-id="${widget.id}"]`);

        if (!card) {
            // New Widget
            card = createWidgetDOM(widget);
            dashboardGrid.appendChild(card);
            // Create Chart
            initWidgetChart(widget, card);
        } else {
            // Update Existing Code (Order check?)
            // If we want to support reordering, we should append child again to move it to end?
            // dashboardGrid.appendChild(card); // This moves it to the end, ensuring order matches array

            // Update Chart Data
            updateWidgetChart(widget);
        }
    });
}

function createWidgetDOM(widget) {
    const card = document.createElement('div');
    card.className = 'widget-card';
    card.dataset.id = widget.id; // Important for diffing

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
        const idx = currentForm.statics.findIndex(w => w.id === widget.id);
        if (idx !== -1) {
            currentForm.statics.splice(idx, 1);
            store.save();
            renderDashboard();
        }
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

    return card;
}

function initWidgetChart(widget, card) {
    const canvas = card.querySelector('canvas');
    if (!canvas) return;

    const config = prepareChartConfig(widget);
    if (config && window.Chart) {
        const chart = new window.Chart(canvas, config);
        chartsMap.set(widget.id, chart);
    } else {
        const container = canvas.parentElement;
        container.innerHTML = "<div style='text-align:center; margin-top:50px; color:red'>Erreur: Impossible de créer le graphique</div>";
    }
}

function updateWidgetChart(widget) {
    const chart = chartsMap.get(widget.id);
    if (!chart) return; // Should not happen if DOM exists

    const newConfig = prepareChartConfig(widget);
    if (!newConfig) return;

    // Check if type changed (requires destroy/recreate)
    if (chart.config.type !== newConfig.type) {
        chart.destroy();
        const card = document.querySelector(`.widget-card[data-id="${widget.id}"]`);
        if (card) initWidgetChart(widget, card);
        return;
    }

    // Update data and options
    chart.data = newConfig.data;
    chart.options = newConfig.options; // In case options changed (e.g. legend)
    chart.update();
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
                backgroundColor: Utils.getComboColor(col.params?.colorScheme, opt, options) || '#ccc'
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
        const colors = labels.map(l => Utils.getComboColor(col.params?.colorScheme, l, options) || getColorByIndex(0));

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

