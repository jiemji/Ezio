/**
 * EZIO - REPORTS RENDERER
 * Handles the generation of HTML and event delegation for the Reports and Modules views.
 */

import { Utils } from '../core/Utils.js';

export const ReportsRenderer = {
    /**
     * Render the main editor view for either a Report or a Module
     * @param {HTMLElement} container - The DOM element to render into
     * @param {Object} context - The context containing data and actions
     */
    render: (container, context) => {
        if (!container) return;

        const { selection, data, actions, availableModels } = context;

        if (!selection.id) {
            container.innerHTML = `
                <div class="reports-empty-state">
                    <p>Sélectionnez un rapport ou un module pour commencer.</p>
                </div>`;
            return;
        }

        if (selection.type === 'report') {
            ReportsRenderer._renderReportEditor(container, data, actions);
        } else if (selection.type === 'module') {
            ReportsRenderer._renderModuleEditor(container, data, actions, availableModels);
        }

        // Setup Event Delegation
        ReportsRenderer._setupEventDelegation(container, actions);
    },

    _renderReportEditor: (container, data, actions) => {
        const { report, modules } = data;
        if (!report) return;

        const headerHTML = `
            <div class="rpt-editor-header">
                <input type="text" class="inp-rpt-name form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${Utils.escapeHtml(report.name)}">
                <div class="rpt-actions">
                    <button class="btn-primary small btn-add-mod-to-rpt">+ Ajouter un module</button>
                    ${report.deletable !== false ? `<button class="btn-danger small btn-delete-report" style="margin-left:10px;">🗑️</button>` : ''}
                </div>
            </div>
        `;

        let listHTML = `<div class="rpt-vertical-list">`;
        if (!report.structure || report.structure.length === 0) {
            listHTML += `<div style="padding:2rem; color:var(--text-muted);">Ce modèle est vide. Ajoutez des modules.</div>`;
        } else {
            report.structure.forEach((inst, idx) => {
                const sourceMod = modules.find(m => m.id === inst.sourceId) || { name: 'Module Inconnu', type: '?' };
                listHTML += `
                    <div class="rpt-template-item">
                        <span class="rpt-template-idx">${idx + 1}.</span>
                        <span class="rpt-template-name">${Utils.escapeHtml(sourceMod.name)}</span>
                        <div class="rpt-template-actions">
                             ${idx > 0 ? `<button class="btn-icon-action btn-move-up" data-idx="${idx}" title="Monter">▲</button>` : ''}
                             ${idx < report.structure.length - 1 ? `<button class="btn-icon-action btn-move-down" data-idx="${idx}" title="Descendre">▼</button>` : ''}
                             <button class="btn-icon-action danger btn-remove-mod" data-idx="${idx}" title="Retirer">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }
        listHTML += `</div>`;

        container.innerHTML = headerHTML + `<div class="rpt-editor-body vertical">${listHTML}</div>`;
    },

    _renderModuleEditor: (container, data, actions, availableModels) => {
        const { module } = data;
        if (!module) return;

        // Ensure defaults exist for rendering (they are forced in controller, but safer here)
        const config = module.config || {};
        const ai = config.ai || {};
        const scope = config.scope || {};

        const scopeType = scope.type || 'global';
        const aiModel = ai.model || '';
        const aiPrompt = ai.prompt || '';

        const modelOptions = availableModels.map(m =>
            `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom} (${m.provider})</option>`
        ).join('');

        container.innerHTML = `
            <div class="editor-container" style="padding: 2rem; max-width: 900px; margin: 0 auto;">
                <header style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <label class="form-label" style="display:block; color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Nom du module (Bibliothèque)</label>
                    <input type="text" class="inp-mod-name form-control" style="font-size: 1.5rem; font-weight: bold; width: 100%;" value="${Utils.escapeHtml(module.name)}">
                </header>

                <div class="form-row">
                    <div class="form-col">
                        <div class="form-group">
                            <label>Type</label>
                            <select class="slc-mod-type form-control">
                                <option value="analysis" ${module.type === 'analysis' ? 'selected' : ''}>Analyse IA</option>
                                <option value="raw" ${module.type === 'raw' ? 'selected' : ''}>Données Brutes</option>
                            </select>
                        </div>
                    </div>
                     <div class="form-col">
                        <div class="form-group">
                            <label>Portée (Scope)</label>
                            <select class="slc-mod-scope form-control">
                                <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Global</option>
                                <option value="chapter" ${scopeType === 'chapter' ? 'selected' : ''}>Chapitre Spécifique</option>
                            </select>
                        </div>
                    </div>
                </div>

                <hr style="margin: 2rem 0; border:0; border-top:1px solid var(--border);">

                <h3>Configuration par défaut</h3>
                <p class="text-muted" style="margin-bottom:1rem; font-size:0.9rem;">Ces réglages seront appliqués par défaut lorsque vous ajoutez ce module un à rapport.</p>

                <div class="form-group">
                    <label>Modèle IA</label>
                    <select class="slc-mod-link-model form-control">
                        <option value="">-- Choisir un modèle --</option>
                        ${modelOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>Prompt / Instructions</label>
                    <textarea class="txt-mod-prompt form-control" rows="8" placeholder="Instructions pour l'IA... (ex: Analyse les risques...)">${Utils.escapeHtml(aiPrompt)}</textarea>
                </div>

                <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                     ${module.deletable !== false ? `<button class="btn-danger btn-delete-module">Supprimer ce module</button>` : ''}
                </div>
            </div>
        `;
    },

    _setupEventDelegation: (container, actions) => {
        // Clear previous event listeners if any to avoid stacking
        container.onclick = null;
        container.onchange = null;
        container.oninput = null;

        container.onclick = (e) => {
            const target = e.target;

            // Report Actions
            if (target.classList.contains('btn-add-mod-to-rpt')) {
                actions.onAddModuleToReport();
                return;
            }
            if (target.classList.contains('btn-delete-report')) {
                actions.onDeleteReport();
                return;
            }
            if (target.classList.contains('btn-move-up')) {
                actions.onMoveModule(parseInt(target.dataset.idx), -1);
                return;
            }
            if (target.classList.contains('btn-move-down')) {
                actions.onMoveModule(parseInt(target.dataset.idx), 1);
                return;
            }
            if (target.classList.contains('btn-remove-mod')) {
                actions.onRemoveModule(parseInt(target.dataset.idx));
                return;
            }

            // Module Actions
            if (target.classList.contains('btn-delete-module')) {
                actions.onDeleteModule();
                return;
            }
        };

        // Handle typing directly for inputs that should autosave (names)
        container.onchange = (e) => {
            const target = e.target;

            // Report Name
            if (target.classList.contains('inp-rpt-name')) {
                actions.onUpdateReportName(target.value);
                return;
            }

            // Module Fields
            if (target.classList.contains('inp-mod-name') ||
                target.classList.contains('slc-mod-type') ||
                target.classList.contains('slc-mod-scope') ||
                target.classList.contains('slc-mod-link-model') ||
                target.classList.contains('txt-mod-prompt')
            ) {
                // Collect all values at once
                const modData = {
                    name: container.querySelector('.inp-mod-name').value,
                    type: container.querySelector('.slc-mod-type').value,
                    scopeType: container.querySelector('.slc-mod-scope').value,
                    aiModel: container.querySelector('.slc-mod-link-model').value,
                    aiPrompt: container.querySelector('.txt-mod-prompt').value
                };
                actions.onUpdateModule(modData);
                return;
            }
        };
    }
};
