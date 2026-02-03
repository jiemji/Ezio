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
            const opt = document.createElement('option');
            opt.value = col.id;
            opt.innerText = col.label;
            kpiColSelect.appendChild(opt);
        }
    });
}

function renderDashboard() {
    if(!dashboardGrid) return;
    updateKpiSelectors();
    
    // Nettoyer les anciens graphiques
    chartsInstances.forEach(c => c.destroy());
    chartsInstances = [];
    dashboardGrid.innerHTML = "";

    if (!currentForm.statics || currentForm.statics.length === 0) {
        dashboardGrid.innerHTML = `<div class="empty-state">Aucun indicateur configuré. Ajoutez-en un via le menu ci-dessus.</div>`;
        return;
    }

    currentForm.statics.forEach(widgetConfig => {
        createWidgetCard(widgetConfig);
    });
}

function createWidgetCard(config) {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<h3>${config.title}</h3><button class="btn-delete-widget" title="Supprimer">×</button>`;
    
    header.querySelector('.btn-delete-widget').onclick = () => {
        if(confirm("Supprimer ce widget ?")) {
            currentForm.statics = currentForm.statics.filter(s => s.id !== config.id);
            saveState();
            renderDashboard();
        }
    };

    const content = document.createElement('div');
    content.className = 'card-content';
    const canvas = document.createElement('canvas');
    content.appendChild(canvas);
    
    card.appendChild(header);
    card.appendChild(content);
    dashboardGrid.appendChild(card);

    // Données
    const colIdx = currentForm.columns.findIndex(c => c.id === config.columnId);
    if(colIdx === -1) return;

    const colDef = currentForm.columns[colIdx];
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
    
    // -- CALCUL DES COULEURS DYNAMIQUE --
    let backgroundColors;

    // Si c'est une Combo avec un schéma de couleur défini
    if (colDef.type === 'combo' && colDef.params && colDef.params.colorScheme) {
        backgroundColors = labels.map(label => {
            // On récupère la couleur calculée pour ce label spécifique
            const color = getComboColor(colDef.params.colorScheme, label, colDef.params.options);
            // Fallback gris si le label n'est pas trouvé dans les options (ex: ancienne donnée)
            return color || '#94a3b8'; 
        });
    } else {
        // Palette par défaut si pas de schéma
        const defaultPalette = ['#2563eb', '#ef4444', '#059669', '#d97706', '#8b5cf6', '#ec4899'];
        backgroundColors = labels.map((_, i) => defaultPalette[i % defaultPalette.length]);
    }

    const ctx = canvas.getContext('2d');
    const newChart = new Chart(ctx, {
        type: config.type,
        data: {
            labels: labels,
            datasets: [{
                label: 'Nombre',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    chartsInstances.push(newChart);
}

// Fonction utilitaire Dupliquée de app_audit.js pour garantir l'autonomie du module Dashboard
function getComboColor(scheme, value, options) {
    if (!scheme || !value || !options || options.length === 0) return '';
    
    const index = options.indexOf(value);
    if (index === -1) return '';

    // -- LOGIQUE COULEURS FIXES --
    const fixedSchemes = {
        'alert': ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#000000'],
        'rainbow': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7']
    };

    if (fixedSchemes[scheme]) {
        const colors = fixedSchemes[scheme];
        if (index >= colors.length) return colors[colors.length - 1];
        return colors[index];
    }

    // -- LOGIQUE DEGRADEE --
    const baseColors = {
        'blue': '59, 130, 246',   
        'green': '34, 197, 94',   
        'red': '239, 68, 68',     
        'purple': '168, 85, 247', 
        'orange': '249, 115, 22', 
        'yellow': '234, 179, 8'   
    };

    const rgb = baseColors[scheme];
    if (!rgb) return '';

    // Interpolation (0.1 -> 0.9)
    let alpha = 0.9; 
    if (options.length > 1) {
        const startAlpha = 0.1;
        const endAlpha = 0.9; 
        const step = (endAlpha - startAlpha) / (options.length - 1);
        alpha = startAlpha + (index * step);
    }

    alpha = Math.round(alpha * 100) / 100;
    return `rgba(${rgb}, ${alpha})`;
}