import { Utils } from '../core/Utils.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';
import { currentForm } from '../core/State.js';

/**
 * EZIO - DELIVERY BLOCK WEB COMPONENT
 * <ezio-delivery-block> - Represents a single card/block in the Deliveries V2 module.
 * 
 * Properties:
 *   .data - Get/Set the block object { id, type, content, config, widgetId, title... }
 * 
 * Events:
 *   'block-delete' - Triigered when trash icon is clicked
 *   'block-config' - Triggered when settings icon is clicked
 *   'block-refresh' - Triggered when refresh icon is clicked (Synthèse)
 *   'block-change' - Triggered when the block content changes (Text/Synthese)
 */
export class EzioDeliveryBlock extends HTMLElement {
    #data = null;
    #rendered = false;
    #editorEl = null;

    constructor() {
        super();
    }

    get data() {
        // Prepare current payload
        const payload = { ...this.#data };
        if (this.#editorEl && (payload.type === 'text' || payload.type === 'synthese')) {
            if (payload.type === 'text') payload.content = this.#editorEl.value;
            if (payload.type === 'synthese') payload.content = this.#editorEl.value; // AI gen result is editable
        }
        return payload;
    }

    set data(val) {
        this.#data = val;
        // Si c'est monté, on render. Sinon connectedCallback s'en chargera.
        if (this.isConnected) {
            this.#render();
        }
    }

    connectedCallback() {
        if (!this.#rendered && this.#data) {
            this.#render();
        }
    }

    #render() {
        if (!this.#data) return;

        const { id, type, content, config, widgetId } = this.#data;
        let titleBlock = this.#data.title || 'Bloc';
        let bodyHtml = '';

        if (type === 'text') {
            titleBlock = titleBlock !== 'Bloc' ? titleBlock : 'Texte Libre';
            bodyHtml = `<ezio-markdown-editor id="md-${id}" editor-id="ed-${id}" toolbar-position="left" min-height="200px" style="display:block; width:100%;"></ezio-markdown-editor>`;
        } else if (type === 'kpi') {
            const widgetDef = currentForm.statics?.find(w => w.id === widgetId);
            titleBlock = titleBlock !== 'Bloc' ? titleBlock : (widgetDef ? `Graphique : ${widgetDef.title}` : 'Graphique inconnu');
            if (widgetDef) {
                // Ensure proper height for KPI cards
                bodyHtml = `<div style="height: 350px; position:relative; padding:10px; box-sizing:border-box;"><ezio-widget data-id="${widgetId}" readonly="true"></ezio-widget></div>`;
            } else {
                bodyHtml = `<div style="padding:20px; color:var(--danger); text-align:center;">Graphique introuvable ou supprimé.</div>`;
            }
        } else if (type === 'synthese') {
            titleBlock = titleBlock !== 'Bloc' ? titleBlock : '✨ Synthèse IA';
            const modelBadge = config?.model ? `<span style="font-size:0.7em; font-weight:normal; background:var(--bg-secondary); padding:2px 8px; border-radius:10px; color:var(--text-muted); margin-left:10px;">Modèle : ${Utils.escapeHtml(config.model)}</span>` : '';
            bodyHtml = `<ezio-markdown-editor id="md-${id}" editor-id="ed-${id}" toolbar-position="left" min-height="250px" style="display:block; width:100%; margin-top:10px;"></ezio-markdown-editor>`;
            titleBlock += modelBadge;
        } else if (type === 'datatable') {
            titleBlock = titleBlock !== 'Bloc' ? titleBlock : 'Tableau de Données';
            const mdTable = config ? AIContextBuilder.buildTable(config.scope, config.columns, currentForm) : '';
            if (mdTable) {
                let htmlTable = window.marked ? window.marked.parse(mdTable) : mdTable;
                htmlTable = htmlTable.replace(/>\n\s*</g, '><').trim();
                bodyHtml = `<div class="block-datatable" style="max-height:400px; overflow:auto; border:1px solid var(--border); border-radius:4px; margin-top:10px;">${htmlTable}</div>`;
            } else {
                bodyHtml = `<div style="padding:20px; color:var(--text-muted); text-align:center;">Tableau vide. Vérifiez la configuration.</div>`;
            }
        }

        const isTextType = type === 'text';
        
        let actionsHtml = `
            ${type === 'synthese' ? '<button class="btn-icon small btn-refresh" title="Relancer la génération">↻</button>' : ''}
            ${!isTextType ? '<button class="btn-icon small btn-config" title="Paramètres">⚙️</button>' : ''}
            <button class="btn-icon danger small btn-delete" title="Supprimer">🗑️</button>
        `;

        this.innerHTML = `
            <div class="dlv-block-card" style="background: var(--bg-color); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Header -->
                <div class="dlv-block-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 1rem; display:flex; align-items:center;">
                        <span style="cursor:grab; opacity:0.5; margin-right:10px;" title="Glisser pour déplacer">⋮⋮</span>
                        ${titleBlock}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        ${actionsHtml}
                    </div>
                </div>
                <!-- Body -->
                <div class="dlv-block-body" style="padding: ${type === 'text' || type === 'synthese' ? '15px' : '0'}; display: flex; flex-direction: column;">
                    ${bodyHtml}
                </div>
            </div>
        `;

        this.#bindEvents();

        // Si c'est un éditeur Markdown, on injecte la valeur initiale après création
        if (type === 'text' || type === 'synthese') {
            this.#editorEl = this.querySelector(`#md-${id}`);
            if (this.#editorEl) {
                // Pour la synthèse, on met config.result s'il existe (compatibilité legacy ou IA) 
                // mais le conteneur principal sera géré par 'content'.
                this.#editorEl.value = (content !== undefined) ? content : (config?.result || '');
            }
        }

        this.#rendered = true;
    }

    #bindEvents() {
        const btnDelete = this.querySelector('.btn-delete');
        const btnConfig = this.querySelector('.btn-config');
        const btnRefresh = this.querySelector('.btn-refresh');

        if (btnDelete) btnDelete.addEventListener('click', () => this.dispatchEvent(new CustomEvent('block-delete', { detail: { id: this.#data.id } })));
        if (btnConfig) btnConfig.addEventListener('click', () => this.dispatchEvent(new CustomEvent('block-config', { detail: { id: this.#data.id } })));
        if (btnRefresh) btnRefresh.addEventListener('click', () => this.dispatchEvent(new CustomEvent('block-refresh', { detail: { id: this.#data.id } })));

        if (this.#data.type === 'text' || this.#data.type === 'synthese') {
            const editorEl = this.querySelector(`#md-${this.#data.id}`);
            if (editorEl) {
                editorEl.addEventListener('change', (e) => {
                     e.stopPropagation();
                     // Màj de l'état interne
                     if (this.#data.type === 'text') this.#data.content = e.detail.markdown;
                     if (this.#data.type === 'synthese') {
                         this.#data.content = e.detail.markdown;
                         if (this.#data.config) this.#data.config.result = e.detail.markdown; // sync double
                     }
                     this.dispatchEvent(new CustomEvent('block-change', { detail: { id: this.#data.id } }));
                });
            }
        }
    }
}

customElements.define('ezio-delivery-block', EzioDeliveryBlock);
