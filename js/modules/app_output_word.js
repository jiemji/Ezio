import { Utils } from '../core/Utils.js';
import { UI } from '../core/UIFactory.js';
import { DOM } from '../ui/DOM.js';
import { currentForm, store } from '../core/State.js';
import { downloadDeliveryWidgets } from './app_dashboard.js';
import { DataUtils } from '../core/DataUtils.js';
import { MarkdownUtils } from '../core/MarkdownUtils.js';
import { IOManager } from '../core/IOManager.js';

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
            inst.contextTable = DataUtils.buildContext(inst.config.scope, inst.config.columns, currentForm);
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
            IOManager.downloadBlob(tempBlob, Utils.toSlug(delivery.name) + ".docx");
            return;
        }

        // 3. Cas avec Modèle : Injection XML (Greffe)
        if (!window.JSZip) {
            UI.showToast("La librairie JSZip est manquante. Impossible d'utiliser le modèle.", "danger");
            IOManager.downloadBlob(tempBlob, Utils.toSlug(delivery.name) + ".docx");
            UI.showToast("Export Word sans modèle de référence généré.", "success");
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
        IOManager.downloadBlob(finalBlob, Utils.toSlug(delivery.name) + ".docx");

    } catch (e) {
        console.error("Erreur lors de la génération Word", e);
        UI.showToast("Erreur lors de la génération : " + e.message, "danger");
    }
}

function parseMarkdownToDocx(mdText, docConfig) {
    const children = [];
    const ast = MarkdownUtils.parseToAST(mdText);

    for (const block of ast) {
        if (block.type === 'table') {
            children.push(createDocxTable(block.rows, docConfig));
        } else if (block.type === 'header') {
            const hStyleMap = {
                1: { style: docConfig?.styles?.h1 || window.docx.HeadingLevel.TITLE, spacing: { before: 400, after: 200 } },
                2: { style: docConfig?.styles?.h2 || window.docx.HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } },
                3: { style: docConfig?.styles?.h3 || window.docx.HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } },
                4: { style: docConfig?.styles?.h4 || window.docx.HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } },
                5: { style: docConfig?.styles?.h5 || window.docx.HeadingLevel.HEADING_4, spacing: { before: 200, after: 100 } },
                6: { style: docConfig?.styles?.h6 || window.docx.HeadingLevel.HEADING_5, spacing: { before: 200, after: 100 } },
            };
            const config = hStyleMap[block.level] || hStyleMap[1];

            children.push(new window.docx.Paragraph({
                children: block.runs.map(r => new window.docx.TextRun({ text: r.text, color: r.format.color, shading: r.format.background ? { type: window.docx.ShadingType.CLEAR, color: r.format.background, fill: r.format.background } : undefined })),
                style: typeof config.style === 'string' ? config.style : undefined,
                heading: typeof config.style === 'string' ? undefined : config.style,
                spacing: config.spacing
            }));
        } else if (block.type === 'list_item') {
            const styleList = docConfig?.styles?.[block.listType === 'ordered' ? 'ol' : 'ul'];
            let appliedStyle = undefined;
            let appliedIndent = undefined;

            if (Array.isArray(styleList)) {
                appliedStyle = styleList[Math.min(block.level, styleList.length - 1)];
            } else if (typeof styleList === 'string') {
                appliedStyle = styleList;
                if (block.level > 0) {
                    appliedIndent = { left: 720 * block.level };
                }
            }

            children.push(new window.docx.Paragraph({
                children: convertRunsToDocx(block.runs),
                style: appliedStyle,
                indent: appliedIndent,
                spacing: { after: 100 },
                bullet: appliedStyle ? undefined : { level: block.level } // Fallback to basic bullet
            }));
        } else if (block.type === 'paragraph') {
            const styleP = docConfig?.styles?.p;
            children.push(new window.docx.Paragraph({
                children: convertRunsToDocx(block.runs),
                style: typeof styleP === 'string' ? styleP : undefined,
                spacing: { after: 100 }
            }));
        }
    }

    return children;
}

function convertRunsToDocx(runs, baseColor, baseBold) {
    if (!runs || runs.length === 0) return [new window.docx.TextRun({ text: "" })];
    return runs.map(r => {
        const tr = {
            text: r.text,
            bold: r.format.bold || baseBold,
            italics: r.format.italic,
            strike: r.format.strike,
            underline: r.format.underline ? { type: window.docx.UnderlineType.SINGLE } : undefined,
            color: r.format.color || baseColor,
            shading: r.format.background ? {
                type: window.docx.ShadingType.CLEAR,
                color: r.format.background,
                fill: r.format.background
            } : undefined
        };
        return new window.docx.TextRun(tr);
    });
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

                    let runs = MarkdownUtils.extractInlineStyles(rawText);

                    // Cell Background priority: Span > Header > Alternating
                    const bgRun = runs.find(r => r.format.background);
                    if (bgRun) cellFill = bgRun.format.background;

                    // Remove background from runs since we apply it to the whole cell shading
                    runs = runs.map(r => {
                        const newFormat = { ...r.format };
                        if (newFormat.color) cellColor = newFormat.color;
                        delete newFormat.background;
                        return { text: r.text, format: newFormat };
                    });

                    return new window.docx.TableCell({
                        children: parseMarkdownCellText(rawText, docConfig, cellColor, isHeader),
                        shading: {
                            fill: cellFill
                        }
                    });
                })
            });
        })
    });
}

function parseMarkdownCellText(rawText, docConfig, cellColor, isHeader) {
    // Basic split for multiline table cells
    const lines = rawText.split(/<br\s*\/?>|\n/i);
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line && i === lines.length - 1) continue;

        let appliedStyle = undefined;
        let bulletActive = false;
        let textToParse = line;

        const matchUl = line.match(/^[-*]\s+(.*)/);
        if (matchUl) {
            bulletActive = true;
            textToParse = matchUl[1];
        } else {
            const matchOl = line.match(/^(\d+\.)\s+(.*)/);
            if (matchOl) {
                bulletActive = true;
                textToParse = matchOl[2];
            }
        }

        const pConfig = {
            children: convertRunsToDocx(MarkdownUtils.extractInlineStyles(textToParse), cellColor, isHeader)
        };

        if (bulletActive) pConfig.bullet = { level: 0 };

        paragraphs.push(new window.docx.Paragraph(pConfig));
    }

    if (paragraphs.length === 0) {
        paragraphs.push(new window.docx.Paragraph({ children: [new window.docx.TextRun({ text: "", color: cellColor })] }));
    }

    return paragraphs;
}
