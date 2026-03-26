/**
 * EZIO - AI CONTEXT BUILDER
 * Logic for transforming raw data into Markdown contexts for AI or Reports.
 */
export const AIContextBuilder = {
    /**
     * Builds a Markdown table context from a selection of columns and rows.
     * @param {Object} scope - { type: 'global' | 'chapter', selection: string[] }
     * @param {Array<string>} columnsIds - The column IDs to include
     * @param {import('./Types.js').AuditData} data - The currentForm data (rows, columns)
     * @returns {string} Markdown table
     */
    buildTable: (scope, columnsIds, data) => {
        if (!data || !data.rows || !data.columns) return "";

        // 1. Filter columns
        const colsToInclude = [];
        data.columns.forEach((col, idx) => {
            if (columnsIds.includes(col.id)) {
                colsToInclude.push({ label: col.label, index: idx });
            }
        });

        if (colsToInclude.length === 0) return "Aucune donnée (aucune colonne sélectionnée).";

        // 2. Filter rows by Scope
        let rows = data.rows;
        if (scope && scope.type === 'chapter' && scope.selection?.length > 0) {
            const chapColIdx = data.columns.findIndex(c => c.type === 'chapitre');
            const subChapColIdx = data.columns.findIndex(c => c.type === 'sous-chapitre');

            rows = rows.filter(row => {
                const chap = row[chapColIdx];
                const sub = row[subChapColIdx];
                // Check in both chapter and sub-chapter columns if present in selection
                return scope.selection.includes(chap) || (sub && scope.selection.includes(sub));
            });
        }

        if (rows.length === 0) return "Aucune donnée (aucun chapitre correspondant).";

        // 3. Build Markdown Table
        const headers = colsToInclude.map(c => c.label);
        let md = "| " + headers.join(" | ") + " |\n";
        md += "| " + headers.map(() => "---").join(" | ") + " |\n";

        rows.forEach(row => {
            const cells = colsToInclude.map(c => {
                let val = row[c.index];
                if (val === null || val === undefined) val = "";
                // Markdown escaping for table characters
                return String(val).replace(/\n/g, "<br>").replace(/\|/g, "\\|");
            });
            md += "| " + cells.join(" | ") + " |\n";
        });

        return md;
    }
};
