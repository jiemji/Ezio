/**
 * EZIO - DELIVERY CARD WEB COMPONENT
 * <ezio-delivery-card> - Self-contained delivery module card.
 * Encapsulates rendering, config UI, and internal events.
 *
 * Properties:
 *   .config  - Set { instance, idx, context } to render the card
 *
 * Events (bubble to parent):
 *   'card-generate'       - { idx }
 *   'card-move'           - { idx, direction }
 *   'card-remove'         - { idx }
 *   'card-config-change'  - { idx, config }
 *
 * Methods:
 *   .getEditor()  - Returns the inner <ezio-markdown-editor> element
 */

import { Utils } from '../core/Utils.js';
import './EzioMarkdownEditor.js';

export class EzioDeliveryCard extends HTMLElement {
    #instance = null;
    #idx = 0;
    #context = null;
    #rendered = false;
    #debouncedConfigChange = null;
    #eventsBound = false;

    constructor() {
        super();
        // No Shadow DOM — inherit global CSS
        this.#debouncedConfigChange = Utils.debounce(() => {
            this.#emitConfigChange();
        }, 500);
    }

    // --- Public API ---

    set config({ instance, idx, context }) {
        this.#instance = instance;
        this.#idx = idx;
        this.#context = context;
        this.#render();
    }

    get config() {
        return { instance: this.#instance, idx: this.#idx, context: this.#context };
    }

    /** Returns the inner <ezio-markdown-editor> for external manipulation (e.g. generateModule) */
    getEditor() {
        return this.querySelector('ezio-markdown-editor');
    }

    // --- Rendering ---

    #render() {
        if (!this.#instance || !this.#context) return;

        const inst = this.#instance;
        const idx = this.#idx;
        const { availableModels, availableModules, currentForm, hierarchy, totalInstances } = this.#context;

        // Note: #bindEvents moved to connectedCallback to prevent duplicates
        const sourceModName = inst.name || ((availableModules || []).find(m => m.id === inst.sourceId) || { name: 'Module' }).name;

        // Ensure config defaults
        if (!inst.config) inst.config = {};
        if (!inst.config.ai) inst.config.ai = {};
        if (!inst.config.scope) inst.config.scope = { type: 'global', selection: [] };
        if (!inst.config.columns) {
            inst.config.columns = (currentForm.columns || []).map(c => c.id);
        }
        if (!inst.config.widgets) {
            inst.config.widgets = [];
        }

        const aiPrompt = inst.config.ai.prompt || '';
        const aiModel = inst.config.ai.model || '';
        const scopeType = inst.config.scope.type || 'global';
        const isCollapsed = inst.config.collapsed || false;

        this.className = `dlv-card ${isCollapsed ? 'collapsed' : ''}`;
        this.dataset.idx = idx;

        this.innerHTML = `
            <div class="dlv-card-header">
                 <div class="dlv-card-nav">
                    ${idx > 0 ? `<button class="btn-card-action btn-move-left" title="Reculer">&lt;</button>` : ''}
                    <span style="font-weight:bold; font-size:0.9rem;">${idx + 1}. ${Utils.escapeHtml(sourceModName)}</span>
                    ${idx < totalInstances - 1 ? `<button class="btn-card-action btn-move-right" title="Avancer">&gt;</button>` : ''}
                 </div>
                 <div class="dlv-card-actions">
                    <button class="btn-card-action danger btn-remove-mod" title="Retirer du livrable">🗑️</button>
                 </div>
            </div>
            <div class="dlv-card-content">
                <div class="dlv-card-footer">
                     <button class="btn-primary small btn-generate">Tester / Générer</button>
                     <ezio-markdown-editor editor-id="dlv-editor-${idx}" min-height="300px" data-value="${Utils.escapeHtml(inst.result || '')}"></ezio-markdown-editor>
                </div>
                <div class="dlv-card-separator" title="${isCollapsed ? 'Déplier' : 'Replier'} la configuration">
                    <div class="dlv-separator-label">CONFIGURATION ${isCollapsed ? '▶' : '◀'}</div>
                </div>
                <div class="dlv-card-body ${isCollapsed ? 'collapsed' : ''}">
                    <div class="dlv-card-body-content">
                        <div class="form-group" style="margin-bottom:5px;">
                            <label style="margin-bottom:0;">Scope (Périmètre)</label>
                        </div>
                        
                        <div class="dlv-inputs-wrapper" style="${isCollapsed ? 'display:none;' : ''}">
                            <select class="form-control slc-inst-scope">
                                <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                                <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                            </select>

                            ${this.#renderChapterSelector(scopeType, hierarchy, inst.config.scope.selection || [])}

                            <div class="form-group" style="margin-top:1rem;">
                                <label>Colonnes à inclure</label>
                                ${this.#renderColumnSelector(inst.config.columns, currentForm)}
                            </div>

                            <div class="form-group" style="display:flex; align-items:center; margin-top:10px;">
                                <input type="checkbox" class="chk-format-table" ${inst.config.isTable ? 'checked' : ''} id="chkTable_${idx}" style="margin-right:8px;">
                                <label for="chkTable_${idx}" style="margin-bottom:0; cursor:pointer;">Tableau (Format de sortie)</label>
                            </div>

                            <div class="form-group" style="margin-top:10px;">
                                <label>Widgets Dashboard (Export Document)</label>
                                ${this.#renderWidgetSelector(inst.config.widgets, currentForm)}
                            </div>

                            <div class="form-group">
                                <label>Prompt IA</label>
                                <textarea class="form-control txt-inst-prompt" rows="5">${Utils.escapeHtml(aiPrompt)}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Agent IA</label>
                                <select class="form-control slc-inst-model">
                                    <option value="">-- Défaut --</option>
                                    ${availableModels.map(m => `<option value="${m.nom}" ${m.nom === aiModel ? 'selected' : ''}>${m.nom}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.#rendered = true;
    }

    connectedCallback() {
        if (this.#eventsBound) return;
        this.#bindEvents();
        this.#eventsBound = true;
    }

    // --- Sub-renderers (migrated from DeliveriesRenderer) ---

    #renderChapterSelector(scopeType, hierarchy, selection) {
        if (scopeType !== 'chapter') return '';
        let html = `<div class="chapter-selector-container">`;

        hierarchy.forEach((chap) => {
            const allChecked = chap.subs.every(s => selection.includes(s));
            html += `
                <div class="chap-item">
                    <label style="font-weight:bold; display:flex; align-items:center;">
                        <input type="checkbox" class="chk-chapter" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                        ${Utils.escapeHtml(chap.name)}
                    </label>
                    <div class="sub-list" style="margin-left: 20px;">
            `;

            chap.subs.forEach(sub => {
                const isChecked = selection.includes(sub);
                html += `
                    <label style="display:flex; align-items:center; font-size:0.9em;">
                        <input type="checkbox" class="chk-subchap" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
                        ${Utils.escapeHtml(sub)}
                    </label>
                `;
            });

            html += `</div></div>`;
        });

        html += `</div>`;
        return html;
    }

    #renderColumnSelector(selectedCols, currentForm) {
        let html = `<div class="chapter-selector-container" style="max-height:150px;">`;

        (currentForm.columns || []).forEach(col => {
            const isChecked = selectedCols.includes(col.id);
            html += `
                <label style="display:flex; align-items:center; margin-bottom:5px;">
                    <input type="checkbox" class="chk-col" data-colid="${col.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                    ${Utils.escapeHtml(col.label)}
                </label>
            `;
        });

        html += `</div>`;
        return html;
    }

    #renderWidgetSelector(selectedWidgets, currentForm) {
        if (!currentForm.statics || currentForm.statics.length === 0) {
            return `<div style="font-size: 0.85em; color: var(--text-muted); padding: 5px;">Aucun widget configuré dans le tableau de bord.</div>`;
        }

        let html = `<div class="chapter-selector-container" style="max-height:150px;">`;

        currentForm.statics.forEach((widget, wIdx) => {
            const isChecked = selectedWidgets.includes(widget.id);
            const colDef = (currentForm.columns || []).find(c => c.id === widget.columnId);
            const label = colDef ? colDef.label : `Widget ${wIdx + 1}`;
            html += `
                <label style="display:flex; align-items:center; margin-bottom:5px;">
                    <input type="checkbox" class="chk-widget" data-widgetid="${widget.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                    ${Utils.escapeHtml(label)} (${Utils.escapeHtml(widget.vizType)})
                </label>
            `;
        });

        html += `</div>`;
        return html;
    }

    // --- Internal event binding ---

    #bindEvents() {
        // CLICK delegation
        this.addEventListener('click', (e) => {
            const target = e.target;

            // Move left
            if (target.closest('.btn-move-left')) {
                this.#emit('card-move', { idx: this.#idx, direction: -1 });
                return;
            }

            // Move right
            if (target.closest('.btn-move-right')) {
                this.#emit('card-move', { idx: this.#idx, direction: 1 });
                return;
            }

            // Remove
            if (target.closest('.btn-remove-mod')) {
                this.#emit('card-remove', { idx: this.#idx });
                return;
            }

            // Generate
            if (target.closest('.btn-generate')) {
                this.#emit('card-generate', { idx: this.#idx });
                return;
            }

            // Toggle collapse
            const separator = target.closest('.dlv-card-separator');
            
            if (separator) {
                const isCollapsedNow = this.#instance.config.collapsed;
                this.#instance.config.collapsed = !isCollapsedNow;

                this.#render();
                this.#emitConfigChange();
                return;
            }
        });

        // CHANGE delegation (selects + checkboxes)
        this.addEventListener('change', (e) => {
            const target = e.target;

            // Skip <ezio-markdown-editor> change events — those bubble up directly
            if (target.closest('ezio-markdown-editor') || e.detail?.markdown !== undefined) return;

            // Scope type
            if (target.classList.contains('slc-inst-scope')) {
                this.#instance.config.scope.type = target.value;
                if (target.value === 'global') {
                    this.#instance.config.scope.selection = [];
                }
                this.#emitConfigChange();
                // Need full re-render to show/hide chapter selector
                this.#render();
                return;
            }

            // AI Model
            if (target.classList.contains('slc-inst-model')) {
                this.#instance.config.ai.model = target.value;
                this.#emitConfigChange();
                return;
            }

            // Prompt (final save on change)
            if (target.classList.contains('txt-inst-prompt')) {
                this.#instance.config.ai.prompt = target.value;
                this.#emitConfigChange();
                return;
            }

            // Format table checkbox
            if (target.classList.contains('chk-format-table')) {
                this.#instance.config.isTable = target.checked;
                this.#emitConfigChange();
                return;
            }

            // Chapter checkbox
            if (target.classList.contains('chk-chapter')) {
                const chapName = target.getAttribute('data-chap');
                const hierarchy = this.#context.hierarchy || [];
                const chap = hierarchy.find(c => c.name === chapName);
                if (!chap) return;

                let sel = this.#instance.config.scope.selection || [];
                if (target.checked) {
                    chap.subs.forEach(s => { if (!sel.includes(s)) sel.push(s); });
                } else {
                    sel = sel.filter(s => !chap.subs.includes(s));
                }
                this.#instance.config.scope.selection = sel;
                this.#emitConfigChange();
                // Re-render to update sub-checkbox visuals
                this.#render();
                return;
            }

            // Sub-chapter checkbox
            if (target.classList.contains('chk-subchap')) {
                const subName = target.getAttribute('data-sub');
                let sel = this.#instance.config.scope.selection || [];
                if (target.checked) {
                    if (!sel.includes(subName)) sel.push(subName);
                } else {
                    sel = sel.filter(s => s !== subName);
                }
                this.#instance.config.scope.selection = sel;
                this.#emitConfigChange();
                return;
            }

            // Column checkbox
            if (target.classList.contains('chk-col')) {
                const colId = target.getAttribute('data-colid');
                let cols = this.#instance.config.columns || [];
                if (target.checked) {
                    if (!cols.includes(colId)) cols.push(colId);
                } else {
                    cols = cols.filter(c => c !== colId);
                }
                this.#instance.config.columns = cols;
                this.#emitConfigChange();
                return;
            }

            // Widget checkbox
            if (target.classList.contains('chk-widget')) {
                const widgetId = target.dataset.widgetid;
                let wList = this.#instance.config.widgets || [];
                if (target.checked) {
                    if (!wList.includes(widgetId)) wList.push(widgetId);
                } else {
                    wList = wList.filter(id => id !== widgetId);
                }
                this.#instance.config.widgets = wList;
                this.#emitConfigChange();
                return;
            }
        });

        // INPUT delegation (debounced prompt)
        this.addEventListener('input', (e) => {
            const target = e.target;
            if (target.classList.contains('txt-inst-prompt')) {
                this.#instance.config.ai.prompt = target.value;
                this.#debouncedConfigChange();
            }
        });
    }

    // --- Event emitters ---

    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    }

    #emitConfigChange() {
        this.#emit('card-config-change', { idx: this.#idx, config: this.#instance.config });
    }
}

customElements.define('ezio-delivery-card', EzioDeliveryCard);
