import { currentForm } from '../core/State.js';
import { Utils } from '../core/Utils.js';
import { Modal } from '../ui/Modal.js';
import { registerModuleInit } from '../ui/Navigation.js';
import { UI } from '../core/UIFactory.js';

export function initExport() {
    registerModuleInit('export', () => { }); // No specific init view, just bind button

    const exportBtn = document.getElementById('menuExportBtn');
    if (exportBtn) {
        // Remove onclick attribute if present (legacy)
        exportBtn.removeAttribute('onclick');
        exportBtn.addEventListener('click', openExportModal);
    }
}

async function openExportModal() {
    const modalId = 'modalExport';
    const content = `
        <div id="exportFormatList" style="display:flex; flex-direction:column; gap:10px;">
            <p>Chargement des formats...</p>
        </div>
    `;

    const modal = new Modal(modalId, 'Export', content);
    modal.render();

    try {
        const response = await fetch('config/formats.json');
        if (!response.ok) throw new Error("Impossible de charger config/formats.json");
        const formats = await response.json();

        const listContainer = document.getElementById('exportFormatList');
        if (listContainer) {
            listContainer.innerHTML = '';
            formats.forEach(fmt => {
                const div = document.createElement('div');
                div.className = "export-item-card";
                div.style.padding = "10px";
                div.style.border = "1px solid #ccc";
                div.style.cursor = "pointer";
                div.style.borderRadius = "5px";
                div.innerHTML = `<strong>${Utils.escapeHtml(fmt.label)}</strong>`;
                div.onclick = () => {
                    handleExport(fmt);
                    modal.close();
                };
                listContainer.appendChild(div);
            });
        }
    } catch (e) {
        console.error(e);
        const listContainer = document.getElementById('exportFormatList');
        if (listContainer) listContainer.innerHTML = "<p style='color:red'>Erreur chargement formats.</p>";
    }
}

async function handleExport(format) {
    await new Promise(r => setTimeout(r, 100));

    try {
        if (format.type === 'excel') {
            exportToExcel(format.mode);
        } else {
            UI.showToast("Type d'export non supporté : " + format.type, "warning");
        }
    } catch (err) {
        console.error("Export Error", err);
        UI.showToast("Erreur lors de l'export : " + err.message, "danger");
    }
}

function prepareDataForExport() {
    const cols = currentForm.columns;
    const headers = cols.map(c => c.label);

    const rows = currentForm.rows.map(row => {
        return row.map((cell, cIdx) => {
            const col = cols[cIdx];
            if (col.type === 'qcm') {
                if (Array.isArray(cell)) {
                    const checked = cell.filter(i => i.checked).map(i => {
                        let label = i.label || "";
                        label = label.replace(/\n/g, '\r\n');
                        return label;
                    });
                    return checked.join('\r\n');
                }
                return "";
            }
            if (col.type === 'combo') return cell || "";
            return cell || "";
        });
    });

    return { headers, rows };
}

function exportToExcel(mode) {
    if (typeof XLSX === 'undefined') {
        UI.showToast("Librairie SheetJS introuvable.", "danger");
        return;
    }

    const wb = XLSX.utils.book_new();
    const dataPrep = prepareDataForExport();

    if (mode === 'global') {
        const wsData = [dataPrep.headers, ...dataPrep.rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Audit Global");
    }
    else if (mode === 'chapters') {
        const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');

        if (chapIdx === -1) {
            const wsData = [dataPrep.headers, ...dataPrep.rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Données");
        } else {
            const chapters = {};
            dataPrep.rows.forEach(row => {
                const chapName = row[chapIdx] || "Autre";
                if (!chapters[chapName]) chapters[chapName] = [];
                chapters[chapName].push(row);
            });

            Object.keys(chapters).forEach(chapName => {
                const safeName = chapName.replace(/[\*\?\/\\\[\]]/g, '').substring(0, 30) || "Sheet";
                const wsData = [dataPrep.headers, ...chapters[chapName]];
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, safeName);
            });
        }
    }

    XLSX.writeFile(wb, `Audit_Export_${mode}.xlsx`);
}


