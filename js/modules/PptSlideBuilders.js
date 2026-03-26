import { MarkdownUtils } from '../core/MarkdownUtils.js';

/**
 * Helper to consolidate split text blocks from extract.html output
 */
export function consolidateElements(elements) {
    if (!elements || elements.length === 0) return [];

    const consolidated = [];
    let current = null;

    elements.forEach(el => {
        if (!current) {
            current = { ...el };
            return;
        }

        const isText = current.type === 'text' && el.type === 'text';

        if (isText) {
            const xDiff = Math.abs(current.x - el.x);
            const wDiff = Math.abs(current.w - el.w);
            const yGap = el.y - (current.y + current.h);

            const sameCol = xDiff < 0.2 && wDiff < 0.2;
            const consecutive = yGap > -0.1 && yGap < 0.5;

            const sameStyle = (current.fontSize === el.fontSize) &&
                (current.bold === el.bold) &&
                (current.color === el.color) &&
                (current.align === el.align);

            if (sameCol && consecutive && sameStyle) {
                current.text = (current.text || "") + "\n" + (el.text || "");
                current.h = (el.y + el.h) - current.y;
                return;
            }
        }

        consolidated.push(current);
        current = { ...el };
    });

    if (current) consolidated.push(current);
    return consolidated;
}

/**
 * @param {any} pptx - PptxGenJS instance
 * @param {any} slide - Slide instance
 * @param {Array<Object>} elements - Elements from template
 * @param {Object} placeholders - Key-value map for replacements
 * @param {import('../core/Types.js').TemplatePPT} template - Template configuration
 */
export function drawMasterElements(pptx, slide, elements, placeholders, template) {
    if (!elements) return;

    const mergedElements = consolidateElements(elements);

    mergedElements.forEach(el => {
        let text = el.text || "";
        if (typeof text === 'string') {
            Object.keys(placeholders).forEach(key => {
                text = text.replace(new RegExp(`{{${key}}}`, 'g'), placeholders[key]);
            });
        }

        const opts = {
            x: el.x, y: el.y, w: el.w, h: el.h,
            fill: el.fill ? { color: el.fill } : undefined,
            align: el.align,
            fontSize: el.fontSize,
            fontFace: el.fontFace || template.fonts.title,
            bold: el.bold,
            color: el.color || template.theme.text,
            shadow: el.shadow,
            transparency: el.transparency,
            opacity: el.opacity,
            rotate: el.rotate,
            valign: el.valign,
            bullet: el.bullet,
            charSpacing: el.charSpacing,
            lineSpacing: el.lineSpacing,
            isTextBox: el.isTextBox,
            hyperlink: el.link || el.hyperlink,
            outline: el.outline,
            margin: el.margin ? [el.margin[3], el.margin[1], el.margin[2], el.margin[0]] : undefined,
            dashType: el.dashType,
            lineHead: el.lineHead,
            lineTail: el.lineTail,
            path: el.path || (el.src !== 'image' ? el.src : undefined),
            data: el.data,
            sizing: el.sizing,
            rounding: el.rounding,
        };

        if (el.border) {
            opts.border = el.border;
            opts.line = el.border;
        }

        if (el.type === 'text') {
            slide.addText(text, opts);
        } else if (el.type === 'rect') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.rect : (pptx.shapes ? pptx.shapes.RECTANGLE : 'rect'), opts);
        } else if (el.type === 'ellipse') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.ellipse : (pptx.shapes ? pptx.shapes.OVAL : 'ellipse'), opts);
        } else if (el.type === 'line') {
            slide.addShape(pptx.ShapeType ? pptx.ShapeType.line : (pptx.shapes ? pptx.shapes.LINE : 'line'), opts);
        } else if (el.type === 'image') {
            if (opts.path || opts.data) slide.addImage(opts);
        } else if (el.type === 'table') {
            if (el.rows && Array.isArray(el.rows)) slide.addTable(el.rows, opts);
        }
    });
}

export function parseMarkdownToSlide(createSlideFn, mdText, area, template, tableFormat = {}, initialTitle = null) {
    const ast = MarkdownUtils.parseToAST(mdText);
    let activeTitle = initialTitle;
    let slide = null;
    let currentY = area.y;
    const marginX = area.x;
    const contentW = area.w;
    const maxY = area.y + area.h;

    const getSlide = () => {
        if (!slide) slide = createSlideFn(activeTitle);
        return slide;
    };

    const theme = template.theme;
    const fontBody = template.fonts.body;

    let textRuns = [];
    let textHeightAccumulated = 0;

    const flushText = () => {
        if (textRuns.length > 0) {
            getSlide().addText(textRuns, {
                x: marginX, y: currentY, w: contentW, h: textHeightAccumulated,
                fontFace: fontBody,
                color: theme.text,
                fontSize: 12,
                valign: 'top',
                margin: 0
            });
            currentY += textHeightAccumulated;
            textRuns = [];
            textHeightAccumulated = 0;
        }
    };

    for (const block of ast) {
        if (block.type === 'table') {
            flushText();
            const tableH = (block.rows.length * 0.4) + 0.2;
            if (currentY + tableH > maxY && currentY > area.y) {
                slide = null;
                currentY = area.y;
            }
            addPptTable(getSlide(), block.rows, currentY, marginX, contentW, theme, fontBody, tableFormat);
            currentY += tableH;
        } else if (block.type === 'header') {
            if (block.level === 3) {
                flushText();
                activeTitle = block.text;
                if (slide !== null || currentY > area.y) {
                    slide = null;
                    currentY = area.y;
                }
                continue;
            }

            let baseOptions = { breakLine: true };
            let h = 0.3;

            if (block.level === 1) {
                baseOptions = { fontSize: 18, bold: true, color: theme.primary, fontFace: template.fonts.title };
                h = 0.6;
            } else if (block.level === 2) {
                baseOptions = { fontSize: 16, bold: true, color: theme.secondary, fontFace: template.fonts.title };
                h = 0.5;
            } else if (block.level === 4) {
                baseOptions = { fontSize: 16, bold: true, color: theme.text, fontFace: template.fonts.title };
                h = 0.4;
            } else if (block.level >= 5) {
                baseOptions = { fontSize: 14, underline: true, color: theme.text, fontFace: template.fonts.title };
                h = 0.35;
            }

            if (currentY + textHeightAccumulated + h > maxY && (currentY > area.y || textHeightAccumulated > 0)) {
                flushText();
                slide = null;
                currentY = area.y;
            }

            formatAndPushRuns(block.runs, baseOptions, textRuns);
            textHeightAccumulated += h;

        } else if (block.type === 'list_item') {
            let baseOptions = { fontSize: 12, color: theme.text, fontFace: fontBody, breakLine: true };
            if (block.listType === 'unordered') baseOptions.bullet = true;
            if (block.level > 0) baseOptions.indentLevel = block.level;

            const explicitNewlines = block.runs.reduce((acc, r) => acc + (r.text.match(/\n/g) || []).length, 0);
            const totalLength = block.runs.reduce((acc, r) => acc + r.text.length, 0);
            const wrapFactor = Math.ceil(totalLength / (contentW * 12));
            const h = 0.3 * Math.max(wrapFactor, explicitNewlines + 1);

            if (currentY + textHeightAccumulated + h > maxY && (currentY > area.y || textHeightAccumulated > 0)) {
                flushText();
                slide = null;
                currentY = area.y;
            }

            formatAndPushRuns(block.runs, baseOptions, textRuns);
            textHeightAccumulated += h;

        } else if (block.type === 'paragraph') {
            let baseOptions = { fontSize: 12, color: theme.text, fontFace: fontBody, breakLine: true };
            const explicitNewlines = block.runs.reduce((acc, r) => acc + (r.text.match(/\n/g) || []).length, 0);
            const totalLength = block.runs.reduce((acc, r) => acc + r.text.length, 0);
            const wrapFactor = Math.ceil(totalLength / (contentW * 12));
            const h = 0.3 * Math.max(wrapFactor, explicitNewlines + 1);

            if (currentY + textHeightAccumulated + h > maxY && (currentY > area.y || textHeightAccumulated > 0)) {
                flushText();
                slide = null;
                currentY = area.y;
            }

            if (block.runs.length === 0) {
                textRuns.push({ text: '', options: baseOptions });
            } else {
                formatAndPushRuns(block.runs, baseOptions, textRuns);
            }
            textHeightAccumulated += h;
        }
    }
    flushText();
}

function formatAndPushRuns(runs, baseOptions, textRuns) {
    if (!runs || runs.length === 0) return;
    for (let rIdx = 0; rIdx < runs.length; rIdx++) {
        const run = runs[rIdx];
        const isLastInLine = (rIdx === runs.length - 1);
        let runOptions = {
            ...baseOptions,
            bold: baseOptions.bold || run.format.bold,
            italic: baseOptions.italic || run.format.italic,
            underline: baseOptions.underline || run.format.underline,
            breakLine: isLastInLine
        };
        if (run.format.color) runOptions.color = run.format.color;
        if (rIdx > 0) {
            delete runOptions.bullet;
            delete runOptions.indentLevel;
        }
        textRuns.push({ text: run.text, options: runOptions });
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
            let fixedText = cellText.replace(/<br\s*\/?>/gi, '\n');
            let runs = MarkdownUtils.extractInlineStyles(fixedText);

            const bgRun = runs.find(r => r.format.background);
            if (bgRun) cellFill = bgRun.format.background;

            return {
                text: runs.map(r => r.text).join(''),
                options: {
                    fill: cellFill,
                    color: color,
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
