/**
 * EZIO - MARKDOWN EDITOR WEB COMPONENT
 * <ezio-markdown-editor> - Autonomous Rich Text Editor that converts to/from Markdown.
 * Encapsulates toolbar, formatting actions, and AI tools internally.
 *
 * Attributes:
 *   editor-id   - Unique ID for the editor (required)
 *   compact     - If present, renders smaller buttons
 *   min-height  - CSS min-height for the editor area (default: '300px')
 *
 * Properties:
 *   .value           - Get/Set Markdown content (auto-converts HTML↔MD)
 *   .htmlContent     - Get/Set raw HTML content
 *   .extraToolbarHtml - HTML string to prepend inside the toolbar
 *
 * Events:
 *   'change' - Dispatched on blur and after AI tool validation
 *              detail: { markdown: string, html: string }
 */

import { Utils } from '../core/Utils.js';
import { MarkdownUtils } from '../core/MarkdownUtils.js';
import { Modal } from '../ui/Modal.js';
import { ApiService } from '../api/api_ia.js';
import { currentForm } from '../core/State.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';

export class EzioMarkdownEditor extends HTMLElement {
    #editorEl = null;
    #rendered = false;
    #pendingValue = null;
    #pendingExtraToolbar = '';

    static get observedAttributes() {
        return ['editor-id', 'compact', 'min-height', 'data-value'];
    }

    constructor() {
        super();
        // No Shadow DOM — inherit global CSS (needed for execCommand too)
    }

    // --- Public API ---

    /** Get Markdown content (converts internal HTML to Markdown) */
    get value() {
        if (!this.#editorEl) return this.#pendingValue || '';
        return MarkdownUtils.htmlToMarkdown(this.#editorEl.innerHTML);
    }

    /** Set Markdown content (parses to HTML and displays) */
    set value(md) {
        if (!this.#editorEl) {
            this.#pendingValue = md;
            return;
        }
        this.#editorEl.innerHTML = this.#parseMarkdown(md);
    }

    /** Get raw HTML content */
    get htmlContent() {
        return this.#editorEl ? this.#editorEl.innerHTML : '';
    }

    /** Set raw HTML content directly */
    set htmlContent(html) {
        if (this.#editorEl) {
            this.#editorEl.innerHTML = html;
        }
    }

    /** Extra toolbar HTML to prepend before standard buttons */
    get extraToolbarHtml() {
        return this.#pendingExtraToolbar;
    }

    set extraToolbarHtml(html) {
        this.#pendingExtraToolbar = html || '';
        // Re-render if already connected
        if (this.#rendered && this.isConnected) {
            this.#render();
        }
    }

    // --- Lifecycle ---

    connectedCallback() {
        if (!this.#rendered) {
            // Read declarative attributes before first render
            if (this.#pendingExtraToolbar === '' && this.dataset.extraToolbar) {
                this.#pendingExtraToolbar = this.dataset.extraToolbar;
            }
            if (this.#pendingValue === null && this.dataset.value !== undefined) {
                this.#pendingValue = this.dataset.value;
            }
            this.#render();
        }
    }

    attributeChangedCallback() {
        if (this.#rendered && this.isConnected) {
            this.#render();
        }
    }

    // --- Internal rendering ---

    #render() {
        const editorId = this.getAttribute('editor-id') || `ezio-md-${Date.now()}`;
        const compact = this.hasAttribute('compact');
        const minHeight = this.getAttribute('min-height') || '300px';

        const btnStyle = compact
            ? 'padding: 2px 4px; font-size: 0.75rem; border-radius: 2px;'
            : 'padding: 4px 6px; font-size: 0.85rem; border-radius: 3px;';
        const iconStyle = compact ? 'font-size: 0.85em;' : '';
        const toolbarMargin = compact ? '5px' : '15px';

        // Preserve current content if re-rendering
        const previousContent = this.#editorEl ? this.#editorEl.innerHTML : null;

        this.innerHTML = `
            <style>
                #${editorId} h3 { font-weight: bold; text-decoration: underline; }
                #${editorId} h4 { font-weight: bold; }
                #${editorId} h5 { font-size: inherit; font-weight: normal; text-decoration: underline; }
            </style>
            <div class="dlv-md-toolbar" style="margin-top: ${toolbarMargin}; display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                 ${this.#pendingExtraToolbar}
                 <button class="btn-secondary small btn-md-ai-tool" title="Outils IA" style="${btnStyle} color: var(--primary); border-color: var(--primary);"><i class="fas fa-magic" style="${iconStyle}"></i></button>
                 <div class="separator-vertical" style="height: 18px; margin: 0 2px;"></div>
                 <button class="btn-secondary small btn-md-format" data-action="p" title="Paragraphe normal" style="${btnStyle}"><b>N</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h3" title="Titre 3" style="${btnStyle}"><b>T3</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h4" title="Titre 4" style="${btnStyle}"><b>T4</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h5" title="Titre 5" style="${btnStyle}"><b>T5</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-down" title="Désindenter" style="${btnStyle}"><i class="fas fa-outdent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-up" title="Indenter" style="${btnStyle}"><i class="fas fa-indent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="list-num" title="Liste numérotée" style="${btnStyle}"><i class="fas fa-list-ol" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="bold" title="Gras" style="${btnStyle}"><b>G</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="underline" title="Souligné" style="${btnStyle}"><u>S</u></button>
            </div>
            <div class="dlv-card-result form-control markdown-editor-content" id="${editorId}" contenteditable="true"
                 style="min-height: ${minHeight}; height: ${minHeight}; box-sizing: border-box; overflow-y: auto; overflow-x: auto; margin-top: 5px; text-align: left; resize: vertical; outline: none; border: 1px solid var(--border); border-radius: 4px; padding: 10px;"></div>
        `;

        this.#editorEl = this.querySelector(`#${editorId}`);

        // Restore or set initial content
        if (previousContent !== null) {
            this.#editorEl.innerHTML = previousContent;
        } else if (this.#pendingValue !== null) {
            this.#editorEl.innerHTML = this.#parseMarkdown(this.#pendingValue);
            this.#pendingValue = null;
        }

        this.#bindEvents();
        this.#rendered = true;
    }

    // --- Event binding (internal — no delegation needed by consumers) ---

    #bindEvents() {
        // FORMAT buttons — click delegation on toolbar
        const toolbar = this.querySelector('.dlv-md-toolbar');
        if (toolbar) {
            toolbar.addEventListener('click', (e) => {
                const btnFormat = e.target.closest('.btn-md-format');
                if (btnFormat) {
                    e.stopPropagation();
                    const action = btnFormat.getAttribute('data-action');
                    this.#handleFormatAction(action);
                    this.#emitChange();
                    return;
                }

                const btnAI = e.target.closest('.btn-md-ai-tool');
                if (btnAI) {
                    e.stopPropagation();
                    this.#openAIToolsModal();
                    return;
                }
            });
        }

        // BLUR — save on focus lost
        if (this.#editorEl) {
            this.#editorEl.addEventListener('blur', () => {
                this.#emitChange();
            });
        }
    }

    // --- Format actions (moved from old MarkdownEditor.handleFormatAction) ---

    #handleFormatAction(action) {
        if (!this.#editorEl) return;
        this.#editorEl.focus();

        if (action === 'bold') {
            document.execCommand('bold', false, null);
        } else if (['p', 'h3', 'h4', 'h5'].includes(action)) {
            document.execCommand('formatBlock', false, '<' + action.toUpperCase() + '>');
        } else if (action === 'underline') {
            document.execCommand('underline', false, null);
        } else if (action === 'indent-up') {
            const isList = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList');
            if (isList) {
                document.execCommand('indent', false, null);
            } else {
                document.execCommand('insertUnorderedList', false, null);
            }
        } else if (action === 'indent-down') {
            document.execCommand('outdent', false, null);
        } else if (action === 'list-num') {
            document.execCommand('insertOrderedList', false, null);
        }
    }

    // --- AI Tools Modal (moved from old MarkdownEditor.openAIToolsModal) ---

    async #openAIToolsModal() {
        if (!this.#editorEl) return;

        // Fetch models
        let modelsData = [];
        try {
            const res = await fetch('config/models.json');
            if (res.ok) modelsData = await res.json();
        } catch (e) { /* ignore */ }

        const toolModels = modelsData.filter(m => m.outil === true);

        if (toolModels.length === 0) {
            alert("Aucun modèle configuré comme outil IA.");
            return;
        }

        const selectOptions = toolModels.map(m =>
            `<option value="${m.nom}">${Utils.escapeHtml(m.nom)} (${Utils.escapeHtml(m.provider)})</option>`
        ).join('');

        const currentText = this.#editorEl.innerText || "";

        const content = `
            <style>
                #modalAITools .modal-content { width: 75vw; max-width: 1400px; height: 75vh; display: flex; flex-direction: column; }
                #modalAITools .modal-body { flex: 1; display: flex; flex-direction: column; gap: 15px; overflow: hidden; margin-top: 10px; }
                .ai-tools-layout { display: flex; gap: 15px; flex: 1; overflow: hidden; }
                .ai-tools-col { flex: 1; display: flex; flex-direction: column; }
                .ai-tools-col label { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; color: var(--text-muted); }
                .ai-tools-col textarea { flex: 1; resize: none; overflow-y: auto; padding: 10px; border: 1px solid var(--border); border-radius: 4px; font-family: inherit; font-size: 0.95em; line-height: 1.4; outline: none; background: var(--bg-color); color: var(--text-main); }
                .ai-tools-col textarea::placeholder { color: var(--text-muted); opacity: 0.7; }
            </style>

            <div style="display: flex; gap: 10px; align-items: flex-end;">
                <div style="flex: 1;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; font-size:0.9em; color:var(--text-muted);">Sélectionnez l'outil</label>
                    <select id="slcAITool" class="form-control" style="width: 100%;">
                        ${selectOptions}
                    </select>
                </div>
                <button id="btnRunAITool" class="btn-primary" style="padding: 8px 15px; height: 38px;">✨ Générer</button>
            </div>

            <div class="ai-tools-layout">
                <div class="ai-tools-col">
                    <label>Texte de la cellule</label>
                    <textarea id="aiToolInput">${Utils.escapeHtml(currentText)}</textarea>
                </div>
                <div class="ai-tools-col">
                    <label>Résultat IA</label>
                    <textarea id="aiToolOutput" placeholder="Le résultat de l'IA s'affichera ici..."></textarea>
                </div>
            </div>
        `;

        const modal = new Modal('modalAITools', '🛠️ Outils IA', content, [
            { label: 'Annuler', class: 'btn-secondary', onClick: (e, m) => m.close() },
            {
                label: 'Valider', class: 'btn-primary', onClick: (e, m) => {
                    const outputArea = document.getElementById('aiToolOutput');
                    if (outputArea && outputArea.value.trim() !== '') {
                        const newText = outputArea.value;
                        this.#editorEl.innerHTML = window.marked ? window.marked.parse(newText) : newText;
                        this.#emitChange();
                    }
                    m.close();
                }
            }
        ]);

        modal.render();

        // Bind generate button
        setTimeout(() => {
            const btnRun = document.getElementById('btnRunAITool');
            if (btnRun) {
                btnRun.onclick = async () => {
                    const slc = document.getElementById('slcAITool');
                    const inputArea = document.getElementById('aiToolInput');
                    const outputArea = document.getElementById('aiToolOutput');

                    if (!slc || !inputArea || !outputArea) return;

                    const selectedModelName = slc.value;
                    const modelConfig = toolModels.find(m => m.nom === selectedModelName);
                    if (!modelConfig) return;

                    const textToProcess = inputArea.value;
                    if (!textToProcess || textToProcess.trim() === '') {
                        alert("Le texte source est vide.");
                        return;
                    }

                    const originalBtnText = btnRun.innerHTML;
                    btnRun.innerHTML = `<span class="rpt-loading">↻</span> En cours...`;
                    btnRun.disabled = true;
                    outputArea.value = "Génération en cours...";

                    try {
                        const messages = [
                            { role: 'system', content: modelConfig.prompt || "Agis comme un expert." },
                            { role: 'user', content: [modelConfig.prompt || "Applique ton traitement sur ce texte:", textToProcess] }
                        ];

                        const response = await ApiService.fetchLLM(modelConfig, messages);
                        outputArea.value = response;
                    } catch (error) {
                        console.error("AI Tool Error", error);
                        outputArea.value = "Erreur: " + error.message;
                    } finally {
                        btnRun.innerHTML = originalBtnText;
                        btnRun.disabled = false;
                    }
                };
            }
        }, 100);
    }

    // --- Helpers ---

    #parseMarkdown(md) {
        if (!md) return '';
        if (!window.marked) return md;

        let parsed = window.marked.parse(md);

        // Transformation des macros {{KPI:id}} en widgets visuels non-éditables complets
        parsed = parsed.replace(/\{\{KPI:([^}]+)\}\}/g, (match, id) => {
             return `<div contenteditable="false" style="margin: 20px 0; padding: 10px; background: var(--bg-secondary); border-radius: 8px; user-select: none; display: block; overflow: hidden; max-height: 450px;"><ezio-widget data-id="${id}" readonly="true"></ezio-widget></div>`;
        });

        // Transformation des macros {{DATATABLE:config}} en Tableaux non-éditables complets
        parsed = parsed.replace(/\{\{DATATABLE:([A-Za-z0-9+/=]+)\}\}/g, (match, b64Config) => {
             try {
                 const configStr = decodeURIComponent(atob(b64Config));
                 const config = JSON.parse(configStr);
                 let mdTable = AIContextBuilder.buildTable(config.scope, config.columns, currentForm);
                 let htmlTable = window.marked.parse(mdTable);
                 // Nettoyage car marked.js peut rajouter des sauts de lignes inutiles
                 htmlTable = htmlTable.replace(/>\n\s*</g, '><').trim();
                 return `<div contenteditable="false" class="datatable-placeholder" data-config="${b64Config}" style="margin: 20px 0; border: 1px solid var(--border); background:var(--bg-secondary); padding:10px; border-radius:8px; max-height:450px; overflow-y:auto; overflow-x:auto;">
                    <div style="font-weight:bold; color:var(--text-main); margin-bottom:10px;">📊 Table de données (${config.scope && config.scope.type === 'global' ? 'Global' : 'Par Chapitre'})</div>
                    ${htmlTable}
                 </div>`;
             } catch(e) {
                 return `<div contenteditable="false" class="datatable-placeholder" style="color:var(--danger); margin:10px 0; padding:10px; border:1px solid var(--danger);">[Table de données invalide]</div>`;
             }
        });

        // Transformation des macros {{SYNTHESE:config}} en bloc IA non-éditable
        parsed = parsed.replace(/\{\{SYNTHESE:([A-Za-z0-9+/=]+)\}\}/g, (match, b64Config) => {
             try {
                 const configStr = decodeURIComponent(atob(b64Config));
                 const config = JSON.parse(configStr);
                 let htmlResult = window.marked.parse(config.result || "Aucun résultat généré.");
                 return `<div contenteditable="false" class="synthese-placeholder" data-config="${b64Config}" style="margin: 20px 0; border: 2px solid var(--primary-color); border-left-width: 6px; background:var(--bg-color); padding:15px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--border);">
                        <span style="font-weight:bold; color:var(--primary-color); font-size:1.1em;">✨ Synthèse IA</span>
                        <span style="font-size:0.8em; color:var(--text-muted); background:var(--bg-secondary); padding:2px 8px; border-radius:12px;">Modèle : ${Utils.escapeHtml(config.model)}</span>
                    </div>
                    <div class="synthese-content" style="color:var(--text-main); opacity:0.9;">
                        ${htmlResult}
                    </div>
                 </div>`;
             } catch(e) {
                 return `<div contenteditable="false" class="synthese-placeholder" style="color:var(--danger); margin:10px 0; padding:10px; border:1px solid var(--danger);">[Bloc Synthèse invalide]</div>`;
             }
        });

        // Clean up visual line breaks injected by marked.js
        parsed = parsed.replace(/>\n\s*</g, '><').trim();
        parsed = parsed.replace(/\n<\/p>/g, '</p>').replace(/<br>\n/g, '<br>');
        return parsed;
    }

    #emitChange() {
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            detail: {
                markdown: this.value,
                html: this.htmlContent
            }
        }));
    }
}

customElements.define('ezio-markdown-editor', EzioMarkdownEditor);
