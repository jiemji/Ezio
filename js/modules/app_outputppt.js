import { Utils } from '../core/Utils.js';
import { UI } from '../core/UIFactory.js';
import { downloadDeliveryWidgets } from './app_dashboard.js';
import { currentForm, store } from '../core/State.js';
import { buildContext } from './app_deliveries.js';

let pptConfig = null;

// Charger la config au démarrage (ou à la première utilisation)
async function loadPptConfig() {
    if (pptConfig) return pptConfig;
    try {
        const res = await fetch('config/output_config.json');
        if (res.ok) {
            pptConfig = await res.json();
        } else {
            console.warn("Impossible de charger config/output_config.json, utilisation défaut.");
            pptConfig = { templates: [] }; // Fallback
        }
    } catch (e) {
        console.error("Erreur chargement config/output_config.json", e);
        pptConfig = { templates: [] };
    }
    return pptConfig;
}

/**
 * Génère et télécharge le fichier PowerPoint pour un livrable donné.
 * @param {Object} delivery - L'objet livrable
 * @param {String} templateId - L'ID du template choisi (défini dans ppt_config.json)
 */
export async function downloadDeliveryPpt(delivery, templateId = 'default') {
    if (!delivery || !delivery.structure || !window.PptxGenJS) {
        if (!window.PptxGenJS) UI.showToast("La librairie PptxGenJS n'est pas chargée.", "danger");
        return;
    }

    await loadPptConfig();

    // Trouver le template ou prendre le premier dispo ou un fallback hardcodé
    let template = pptConfig.templates.find(t => t.id === templateId);
    if (!template) template = pptConfig.templates[0];

    // Fallback ultime si aucun fichier de config ou vide
    if (!template) {
        template = {
            name: "Fallback",
            theme: { primary: "003366", secondary: "c43e1c", text: "333333", background: "FFFFFF", surface: "F7F7F7" },
            fonts: { title: "Arial", body: "Arial" },
            masters: {
                TITRE: { elements: [] },
                CHAPITRE: { elements: [] },
                SLIDE: { elements: [], contentArea: { x: 0.5, y: 1.0, w: 9.0, h: 4.5 } }
            }
        };
    }

    const tableFormat = template.tableFormat || pptConfig.tableFormat || {};

    const pptx = new window.PptxGenJS();

    // Configuration de base pptxgenjs
    pptx.author = 'Ezio IA';
    pptx.company = 'Ezio';
    pptx.title = delivery.name;

    // Définir la taille personnalisée de la diapositive si présente dans le template
    if (template.layout) {
        pptx.defineLayout({ name: template.layout.name || 'customLayout', width: template.layout.width, height: template.layout.height });
        pptx.layout = template.layout.name || 'customLayout';
    } else {
        pptx.layout = 'LAYOUT_16x9'; // Fallback par défaut
    }

    // Helper pour trouver un master
    const findMaster = (keys, searchTerms) => {
        let found = keys.find(k => k === searchTerms[0]); // Exact match priority
        if (!found) found = keys.find(k => searchTerms.some(term => k.includes(term)));
        return found;
    };

    const masterKeys = Object.keys(template.masters);

    // 1. Slide de Titre
    let titleMasterKey = findMaster(masterKeys, ['TITLE_SLIDE', 'TITRE']);
    if (!titleMasterKey && masterKeys.length > 0) titleMasterKey = masterKeys[0];

    const titleMaster = template.masters[titleMasterKey];
    const slideTitle = pptx.addSlide();

    if (titleMaster) {
        // Appliquer fond
        if (titleMaster.background && titleMaster.background.color) {
            slideTitle.background = { color: titleMaster.background.color };
        }

        // Dessiner les éléments statiques du Master Titre
        drawMasterElements(pptx, slideTitle, titleMaster.elements, {
            TITLE: delivery.name,
            TITRE: delivery.name,
            title: delivery.name,
            titre: delivery.name,
            DATE: new Date().toLocaleDateString(),
            date: new Date().toLocaleDateString()
        }, template);
    }


    // 2. Gestion des Masques
    let chapterMasterKey = findMaster(masterKeys, ['CHAPITRE', 'CHAPTER', 'SECTION']);
    let slideMasterKey = findMaster(masterKeys, ['SLIDE', 'CONTENT_SLIDE', 'CONTENU', 'CONTENT']);
    if (!slideMasterKey && masterKeys.length > 1) slideMasterKey = masterKeys[1];

    const chapterMaster = chapterMasterKey ? template.masters[chapterMasterKey] : null;
    const slideMaster = slideMasterKey ? template.masters[slideMasterKey] : null;

    for (let idx = 0; idx < delivery.structure.length; idx++) {
        const inst = delivery.structure[idx];
        const modTitle = inst.name || 'Module';

        // Slide "CHAPITRE"
        if (chapterMaster) {
            const chapSlide = pptx.addSlide();
            if (chapterMaster.background && chapterMaster.background.color) {
                chapSlide.background = { color: chapterMaster.background.color };
            }
            drawMasterElements(pptx, chapSlide, chapterMaster.elements, {
                chapter: modTitle,
                chapitre: modTitle,
                TITLE: modTitle,
                DATE: new Date().toLocaleDateString(),
                date: new Date().toLocaleDateString()
            }, template);
        }

        // Fonction pour créer une nouvelle slide "SLIDE" au besoin
        const createContentSlide = (customTitle) => {
            const slideTitle = customTitle || modTitle;
            const slide = pptx.addSlide();
            if (slideMaster) {
                if (slideMaster.background && slideMaster.background.color) {
                    slide.background = { color: slideMaster.background.color };
                }
                drawMasterElements(pptx, slide, slideMaster.elements, {
                    title: slideTitle,
                    MODULE_TITLE: modTitle,
                    SLIDE_NUMBER: (idx + 1).toString(),
                    DATE: new Date().toLocaleDateString(),
                    date: new Date().toLocaleDateString()
                }, template);
            } else {
                slide.addText(slideTitle, { x: 0.5, y: 0.5, fontSize: 18, bold: true, color: '363636' });
            }
            return slide;
        };

        const area = slideMaster?.contentArea || { x: 0.5, y: 1.0, w: 9.0, h: 4.5 };

        // Dessin du Tableau de Contexte (isolé)
        if (inst.config?.isTable) {
            inst.contextTable = await buildContext(inst.config.scope, inst.config.columns, currentForm);
            if (inst.contextTable) {
                parseMarkdownToSlide(createContentSlide, inst.contextTable, area, template, tableFormat, modTitle);
            }
        }

        // Dessin du Résultat (isolé et paginé)
        if (inst.result) {
            parseMarkdownToSlide(createContentSlide, inst.result, area, template, tableFormat, modTitle);
        }
    }

    // Télécharger les widgets demandés en images individuelles
    try {
        await downloadDeliveryWidgets(delivery);
    } catch (e) {
        console.error("Erreur downloadDeliveryWidgets PPT:", e);
    }

    // Sauvegarde
    pptx.writeFile({ fileName: `${Utils.toSlug(delivery.name)}.pptx` });
}

/**
 * Helper to consolidate split text blocks
 */
function consolidateElements(elements) {
    if (!elements || elements.length === 0) return [];

    // Sort slightly by Y to ensure correct order if not already
    // but typically keep original order if possible to respect z-index
    // Here we rely on the input order being roughly reading order for text blocks

    const consolidated = [];
    let current = null;

    elements.forEach(el => {
        if (!current) {
            current = { ...el };
            return;
        }

        // Check if we can merge 'el' into 'current'
        // Criteria: both text, same align, same font properties, close vertically, same width/x (approx)
        const isText = current.type === 'text' && el.type === 'text';

        if (isText) {
            const xDiff = Math.abs(current.x - el.x);
            const wDiff = Math.abs(current.w - el.w);
            const yGap = el.y - (current.y + current.h);

            // Allow small deviations
            const sameCol = xDiff < 0.2 && wDiff < 0.2;
            const consecutive = yGap > -0.1 && yGap < 0.5; // Up to 0.5 inch gap

            // Also check styles match (simplistic check)
            const sameStyle = (current.fontSize === el.fontSize) &&
                (current.bold === el.bold) &&
                (current.color === el.color) &&
                (current.align === el.align);

            if (sameCol && consecutive && sameStyle) {
                // Merge
                current.text = (current.text || "") + "\n" + (el.text || "");
                // Update height to encompass both
                // New height = (el.y + el.h) - current.y
                current.h = (el.y + el.h) - current.y;
                return;
            }
        }

        // If not merged, push current and start new
        consolidated.push(current);
        current = { ...el };
    });

    if (current) consolidated.push(current);

    return consolidated;
}

function drawMasterElements(pptx, slide, elements, placeholders, template) {
    if (!elements) return;

    // Consolidate text blocks on the fly
    const mergedElements = consolidateElements(elements);

    mergedElements.forEach(el => {
        let text = el.text || "";
        // Remplacement placeholders uniquement si c'est du texte
        if (typeof text === 'string') {
            Object.keys(placeholders).forEach(key => {
                text = text.replace(new RegExp(`{{${key}}}`, 'g'), placeholders[key]);
            });
        }


        // Construction des options étendues
        const opts = {
            x: el.x, y: el.y, w: el.w, h: el.h,
            fill: el.fill ? { color: el.fill } : undefined,
            align: el.align,
            fontSize: el.fontSize,
            fontFace: el.fontFace || template.fonts.title, // Priorité à la config locale
            bold: el.bold,
            color: el.color || template.theme.text,

            // Propriétés étendues
            shadow: el.shadow,
            transparency: el.transparency,
            opacity: el.opacity,
            rotate: el.rotate,

            // Propriétés de texte avancées
            valign: el.valign,
            bullet: el.bullet,
            charSpacing: el.charSpacing,
            lineSpacing: el.lineSpacing,
            isTextBox: el.isTextBox,
            hyperlink: el.link || el.hyperlink,
            outline: el.outline,
            // PptxGenJS expecting [Left, Right, Bottom, Top] instead of [Top, Right, Bottom, Left] on this version 
            margin: el.margin ? [el.margin[3], el.margin[1], el.margin[2], el.margin[0]] : undefined,

            // Propriétés de ligne/bordure
            dashType: el.dashType,
            lineHead: el.lineHead,
            lineTail: el.lineTail,

            // Propriétés d'image
            path: el.path || (el.src !== 'image' ? el.src : undefined), // Ignore 'image' placeholder du extracteur
            data: el.data,
            sizing: el.sizing,
            rounding: el.rounding,
        };

        // Gestion unifyée des bordures
        if (el.border) {
            opts.border = el.border; // Pour Text/Table
            opts.line = el.border;   // Pour Shapes (alias souvent utilisé)
        }

        // Dispatch selon le type
        if (el.type === 'text') {
            slide.addText(text, opts);
        } else if (el.type === 'rect') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.rect : (pptx.shapes ? pptx.shapes.RECTANGLE : 'rect'), opts);
        } else if (el.type === 'ellipse') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.ellipse : (pptx.shapes ? pptx.shapes.OVAL : 'ellipse'), opts);
        } else if (el.type === 'line') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.line : (pptx.shapes ? pptx.shapes.LINE : 'line'), opts);
        } else if (el.type === 'image') {
            // Si data ou path est présent
            if (opts.path || opts.data) {
                slide.addImage(opts);
            }
        } else if (el.type === 'table') {
            if (el.rows && Array.isArray(el.rows)) {
                slide.addTable(el.rows, opts);
            }
        }
    });
}

/**
 * Parse Markdown et insère dans la zone définie
 */
function parseMarkdownToSlide(createSlideFn, mdText, area, template, tableFormat = {}, initialTitle = null) {
    const lines = mdText.split('\n');
    let activeTitle = initialTitle;
    let slide = null;
    let currentY = area.y;
    const marginX = area.x;
    const contentW = area.w;
    const maxH = area.h;
    const maxY = area.y + maxH;

    const getSlide = () => {
        if (!slide) slide = createSlideFn(activeTitle);
        return slide;
    };

    // Estimation hauteur ligne
    const lineHeightBase = 0.3; // pouces

    const theme = template.theme;
    const fontBody = template.fonts.body;

    let inTable = false;
    let tableRows = [];

    // Buffer for text runs to consolidate
    let textRuns = [];
    let textHeightAccumulated = 0;

    // Helper to flush current text buffer
    const flushText = () => {
        if (textRuns.length > 0) {
            getSlide().addText(textRuns, {
                x: marginX, y: currentY, w: contentW, h: textHeightAccumulated,
                fontFace: fontBody, // Default font
                color: theme.text,   // Default color
                fontSize: 12,        // Default size
                valign: 'top',
                margin: 0
            });
            currentY += textHeightAccumulated;
            textRuns = [];
            textHeightAccumulated = 0;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const line = originalLine.trim();

        // 1. Tableaux
        if (line.startsWith('|')) {
            // Fin de bloc texte avant tableau
            if (!inTable) {
                flushText();
                inTable = true;
                tableRows = [];
            }
            const splitCells = line.split('|');
            if (splitCells.length > 0 && splitCells[0].trim() === '') splitCells.shift();
            if (splitCells.length > 0 && splitCells[splitCells.length - 1].trim() === '') splitCells.pop();
            const cells = splitCells.map(c => c.trim().replace(/<br\s*\/?>/gi, '\n'));
            if (cells.some(c => c.match(/^[-:]+$/))) continue;
            tableRows.push(cells);
        } else {
            // Fin de tableau
            if (inTable) {
                if (tableRows.length > 0) {
                    const tableH = (tableRows.length * 0.4) + 0.2;
                    if (currentY + tableH > maxY && currentY > area.y) {
                        flushText();
                        slide = null;
                        currentY = area.y;
                    }
                    addPptTable(getSlide(), tableRows, currentY, marginX, contentW, theme, fontBody, tableFormat);
                    currentY += tableH;
                }
                inTable = false;
            }

            if (line === '') {
                // Empty line = empty text run for spacing
                textRuns.push({ text: '', options: { fontSize: 12, breakLine: true } });
                textHeightAccumulated += 0.15;
                continue;
            }

            // Detect Indentation and Bullets
            const leadingSpacesMatch = originalLine.match(/^(\s*)/);
            const leadingSpacesCount = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
            const indentLvl = Math.floor(leadingSpacesCount / 2); // 2 spaces = 1 indent level

            let isBullet = false;
            let textContent = line.replace(/<br\s*\/?>/gi, '\n');
            const explicitNewlines = (textContent.match(/\n/g) || []).length;

            if (textContent.startsWith('- ') || textContent.startsWith('* ')) {
                isBullet = true;
                textContent = textContent.substring(2).trim();
            }

            // 2. Titres et Texte
            let baseOptions = { breakLine: true };
            let h = lineHeightBase;

            if (textContent.startsWith('# ')) {
                baseOptions = { fontSize: 18, bold: true, color: theme.primary, fontFace: template.fonts.title };
                textContent = textContent.replace('# ', '');
                h = 0.6;
            } else if (textContent.startsWith('## ')) {
                baseOptions = { fontSize: 16, bold: true, color: theme.secondary, fontFace: template.fonts.title };
                textContent = textContent.replace('## ', '');
                h = 0.5;
            } else if (textContent.startsWith('### ')) {
                flushText();
                activeTitle = textContent.replace(/^###\s*/, '').trim();
                if (slide !== null || currentY > area.y) {
                    slide = null;
                    currentY = area.y;
                }
                continue;
            } else {
                baseOptions = { fontSize: 12, color: theme.text, fontFace: fontBody };
                // Wrap height estimation
                const wrapFactor = Math.ceil(textContent.length / (contentW * 12));
                h *= Math.max(wrapFactor, explicitNewlines + 1);
            }

            if (isBullet) baseOptions.bullet = true;
            if (indentLvl > 0) baseOptions.indentLevel = indentLvl;

            if (currentY + textHeightAccumulated + h > maxY && (currentY > area.y || textHeightAccumulated > 0)) {
                flushText();
                slide = null;
                currentY = area.y;
            }

            // Parse Inline Bold (**text**)
            const parts = textContent.split(/(\*\*.*?\*\*)/g).filter(p => p.length > 0);
            if (parts.length === 0) parts.push('');

            for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                let pText = parts[pIdx];
                let pBold = baseOptions.bold || false;

                if (pText.startsWith('**') && pText.endsWith('**')) {
                    pText = pText.slice(2, -2);
                    pBold = true;
                }

                const isLastInLine = (pIdx === parts.length - 1);

                let runOptions = {
                    ...baseOptions,
                    bold: pBold,
                    breakLine: isLastInLine
                };

                // Seulement le premier bloc de texte d'une ligne doit porter la propriété bullet/indent
                // Sinon, PptxGenJS crée une nouvelle puce à chaque sous-bloc formaté
                if (pIdx > 0) {
                    delete runOptions.bullet;
                    delete runOptions.indentLevel;
                }

                textRuns.push({
                    text: pText,
                    options: runOptions
                });
            }

            textHeightAccumulated += h;
        }
    }

    // Flush restant
    if (inTable && tableRows.length > 0) {
        // Table at the very end
        const tableH = (tableRows.length * 0.4) + 0.2;
        if (currentY + tableH > maxY && currentY > area.y) {
            flushText();
            slide = null;
            currentY = area.y;
        }
        addPptTable(getSlide(), tableRows, currentY, marginX, contentW, theme, fontBody, tableFormat);
    } else {
        flushText();
    }
}

function addPptTable(slide, rows, y, x, w, theme, font, tableFormat = {}) {
    if (rows.length === 0) return;
    const colCount = rows[0].length;
    const colW = w / colCount;
    const colWidths = Array(colCount).fill(colW);

    const format = {
        headerFill: tableFormat.headerFill || "E0E0E0",
        headerColor: tableFormat.headerColor || "000000",
        headerBold: tableFormat.headerBold !== undefined ? tableFormat.headerBold : true,
        rowFill: tableFormat.rowFill || "FFFFFF",
        rowAltFill: tableFormat.rowAltFill || "FFFFFF",
        borderSize: tableFormat.borderSize !== undefined ? tableFormat.borderSize : 1,
        borderColor: tableFormat.borderColor || "CCCCCC",
        fontSize: tableFormat.fontSize || 10
    };

    const formattedRows = rows.map((row, rIdx) => {
        const isHeader = rIdx === 0;
        let fill = isHeader ? format.headerFill : (rIdx % 2 === 0 ? format.rowFill : format.rowAltFill);
        let color = isHeader ? format.headerColor : theme.text;
        let bold = isHeader ? format.headerBold : false;

        return row.map(cellText => {
            let cellFill = fill;
            let cellColor = color;
            let rawText = cellText;

            // Simple regex to parse our specific span format: 
            // <span style="background-color:rgba(x,y,z,a);color:#fff;padding:2px 4px;border-radius:3px;">Value</span>
            const spanMatch = rawText.match(/<span style="background-color:([^;]+);color:([^;]+);.*?">(.*?)<\/span>/i);

            if (spanMatch) {
                let extractedBg = spanMatch[1].trim();
                let extractedColor = spanMatch[2].trim();

                // PptxGenJS hex only format (strip # and handle rgb/rgba)
                if (extractedBg.startsWith('#')) {
                    cellFill = extractedBg.replace('#', '');
                    if (cellFill.length === 3) {
                        cellFill = cellFill.split('').map(c => c + c).join('');
                    }
                } else if (extractedBg.startsWith('rgba') || extractedBg.startsWith('rgb')) {
                    // Try to convert rgb to hex for PPTX, since PptxGenJS prefers hex without #
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

                rawText = spanMatch[3]; // The actual text inside the span
            }

            return {
                text: rawText,
                options: {
                    fill: cellFill,
                    color: cellColor,
                    bold: bold,
                    fontFace: font,
                    fontSize: format.fontSize,
                    border: { pt: format.borderSize, color: format.borderColor }
                }
            };
        });
    });

    slide.addTable(formattedRows, {
        x: x, y: y, w: w,
        colW: colWidths,
        rowH: 0.4
    });
}
