import { store, currentForm } from '../core/State.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { Utils } from '../core/Utils.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { Modal } from '../ui/Modal.js';
import { initWidgetChart, updateWidgetChart, destroyWidgetChart, clearAllCharts, exportWidgetImage } from './WidgetRenderer.js';

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
        clearAllCharts();
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
            destroyWidgetChart(id);
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
            initWidgetChart(widget, card, currentForm);
        } else {
            // Update Existing Code (Order check?)
            // If we want to support reordering, we should append child again to move it to end?
            // dashboardGrid.appendChild(card); // This moves it to the end, ensuring order matches array

            // Update Chart Data
            updateWidgetChart(widget, currentForm);
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

/**
 * Télécharge les images des widgets sélectionnés pour un livrable donné
 * @param {Object} delivery 
 */
export async function downloadDeliveryWidgets(delivery) {
    let order = 1;
    for (const inst of delivery.structure) {
        if (inst.config && inst.config.widgets && inst.config.widgets.length > 0) {
            for (const wId of inst.config.widgets) {
                const widgetDef = (currentForm?.statics || []).find(w => w.id === wId);
                const b64Data = widgetDef ? await exportWidgetImage(widgetDef, currentForm) : null;
                if (b64Data) {
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

