/**
 * EZIO - MARKDOWN UTILS
 * Pure utility functions for handling markdown and HTML conversions.
 */

export const MarkdownUtils = {
    /**
     * Converts an HTML string into Markdown format
     * @param {string} html 
     * @returns {string} Markdown
     */
    htmlToMarkdown: (html) => {
        if (!html) return '';

        // Create a temporary element to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Clean up empty tags and weird spaces
        temp.innerHTML = temp.innerHTML.replace(/\u200B/g, '');

        function parseNodeToMd(node, listLevel = 0, isOrdered = false, counter = { val: 1 }, inHeading = false) {
            let md = '';
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];

                if (child.nodeType === 3) { // Text node
                    // On préserve le texte brut. Le nettoyage de la structure HTML se fait en amont (MarkdownEditor.js)
                    md += child.textContent;
                } else if (child.nodeType === 1) { // Element node
                    const tag = child.tagName.toLowerCase();

                    switch (tag) {
                        case 'b':
                        case 'strong':
                            if (inHeading) md += parseNodeToMd(child, listLevel, isOrdered, counter, inHeading);
                            else md += '**' + parseNodeToMd(child, listLevel, isOrdered, counter, inHeading) + '**';
                            break;
                        case 'i':
                        case 'em':
                            if (inHeading) md += parseNodeToMd(child, listLevel, isOrdered, counter, inHeading);
                            else md += '*' + parseNodeToMd(child, listLevel, isOrdered, counter, inHeading) + '*';
                            break;
                        case 'u':
                            md += '<u>' + parseNodeToMd(child, listLevel, isOrdered, counter, inHeading) + '</u>';
                            break;
                        case 'h1': md += '\n# ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'h2': md += '\n## ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'h3': md += '\n### ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'h4': md += '\n#### ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'h5': md += '\n##### ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'h6': md += '\n###### ' + parseNodeToMd(child, listLevel, false, counter, true) + '\n\n'; break;
                        case 'p':
                        case 'div':
                            md += '\n' + parseNodeToMd(child, listLevel, isOrdered, counter, inHeading) + '\n';
                            break;
                        case 'br':
                            md += '<br>\n';
                            break;
                        case 'table':
                            const tRows = child.querySelectorAll('tr');
                            let tableMd = '\n';
                            tRows.forEach((tr, rIdx) => {
                                let rMd = '|';
                                const cells = tr.querySelectorAll('th, td');
                                if (cells.length === 0) return;
                                cells.forEach(cell => {
                                    rMd += ' ' + parseNodeToMd(cell).replace(/\n/g, '<br>').trim() + ' |';
                                });
                                tableMd += rMd + '\n';
                                if (rIdx === 0 && tr.querySelector('th')) {
                                    tableMd += '|' + Array.from(cells).map(() => '---').join('|') + '|\n';
                                }
                            });
                            md += tableMd + '\n';
                            break;
                        case 'ul':
                            const ulPre = listLevel === 0 ? '\n' : '';
                            const ulSuf = listLevel === 0 ? '\n' : '';
                            md += ulPre + parseNodeToMd(child, listLevel + 1, false, counter, inHeading) + ulSuf;
                            break;
                        case 'ol':
                            const olPre = listLevel === 0 ? '\n' : '';
                            const olSuf = listLevel === 0 ? '\n' : '';
                            md += olPre + parseNodeToMd(child, listLevel + 1, true, { val: 1 }, inHeading) + olSuf;
                            break;
                        case 'li':
                            const indent = '  '.repeat(Math.max(0, listLevel - 1));
                            const bullet = isOrdered ? `${counter.val++}. ` : '- ';
                            md += '\n' + indent + bullet + parseNodeToMd(child, listLevel, isOrdered, counter, inHeading);
                            break;
                        default:
                            md += parseNodeToMd(child, listLevel, isOrdered, counter, inHeading);
                    }
                }
            }
            return md;
        }

        let markdown = parseNodeToMd(temp).trim();
        // Normalize multiple newlines
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        return markdown;
    },

    /**
     * Parse inline markdown styles and HTML span styles into an array of run objects.
     * @param {string} text - The raw text line
     * @param {Object} baseFormat - Base formatting {color, bold, italic, etc}
     * @returns {Array} Array of objects to be consumed by Word/PPTX runners
     */
    extractInlineStyles(text, baseFormat = {}) {
        // Remove <br> for linear parsing
        const cleanText = text.replace(/<br\s*\/?>/ig, '');

        // Split by standard MD tokens and HTML spans
        const parts = cleanText.split(/(<span\b[^>]*>.*?<\/span>|<u\b[^>]*>.*?<\/u>|<b>.*?<\/b>|<i>.*?<\/i>|\*\*.*?\*\*|\_.*?\_|\*.*?\*|<s\b[^>]*>.*?<\/s>|~~.*?~~)/ig);

        return parts.filter(p => p.length > 0).map(part => {
            let format = { ...baseFormat };
            let innerText = part;

            // Handle Span (Colors/Backgrounds)
            if (part.toLowerCase().startsWith('<span')) {
                const bgMatch = part.match(/background-color:\s*([^;]+)/i);
                const colorMatch = part.match(/color:\s*([^;"]+)/i);
                if (bgMatch) format.background = this.normalizeColor(bgMatch[1].trim());
                if (colorMatch) format.color = this.normalizeColor(colorMatch[1].trim());

                const contentMatch = part.match(/>(.*?)<\/span>/i);
                if (contentMatch) innerText = contentMatch[1];
            } else if (part.startsWith('**') && part.endsWith('**')) {
                innerText = part.slice(2, -2);
                format.bold = true;
            } else if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*'))) {
                innerText = part.slice(1, -1);
                format.italic = true;
            } else if (part.toLowerCase().startsWith('<u>') && part.toLowerCase().endsWith('</u>')) {
                innerText = part.slice(3, -4);
                format.underline = true;
            } else if (part.toLowerCase().startsWith('<b>') && part.toLowerCase().endsWith('</b>')) {
                innerText = part.slice(3, -4);
                format.bold = true;
            } else if (part.toLowerCase().startsWith('<i>') && part.toLowerCase().endsWith('</i>')) {
                innerText = part.slice(3, -4);
                format.italic = true;
            } else if (part.startsWith('~~') && part.endsWith('~~') || (part.toLowerCase().startsWith('<s>') && part.toLowerCase().endsWith('</s>'))) {
                innerText = part.startsWith('<') ? part.slice(3, -4) : part.slice(2, -2);
                format.strike = true;
            }

            return {
                text: innerText,
                format: format
            };
        });
    },

    /**
     * Converts rgb/rgba/hex# into a clean hex string without `#` for Word/PPT
     * @param {string} colorString 
     * @returns {string|undefined} Hexadecimal color value without '#' or undefined if invalid
     */
    normalizeColor(colorString) {
        if (!colorString) return undefined;
        let color = colorString.trim().toLowerCase();

        if (color === 'transparent' || color === 'none') return undefined;

        const namedColors = {
            "white": "FFFFFF", "black": "000000", "red": "FF0000",
            "green": "00FF00", "blue": "0000FF", "yellow": "FFFF00",
            "gray": "808080", "grey": "808080"
        };
        if (namedColors[color]) return namedColors[color];

        if (color.startsWith('#')) {
            let hex = color.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (/^[0-9a-f]{6}$/.test(hex)) return hex.toUpperCase();
        } else if (color.startsWith('rgb')) {
            const vals = color.match(/\d+/g);
            if (vals && vals.length >= 3) {
                const r = parseInt(vals[0]).toString(16).padStart(2, '0');
                const g = parseInt(vals[1]).toString(16).padStart(2, '0');
                const b = parseInt(vals[2]).toString(16).padStart(2, '0');
                return (r + g + b).toUpperCase();
            }
        }

        if (/^[0-9a-f]{6}$/.test(color)) return color.toUpperCase();
        if (/^[0-9a-f]{3}$/.test(color)) return color.split('').map(c => c + c).join('').toUpperCase();

        return undefined;
    },

    /**
     * Parses a generic Markdown string into an abstract syntax tree (AST).
     * @param {string} markdown 
     * @returns {Array} AST Array of block objects
     */
    parseToAST(markdown) {
        if (!markdown) return [];
        const lines = markdown.split('\n');
        const ast = [];

        let inTable = false;
        let tableRows = [];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.trim();

            if (line.startsWith('|')) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                if (cells.some(c => c.match(/^[-:]+$/))) continue; // skip dashes
                tableRows.push(cells);
            } else {
                if (inTable) {
                    if (tableRows.length > 0) ast.push({ type: 'table', rows: tableRows });
                    inTable = false;
                }

                if (line === '') continue;

                // Headers
                const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
                if (headerMatch) {
                    ast.push({
                        type: 'header',
                        level: headerMatch[1].length,
                        text: headerMatch[2],
                        runs: this.extractInlineStyles(headerMatch[2])
                    });
                    continue;
                }

                // Unordered List
                const ulMatch = rawLine.match(/^(\s*)([-*])\s+(.*)/);
                if (ulMatch) {
                    const level = Math.floor(ulMatch[1].replace(/\t/g, '    ').length / 2);
                    ast.push({
                        type: 'list_item',
                        listType: 'unordered',
                        level: level,
                        text: ulMatch[3],
                        runs: this.extractInlineStyles(ulMatch[3])
                    });
                    continue;
                }

                // Ordered List
                const olMatch = rawLine.match(/^(\s*)(\d+\.)\s+(.*)/);
                if (olMatch) {
                    const level = Math.floor(olMatch[1].replace(/\t/g, '    ').length / 2);
                    ast.push({
                        type: 'list_item',
                        listType: 'ordered',
                        level: level,
                        text: olMatch[3],
                        runs: this.extractInlineStyles(olMatch[3])
                    });
                    continue;
                }

                // Paragraph
                ast.push({
                    type: 'paragraph',
                    text: line,
                    runs: this.extractInlineStyles(line)
                });
            }
        }

        if (inTable && tableRows.length > 0) {
            ast.push({ type: 'table', rows: tableRows });
        }

        return ast;
    }
};
