/**
 * EZIO - DATA UTILS
 * Helper functions for data manipulation (filtering, sorting).
 */
export const DataUtils = {
    /**
     * Process rows (Filter & Sort)
     * @param {Array} rows - The raw data rows
     * @param {Array} columns - The column definitions
     * @param {Object} activeFilters - { chapter, subChapter }
     * @param {Object} columnFilters - { colIndex: value }
     * @param {String} searchQuery - Global text search
     * @param {Object} sortConfig - { colIndex, direction }
     * @returns {Array} Array of objects { data, originalIndex }
     */
    processRows: (rows, columns, activeFilters, columnFilters, searchQuery, sortConfig) => {
        if (!rows) return [];

        // 1. Map to preserve original index
        let processed = rows.map((row, index) => ({ data: row, originalIndex: index }));

        // 2. Identify Special Columns
        const chapIdx = columns.findIndex(c => c.type === 'chapitre');
        const subChapIdx = columns.findIndex(c => c.type === 'sous-chapitre');

        // 3. Filter by Chapter/SubChapter
        if (activeFilters.chapter && chapIdx !== -1) {
            processed = processed.filter(item => item.data[chapIdx] === activeFilters.chapter);
        }
        if (activeFilters.subChapter && subChapIdx !== -1) {
            processed = processed.filter(item => item.data[subChapIdx] === activeFilters.subChapter);
        }

        // 4. Filter by Columns
        if (columnFilters) {
            Object.keys(columnFilters).forEach(keyIdx => {
                const filterVal = columnFilters[keyIdx];
                const cIdx = parseInt(keyIdx);
                processed = processed.filter(item => item.data[cIdx] === filterVal);
            });
        }

        // 5. Global Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            processed = processed.filter(item => {
                // Optimization: Avoid JSON.stringify for every cell
                // Build a searchable string from relevant values
                let rowText = "";
                const len = item.data.length;
                for (let i = 0; i < len; i++) {
                    const cell = item.data[i];
                    if (cell === null || cell === undefined) continue;

                    const type = typeof cell;
                    if (type === 'string') {
                        rowText += cell + " ";
                    } else if (type === 'number' || type === 'boolean') {
                        rowText += cell + " ";
                    } else if (type === 'object') {
                        // For arrays (Multiplex/QCM) or simple objects, we might want to search their values
                        // But avoiding full JSON stringify if possible.
                        // For QCM (array of objects), we often want labels.
                        if (Array.isArray(cell)) {
                            // Check if it's an array of strings or objects
                            if (cell.length > 0) {
                                if (typeof cell[0] === 'string') {
                                    rowText += cell.join(" ") + " ";
                                } else if (cell[0].label) {
                                    // QCM structure: [{label: "x", checked: true}, ...]
                                    // We only search labels if checked? Or all? Usually search finds text content.
                                    // Let's add all labels for searchability
                                    rowText += cell.map(o => o.label).join(" ") + " ";
                                } else {
                                     // Fallback
                                    rowText += JSON.stringify(cell) + " ";
                                }
                            }
                        } else {
                            // Fallback for other objects
                             rowText += JSON.stringify(cell) + " ";
                        }
                    }
                }
                return rowText.toLowerCase().includes(query);
            });
        }

        // 6. Sorting
        if (sortConfig && sortConfig.colIndex !== -1) {
            const { colIndex, direction } = sortConfig;
            processed.sort((a, b) => {
                const valA = a.data[colIndex];
                const valB = b.data[colIndex];

                if (valA == null && valB == null) return 0;
                if (valA == null) return 1;
                if (valB == null) return -1;

                let comparison = 0;
                // Numeric check
                // We use a loose check for numbers in strings
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);

                if (!isNaN(numA) && isFinite(valA) && !isNaN(numB) && isFinite(valB)) {
                    comparison = numA - numB;
                } else {
                    comparison = String(valA).localeCompare(String(valB));
                }

                return direction === 'asc' ? comparison : -comparison;
            });
        }

        return processed;
    }
};
