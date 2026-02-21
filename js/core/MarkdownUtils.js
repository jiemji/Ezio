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

        function parseNodeToMd(node, listLevel = 0, isOrdered = false, counter = { val: 1 }) {
            let md = '';
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];

                if (child.nodeType === 3) { // Text node
                    md += child.textContent;
                } else if (child.nodeType === 1) { // Element node
                    const tag = child.tagName.toLowerCase();

                    switch (tag) {
                        case 'b':
                        case 'strong':
                            md += '**' + parseNodeToMd(child) + '**';
                            break;
                        case 'i':
                        case 'em':
                            md += '*' + parseNodeToMd(child) + '*';
                            break;
                        case 'h1': md += '\n# ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'h2': md += '\n## ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'h3': md += '\n### ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'h4': md += '\n#### ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'h5': md += '\n##### ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'h6': md += '\n###### ' + parseNodeToMd(child) + '\n\n'; break;
                        case 'p':
                        case 'div':
                            md += '\n' + parseNodeToMd(child) + '\n';
                            break;
                        case 'br':
                            md += '\n';
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
                            md += '\n' + parseNodeToMd(child, listLevel + 1, false) + '\n';
                            break;
                        case 'ol':
                            md += '\n' + parseNodeToMd(child, listLevel + 1, true, { val: 1 }) + '\n';
                            break;
                        case 'li':
                            const indent = '  '.repeat(Math.max(0, listLevel - 1));
                            const bullet = isOrdered ? `${counter.val++}. ` : '- ';
                            md += '\n' + indent + bullet + parseNodeToMd(child, listLevel, isOrdered, counter);
                            break;
                        default:
                            md += parseNodeToMd(child, listLevel, isOrdered, counter);
                    }
                }
            }
            return md;
        }

        let markdown = parseNodeToMd(temp).trim();
        // Normalize multiple newlines
        markdown = markdown.replace(/\n{3,}/g, '\n\n');
        return markdown;
    }
};
