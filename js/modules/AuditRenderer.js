import { Utils } from '../core/Utils.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { DataUtils } from '../core/DataUtils.js';
import { MarkdownEditor } from '../ui/MarkdownEditor.js';
import { MarkdownUtils } from '../core/MarkdownUtils.js';

export const AuditRenderer = {
    render: (container, context) => {
        const { currentForm, filters, actions } = context;
        if (!container) return;

        // Process Data
        const rowsToProcess = DataUtils.processRows(
            currentForm.rows,
            currentForm.columns,
            filters.activeFilters,
            filters.columnFilters,
            filters.currentSearch,
            filters.currentSort
        );

        // Build HTML
        let html = '<table><thead><tr>';

        // Action Column Header
        html += '<th class="col-actions"></th>';

        // Columns Headers
        currentForm.columns.forEach((col, cIdx) => {
            if (col.visible === false) return;
            const colClass = getColClass(col);
            let sortClass = 'sortable-header';
            let sortIcon = '↕';

            if (filters.currentSort.colIndex === cIdx) {
                sortClass += ' sorted';
                sortIcon = filters.currentSort.direction === 'asc' ? '▲' : '▼';
            }

            html += `<th class="${colClass} ${sortClass}" data-colidx="${cIdx}">
                <div class="th-header-content">
                    <span class="th-label">${Utils.escapeHtml(col.label)} ${sortIcon}</span>`;

            if (col.type === 'combo') {
                const opts = col.params?.options || [];
                html += `<select class="th-filter-select" data-colidx="${cIdx}" onclick="event.stopPropagation()">
                    <option value="">Tout</option>
                    ${opts.map(opt => `<option value="${Utils.escapeHtml(opt)}" ${filters.columnFilters[cIdx] === opt ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`).join('')}
                </select>`;
            }

            html += `</div></th>`;
        });
        html += '</tr></thead><tbody>';

        // Rows
        rowsToProcess.forEach((item) => {
            const r = item.originalIndex;
            const meta = currentForm.rowMeta[r] || {};

            html += `<tr>`;

            // Actions
            html += `<td class="col-actions">
                <div class="action-buttons-container">
                    <button class="btn-row-action btn-add-row" data-r="${r}" title="Dupliquer">+</button>
                    ${meta.isAdded ? `<button class="btn-row-action btn-delete-row" data-r="${r}" title="Supprimer">🗑️</button>` : ''}
                </div>
            </td>`;

            // Cells
            item.data.forEach((cell, cIdx) => { // Use data from DataUtils item
                // DataUtils item.data is the filtered row, but we need to iterate over all columns of the form (or filtered columns)
                // Wait, DataUtils returns { originalIndex, data: row }
                // We iterate currentForm.columns to match the headers
                const col = currentForm.columns[cIdx];
                if (col.visible === false) return;
                // item.data contains the row values
                html += `<td class="${getColClass(col)}">${renderCellHtml(col, item.data[cIdx], r, cIdx, currentForm)}</td>`;
            });

            html += `</tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Attach Events
        attachEvents(container, actions, currentForm);

        // Return stats for indicator
        return { visibleCount: rowsToProcess.length };
    }
};

function getColClass(col) {
    if (col.type === 'chapitre' || col.type === 'sous-chapitre') return 'col-chapitre';
    if (col.type === 'popup') return 'col-popup';
    if (col.type === 'combo') return 'col-combo';
    if (col.type === 'qcm') return 'col-qcm';
    if (col.type === 'reponse') return 'col-reponse';
    if (col.type === 'ia') return 'col-ia';
    const size = col.size ? col.size.toUpperCase() : 'L';
    return size === 'S' ? 'col-s' : (size === 'M' ? 'col-m' : 'col-l');
}

function renderCellHtml(col, value, r, c, currentForm) {
    const valStr = (value === null || value === undefined) ? '' : value;

    switch (col.type) {
        case 'question':
            const meta = currentForm.rowMeta[r] || {};
            if (meta.isAdded) {
                return `<textarea class="editable-question" data-r="${r}" data-c="${c}">${Utils.escapeHtml(valStr)}</textarea>`;
            } else {
                return Utils.escapeHtml(valStr);
            }

        case 'chapitre':
        case 'sous-chapitre':
        case 'reference':
            return Utils.escapeHtml(valStr);

        case 'reponse':
            return MarkdownEditor.render(`editor-${r}-${c}`, valStr, `${r}-${c}`, '100px', true);

        case 'combo':
            const options = col.params?.options || [];
            const colorScheme = col.params?.colorScheme;
            let bg = '', color = '';

            if (colorScheme && value) {
                bg = Utils.getComboColor(colorScheme, value, options);
                color = Utils.getContrastColor(bg);
            }

            const style = bg ? `style="background-color:${bg}; color:${color};"` : '';

            return `<select class="inp-combo" data-r="${r}" data-c="${c}" ${style}>
                <option value="">--</option>
                ${options.map(opt => `<option value="${Utils.escapeHtml(opt)}" ${opt === value ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`).join('')}
            </select>`;

        case 'qcm':
            const items = Array.isArray(value) ? value : (col.params?.options || []).map(o => ({ label: o, checked: false }));
            return `<div class="qcm-container">
                ${items.map((item, i) => `
                    <label class="qcm-item">
                        <input type="checkbox" class="inp-qcm" data-r="${r}" data-c="${c}" data-i="${i}" ${item.checked ? 'checked' : ''}>
                        ${Utils.escapeHtml(item.label)}
                    </label>
                `).join('')}
            </div>`;

        case 'popup':
            let rawContent = valStr;
            if (typeof rawContent === 'string') rawContent = rawContent.replace(/\\n/g, '\n');
            const renderedContent = window.marked ? window.marked.parse(rawContent, { breaks: true }) : Utils.escapeHtml(rawContent);
            return `<div class="popup-wrapper">
                ${UI.renderBadge('Preuves', Config.COLORS.INFO)}
                <div class="popup-content">${renderedContent}</div>
            </div>`;

        case 'ia':
            const iaBtnHtml = `<button class="btn-ia" data-r="${r}" data-c="${c}" title="Générer IA" style="border-radius: 4px; padding: 4px 6px; font-size: 0.9rem; background: var(--primary); color: #fff; border: 1px solid var(--primary); cursor: pointer; display: flex; align-items: center; justify-content: center; height: 26px;">✨</button>`;
            return `<div class="ia-cell">
                ${MarkdownEditor.render(`editor-${r}-${c}`, valStr, `${r}-${c}`, '100px', true, iaBtnHtml)}
            </div>`;

        default:
            return Utils.escapeHtml(valStr);
    }
}

function attachEvents(container, actions, currentForm) {
    // 1. CLICK DELEGATION
    // Handles: Sort, Row Actions (Add/Delete), IA Generation
    container.onclick = (e) => {
        const target = e.target;

        // A. SORTING (Header)
        const sortHeader = target.closest('.th-label');
        if (sortHeader) {
            const th = sortHeader.closest('th');
            if (th) actions.handleSort(parseInt(th.dataset.colidx));
            return;
        }

        // B. ROW ACTIONS
        const btnAdd = target.closest('.btn-add-row');
        if (btnAdd) {
            actions.duplicateRow(parseInt(btnAdd.dataset.r));
            return;
        }

        const btnDel = target.closest('.btn-delete-row');
        if (btnDel) {
            actions.deleteRow(parseInt(btnDel.dataset.r));
            return;
        }

        // C. IA GENERATION
        const btnIA = target.closest('.btn-ia');
        if (btnIA) {
            const r = parseInt(btnIA.dataset.r);
            const c = parseInt(btnIA.dataset.c);
            const col = currentForm.columns[c];
            const editor = container.querySelector(`#editor-${r}-${c}`);
            actions.runIA(r, c, col, btnIA, editor);
            return;
        }

        // D. MARKDOWN FORMATTING
        const btnFormat = target.closest('.btn-md-format');
        if (btnFormat) {
            const action = btnFormat.getAttribute('data-action');
            const idxStr = btnFormat.getAttribute('data-idx'); // `${r}-${c}`
            const editor = container.querySelector(`#editor-${idxStr}`);
            MarkdownEditor.handleFormatAction(action, editor);

            // Save after formatting
            if (editor) {
                const parts = idxStr.split('-');
                if (parts.length === 2) {
                    const r = parseInt(parts[0]);
                    const c = parseInt(parts[1]);
                    actions.updateValue(r, c, MarkdownUtils.htmlToMarkdown(editor.innerHTML));
                }
            }
            return;
        }

        // E. AI TOOLS
        const btnAITool = target.closest('.btn-md-ai-tool');
        if (btnAITool) {
            const idxStr = btnAITool.getAttribute('data-idx');
            const editor = container.querySelector(`#editor-${idxStr}`);
            MarkdownEditor.openAIToolsModal(editor, (newHtml) => {
                const parts = idxStr.split('-');
                if (parts.length === 2) {
                    const r = parseInt(parts[0]);
                    const c = parseInt(parts[1]);
                    actions.updateValue(r, c, MarkdownUtils.htmlToMarkdown(newHtml));
                }
            });
            return;
        }
    };

    // 2. CHANGE DELEGATION
    // Handles: Column Filters, Combo Inputs, QCM Inputs
    container.onchange = (e) => {
        const target = e.target;

        // A. COLUMN FILTERS
        if (target.classList.contains('th-filter-select')) {
            actions.handleColumnFilter(parseInt(target.dataset.colidx), target.value);
            return;
        }

        // B. COMBO INPUTS
        if (target.classList.contains('inp-combo')) {
            const r = parseInt(target.dataset.r);
            const c = parseInt(target.dataset.c);
            const val = target.value;
            actions.updateValue(r, c, val);

            // Visual update for combo color
            const col = currentForm.columns[c];
            if (col.params?.colorScheme) {
                const options = col.params.options || [];
                const bg = Utils.getComboColor(col.params.colorScheme, val, options);
                target.style.backgroundColor = bg;
                target.style.color = Utils.getContrastColor(bg);
            }
            return;
        }

        // C. QCM INPUTS
        if (target.classList.contains('inp-qcm')) {
            const r = parseInt(target.dataset.r);
            const c = parseInt(target.dataset.c);

            // Re-read current value from FORM STATE to update specific item
            let currentVal = currentForm.rows[r][c];
            if (!Array.isArray(currentVal)) {
                const col = currentForm.columns[c];
                currentVal = (col.params?.options || []).map(o => ({ label: o, checked: false }));
            }

            // Clone to avoid direct mutation if strict
            const newVal = JSON.parse(JSON.stringify(currentVal));
            const itemIdx = parseInt(target.dataset.i);
            if (newVal[itemIdx]) {
                newVal[itemIdx].checked = target.checked;
                actions.updateValue(r, c, newVal);
            }
            return;
        }
    };

    // 3. INPUT DELEGATION
    // Handles: Text Inputs (Editable Question, Markdown Editor)
    container.oninput = (e) => {
        const target = e.target;

        if (target.classList.contains('editable-question')) {
            const r = parseInt(target.dataset.r);
            const c = parseInt(target.dataset.c);
            actions.updateValue(r, c, target.value);
        } else if (target.classList.contains('markdown-editor-content')) {
            const parts = target.id.split('-');
            if (parts.length === 3) {
                const r = parseInt(parts[1]);
                const c = parseInt(parts[2]);
                actions.updateValue(r, c, MarkdownUtils.htmlToMarkdown(target.innerHTML));
            }
        }
    };
}
