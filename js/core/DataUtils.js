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
                const rowText = item.data.map(cell => {
                    if (cell === null || cell === undefined) return "";
                    if (typeof cell === 'object') return JSON.stringify(cell);
                    return String(cell);
                }).join(" ").toLowerCase();
                return rowText.includes(query);
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
