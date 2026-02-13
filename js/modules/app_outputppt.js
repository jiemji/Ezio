import { Utils } from '../core/Utils.js';

let pptConfig = null;

// Charger la config au démarrage (ou à la première utilisation)
async function loadPptConfig() {
    if (pptConfig) return pptConfig;
    try {
        const res = await fetch('ppt_config.json');
        if (res.ok) {
            pptConfig = await res.json();
        } else {
            console.warn("Impossible de charger ppt_config.json, utilisation défaut.");
            pptConfig = { templates: [] }; // Fallback
        }
    } catch (e) {
        console.error("Erreur chargement ppt_config.json", e);
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
        if (!window.PptxGenJS) alert("La librairie PptxGenJS n'est pas chargée.");
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

    // 1. Slide de Titre
    const titleMaster = template.masters.TITLE_SLIDE;
    const slideTitle = pptx.addSlide();

    // Appliquer fond
    if (titleMaster.background && titleMaster.background.color) {
        slideTitle.background = { color: titleMaster.background.color };
    }

    // Dessiner les éléments statiques du Master Titre
    drawMasterElements(slideTitle, titleMaster.elements, {
        TITLE: delivery.name,
        DATE: new Date().toLocaleDateString()
    }, template);


    // 2. Slides par Module
    const contentMaster = template.masters.CONTENT_SLIDE;

    delivery.structure.forEach((inst, idx) => {
        const modTitle = inst.name || 'Module';
        const content = inst.result || '';

        // Nouvelle slide
        const slide = pptx.addSlide();

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
    });

    // Sauvegarde
    pptx.writeFile({ fileName: `${Utils.toSlug(delivery.name)}.pptx` });
}

function drawMasterElements(slide, elements, placeholders, template) {
    if (!elements) return;

    elements.forEach(el => {
        let text = el.text || "";
        // Remplacement placeholders
        Object.keys(placeholders).forEach(key => {
            text = text.replace(new RegExp(`{{${key}}}`, 'g'), placeholders[key]);
        });

        const opts = {
            x: el.x, y: el.y, w: el.w, h: el.h,
            fill: el.fill ? { color: el.fill } : undefined,
            align: el.align,
            fontSize: el.fontSize,
            fontFace: template.fonts.title, // Utilise la police titre par défaut pour les éléments master
            bold: el.bold,
            color: el.color || template.theme.text
        };

        if (el.border) opts.border = el.border;

        if (el.type === 'text') {
            slide.addText(text, opts);
        } else if (el.type === 'rect') {
            slide.addShape(window.PptxGenJS.ShapeType.rect, opts);
        } else if (el.type === 'ellipse') {
            slide.addShape(window.PptxGenJS.ShapeType.ellipse, opts);
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. Tableaux
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.some(c => c.match(/^[-:]+$/))) continue;
            tableRows.push(cells);
        } else {
            if (inTable) {
                if (tableRows.length > 0) {
                    const tableH = (tableRows.length * 0.4) + 0.2;
                    if (currentY + tableH > area.y + area.h) break; // Overflow check simple

                    addPptTable(slide, tableRows, currentY, marginX, contentW, theme, fontBody);
                    currentY += tableH;
                }
                inTable = false;
            }

            if (line === '') continue;
            if (currentY > area.y + area.h) break; // Overflow

            // 2. Titres
            if (line.startsWith('# ')) {
                slide.addText(line.replace('# ', ''), {
                    x: marginX, y: currentY, w: contentW, h: 0.5,
                    fontSize: 18, bold: true, color: theme.primary, fontFace: template.fonts.title
                });
                currentY += 0.6;
            } else if (line.startsWith('## ')) {
                slide.addText(line.replace('## ', ''), {
                    x: marginX, y: currentY, w: contentW, h: 0.4,
                    fontSize: 16, bold: true, color: theme.secondary, fontFace: template.fonts.title
                });
                currentY += 0.5;
            } else if (line.startsWith('### ')) {
                slide.addText(line.replace('### ', ''), {
                    x: marginX, y: currentY, w: contentW, h: 0.4,
                    fontSize: 14, bold: true, underline: true, color: theme.text, fontFace: template.fonts.title
                });
                currentY += 0.5;
            } else {
                // Texte
                const cleanLine = line.replace(/\*\*/g, '');
                slide.addText(cleanLine, {
                    x: marginX, y: currentY, w: contentW, h: lineHeightBase,
                    fontSize: 12, color: theme.text, fontFace: fontBody
                });
                currentY += lineHeightBase;
            }
        }
    }

    if (inTable && tableRows.length > 0) {
        addPptTable(slide, tableRows, currentY, marginX, contentW, theme, fontBody);
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
