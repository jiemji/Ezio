import { Utils } from '../core/Utils.js';
import { UI } from '../core/UIFactory.js';
import { downloadDeliveryWidgets } from './app_dashboard.js';
import { currentForm, store } from '../core/State.js';
import { buildContext } from './app_deliveries.js';

/**
 * Génère et télécharge le fichier Word pour un livrable donné.
 * Supporte l'injection dans un modèle (.docx/.dotx) si fourni.
 * 
 * @param {Object} delivery - L'objet livrable
 * @param {ArrayBuffer} [templateBuffer] - Le buffer du fichier modèle (optionnel)
 */
export async function downloadDeliveryWord(delivery, templateBuffer, docConfig) {
    if (!delivery || !delivery.structure || !window.docx) {
        if (!window.docx) UI.showToast("La librairie docx n'est pas chargée.", "danger");
        return;
    }

    // 1. Générer le contenu du rapport (Document temporaire)
    // On génère juste le "cœur" du rapport avec docx sans le grand titre global
    const allBlocks = [];

    for (let i = 0; i < delivery.structure.length; i++) {
        const inst = delivery.structure[i];
        const title = inst.name || 'Module';
        const content = inst.result || '(Aucun contenu)';

        const titleStyle = docConfig?.styles?.deliveryTitle || window.docx.HeadingLevel.TITLE;

        allBlocks.push(
            new window.docx.Paragraph({
                text: title,
                style: typeof titleStyle === 'string' ? titleStyle : undefined,
                heading: typeof titleStyle === 'string' ? undefined : titleStyle,
                spacing: { before: 400, after: 200 }
            })
        );

        if (inst.config?.isTable) {
            inst.contextTable = await buildContext(inst.config.scope, inst.config.columns, currentForm);
            if (inst.contextTable) {
                allBlocks.push(...parseMarkdownToDocx(inst.contextTable, docConfig));
            }
        }

        allBlocks.push(...parseMarkdownToDocx(content, docConfig));
    }

    const tempDoc = new window.docx.Document({
        sections: [{
            properties: {},
            children: allBlocks
        }]
    });

    // Télécharger les widgets demandés en images individuelles
    try {
        await downloadDeliveryWidgets(delivery);
    } catch (e) {
        console.error("Erreur downloadDeliveryWidgets Word:", e);
    }

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
            UI.showToast("La librairie JSZip est manquante. Impossible d'utiliser le modèle.", "danger");
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

        // Variables de remplacement
        const safeTitle = (delivery.name || "").replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
        const safeDate = new Date().toLocaleDateString('fr-FR');

        const replaceVarsInXml = (xmlStr) => {
            let res = xmlStr.replace(/\{\{TITRE\}\}/g, safeTitle);
            res = res.replace(/\{\{DATE\}\}/g, safeDate);
            return res;
        };

        // Remplacer {{TITRE}} et {{DATE}} dans les en-têtes et pieds de page
        for (let filename of Object.keys(templateZip.files)) {
            if (filename.startsWith("word/header") || filename.startsWith("word/footer")) {
                let hfXml = await templateZip.file(filename).async("string");
                templateZip.file(filename, replaceVarsInXml(hfXml));
            }
        }

        // Remplacer dans le document principal
        let templateXmlStr = await templateZip.file("word/document.xml").async("string");
        templateXmlStr = replaceVarsInXml(templateXmlStr);

        const templateXmlDoc = parser.parseFromString(templateXmlStr, "text/xml");
        const templateBody = templateXmlDoc.getElementsByTagName("w:body")[0];

        // c. Trouver le placeholder {{CONTENU}}
        // Note: Word découpe souvent le texte en plusieurs <w:t>. C'est une recherche simplifiée.
        // On cherche un <w:p> qui contient le texte {{CONTENU}}
        let placeholderPara = null;
        const paras = templateBody.getElementsByTagName("w:p");

        for (let i = 0; i < paras.length; i++) {
            if (paras[i].textContent.includes("{{CONTENU}}")) {
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
        UI.showToast("Erreur lors de la génération : " + e.message, "danger");
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

function parseMarkdownToDocx(mdText, docConfig) {
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
                    children.push(createDocxTable(tableRows, docConfig));
                }
                inTable = false;
            }

            if (line === '') continue;

            if (line.startsWith('# ')) {
                const styleH1 = docConfig?.styles?.h1 || window.docx.HeadingLevel.TITLE;
                children.push(new window.docx.Paragraph({
                    text: line.replace('# ', ''),
                    style: typeof styleH1 === 'string' ? styleH1 : undefined,
                    heading: typeof styleH1 === 'string' ? undefined : styleH1,
                    spacing: { before: 400, after: 200 }
                }));
            } else if (line.startsWith('## ')) {
                const styleH2 = docConfig?.styles?.h2 || window.docx.HeadingLevel.HEADING_1;
                children.push(new window.docx.Paragraph({
                    text: line.replace('## ', ''),
                    style: typeof styleH2 === 'string' ? styleH2 : undefined,
                    heading: typeof styleH2 === 'string' ? undefined : styleH2,
                    spacing: { before: 300, after: 150 }
                }));
            } else if (line.startsWith('### ')) {
                const styleH3 = docConfig?.styles?.h3 || window.docx.HeadingLevel.HEADING_2;
                children.push(new window.docx.Paragraph({
                    text: line.replace('### ', ''),
                    style: typeof styleH3 === 'string' ? styleH3 : undefined,
                    heading: typeof styleH3 === 'string' ? undefined : styleH3,
                    spacing: { before: 200, after: 100 }
                }));
            } else if (line.match(/^[-*]\s+/)) {
                const styleUl = docConfig?.styles?.ul;
                const isCustom = typeof styleUl === 'string';
                const text = isCustom ? line.replace(/^[-*]\s+/, '') : line;
                children.push(new window.docx.Paragraph({
                    children: parseTextFormatting(text),
                    style: isCustom ? styleUl : undefined,
                    spacing: { after: 100 }
                }));
            } else if (line.match(/^\d+\.\s+/)) {
                const styleOl = docConfig?.styles?.ol;
                const isCustom = typeof styleOl === 'string';
                const text = isCustom ? line.replace(/^\d+\.\s+/, '') : line;
                children.push(new window.docx.Paragraph({
                    children: parseTextFormatting(text),
                    style: isCustom ? styleOl : undefined,
                    spacing: { after: 100 }
                }));
            } else {
                const styleP = docConfig?.styles?.p;
                // Standard paragraph with bold parsing
                children.push(new window.docx.Paragraph({
                    children: parseTextFormatting(line),
                    style: typeof styleP === 'string' ? styleP : undefined,
                    spacing: { after: 100 }
                }));
            }
        }
    }

    // Handle table at very end of content
    if (inTable && tableRows.length > 0) {
        children.push(createDocxTable(tableRows, docConfig));
    }

    return children;
}

function createDocxTable(rowsData, docConfig) {
    const tFmt = (docConfig && docConfig.tableFormat) ? docConfig.tableFormat : {};
    const headerFill = tFmt.headerFill || "E0E0E0";
    const headerColor = tFmt.headerColor || "000000";
    const rowFill = tFmt.rowFill || "FFFFFF";
    const rowAltFill = tFmt.rowAltFill || "FFFFFF";
    const borderColor = tFmt.borderColor || "CCCCCC";
    const borderSize = tFmt.borderSize !== undefined ? tFmt.borderSize : 4; // Word size is 1/8 pt

    const borderDef = {
        style: window.docx.BorderStyle.SINGLE,
        size: borderSize,
        color: borderColor
    };
    const tableBorders = {
        top: borderDef, bottom: borderDef, left: borderDef, right: borderDef, insideHorizontal: borderDef, insideVertical: borderDef
    };

    return new window.docx.Table({
        width: {
            size: 100,
            type: window.docx.WidthType.PERCENTAGE,
        },
        borders: tableBorders,
        rows: rowsData.map((row, rIdx) => {
            const isHeader = rIdx === 0;

            return new window.docx.TableRow({
                children: row.map(cellText => {
                    let cellFill = isHeader ? headerFill : (rIdx % 2 === 0 ? rowFill : rowAltFill);
                    let cellColor = isHeader ? headerColor : "000000";
                    let rawText = cellText;

                    const spanMatch = rawText.match(/<span style="background-color:([^;]+);color:([^;]+);.*?">(.*?)<\/span>/i);
                    if (spanMatch) {
                        let extractedBg = spanMatch[1].trim();
                        let extractedColor = spanMatch[2].trim();

                        if (extractedBg.startsWith('#')) {
                            cellFill = extractedBg.replace('#', '');
                            if (cellFill.length === 3) {
                                cellFill = cellFill.split('').map(c => c + c).join('');
                            }
                        } else if (extractedBg.startsWith('rgba') || extractedBg.startsWith('rgb')) {
                            const rgbVals = extractedBg.match(/\d+/g);
                            if (rgbVals && rgbVals.length >= 3) {
                                const r = parseInt(rgbVals[0]).toString(16).padStart(2, '0');
                                const g = parseInt(rgbVals[1]).toString(16).padStart(2, '0');
                                const b = parseInt(rgbVals[2]).toString(16).padStart(2, '0');
                                cellFill = (r + g + b).toUpperCase();
                            }
                        }

                        if (extractedColor.startsWith('#')) {
                            cellColor = extractedColor.replace('#', '');
                            if (cellColor.length === 3) {
                                cellColor = cellColor.split('').map(c => c + c).join('');
                            }
                        }
                        rawText = spanMatch[3];
                    }

                    return new window.docx.TableCell({
                        children: [
                            new window.docx.Paragraph({
                                children: [
                                    new window.docx.TextRun({
                                        text: rawText.replace(/<br>/g, '\n'),
                                        color: cellColor,
                                        bold: isHeader
                                    })
                                ]
                            })
                        ],
                        shading: {
                            fill: cellFill
                        }
                    });
                })
            });
        })
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
