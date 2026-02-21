/**
 * EZIO - MARKDOWN EDITOR
 * Reusable UI component for a Rich Text Editor that converts to/from Markdown.
 * Uses native execCommand for WYSIWYG formatting.
 */

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
        }

        const btnStyle = compact ? 'padding: 2px 4px; font-size: 0.75rem; border-radius: 2px;' : '';
        const iconStyle = compact ? 'font-size: 0.85em;' : '';
        const toolbarMargin = compact ? '5px' : '15px';

        return `
            <div class="dlv-md-toolbar" style="margin-top: ${toolbarMargin}; display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                 ${extraToolbarHtml}
                 <button class="btn-secondary small btn-md-format" data-action="h-up" data-idx="${index}" title="Niveau de titre +" style="${btnStyle}"><i class="fas fa-heading" style="${iconStyle}"></i> <i class="fas fa-plus" style="font-size:0.7em;"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="h-down" data-idx="${index}" title="Niveau de titre -" style="${btnStyle}"><i class="fas fa-heading" style="${iconStyle}"></i> <i class="fas fa-minus" style="font-size:0.7em;"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-down" data-idx="${index}" title="Désindenter" style="${btnStyle}"><i class="fas fa-outdent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="indent-up" data-idx="${index}" title="Indenter" style="${btnStyle}"><i class="fas fa-indent" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="list-num" data-idx="${index}" title="Liste numérotée" style="${btnStyle}"><i class="fas fa-list-ol" style="${iconStyle}"></i></button>
                 <button class="btn-secondary small btn-md-format" data-action="bold" data-idx="${index}" title="Gras" style="${btnStyle}"><i class="fas fa-bold" style="${iconStyle}"></i></button>
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
        } else if (action === 'h-up' || action === 'h-down') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            let node = selection.focusNode;
            if (!node) return;

            // Find closest block element
            const blockNode = node.nodeType === 3 ? node.parentNode : node;
            const blockWrapper = blockNode.closest('h1, h2, h3, h4, h5, h6, p, div');
            let currentTag = blockWrapper ? blockWrapper.tagName.toLowerCase() : 'p';
            if (currentTag === 'div' || currentTag === 'li') currentTag = 'p';

            let newTag = currentTag;

            if (action === 'h-up') { // [+] Level 2 -> Level 3 -> Level 4 -> Level 4 (Max Level)
                if (currentTag === 'p') newTag = 'h2';
                else if (currentTag === 'h2') newTag = 'h3';
                else if (currentTag === 'h3') newTag = 'h4';
                else if (currentTag === 'h4') newTag = 'h4';
            } else if (action === 'h-down') { // [-] Level 4 -> Level 3 -> Level 2 -> Normal Text 
                if (currentTag === 'h4') newTag = 'h3';
                else if (currentTag === 'h3') newTag = 'h2';
                else if (currentTag === 'h2') newTag = 'p';
                else if (currentTag === 'p') newTag = 'p';
            }

            if (newTag !== currentTag) {
                document.execCommand('formatBlock', false, '<' + newTag.toUpperCase() + '>');
            }
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
};
