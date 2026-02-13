import { Utils } from '../core/Utils.js';

/**
 * Génère et télécharge le fichier Word pour un livrable donné.
 * @param {Object} delivery - L'objet livrable (ezio reports structure)
 */
export function downloadDeliveryWord(delivery) {
    if (!delivery || !delivery.structure || !window.docx) {
        if (!window.docx) alert("La librairie docx n'est pas chargée.");
        return;
    }

    const doc = new window.docx.Document({
        sections: [{
            properties: {},
            children: [
                new window.docx.Paragraph({
                    text: delivery.name,
                    heading: window.docx.HeadingLevel.TITLE,
                    spacing: { after: 200 }
                }),
                ...delivery.structure.flatMap(inst => {
                    const title = inst.name || 'Module';
                    const content = inst.result || '(Aucun contenu)';

                    return [
                        new window.docx.Paragraph({
                            text: title,
                            heading: window.docx.HeadingLevel.HEADING_1,
                            spacing: { before: 400, after: 200 }
                        }),
                        ...parseMarkdownToDocx(content)
                    ];
                })
            ]
        }]
    });

    window.docx.Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = `${Utils.toSlug(delivery.name)}.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
}

function parseMarkdownToDocx(mdText) {
    const lines = mdText.split('\n');
    const children = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            // Parse table row
            const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);

            // Ignore separator lines like |---|---|
            if (cells.some(c => c.match(/^[-:]+$/))) continue;

            tableRows.push(cells);
        } else {
            if (inTable) {
                // End of table, generate docx table
                if (tableRows.length > 0) {
                    children.push(createDocxTable(tableRows));
                }
                inTable = false;
            }

            if (line === '') continue;

            if (line.startsWith('# ')) {
                children.push(new window.docx.Paragraph({
                    text: line.replace('# ', ''),
                    heading: window.docx.HeadingLevel.TITLE, // MD Level 1 -> Word Title
                    spacing: { before: 400, after: 200 }
                }));
            } else if (line.startsWith('## ')) {
                children.push(new window.docx.Paragraph({
                    text: line.replace('## ', ''),
                    heading: window.docx.HeadingLevel.HEADING_1, // MD Level 2 -> Word Heading 1
                    spacing: { before: 300, after: 150 }
                }));
            } else if (line.startsWith('### ')) {
                children.push(new window.docx.Paragraph({
                    text: line.replace('### ', ''),
                    heading: window.docx.HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
            } else {
                // Standard paragraph with bold parsing
                children.push(new window.docx.Paragraph({
                    children: parseTextFormatting(line),
                    spacing: { after: 100 }
                }));
            }
        }
    }

    // Handle table at very end of content
    if (inTable && tableRows.length > 0) {
        children.push(createDocxTable(tableRows));
    }

    return children;
}

function createDocxTable(rowsData) {
    return new window.docx.Table({
        width: {
            size: 100,
            type: window.docx.WidthType.PERCENTAGE,
        },
        rows: rowsData.map((row, rIdx) =>
            new window.docx.TableRow({
                children: row.map(cellText =>
                    new window.docx.TableCell({
                        children: [new window.docx.Paragraph({ text: cellText.replace(/<br>/g, '\n') })],
                        shading: {
                            fill: rIdx === 0 ? "E0E0E0" : "FFFFFF" // Header row gray
                        },
                        font: {
                            bold: rIdx === 0
                        }
                    })
                )
            })
        )
    });
}

function parseTextFormatting(text) {
    // Simple parser for **bold**
    // Splits text by **
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return new window.docx.TextRun({
                text: part.slice(2, -2),
                bold: true
            });
        }
        return new window.docx.TextRun({ text: part });
    });
}
