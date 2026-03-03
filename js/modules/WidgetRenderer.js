import { prepareChartConfig } from './WidgetDataTransformer.js';

let chartsMap = new Map(); // Store chart instances by widget ID

/**
 * Initializes a new Chart.js chart for a widget
 * @param {Object} widget - The widget configuration
 * @param {HTMLElement} card - The DOM element containing the tracking card and canvas
 * @param {Object} currentForm - The application state (columns, rows)
 */
export function initWidgetChart(widget, card, currentForm) {
    const canvas = card.querySelector('canvas');
    if (!canvas) return;

    const config = prepareChartConfig(widget, currentForm.columns, currentForm.rows);
    if (config && window.Chart) {
        const chart = new window.Chart(canvas, config);
        chartsMap.set(widget.id, chart);
    } else {
        const container = canvas.parentElement;
        container.innerHTML = "<div style='text-align:center; margin-top:50px; color:red'>Erreur: Impossible de créer le graphique</div>";
    }
}

/**
 * Updates an existing widget chart with new data or config
 * @param {Object} widget - The widget configuration
 * @param {Object} currentForm - The application state
 */
export function updateWidgetChart(widget, currentForm) {
    const chart = chartsMap.get(widget.id);
    if (!chart) return;

    const newConfig = prepareChartConfig(widget, currentForm.columns, currentForm.rows);
    if (!newConfig) return;

    // Check if type changed (requires destroy/recreate)
    if (chart.config.type !== newConfig.type) {
        chart.destroy();
        const card = document.querySelector(`.widget-card[data-id="${widget.id}"]`);
        if (card) initWidgetChart(widget, card, currentForm);
        return;
    }

    // Update data and options
    chart.data = newConfig.data;
    chart.options = newConfig.options;
    chart.update();
}

/**
 * Destroys a chart to free memory
 * @param {String} widgetId 
 */
export function destroyWidgetChart(widgetId) {
    if (chartsMap.has(widgetId)) {
        chartsMap.get(widgetId).destroy();
        chartsMap.delete(widgetId);
    }
}

/**
 * Destroys all charts rendering on the dashboard
 */
export function clearAllCharts() {
    chartsMap.forEach(chart => chart.destroy());
    chartsMap.clear();
}

/**
 * Generates a Base64 image of a widget for export.
 * @param {Object} widget - The widget definition
 * @param {Object} currentForm - The application state needed to build the config
 * @returns {Promise<String|null>} The image as a base64 data URI
 */
export async function exportWidgetImage(widget, currentForm) {
    if (!widget) return null;

    const config = prepareChartConfig(widget, currentForm.columns, currentForm.rows);
    if (!config || !window.Chart) return null;

    // Disable animations for immediate render and force fixed sizes
    config.options.animation = false;
    config.options.responsive = false;
    config.options.maintainAspectRatio = false;

    // Force opaque white background instead of transparent
    if (!config.options.plugins) config.options.plugins = {};
    config.options.plugins.customCanvasBackgroundColor = { color: 'white' };

    // Create ghost container
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

    return new Promise((resolve) => {
        config.options.animation = {
            duration: 0,
            onComplete: function () {
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
