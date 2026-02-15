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
        const response = await fetch('formats.json');
        if (!response.ok) throw new Error("Impossible de charger formats.json");
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
        } else if (format.type === 'ppt') {
            exportToPPT(format.mode);
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

function exportToPPT(mode) {
    if (typeof PptxGenJS === 'undefined') {
        UI.showToast("Librairie PptxGenJS introuvable.", "danger");
        return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    let slide = pptx.addSlide();
    slide.addText("Rapport d'Audit", { x: 1, y: 1, w: '80%', h: 1, fontSize: 36, align: 'center' });
    slide.addText(`Généré le ${new Date().toLocaleDateString()}`, { x: 1, y: 2.5, w: '80%', h: 0.5, fontSize: 18, align: 'center', color: '666666' });

    const dataPrep = prepareDataForExport();
    const cols = currentForm.columns;
    const chapIdx = cols.findIndex(c => c.type === 'chapitre');
    const subChapIdx = cols.findIndex(c => c.type === 'sous-chapitre');

    const colsToKeepArg = cols.map((c, i) => ({ label: c.label, idx: i }))
        .filter(c => c.idx !== chapIdx && c.idx !== subChapIdx);

    const tableHeaders = colsToKeepArg.map(c => c.label);

    const hierarchy = {};

    dataPrep.rows.forEach((row, rIdx) => {
        const chapName = (chapIdx !== -1) ? (row[chapIdx] || "Général") : "Général";
        const subChapName = (subChapIdx !== -1) ? (row[subChapIdx] || "Détail") : "Détail";

        if (!hierarchy[chapName]) hierarchy[chapName] = {};
        if (!hierarchy[chapName][subChapName]) hierarchy[chapName][subChapName] = [];

        const cleanRow = colsToKeepArg.map(c => row[c.idx]);
        hierarchy[chapName][subChapName].push(cleanRow);
    });

    Object.keys(hierarchy).forEach(chap => {
        const subChaps = hierarchy[chap];
        Object.keys(subChaps).forEach(sub => {
            const rows = subChaps[sub];

            const slide = pptx.addSlide();

            slide.addText(chap, { x: 0.5, y: 0.3, w: '90%', fontSize: 24, color: '363636', bold: true });
            slide.addText(sub, { x: 0.5, y: 0.8, w: '90%', fontSize: 18, color: '666666' });

            const tableData = [tableHeaders, ...rows];

            const tabOpts = {
                x: 0.5, y: 1.3, w: '90%',
                colW: Array(tableHeaders.length).fill(9.0 / tableHeaders.length),
                fontSize: 10,
                border: { pt: 1, color: "CCCCCC" },
                fill: "F7F7F7",
                autoPage: true,
                startY: 1.3
            };

            slide.addTable(tableData, tabOpts);
        });
    });

    pptx.writeFile({ fileName: "Audit_Presentation.pptx" });
}
