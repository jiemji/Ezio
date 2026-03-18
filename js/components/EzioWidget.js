import { initWidgetChart, destroyWidgetChart } from '../modules/WidgetRenderer.js';
import { currentForm } from '../core/State.js';

export class EzioWidget extends HTMLElement {
    constructor() {
        super();
        this.widgetDef = null;
        this.chartInitialized = false;
        // Unlike EzioToast, we won't use Shadow DOM here to allow global CSS (like Chart.js tooltips)
        // and easy styling from style.css, but we will encapsulate the HTML structure.
    }

    // Called when the element is inserted into the DOM
    connectedCallback() {
        if (!this.widgetDef) return;
        this.render();
    }

    // Called when the element is removed from the DOM
    disconnectedCallback() {
        if (this.widgetDef && this.chartInitialized) {
            destroyWidgetChart(this.widgetDef.id);
            this.chartInitialized = false;
        }
    }

    set config(widget) {
        this.widgetDef = widget;
        // Reactivity: if config changes after being added to DOM, re-render
        if (this.isConnected) {
            this.render();
        }
    }

    get config() {
        return this.widgetDef;
    }

    render() {
        // Build internal HTML structure
        this.dataset.id = this.widgetDef.id;
        this.className = 'widget-card';
        if (this.widgetDef.vizType === 'cross_stacked') {
            this.classList.add('widget-wide');
        } else {
            this.classList.remove('widget-wide');
        }

        // Clean up old chart if any (though usually we replace the whole node or update directly)
        if (this.chartInitialized) {
            destroyWidgetChart(this.widgetDef.id);
            this.chartInitialized = false;
        }

        // We use innerHTML but it's isolated to this component's logic
        this.innerHTML = `
            <div class="widget-header">
                <h3>${this.escapeHtml(this.widgetDef.title)}</h3>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon btn-edit" title="Modifier">⚙️</button>
                    <button class="btn-icon danger btn-delete" title="Supprimer">🗑️</button>
                </div>
            </div>
            <div class="canvas-container" style="flex: 1; position: relative; min-height: ${this.classList.contains('widget-wide') ? '350px' : '250px'}; padding: 10px;">
                <canvas></canvas>
            </div>
        `;

        // Bind Events
        this.querySelector('.btn-edit').addEventListener('click', () => {
            // Dispatch a standard custom event that app_dashboard can listen to
            this.dispatchEvent(new CustomEvent('edit-widget', { detail: { id: this.widgetDef.id }, bubbles: true }));
        });

        this.querySelector('.btn-delete').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('delete-widget', { detail: { id: this.widgetDef.id }, bubbles: true }));
        });

        // Initialize Chart.js safely using the existing external Renderer module
        // We pass 'this' as the card container
        initWidgetChart(this.widgetDef, this, currentForm);
        this.chartInitialized = true;
    }

    escapeHtml(unsafe) {
        return (unsafe || '').replace(/[&<"'>]/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
}

customElements.define('ezio-widget', EzioWidget);
