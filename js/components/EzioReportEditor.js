/**
 * EZIO - REPORT EDITOR WEB COMPONENT
 * <ezio-report-editor> - Self-contained editor for reports and modules.
 * Handles report template editing (module list + reorder) and module config editing.
 *
 * Properties:
 *   .config - Set { selection, data, availableModels } to render
 *
 * Events (bubble to parent):
 *   'report-add-module'    - { }
 *   'report-delete'        - { }
 *   'report-move-module'   - { index, direction }
 *   'report-remove-module' - { index }
 *   'report-name-change'   - { name }
 *   'module-delete'        - { }
 *   'module-update'        - { name, type, scopeType, aiModel, aiPrompt }
 */

import { Utils } from '../core/Utils.js';

export class EzioReportEditor extends HTMLElement {
    #selection = null;
    #data = null;
    #availableModels = [];

    constructor() {
        super();
    }

    // --- Public API ---

    set config({ selection, data, availableModels }) {
        this.#selection = selection;
        this.#data = data;
        this.#availableModels = availableModels || [];
        this.#render();
    }

    // --- Rendering ---

    #render() {
        if (!this.#selection?.id) {
            this.innerHTML = `
                <div class="reports-empty-state">
                    <p>Sélectionnez un rapport ou un module pour commencer.</p>
                </div>`;
            return;
        }

        if (this.#selection.type === 'report') {
            this.#renderReportEditor();
        } else if (this.#selection.type === 'module') {
            this.#renderModuleEditor();
        }

        this.#bindEvents();
    }

    #renderReportEditor() {
        const { report, modules } = this.#data;
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

        this.innerHTML = headerHTML + `<div class="rpt-editor-body vertical">${listHTML}</div>`;
    }

    #renderModuleEditor() {
        const { module } = this.#data;
        if (!module) return;

        const config = module.config || {};
        const ai = config.ai || {};
        const scope = config.scope || {};

        const scopeType = scope.type || 'global';
        const aiModel = ai.model || '';
        const aiPrompt = ai.prompt || '';

        const modelOptions = this.#availableModels.map(m =>
            `<option value="${m.nom}" ${m.nom === aiModel ? 'selected' : ''}>${m.nom} (${m.provider})</option>`
        ).join('');

        this.innerHTML = `
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
                    <label>Agent IA</label>
                    <select class="slc-mod-link-model form-control">
                        <option value="">-- Choisir un agent --</option>
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
    }

    // --- Internal event binding ---

    #bindEvents() {
        // CLICK delegation
        this.addEventListener('click', (e) => {
            const target = e.target;

            if (target.classList.contains('btn-add-mod-to-rpt')) {
                this.#emit('report-add-module', {});
                return;
            }
            if (target.classList.contains('btn-delete-report')) {
                this.#emit('report-delete', {});
                return;
            }
            if (target.classList.contains('btn-move-up')) {
                this.#emit('report-move-module', { index: parseInt(target.dataset.idx), direction: -1 });
                return;
            }
            if (target.classList.contains('btn-move-down')) {
                this.#emit('report-move-module', { index: parseInt(target.dataset.idx), direction: 1 });
                return;
            }
            if (target.classList.contains('btn-remove-mod')) {
                this.#emit('report-remove-module', { index: parseInt(target.dataset.idx) });
                return;
            }
            if (target.classList.contains('btn-delete-module')) {
                this.#emit('module-delete', {});
                return;
            }
        });

        // CHANGE delegation
        this.addEventListener('change', (e) => {
            const target = e.target;

            // Report name
            if (target.classList.contains('inp-rpt-name')) {
                this.#emit('report-name-change', { name: target.value });
                return;
            }

            // Module fields — collect and emit all at once
            if (target.classList.contains('inp-mod-name') ||
                target.classList.contains('slc-mod-type') ||
                target.classList.contains('slc-mod-scope') ||
                target.classList.contains('slc-mod-link-model') ||
                target.classList.contains('txt-mod-prompt')
            ) {
                this.#emitModuleUpdate();
                return;
            }
        });
    }

    #emitModuleUpdate() {
        const modData = {
            name: this.querySelector('.inp-mod-name')?.value || '',
            type: this.querySelector('.slc-mod-type')?.value || 'analysis',
            scopeType: this.querySelector('.slc-mod-scope')?.value || 'global',
            aiModel: this.querySelector('.slc-mod-link-model')?.value || '',
            aiPrompt: this.querySelector('.txt-mod-prompt')?.value || ''
        };
        this.#emit('module-update', modData);
    }

    // --- Event emitter ---

    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    }
}

customElements.define('ezio-report-editor', EzioReportEditor);
