import { Utils } from '../core/Utils.js';
import { UI } from '../core/UIFactory.js';
import { downloadDeliveryWidgets } from './app_dashboard.js';

let pptConfig = null;

// Charger la config au démarrage (ou à la première utilisation)
async function loadPptConfig() {
    if (pptConfig) return pptConfig;
    try {
        const res = await fetch('output_config.json');
        if (res.ok) {
            pptConfig = await res.json();
        } else {
            console.warn("Impossible de charger output_config.json, utilisation défaut.");
            pptConfig = { templates: [] }; // Fallback
        }
    } catch (e) {
        console.error("Erreur chargement output_config.json", e);
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
                TITLE_SLIDE: { elements: [{ type: "text", text: "{{TITLE}}", x: 1, y: 1, w: 8, h: 1, fontSize: 24 }] },
                CONTENT_SLIDE: { elements: [{ type: "text", text: "{{MODULE_TITLE}}", x: 1, y: 0.5, w: 8, h: 0.5 }], contentArea: { x: 1, y: 1.5, w: 8, h: 3 } }
            }
        };
    }

    const pptx = new window.PptxGenJS();

    // Configuration globale
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Ezio Audit';
    pptx.company = 'Ezio';
    pptx.subject = delivery.name;
    pptx.title = delivery.name;

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
        drawMasterElements(slideTitle, titleMaster.elements, {
            TITLE: delivery.name,
            DATE: new Date().toLocaleDateString()
        }, template);
    }


    // 2. Slides par Module
    let contentMasterKey = findMaster(masterKeys, ['CONTENT_SLIDE', 'CONTENU', 'CONTENT']);
    if (!contentMasterKey && masterKeys.length > 1) contentMasterKey = masterKeys[1];
    if (!contentMasterKey && masterKeys.length > 0) contentMasterKey = masterKeys[0];

    const contentMaster = template.masters[contentMasterKey];

    delivery.structure.forEach((inst, idx) => {
        const modTitle = inst.name || 'Module';
        let content = inst.result || '';

        if (inst.config?.isTable && inst.contextTable) {
            content = inst.contextTable + "\n\n" + content;
        }

        // Nouvelle slide pour le texte Markdown
        const slide = pptx.addSlide();

        if (contentMaster) {
            // Fond
            if (contentMaster.background && contentMaster.background.color) {
                slide.background = { color: contentMaster.background.color };
            }

            // Éléments Master Contenu
            drawMasterElements(slide, contentMaster.elements, {
                MODULE_TITLE: modTitle,
                SLIDE_NUMBER: (idx + 1).toString()
            }, template);

            // Parsing Markdown dans la Content Area
            const area = contentMaster.contentArea || { x: 0.5, y: 1.0, w: 9.0, h: 4.5 };
            parseMarkdownToSlide(slide, content, area, template);
        } else {
            // Fallback minimaliste si aucun master trouvé
            slide.addText(modTitle, { x: 0.5, y: 0.5, fontSize: 18, bold: true, color: '363636' });
            parseMarkdownToSlide(slide, content, { x: 0.5, y: 1.5, w: 9.0, h: 4.0 }, template);
        }
    });

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

function drawMasterElements(slide, elements, placeholders, template) {
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
            slide.addShape(window.PptxGenJS.ShapeType.rect, opts);
        } else if (el.type === 'ellipse') {
            slide.addShape(window.PptxGenJS.ShapeType.ellipse, opts);
        } else if (el.type === 'line') {
            slide.addShape(window.PptxGenJS.ShapeType.line, opts);
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
function parseMarkdownToSlide(slide, mdText, area, template) {
    const lines = mdText.split('\n');
    let currentY = area.y;
    const marginX = area.x;
    const contentW = area.w;
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
            slide.addText(textRuns, {
                x: marginX, y: currentY, w: contentW, h: textHeightAccumulated,
                fontFace: fontBody, // Default font
                color: theme.text,   // Default color
                fontSize: 12         // Default size
            });
            currentY += textHeightAccumulated;
            textRuns = [];
            textHeightAccumulated = 0;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. Tableaux
        if (line.startsWith('|')) {
            // Fin de bloc texte avant tableau
            if (!inTable) {
                flushText();
                inTable = true;
                tableRows = [];
            }
            const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.some(c => c.match(/^[-:]+$/))) continue;
            tableRows.push(cells);
        } else {
            // Fin de tableau
            if (inTable) {
                if (tableRows.length > 0) {
                    const tableH = (tableRows.length * 0.4) + 0.2;
                    // Check overflow ? Tant pis s'il dépasse

                    addPptTable(slide, tableRows, currentY, marginX, contentW, theme, fontBody);
                    currentY += tableH;
                }
                inTable = false;
            }

            if (line === '') {
                // Empty line = line break
                // Optional: add empty run for spacing if needed
                // textRuns.push({ text: "", options: { breakLine: true } });
                // textHeightAccumulated += lineHeightBase;
                continue;
            }

            // 2. Titres et Texte
            let run = {};
            let h = lineHeightBase;

            if (line.startsWith('# ')) {
                run = {
                    text: line.replace('# ', ''),
                    options: { fontSize: 18, bold: true, color: theme.primary, fontFace: template.fonts.title, breakLine: true }
                };
                h = 0.6;
            } else if (line.startsWith('## ')) {
                run = {
                    text: line.replace('## ', ''),
                    options: { fontSize: 16, bold: true, color: theme.secondary, fontFace: template.fonts.title, breakLine: true }
                };
                h = 0.5;
            } else if (line.startsWith('### ')) {
                run = {
                    text: line.replace('### ', ''),
                    options: { fontSize: 14, bold: true, underline: true, color: theme.text, fontFace: template.fonts.title, breakLine: true }
                };
                h = 0.5;
            } else {
                // Texte normal
                const cleanLine = line.replace(/\*\*/g, '');
                run = {
                    text: cleanLine,
                    options: { fontSize: 12, color: theme.text, fontFace: fontBody, breakLine: true }
                };
                h = lineHeightBase;
            }

            textRuns.push(run);
            textHeightAccumulated += h;
        }
    }

    // Flush restant
    if (inTable && tableRows.length > 0) {
        // Table at the very end
        const tableH = (tableRows.length * 0.4) + 0.2;
        addPptTable(slide, tableRows, currentY, marginX, contentW, theme, fontBody);
    } else {
        flushText();
    }
}

function addPptTable(slide, rows, y, x, w, theme, font) {
    if (rows.length === 0) return;
    const colCount = rows[0].length;
    const colW = w / colCount;
    const colWidths = Array(colCount).fill(colW);

    slide.addTable(rows, {
        x: x, y: y, w: w,
        colW: colWidths,
        rowH: 0.4,
        fontSize: 10,
        fontFace: font,
        border: { pt: 1, color: "CCCCCC" },
        fill: theme.background, // Cell fill
        // Header
        fill: { color: theme.surface }
    });
}
