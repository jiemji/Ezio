/**
 * EZIO - EXPORT MANAGER
 * Gère l'export des données vers Excel et PowerPoint.
 * Dépend de app_shared.js (pour currentForm) et des librairies xlsx/pptxgenjs.
 */

// Récupération des éléments DOM (doivent exister dans index.html)
const exportModal = document.getElementById('exportModal');
const closeExportModal = document.getElementById('closeExportModal');
const exportFormatList = document.getElementById('exportFormatList');

// On expose la fonction pour le HTML onclick="openExportModal()"
window.openExportModal = async function () {
    if (!exportModal) return;

    // On utilise display = block comme pour le modal de chargement
    exportModal.style.display = 'block';

    // Charger formats.json
    try {
        const response = await fetch('formats.json');
        if (!response.ok) throw new Error("Impossible de charger formats.json");
        const formats = await response.json();
        renderExportFormats(formats);
    } catch (e) {
        console.error(e);
        if (exportFormatList) exportFormatList.innerHTML = "<p style='color:red'>Erreur chargement formats.</p>";
    }
};

// Fermeture du modal : gestionnaire d'événements
if (closeExportModal) {
    closeExportModal.onclick = () => {
        if (exportModal) exportModal.style.display = 'none';
    };
}

// Fermeture au clic en dehors
window.addEventListener('click', (e) => {
    if (e.target == exportModal) {
        exportModal.style.display = 'none';
    }
});

function renderExportFormats(formats) {
    if (!exportFormatList) return;
    exportFormatList.innerHTML = "";

    formats.forEach(fmt => {
        const div = document.createElement('div');
        div.className = "export-item-card";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.margin = "5px 0";
        div.style.cursor = "pointer";
        div.style.borderRadius = "5px";
        div.innerHTML = `<strong>${fmt.label}</strong>`;
        div.onclick = () => handleExport(fmt);
        exportFormatList.appendChild(div);
    });
}

async function handleExport(format) {
    if (exportModal) exportModal.style.display = 'none';
    // Petit délai pour l'UX
    await new Promise(r => setTimeout(r, 100));

    try {
        if (format.type === 'excel') {
            exportToExcel(format.mode);
        } else if (format.type === 'ppt') {
            exportToPPT(format.mode);
        } else {
            alert("Type d'export non supporté : " + format.type);
        }
    } catch (err) {
        console.error("Export Error", err);
        alert("Erreur lors de l'export : " + err.message);
    }
}

// --- UTILS DATA PREPARATION ---

function prepareDataForExport() {
    // On doit préparer les données.
    // Pour les QCM: on ne veut que les items cochés.
    // Format attendu: Tableau d'objets ou Matrice.

    // On parcourt les colonnes pour identifier les types
    const cols = currentForm.columns;

    // On prépare les headers
    const headers = cols.map(c => c.label);

    // On prépare les lignes
    const rows = currentForm.rows.map(row => {
        return row.map((cell, cIdx) => {
            const col = cols[cIdx];
            if (col.type === 'qcm') {
                if (Array.isArray(cell)) {
                    // Filter checked
                    const checked = cell.filter(i => i.checked).map(i => {
                        let label = i.label || "";
                        // Remplacement des sauts de ligne Markdown (\n ou <br> etc) par \r\n pour Excel
                        // On suppose que le markdown est du type \n
                        label = label.replace(/\n/g, '\r\n');
                        return label;
                    });

                    // Jointure avec saut de ligne Excel pour avoir une liste verticale dans la cellule
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

// --- EXCEL EXPORT (BLOB) ---

function exportToExcel(mode) {
    if (typeof XLSX === 'undefined') {
        alert("Librairie SheetJS introuvable.");
        return;
    }

    const wb = XLSX.utils.book_new();
    const dataPrep = prepareDataForExport();

    if (mode === 'global') {
        // 1 seule feuille avec tout
        const wsData = [dataPrep.headers, ...dataPrep.rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Audit Global");
    }
    else if (mode === 'chapters') {
        // Découpage par chapitre
        const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');

        if (chapIdx === -1) {
            // Pas de chapitre => Fallback global
            const wsData = [dataPrep.headers, ...dataPrep.rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Données");
        } else {
            // Group by chapter
            const chapters = {};
            dataPrep.rows.forEach(row => {
                const chapName = row[chapIdx] || "Autre";
                if (!chapters[chapName]) chapters[chapName] = [];
                chapters[chapName].push(row);
            });

            // Une feuille par chapitre
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

// --- POWERPOINT EXPORT (BLOB) ---

function exportToPPT(mode) {
    if (typeof PptxGenJS === 'undefined') {
        alert("Librairie PptxGenJS introuvable.");
        return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Slide de titre
    let slide = pptx.addSlide();
    slide.addText("Rapport d'Audit", { x: 1, y: 1, w: '80%', h: 1, fontSize: 36, align: 'center' });
    slide.addText(`Généré le ${new Date().toLocaleDateString()}`, { x: 1, y: 2.5, w: '80%', h: 0.5, fontSize: 18, align: 'center', color: '666666' });

    // Préparation données
    const dataPrep = prepareDataForExport();
    const cols = currentForm.columns;
    const chapIdx = cols.findIndex(c => c.type === 'chapitre');
    const subChapIdx = cols.findIndex(c => c.type === 'sous-chapitre');

    // On doit regrouper par Chapitre > Sous-Chapitre
    // Structure: { "Chapitre 1": { "Sous-Chapitre A": [rows...], "Sous-Chapitre B": [rows...] } }

    // Filtrage des colonnes à exclure (Chap et Sous-Chap) pour le tableau PPT
    const colsToKeepArg = cols.map((c, i) => ({ label: c.label, idx: i }))
        .filter(c => c.idx !== chapIdx && c.idx !== subChapIdx);

    const tableHeaders = colsToKeepArg.map(c => c.label);

    const hierarchy = {};

    dataPrep.rows.forEach((row, rIdx) => {
        // row contient déjà les valeurs formatées (QCM stringifiés etc)
        const chapName = (chapIdx !== -1) ? (row[chapIdx] || "Général") : "Général";
        const subChapName = (subChapIdx !== -1) ? (row[subChapIdx] || "Détail") : "Détail";

        if (!hierarchy[chapName]) hierarchy[chapName] = {};
        if (!hierarchy[chapName][subChapName]) hierarchy[chapName][subChapName] = [];

        // On construit la ligne pour le tableau PPT (sans chap/subchap)
        const cleanRow = colsToKeepArg.map(c => row[c.idx]);
        hierarchy[chapName][subChapName].push(cleanRow);
    });

    // Génération des slides
    Object.keys(hierarchy).forEach(chap => {
        const subChaps = hierarchy[chap];
        Object.keys(subChaps).forEach(sub => {
            const rows = subChaps[sub];

            const slide = pptx.addSlide();

            // Titre : Chapitre
            slide.addText(chap, { x: 0.5, y: 0.3, w: '90%', fontSize: 24, color: '363636', bold: true });
            // Sous-titre : Sous-chapitre
            slide.addText(sub, { x: 0.5, y: 0.8, w: '90%', fontSize: 18, color: '666666' });

            // Tableau
            // Rows format for pptxgen: [ [header1, header2], [val1, val2] ... ]
            const tableData = [tableHeaders, ...rows];

            // Options tableau
            const tabOpts = {
                x: 0.5, y: 1.3, w: '90%',
                colW: Array(tableHeaders.length).fill(9.0 / tableHeaders.length), // Auto-width basic
                fontSize: 10,
                border: { pt: 1, color: "CCCCCC" },
                fill: "F7F7F7",
                autoPage: true, // Créer de nouvelles slides si débordement
                startY: 1.3
            };

            slide.addTable(tableData, tabOpts);
        });
    });

    // Simple writeFile works for blob download
    pptx.writeFile({ fileName: "Audit_Presentation.pptx" });
}
