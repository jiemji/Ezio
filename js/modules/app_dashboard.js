import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { Modal } from '../ui/Modal.js';

let chartsMap = new Map(); // Store chart instances by widget ID

export function initDashboard() {
    if (window.Chart && window.ChartDataLabels) {
        window.Chart.register(window.ChartDataLabels);
    }
    registerModuleInit('dashboard', renderDashboard);

    const btnAddWidget = document.getElementById('btnAddWidget');

    if (btnAddWidget) {
        btnAddWidget.onclick = () => {
            showWidgetModal();
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

function showWidgetModal(widgetId = null) {
    const isEdit = !!widgetId;
    const widget = isEdit
        ? currentForm.statics.find(w => w.id === widgetId)
        : { vizType: 'global_pie', title: 'Nouveau Graphique', showLabels: true };

    if (isEdit && !widget) return;

    const validCols = currentForm.columns.filter(c => c.type !== 'info' && c.type !== 'separator');
    if (validCols.length === 0) {
        return UI.showToast("Aucune colonne disponible pour générer un graphique.", "warning");
    }

    const colOptions = validCols.map(c => `<option value="${c.id}" ${widget.columnId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.label)}</option>`).join('');

    // Cross columns can be any valid column
    const crossCols = validCols;
    const crossOptions = `<option value="">-- Aucun croisement --</option>` +
        crossCols.map(c => `<option value="${c.id}" ${widget.crossColumnId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.label)}</option>`).join('');

    const html = `
        <div class="form-group mb-3">
            <label>Titre du graphique</label>
            <input type="text" id="wdgTitle" class="form-control" value="${Utils.escapeHtml(widget.title || '')}" placeholder="Titre...">
        </div>
        <div class="form-group mb-3">
            <label>Axe Principal (Donnée à compter)</label>
            <select id="wdgMainCol" class="form-control">
                ${!isEdit ? '<option value="">-- Choisir une colonne --</option>' : ''}
                ${colOptions}
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Axe Secondaire (Croisement optionnel)</label>
            <select id="wdgCrossCol" class="form-control">
                ${crossOptions}
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Format Visuel</label>
            <select id="wdgVizType" class="form-control">
                <!-- Populated dynamically based on crosscol -->
            </select>
        </div>
        <div class="form-group mb-3" style="display:flex; align-items:center;">
            <input type="checkbox" id="wdgShowLabels" ${widget.showLabels !== false ? 'checked' : ''} style="margin-right:8px; transform: scale(1.2);">
            <label for="wdgShowLabels" style="margin:0; cursor:pointer; margin-right:15px;">Afficher les valeurs</label>
            
            <select id="wdgValueFormat" class="form-control" style="width: auto; display: inline-block; padding: 0.2rem 0.5rem; height: auto;">
                <option value="raw" ${widget.valueFormat !== 'percent' ? 'selected' : ''}>Valeur Brute</option>
                <option value="percent" ${widget.valueFormat === 'percent' ? 'selected' : ''}>Pourcentage (%)</option>
            </select>
        </div>
    `;

    const modal = new Modal('widgetConfigModal', isEdit ? 'Modifier le Graphique' : 'Nouveau Graphique', html, [
        { label: 'Annuler', class: 'btn-secondary', onClick: (e, m) => m.close() },
        { label: isEdit ? 'Enregistrer' : 'Créer', class: 'btn-primary', onClick: (e, m) => saveWidgetConfig(m, widgetId) }
    ]);

    modal.render();

    const mainColSel = document.getElementById('wdgMainCol');
    const crossColSel = document.getElementById('wdgCrossCol');
    const vizTypeSel = document.getElementById('wdgVizType');

    const updateVizOptions = () => {
        const hasCross = !!crossColSel.value;
        const currentViz = isEdit && !vizTypeSel.value ? widget.vizType : vizTypeSel.value;

        vizTypeSel.innerHTML = '';
        if (hasCross) {
            vizTypeSel.innerHTML = `
                <option value="cross_stacked" ${currentViz === 'cross_stacked' ? 'selected' : ''}>Barres Empilées</option>
                <option value="cross_grouped" ${currentViz === 'cross_grouped' ? 'selected' : ''}>Barres Groupées</option>
            `;
        } else {
            vizTypeSel.innerHTML = `
                <option value="global_pie" ${currentViz === 'global_pie' ? 'selected' : ''}>Camembert (Pie)</option>
                <option value="global_doughnut" ${currentViz === 'global_doughnut' ? 'selected' : ''}>Anneau (Donut)</option>
                <option value="global_bar" ${currentViz === 'global_bar' ? 'selected' : ''}>Histogramme (Barres Verticales)</option>
            `;
        }
    };

    crossColSel.addEventListener('change', updateVizOptions);
    updateVizOptions();

    // Auto title if empty
    if (!isEdit) {
        mainColSel.addEventListener('change', () => {
            const titleInp = document.getElementById('wdgTitle');
            if (!titleInp.value || titleInp.value === 'Nouveau Graphique') {
                const col = currentForm.columns.find(c => c.id === mainColSel.value);
                if (col) titleInp.value = `Analyse: ${col.label}`;
            }
        });
    }
}

function saveWidgetConfig(modal, existingId) {
    const title = document.getElementById('wdgTitle').value.trim();
    const columnId = document.getElementById('wdgMainCol').value;
    const crossColumnId = document.getElementById('wdgCrossCol').value;
    const vizType = document.getElementById('wdgVizType').value;
    const showLabels = document.getElementById('wdgShowLabels').checked;
    const valueFormat = document.getElementById('wdgValueFormat').value;

    if (!columnId) return UI.showToast("Veuillez choisir un axe principal.", "warning");

    if (!currentForm.statics) currentForm.statics = [];

    if (existingId) {
        const w = currentForm.statics.find(w => w.id === existingId);
        if (w) {
            w.title = title || 'Graphique';
            w.columnId = columnId;
            w.crossColumnId = crossColumnId;
            w.vizType = vizType;
            w.showLabels = showLabels;
            w.valueFormat = valueFormat;
        }
    } else {
        currentForm.statics.push({
            id: `widget_${Date.now()}`,
            title: title || 'Graphique',
            columnId,
            crossColumnId,
            vizType,
            showLabels,
            valueFormat
        });
    }

    store.save();
    renderDashboard();
    modal.close();
}

function renderDashboard() {

    const dashboardGrid = document.getElementById('dashboardGrid');
    if (!dashboardGrid) return;

    if (!currentForm.statics || currentForm.statics.length === 0) {
        dashboardGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem; border:2px dashed var(--border); border-radius:8px;">
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

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-icon';
    btnEdit.innerHTML = '⚙️';
    btnEdit.onclick = () => showWidgetModal(widget.id);

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

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '5px';
    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDel);
    header.appendChild(actionsDiv);
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
    const colMain = currentForm.columns.find(c => c.id === widget.columnId);
    if (!colMain) return null;

    const mainIdx = currentForm.columns.findIndex(c => c.id === widget.columnId);
    const rows = currentForm.rows || [];

    let mainOptions = colMain.params?.options || [];
    if (mainOptions.length === 0 && rows.length > 0) {
        mainOptions = [...new Set(rows.map(r => r[mainIdx] || "Non défini"))];
    }

    const vizType = widget.vizType;

    const showLabels = widget.showLabels !== false;
    const isPercent = widget.valueFormat === 'percent';

    // Configuration par défaut pour chartjs-plugin-datalabels
    const datalabelsConfig = {
        display: showLabels,
        color: '#000', // Noir pour plus de lisibilité sur les fonds colorés
        font: { weight: 'bold', size: 13 },
        formatter: (value, context) => {
            if (value === 0) return '';
            if (isPercent) {
                let total = 0;
                if (vizType.startsWith('cross_')) {
                    context.chart.data.datasets.forEach(ds => {
                        total += ds.data[context.dataIndex] || 0;
                    });
                } else {
                    const dataset = context.chart.data.datasets[context.datasetIndex];
                    total = dataset.data.reduce((acc, val) => acc + (val || 0), 0);
                }
                if (total === 0) return '';
                const percentage = Math.round((value / total) * 100);
                return percentage + '%';
            }
            return value;
        }
    };

    if (vizType.startsWith('cross_')) {
        const crossIdx = currentForm.columns.findIndex(c => c.id === widget.crossColumnId);
        if (crossIdx === -1) return null;

        const crossCol = currentForm.columns[crossIdx];
        const isStacked = vizType === 'cross_stacked';

        let crossValues = [];
        if (crossCol.params?.options) {
            crossValues = [...crossCol.params.options];
            const actualValues = new Set(rows.map(r => r[crossIdx] || "Non défini"));
            actualValues.forEach(v => { if (!crossValues.includes(v)) crossValues.push(v); });
        } else {
            crossValues = [...new Set(rows.map(r => r[crossIdx] || "Non défini"))];
        }

        const datasets = mainOptions.map((mainOpt, idx) => {
            let data = crossValues.map(crossVal => {
                return rows.filter(r => (r[crossIdx] || "Non défini") === crossVal && r[mainIdx] === mainOpt).length;
            });

            if (isPercent) {
                data = data.map((val, dataIdx) => {
                    let totalForCrossValue = 0;
                    mainOptions.forEach(opt => {
                        totalForCrossValue += rows.filter(r => (r[crossIdx] || "Non défini") === crossValues[dataIdx] && r[mainIdx] === opt).length;
                    });
                    return totalForCrossValue > 0 ? Math.round((val / totalForCrossValue) * 100) : 0;
                });
            }

            return {
                label: mainOpt,
                data: data,
                backgroundColor: Utils.getComboColor(colMain.params?.colorScheme, mainOpt, mainOptions) || getColorByIndex(idx)
            };
        });

        return {
            type: 'bar',
            data: { labels: crossValues, datasets: datasets },
            options: {
                indexAxis: 'y', // horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: isStacked,
                        beginAtZero: true,
                        max: isPercent ? 100 : undefined,
                        ticks: {
                            callback: function (value) {
                                return isPercent ? value + '%' : value;
                            }
                        }
                    },
                    y: { stacked: isStacked }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: datalabelsConfig
                }
            }
        };
    }

    if (vizType.startsWith('global_')) {
        const counts = {};
        rows.forEach(r => {
            const val = r[mainIdx] || "Non défini";
            counts[val] = (counts[val] || 0) + 1;
        });

        const labels = mainOptions.length > 0
            ? mainOptions.filter(o => counts[o])
            : Object.keys(counts);

        Object.keys(counts).forEach(k => { if (!labels.includes(k)) labels.push(k); });

        const data = labels.map(l => counts[l] || 0);
        const colors = labels.map((l, idx) => Utils.getComboColor(colMain.params?.colorScheme, l, mainOptions) || getColorByIndex(idx));

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
                plugins: {
                    legend: { position: type === 'bar' ? 'none' : 'right' },
                    datalabels: datalabelsConfig
                }
            }
        };
    }
    return null;
}

function getColorByIndex(i) {
    const palette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
    return palette[i % palette.length];
}

/**
 * Génère l'image Base64 d'un widget pour l'export.
 * @param {String} widgetId 
 * @returns {Promise<String|null>} L'image en data URI Base64
 */
export async function exportWidgetImage(widgetId) {
    const widget = currentForm.statics.find(w => w.id === widgetId);
    if (!widget) return null;

    const config = prepareChartConfig(widget);
    if (!config || !window.Chart) return null;

    // Désactiver toutes les animations pour un rendu immédiat et forcer une taille fixe
    config.options.animation = false;
    config.options.responsive = false;
    config.options.maintainAspectRatio = false;

    // Forcer un fond blanc opaque si non défini, car canvas transparent -> fond noir / moche dans docx/pptx
    if (!config.options.plugins) config.options.plugins = {};
    config.options.plugins.customCanvasBackgroundColor = { color: 'white' };

    // Créer un conteneur fantôme dans le DOM pour forcer le rendu Chart.js
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.height = widget.vizType === 'cross_stacked' ? '500px' : '400px';

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = widget.vizType === 'cross_stacked' ? 500 : 400;
    container.appendChild(canvas);
    document.body.appendChild(container);

    // Plugin local pour forcer le fond
    const pluginBg = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart, args, options) => {
            const { ctx } = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#ffffff';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };

    config.plugins = [pluginBg];

    // On englobe dans une promise pour s'assurer que le chart.js a fini de dessiner
    return new Promise((resolve) => {
        // Remplacer l'option `animation: false` par un objet avec durée 0 et un callback
        config.options.animation = {
            duration: 0,
            onComplete: function () {
                // Attente d'un frame supplémentaire pour le rendu canvas (sécurité docx)
                requestAnimationFrame(() => {
                    const b64 = chart.toBase64Image('image/png', 1.0);
                    chart.destroy();
                    if (document.body.contains(container)) {
                        document.body.removeChild(container);
                    }
                    resolve(b64);
                });
            }
        };

        const chart = new window.Chart(canvas, config);
    });
}

/**
 * Télécharge les images des widgets sélectionnés pour un livrable donné
 * @param {Object} delivery 
 */
export async function downloadDeliveryWidgets(delivery) {
    let order = 1;
    for (const inst of delivery.structure) {
        if (inst.config && inst.config.widgets && inst.config.widgets.length > 0) {
            for (const wId of inst.config.widgets) {
                const b64Data = await exportWidgetImage(wId);
                if (b64Data) {
                    const widgetDef = (currentForm?.statics || []).find(w => w.id === wId);
                    const widgetTitle = widgetDef ? widgetDef.title : "Graphique";

                    // Nettoyer les noms pour les fichiers
                    const safeModuleTitle = (inst.name || "Module").replace(/[^a-z0-9\u00C0-\u017F]/gi, '_');
                    const safeWidgetTitle = widgetTitle.replace(/[^a-z0-9\u00C0-\u017F]/gi, '_');

                    const fileName = `${order}_${safeModuleTitle}_${safeWidgetTitle}.png`;

                    const a = document.createElement('a');
                    a.href = b64Data;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Petit délai pour laisser le navigateur souffler entre deux téléchargements
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        }
        order++;
    }
}

