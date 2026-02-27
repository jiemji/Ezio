/**
 * EZIO - MARKDOWN EDITOR
 * Reusable UI component for a Rich Text Editor that converts to/from Markdown.
 * Uses native execCommand for WYSIWYG formatting.
 */

import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';
import { ApiService } from '../api/api_ia.js';

export const MarkdownEditor = {
    /**
     * Renders the HTML for the Markdown Toolbar and Editor
     * @param {string} editorId - Unique ID for the editor div
     * @param {string} content - Initial HTML/Markdown content
     * @param {string|number} index - An optional index/identifier to pass to toolbar buttons (useful for delegation)
     * @param {string} minHeight - CSS min-height for the editor
     * @param {string} minHeight - CSS min-height for the editor
     * @param {boolean} compact - If true, renders smaller buttons and less margin
     * @param {string} extraToolbarHtml - Optional HTML to prepend to the toolbar
     * @returns {string} - HTML string
     */
    render: (editorId, content = '', index = '', minHeight = '300px', compact = false, extraToolbarHtml = '') => {
        // Parse initial content if it's raw markdown
        let parsedContent = content;
        if (content && window.marked) {
            parsedContent = window.marked.parse(content);
            // Nettoyage des sauts de ligne de formatage HTML générés par marked.js.
            // Le "white-space: pre-wrap" de la balise editable affiche littéralement ces \n.
            // Ce regex supprime uniquement ces espaces/retours entre les balises HTML de structure (<p>, <ul>...)
            parsedContent = parsedContent.replace(/>\n\s*</g, '><').trim();
            // Si jamais marked a inséré un \n juste après un simple texte pour faire joli à la fin du block :
            parsedContent = parsedContent.replace(/\n<\/p>/g, '</p>').replace(/<br>\n/g, '<br>');
        }

        const btnStyle = compact ? 'padding: 2px 4px; font-size: 0.75rem; border-radius: 2px;' : 'padding: 4px 6px; font-size: 0.85rem; border-radius: 3px;';
        const iconStyle = compact ? 'font-size: 0.85em;' : '';
        const toolbarMargin = compact ? '5px' : '15px';

        return `
            <div class="dlv-md-toolbar" style="margin-top: ${toolbarMargin}; display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                 ${extraToolbarHtml}
                 <button class="btn-secondary small btn-md-ai-tool" data-idx="${index}" title="Outils IA" style="${btnStyle} color: var(--primary); border-color: var(--primary);"><i class="fas fa-magic" style="${iconStyle}"></i></button>
                 <div class="separator-vertical" style="height: 18px; margin: 0 2px;"></div>
                 <button class="btn-secondary small btn-md-format" data-action="p" data-idx="${index}" title="Paragraphe normal" style="${btnStyle}"><b>N</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h3" data-idx="${index}" title="Titre 3" style="${btnStyle}"><b>T3</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h4" data-idx="${index}" title="Titre 4" style="${btnStyle}"><b>T4</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="h5" data-idx="${index}" title="Titre 5" style="${btnStyle}"><b>T5</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-down" data-idx="${index}" title="Désindenter" style="${btnStyle}"><i class="fas fa-outdent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-up" data-idx="${index}" title="Indenter" style="${btnStyle}"><i class="fas fa-indent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="list-num" data-idx="${index}" title="Liste numérotée" style="${btnStyle}"><i class="fas fa-list-ol" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="bold" data-idx="${index}" title="Gras" style="${btnStyle}"><b>G</b></button>
                 <button class="btn-secondary small btn-md-format" data-action="underline" data-idx="${index}" title="Souligné" style="${btnStyle}"><u>S</u></button>
            </div>
            <div class="dlv-card-result form-control markdown-editor-content" id="${editorId}" contenteditable="true" 
                 style="width: 100%; min-height: ${minHeight}; height: ${minHeight}; box-sizing: border-box; overflow-y: auto; overflow-x: auto; margin-top: 5px; text-align: left; resize: vertical; outline: none; border: 1px solid var(--border); border-radius: 4px; padding: 10px;">${parsedContent}</div>
        `;
    },

    /**
     * Handles standard rich-text formatting actions
     * @param {string} action - The string action ('bold', 'h-up', 'indent-up', etc.)
     * @param {HTMLElement} editorElement - The contenteditable DOM element
     */
    handleFormatAction: (action, editorElement) => {
        if (!editorElement) return;

        editorElement.focus();

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
    },

    /**
     * Opens a modal to generate AI text formatting
     */
    openAIToolsModal: async (editorElement, saveCallback) => {
        if (!editorElement) return;

        // Fetch models
        let modelsData = [];
        try {
            const res = await fetch('config/models.json');
            if (res.ok) modelsData = await res.json();
        } catch (e) { }

        const toolModels = modelsData.filter(m => m.outil === true);

        if (toolModels.length === 0) {
            alert("Aucun modèle configuré comme outil IA.");
            return;
        }

        const selectOptions = toolModels.map(m => `<option value="${m.nom}">${Utils.escapeHtml(m.nom)} (${Utils.escapeHtml(m.provider)})</option>`).join('');
        const currentText = editorElement.innerText || ""; // plain text

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
                        editorElement.innerHTML = window.marked ? window.marked.parse(newText) : newText;
                        if (saveCallback) saveCallback(editorElement.innerHTML);
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
};
