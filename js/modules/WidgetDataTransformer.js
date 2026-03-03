import { Utils } from '../core/Utils.js';

/**
 * Transforms Audit data (columns & rows) into a Chart.js compatible configuration.
 * @param {Object} widget - The widget configuration object
 * @param {Array} columns - The columns definition from the current form
 * @param {Array} rows - The data rows from the current form
 * @returns {Object|null} Chart.js configuration object or null if invalid
 */
export function prepareChartConfig(widget, columns = [], rows = []) {
    const colMain = columns.find(c => c.id === widget.columnId);
    if (!colMain) return null;

    const mainIdx = columns.findIndex(c => c.id === widget.columnId);

    let mainOptions = colMain.params?.options || [];
    if (mainOptions.length === 0 && rows.length > 0) {
        mainOptions = [...new Set(rows.map(r => r[mainIdx] || "Non défini"))];
    }

    const vizType = widget.vizType;
    const showLabels = widget.showLabels !== false;
    const isPercent = widget.valueFormat === 'percent';

    // Default configuration for chartjs-plugin-datalabels
    const datalabelsConfig = {
        display: showLabels,
        color: '#000', // Black for better readability on colored backgrounds
        font: { weight: 'bold', size: 13 },
        formatter: (value, context) => {
            if (value === 0) return '';
            if (isPercent) {
                let total = 0;
                if (vizType.startsWith('cross_')) {
                    context.chart.data.datasets.forEach(ds => {
                        total += ds.data[context.dataIndex] || 0;
                    });
                } else {
                    const dataset = context.chart.data.datasets[context.datasetIndex];
                    total = dataset.data.reduce((acc, val) => acc + (val || 0), 0);
                }
                if (total === 0) return '';
                const percentage = Math.round((value / total) * 100);
                return percentage + '%';
            }
            return value;
        }
    };

    if (vizType.startsWith('cross_')) {
        const crossIdx = columns.findIndex(c => c.id === widget.crossColumnId);
        if (crossIdx === -1) return null;

        const crossCol = columns[crossIdx];
        const isStacked = vizType === 'cross_stacked';

        let crossValues = [];
        if (crossCol.params?.options) {
            crossValues = [...crossCol.params.options];
            const actualValues = new Set(rows.map(r => r[crossIdx] || "Non défini"));
            actualValues.forEach(v => { if (!crossValues.includes(v)) crossValues.push(v); });
        } else {
            crossValues = [...new Set(rows.map(r => r[crossIdx] || "Non défini"))];
        }

        const datasets = mainOptions.map((mainOpt, idx) => {
            let data = crossValues.map(crossVal => {
                return rows.filter(r => (r[crossIdx] || "Non défini") === crossVal && r[mainIdx] === mainOpt).length;
            });

            if (isPercent) {
                data = data.map((val, dataIdx) => {
                    let totalForCrossValue = 0;
                    mainOptions.forEach(opt => {
                        totalForCrossValue += rows.filter(r => (r[crossIdx] || "Non défini") === crossValues[dataIdx] && r[mainIdx] === opt).length;
                    });
                    return totalForCrossValue > 0 ? Math.round((val / totalForCrossValue) * 100) : 0;
                });
            }

            return {
                label: mainOpt,
                data: data,
                backgroundColor: Utils.getComboColor(colMain.params?.colorScheme, mainOpt, mainOptions) || getColorByIndex(idx)
            };
        });

        return {
            type: 'bar',
            data: { labels: crossValues, datasets: datasets },
            options: {
                indexAxis: 'y', // horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: isStacked,
                        beginAtZero: true,
                        max: isPercent ? 100 : undefined,
                        ticks: {
                            callback: function (value) {
                                return isPercent ? value + '%' : value;
                            }
                        }
                    },
                    y: { stacked: isStacked }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: datalabelsConfig
                }
            }
        };
    }

    if (vizType.startsWith('global_')) {
        const counts = {};
        rows.forEach(r => {
            const val = r[mainIdx] || "Non défini";
            counts[val] = (counts[val] || 0) + 1;
        });

        const labels = mainOptions.length > 0
            ? mainOptions.filter(o => counts[o])
            : Object.keys(counts);

        Object.keys(counts).forEach(k => { if (!labels.includes(k)) labels.push(k); });

        const data = labels.map(l => counts[l] || 0);
        const colors = labels.map((l, idx) => Utils.getComboColor(colMain.params?.colorScheme, l, mainOptions) || getColorByIndex(idx));

        const type = vizType.split('_')[1];

        return {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Occurrences',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: type === 'bar' ? 'none' : 'right' },
                    datalabels: datalabelsConfig
                }
            }
        };
    }
    return null;
}

function getColorByIndex(i) {
    const palette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
    return palette[i % palette.length];
}
