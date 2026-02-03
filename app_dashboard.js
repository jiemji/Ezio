/**
 * EZIO - MODULE DASHBOARD
 * Gère l'affichage des graphiques et widgets.
 */

let chartsInstances = [];

// DOM Elements spécifiques Dashboard
const btnAddWidget = document.getElementById('btnAddWidget');
const kpiColSelect = document.getElementById('kpiColSelect');
const kpiTypeSelect = document.getElementById('kpiTypeSelect');
const dashboardGrid = document.getElementById('dashboardGrid');

if(btnAddWidget) {
    btnAddWidget.onclick = () => {
        const colId = kpiColSelect.value;
        const type = kpiTypeSelect.value;
        if(!colId) return alert("Veuillez choisir une colonne.");
        
        const col = currentForm.columns.find(c => c.id === colId);
        
        if(!currentForm.statics) currentForm.statics = [];
        currentForm.statics.push({
            id: `widget_${Date.now()}`,
            columnId: colId,
            type: type,
            title: col ? col.label : "Indicateur"
        });
        
        saveState(); // Utilise fonction globale
        renderDashboard();
    };
}

function updateKpiSelectors() {
    if(!kpiColSelect) return;
    kpiColSelect.innerHTML = '<option value="">-- Choisir une colonne --</option>';
    
    currentForm.columns.forEach(col => {
        if(['combo', 'qcm'].includes(col.type)) {
            const opt = new Option(col.label, col.id);
            kpiColSelect.appendChild(opt);
        }
    });
}

// Fonction appelée globalement par app_shared.js
window.renderDashboard = function() {
    if(!dashboardGrid) return;
    dashboardGrid.innerHTML = "";
    updateKpiSelectors();
    
    chartsInstances.forEach(c => c.destroy());
    chartsInstances = [];

    if(!currentForm.statics || currentForm.statics.length === 0) {
        dashboardGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">
            <p>Le tableau de bord est vide.</p>
            <p>Ajoutez des widgets via le menu ci-dessus.</p>
        </div>`;
        return;
    }

    currentForm.statics.forEach((widgetConfig, index) => {
        createWidget(widgetConfig, index);
    });
};

function createWidget(config, index) {
    const card = document.createElement('div');
    card.className = 'widget-card';
    
    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<span class="widget-title">${config.title}</span>`;
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-remove-widget';
    btnDel.innerHTML = '×';
    btnDel.onclick = () => {
        if(confirm("Supprimer ce graphique ?")) {
            currentForm.statics.splice(index, 1);
            saveState();
            renderDashboard();
        }
    };
    header.appendChild(btnDel);
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);

    card.appendChild(header);
    card.appendChild(chartContainer);
    dashboardGrid.appendChild(card);

    // Données
    const colIdx = currentForm.columns.findIndex(c => c.id === config.columnId);
    if(colIdx === -1) return;

    const counts = {};
    currentForm.rows.forEach(row => {
        const val = row[colIdx];
        if (typeof val === 'string' && val.trim() !== "") {
            counts[val] = (counts[val] || 0) + 1;
        }
        else if (Array.isArray(val)) {
            val.forEach(item => {
                if(item.checked) counts[item.label] = (counts[item.label] || 0) + 1;
            });
        }
    });

    const labels = Object.keys(counts);
    const dataValues = Object.values(counts);
    const colDef = currentForm.columns[colIdx];
    let backgroundColors = (colDef.params && colDef.params.colors) 
        ? labels.map(l => colDef.params.colors[l] || '#cbd5e1')
        : ['#2563eb', '#ef4444', '#059669', '#d97706', '#8b5cf6', '#ec4899'];

    const ctx = canvas.getContext('2d');
    const newChart = new Chart(ctx, {
        type: config.type,
        data: {
            labels: labels,
            datasets: [{
                label: 'Occurrences',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
    
    chartsInstances.push(newChart);
}