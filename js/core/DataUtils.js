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
    },

    /**
     * Builds a Markdown table context from a selection of columns and rows.
     * @param {Object} scope - The target scope for the module
     * @param {Array<String>} columnsIds - The columns selected
     * @param {Object} data - The currentForm data (rows, columns)
     * @returns {String} The rendered Markdown table
     */
    buildContext: (scope, columnsIds, data) => {
        if (!data || !data.rows || !data.columns) return "";

        // 1. Filtrer les colonnes à inclure
        const colsToInclude = [];
        data.columns.forEach((col, idx) => {
            if (columnsIds.includes(col.id)) {
                colsToInclude.push({ label: col.label, index: idx });
            }
        });

        if (colsToInclude.length === 0) return "Aucune donnée (aucune colonne sélectionnée).";

        // 2. Filtrer les lignes (Scope)
        let rows = data.rows;
        if (scope && scope.type === 'chapter' && scope.selection && scope.selection.length > 0) {
            const chapColIdx = data.columns.findIndex(c => c.type === 'chapitre');
            const subChapColIdx = data.columns.findIndex(c => c.type === 'sous-chapitre');

            rows = rows.filter(row => {
                const chap = row[chapColIdx];
                const sub = row[subChapColIdx];
                return scope.selection.includes(chap) || scope.selection.includes(sub);
            });
        }

        if (rows.length === 0) return "Aucune donnée (aucun chapitre correspondant).";

        // 3. Construire le Tableau Markdown
        // Header
        const headers = colsToInclude.map(c => c.label);
        let md = "| " + headers.join(" | ") + " |\n";
        md += "| " + headers.map(() => "---").join(" | ") + " |\n";

        // Rows
        rows.forEach(row => {
            const cells = colsToInclude.map(c => {
                let val = row[c.index];
                const colDef = data.columns[c.index];

                if (val === null || val === undefined) val = "";

                // Handle Combo colors
                if (colDef && colDef.type === 'combo' && colDef.params?.colorScheme && val) {
                    const options = colDef.params.options || [];
                    // We must dynamically import Utils if needed, or rely on a global util approach, 
                    // but we will just duplicate the tiny getComboColor logic or do static.
                    // To avoid circular dependencies, use a simple lookup if possible.
                    // Wait, DataUtils is fine to import Utils if needed. 
                    // Let's assume we can get it from 'Utils.js' later, or just don't here.
                }

                // Nettoyage basique pour ne pas casser le tableau MD
                val = String(val).replace(/\n/g, "<br>").replace(/\|/g, "\\|");
                return val;
            });
            md += "| " + cells.join(" | ") + " |\n";
        });

        return md;
    }
};
