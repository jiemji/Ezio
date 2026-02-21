/**
 * EZIO - DELIVERIES RENDERER
 * Handles the generation of HTML templates for the Deliveries module.
 */

import { Utils } from '../core/Utils.js';
import { MarkdownEditor } from '../ui/MarkdownEditor.js';

export const DeliveriesRenderer = {
    renderCard: (inst, idx, context) => {
        const { availableModels, availableModules, currentForm, hierarchy } = context;

        const sourceModName = inst.name || ((availableModules || []).find(m => m.id === inst.sourceId) || { name: 'Module' }).name;

        if (!inst.config) inst.config = {};
        if (!inst.config.ai) inst.config.ai = {};
        if (!inst.config.scope) inst.config.scope = { type: 'global', selection: [] };

        const aiPrompt = inst.config.ai.prompt || '';
        const aiModel = inst.config.ai.model || '';
        const scopeType = inst.config.scope.type || 'global';

        if (!inst.config.columns) {
            inst.config.columns = (currentForm.columns || []).map(c => c.id);
        }
        if (!inst.config.widgets) {
            inst.config.widgets = [];
        }

        const isCollapsed = inst.config.collapsed || false;
        const totalInstances = context.totalInstances || 0;

        return `
            <div class="dlv-card ${isCollapsed ? 'collapsed' : ''}" data-idx="${idx}">
                <div class="dlv-card-header">
                     <div class="dlv-card-nav">
                        ${idx > 0 ? `<button class="btn-card-action btn-move-left" data-idx="${idx}" title="Reculer">&lt;</button>` : ''}
                        <span style="font-weight:bold; font-size:0.9rem;">${idx + 1}. ${Utils.escapeHtml(sourceModName)}</span>
                        ${idx < totalInstances - 1 ? `<button class="btn-card-action btn-move-right" data-idx="${idx}" title="Avancer">&gt;</button>` : ''}
                     </div>
                     <div class="dlv-card-actions">
                        <button class="btn-card-action danger btn-remove-mod" data-idx="${idx}" title="Retirer du livrable">🗑️</button>
                     </div>
                </div>
                <div class="dlv-card-body">
                    <div class="form-group">
                        <div style="display:flex; align-items:center; margin-bottom:5px;">
                            <label style="margin-bottom:0; margin-right: 10px;">Scope (Périmètre)</label>
                            <button class="btn-toggle-collapse" data-idx="${idx}" title="Replier/Déplier" style="padding:0; border:none; background:none; cursor:pointer;">
                                ${isCollapsed ? '▶' : '▼'}
                            </button>
                        </div>
                        
                        <div class="dlv-inputs-wrapper" style="${isCollapsed ? 'display:none;' : ''}">
                            <select class="form-control slc-inst-scope" data-idx="${idx}">
                                <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global (Tout l'audit)</option>
                                <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Par Chapitre / Sous-chapitre</option>
                            </select>

                            ${DeliveriesRenderer.renderChapterSelector(idx, scopeType, hierarchy, inst.config.scope.selection || [])}

                            <div class="form-group" style="margin-top:1rem;">
                                <label>Colonnes à inclure</label>
                                ${DeliveriesRenderer.renderColumnSelector(idx, inst.config.columns, currentForm)}
                            </div>

                            <div class="form-group" style="display:flex; align-items:center; margin-top:10px;">
                                <input type="checkbox" class="chk-format-table" data-idx="${idx}" ${inst.config.isTable ? 'checked' : ''} id="chkTable_${idx}" style="margin-right:8px;">
                                <label for="chkTable_${idx}" style="margin-bottom:0; cursor:pointer;">Tableau (Format de sortie)</label>
                            </div>

                            <div class="form-group" style="margin-top:10px;">
                                <label>Widgets Dashboard (Export Document)</label>
                                ${DeliveriesRenderer.renderWidgetSelector(idx, inst.config.widgets, currentForm)}
                            </div>

                            <div class="form-group">
                                <label>Prompt IA</label>
                                <textarea class="form-control txt-inst-prompt" data-idx="${idx}" rows="5">${Utils.escapeHtml(aiPrompt)}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Modèle IA</label>
                                <select class="form-control slc-inst-model" data-idx="${idx}">
                                    <option value="">-- Défaut --</option>
                                    ${availableModels.map(m => `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dlv-card-footer">
                     <button class="btn-primary small btn-generate" data-idx="${idx}" style="width:100%;">Tester / Générer</button>
                     ${MarkdownEditor.render(`dlv-editor-${idx}`, inst.result || '', idx, '300px')}
                </div>
            </div>
        `;
    },

    renderChapterSelector: (idx, scopeType, hierarchy, selection) => {
        if (scopeType !== 'chapter') return '';
        let html = `<div class="chapter-selector-container">`;

        hierarchy.forEach((chap) => {
            const allChecked = chap.subs.every(s => selection.includes(s));
            html += `
                <div class="chap-item">
                    <label style="font-weight:bold; display:flex; align-items:center;">
                        <input type="checkbox" class="chk-chapter" data-idx="${idx}" data-chap="${Utils.escapeHtml(chap.name)}" ${allChecked ? 'checked' : ''} style="margin-right:5px;">
                        ${Utils.escapeHtml(chap.name)}
                    </label>
                    <div class="sub-list" style="margin-left: 20px;">
            `;

            chap.subs.forEach(sub => {
                const isChecked = selection.includes(sub);
                html += `
                    <label style="display:flex; align-items:center; font-size:0.9em;">
                        <input type="checkbox" class="chk-subchap" data-idx="${idx}" data-sub="${Utils.escapeHtml(sub)}" ${isChecked ? 'checked' : ''} style="margin-right:5px;">
                        ${Utils.escapeHtml(sub)}
                    </label>
                `;
            });

            html += `</div></div>`;
        });

        html += `</div>`;
        return html;
    },

    renderColumnSelector: (idx, selectedCols, currentForm) => {
        let html = `<div class="chapter-selector-container" style="max-height:150px;">`;

        (currentForm.columns || []).forEach(col => {
            const isChecked = selectedCols.includes(col.id);
            html += `
                <label style="display:flex; align-items:center; margin-bottom:5px;">
                    <input type="checkbox" class="chk-col" data-idx="${idx}" data-colid="${col.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                    ${Utils.escapeHtml(col.label)}
                </label>
            `;
        });

        html += `</div>`;
        return html;
    },

    renderWidgetSelector: (idx, selectedWidgets, currentForm) => {
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
                    <input type="checkbox" class="chk-widget" data-idx="${idx}" data-widgetid="${widget.id}" ${isChecked ? 'checked' : ''} style="margin-right:8px;">
                    ${Utils.escapeHtml(label)} (${Utils.escapeHtml(widget.vizType)})
                </label>
            `;
        });

        html += `</div>`;
        return html;
    }
};
