import { Utils } from '../core/Utils.js';
import { Config } from '../core/Config.js';
import { UI } from '../core/UIFactory.js';
import { DataUtils } from '../core/DataUtils.js';

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
            return `<textarea class="inp-reponse" data-r="${r}" data-c="${c}">${Utils.escapeHtml(valStr)}</textarea>`;

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
            return `<div class="ia-cell">
                <button class="btn-ia" data-r="${r}" data-c="${c}" title="Générer IA">✨</button>
                <textarea class="ia-textarea" data-r="${r}" data-c="${c}" placeholder="IA...">${Utils.escapeHtml(valStr)}</textarea>
                <div id="ia-${r}-${c}" class="ia-content hidden"></div> 
            </div>`; // Added hidden preview div for consistent targeting

        default:
            return Utils.escapeHtml(valStr);
    }
}

function attachEvents(container, actions, currentForm) {
    // Sort
    container.querySelectorAll('.th-label').forEach(el => {
        el.parentElement.onclick = () => actions.handleSort(parseInt(el.parentElement.parentElement.dataset.colidx));
    });

    // Column Filters
    container.querySelectorAll('.th-filter-select').forEach(el => {
        el.onchange = (e) => actions.handleColumnFilter(parseInt(el.dataset.colidx), e.target.value);
    });

    // Row Actions
    container.querySelectorAll('.btn-add-row').forEach(btn => {
        btn.onclick = () => actions.duplicateRow(parseInt(btn.dataset.r));
    });
    container.querySelectorAll('.btn-delete-row').forEach(btn => {
        btn.onclick = () => actions.deleteRow(parseInt(btn.dataset.r));
    });

    // Inputs: Reponse
    container.querySelectorAll('.inp-reponse, .editable-question').forEach(el => {
        el.oninput = (e) => actions.updateValue(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c), e.target.value);
    });

    // Inputs: Combo
    container.querySelectorAll('.inp-combo').forEach(el => {
        el.onchange = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);
            const val = e.target.value;
            actions.updateValue(r, c, val);

            // Visual update for combo color
            const col = currentForm.columns[c];
            if (col.params?.colorScheme) {
                const options = col.params.options || [];
                const bg = Utils.getComboColor(col.params.colorScheme, val, options);
                e.target.style.backgroundColor = bg;
                e.target.style.color = Utils.getContrastColor(bg);
            }
        };
    });

    // Inputs: QCM
    container.querySelectorAll('.inp-qcm').forEach(el => {
        el.onchange = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);

            // Re-read current value from FORM STATE to update specific item
            // actions.updateValue expects the FULL value for the cell
            let currentVal = currentForm.rows[r][c];
            if (!Array.isArray(currentVal)) {
                const col = currentForm.columns[c];
                currentVal = (col.params?.options || []).map(o => ({ label: o, checked: false }));
            }

            // Clone to avoid direct mutation if strict
            const newVal = JSON.parse(JSON.stringify(currentVal));
            const itemIdx = parseInt(e.target.dataset.i);
            if (newVal[itemIdx]) {
                newVal[itemIdx].checked = e.target.checked;
                actions.updateValue(r, c, newVal);
            }
        };
    });

    // Inputs: IA
    container.querySelectorAll('.ia-textarea').forEach(el => {
        el.oninput = (e) => {
            const r = parseInt(e.target.dataset.r);
            const c = parseInt(e.target.dataset.c);
            actions.updateValue(r, c, e.target.value);
        };
    });

    container.querySelectorAll('.btn-ia').forEach(btn => {
        btn.onclick = () => {
            const r = parseInt(btn.dataset.r);
            const c = parseInt(btn.dataset.c);
            const col = currentForm.columns[c];
            const txt = btn.parentElement.querySelector('.ia-textarea');
            const preview = container.querySelector(`#ia-${r}-${c}`);
            actions.runIA(r, c, col, btn, txt, preview);
        };
    });
}
