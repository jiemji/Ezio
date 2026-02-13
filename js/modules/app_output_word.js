import { Utils } from '../core/Utils.js';

/**
 * Génère et télécharge le fichier Word pour un livrable donné.
 * Supporte l'injection dans un modèle (.docx/.dotx) si fourni.
 * 
 * @param {Object} delivery - L'objet livrable
 * @param {ArrayBuffer} [templateBuffer] - Le buffer du fichier modèle (optionnel)
 */
export async function downloadDeliveryWord(delivery, templateBuffer) {
    if (!delivery || !delivery.structure || !window.docx) {
        if (!window.docx) alert("La librairie docx n'est pas chargée.");
        return;
    }

    // 1. Générer le contenu du rapport (Document temporaire)
    // On génère juste le "cœur" du rapport avec docx
    const tempDoc = new window.docx.Document({
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
                            heading: window.docx.HeadingLevel.HEADING_1, // Utilise le style "Heading 1" du template
                            spacing: { before: 400, after: 200 }
                        }),
                        ...parseMarkdownToDocx(content)
                    ];
                })
            ]
        }]
    });

    try {
        // 2. Packer le document temporaire pour obtenir son XML
        const tempBlob = await window.docx.Packer.toBlob(tempDoc);

        if (!templateBuffer) {
            // Cas simple : Pas de modèle, on télécharge directement le doc généré
            downloadBlob(tempBlob, `${Utils.toSlug(delivery.name)}.docx`);
            return;
        }

        // 3. Cas avec Modèle : Injection XML (Greffe)
        if (!window.JSZip) {
            alert("La librairie JSZip est manquante. Impossible d'utiliser le modèle.");
            downloadBlob(tempBlob, `${Utils.toSlug(delivery.name)}.docx`);
            return;
        }

        // a. Charger le document temporaire (Source)
        const tempZip = await window.JSZip.loadAsync(tempBlob);
        const tempXmlStr = await tempZip.file("word/document.xml").async("string");
        const parser = new DOMParser();
        const tempXmlDoc = parser.parseFromString(tempXmlStr, "text/xml");

        // Extraire les enfants de <body> (sauf sectPr final)
        const tempBody = tempXmlDoc.getElementsByTagName("w:body")[0];
        const sourceNodes = Array.from(tempBody.childNodes).filter(node => node.nodeName !== "w:sectPr");

        // b. Charger le modèle (Cible)
        const templateZip = await window.JSZip.loadAsync(templateBuffer);
        const templateXmlStr = await templateZip.file("word/document.xml").async("string");
        const templateXmlDoc = parser.parseFromString(templateXmlStr, "text/xml");
        const templateBody = templateXmlDoc.getElementsByTagName("w:body")[0];

        // c. Trouver le placeholder {{CONTENT}}
        // Note: Word découpe souvent le texte en plusieurs <w:t>. C'est une recherche simplifiée.
        // On cherche un <w:p> qui contient le texte {{CONTENT}}
        let placeholderPara = null;
        const paras = templateBody.getElementsByTagName("w:p");

        for (let i = 0; i < paras.length; i++) {
            if (paras[i].textContent.includes("{{CONTENT}}")) {
                placeholderPara = paras[i];
                break;
            }
        }

        // d. Injection
        if (placeholderPara) {
            // Insérer avant le placeholder, puis supprimer le placeholder
            sourceNodes.forEach(node => {
                // Il faut importer le nœud dans le document cible
                const importedNode = templateXmlDoc.importNode(node, true);
                templateBody.insertBefore(importedNode, placeholderPara);
            });
            templateBody.removeChild(placeholderPara);
        } else {
            // Si pas de placeholder, ajouter à la fin (avant la dernière section sectPr si elle existe)
            const lastChild = templateBody.lastChild;
            sourceNodes.forEach(node => {
                const importedNode = templateXmlDoc.importNode(node, true);
                if (lastChild && lastChild.nodeName === "w:sectPr") {
                    templateBody.insertBefore(importedNode, lastChild);
                } else {
                    templateBody.appendChild(importedNode);
                }
            });
        }

        // e. Sauvegarder le XML modifié dans le Zip du modèle
        const serializer = new XMLSerializer();
        const newTemplateXml = serializer.serializeToString(templateXmlDoc);
        templateZip.file("word/document.xml", newTemplateXml);

        // f. Générer le fichier final
        const finalBlob = await templateZip.generateAsync({ type: "blob" });
        downloadBlob(finalBlob, `${Utils.toSlug(delivery.name)}.docx`);

    } catch (e) {
        console.error("Erreur lors de la génération Word", e);
        alert("Erreur lors de la génération : " + e.message);
    }
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
