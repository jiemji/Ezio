/**
 * EZIO - MODULE AUDIT
 * Gère l'affichage du formulaire, la sidebar, les interactions utilisateur,
 * le tri par colonne et le filtrage.
 */

let activeFilters = { chapter: null, subChapter: null };
let columnFilters = {}; // Stocke les filtres par colonne: { colIndex: "valeur" }
let currentSort = { colIndex: -1, direction: 'asc' }; // { colIndex: 2, direction: 'asc' | 'desc' }
let currentSearch = "";

// --- 1. DÉCLARATION DES ÉLÉMENTS DOM ---
const tableContainer = document.getElementById('tableContainer');
const statusIndicator = document.getElementById('statusIndicator');
const sidebar = document.getElementById('sidebar');
const chapterList = document.getElementById('chapterList');
const searchInput = document.getElementById('searchInput');
const jsonInput = document.getElementById('jsonInput');
const exportBtn = document.getElementById('exportBtn');

// Nouveaux éléments pour la modale (Assurez-vous qu'ils sont dans index.html)
const modalLoad = document.getElementById('modalLoad');
const btnOpenLoad = document.getElementById('loadBtn');
const templateList = document.getElementById('templateList');
const closeModal = document.querySelector('.close-modal');

// 1. Ouvrir la modale
if (btnOpenLoad) {
    btnOpenLoad.onclick = async () => {
        if (modalLoad) modalLoad.style.display = "block";
        if (templateList) {
            templateList.innerHTML = "<li>Recherche des modèles...</li>";
            try {
                // Charge la liste depuis le serveur
                const response = await fetch('./templates/templates.json');
                if (!response.ok) throw new Error("Fichier templates.json introuvable");
                const templates = await response.json();

                templateList.innerHTML = templates.map(t =>
                    `<li class="template-item" onclick="loadRemoteTemplate('${t.filename}')">
                        ${t.name}
                    </li>`
                ).join('');
            } catch (err) {
                templateList.innerHTML = "<li style='color:red'>Aucun modèle disponible (dossier 'templates' manquant ?)</li>";
            }
        }
    };
}

// 2. Charger un Template distant (Attaché à window pour le HTML dynamique)
// 2. Charger un Template distant (Attaché à window pour le HTML dynamique)
window.loadRemoteTemplate = async (filename) => {
    try {
        const response = await fetch(`./templates/${filename}`);
        if (!response.ok) throw new Error(`Fichier introuvable (${response.status})`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            applyLoadedData(data, `Modèle chargé : ${filename}`);
        } catch (parseError) {
            throw new Error(`JSON invalide: ${parseError.message}`);
        }
    } catch (err) {
        console.error(err);
        alert(`Erreur : Impossible de charger ce modèle.\nDétail: ${err.message}`);
    }
};

// 3. Charger un fichier Local
if (jsonInput) {
    jsonInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                applyLoadedData(data, "Fichier local chargé avec succès");
            } catch (err) {
                alert("Erreur : Fichier JSON invalide.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset pour permettre de recharger le même fichier
    };
}

// 4. Fonction unifiée pour appliquer les données (Factorisation)
function applyLoadedData(data, message) {
    if (!data.columns || !data.rows) {
        alert("Format de fichier invalide (Colonnes ou lignes manquantes).");
        return;
    }

    currentForm = data;
    if (!currentForm.statics) currentForm.statics = [];

    // Reset des filtres
    activeFilters = { chapter: null, subChapter: null };
    columnFilters = {};
    currentSort = { colIndex: -1, direction: 'asc' };
    currentSearch = "";
    if (searchInput) searchInput.value = "";

    // Sauvegarde et Rendu
    saveState();
    if (typeof switchView === 'function') switchView('app');

    // C'EST ICI LA CLÉ : On appelle renderApp() qui existe dans votre fichier
    renderApp();

    // UI
    if (modalLoad) modalLoad.style.display = "none";
    if (statusIndicator) statusIndicator.textContent = message;
}

// Fermeture de la modale
if (closeModal) closeModal.onclick = () => modalLoad.style.display = "none";
window.onclick = (e) => { if (e.target == modalLoad) modalLoad.style.display = "none"; };

//***************** */
// Listeners spécifiques
if (searchInput) {
    searchInput.oninput = (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderTable();
    };
}

if (exportBtn) {
    exportBtn.onclick = () => downloadJSON(currentForm, `export_${new Date().getTime()}.json`);
}



// Fin Modale
// -- LOGIQUE DE RENDU --

function updateValue(r, c, val) {
    // r est l'index original (absolu) dans currentForm.rows
    currentForm.rows[r][c] = val;
    saveState();
}

function renderApp() {
    if (!currentForm.columns.length) return;
    if (sidebar) {
        sidebar.classList.remove('hidden');
        renderSidebar();
    }
    renderTable();
}

function renderSidebar() {
    if (!chapterList) return;
    chapterList.innerHTML = "";
    const chapColIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapColIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    if (chapColIdx === -1) return;

    const hierarchy = new Map();
    let totalCount = 0;

    currentForm.rows.forEach(row => {
        const chapName = row[chapColIdx] || "Sans chapitre";
        const subChapName = (subChapColIdx !== -1) ? (row[subChapColIdx] || null) : null;

        if (!hierarchy.has(chapName)) {
            hierarchy.set(chapName, { count: 0, subChapters: new Map() });
        }

        const chapObj = hierarchy.get(chapName);
        chapObj.count++;
        totalCount++;

        if (subChapName) {
            const currentSubCount = chapObj.subChapters.get(subChapName) || 0;
            chapObj.subChapters.set(subChapName, currentSubCount + 1);
        }
    });

    // Bouton Vue Globale
    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${(!activeFilters.chapter) ? 'active' : ''}`;
    allItem.innerHTML = `<span>Vue Globale</span> <span class="count-badge">${totalCount}</span>`;
    allItem.onclick = () => {
        activeFilters = { chapter: null, subChapter: null };
        columnFilters = {}; // Reset filtres colonnes si on change de vue (optionnel)
        renderApp();
    };
    chapterList.appendChild(allItem);

    // Arborescence
    hierarchy.forEach((data, chapName) => {
        const isChapActive = activeFilters.chapter === chapName;
        const liChap = document.createElement('li');
        liChap.className = `chapter-item ${isChapActive && !activeFilters.subChapter ? 'active' : ''}`;
        liChap.innerHTML = `<span>${chapName}</span> <span class="count-badge">${data.count}</span>`;
        liChap.onclick = (e) => {
            activeFilters = { chapter: chapName, subChapter: null };
            renderApp();
        };

        const subUl = document.createElement('ul');
        subUl.className = `sub-chapter-list ${isChapActive ? 'open' : ''}`;

        if (data.subChapters.size > 0) {
            data.subChapters.forEach((count, subName) => {
                const liSub = document.createElement('li');
                const isSubActive = isChapActive && activeFilters.subChapter === subName;
                liSub.className = `sub-chapter-item ${isSubActive ? 'active' : ''}`;
                liSub.innerText = `${subName} (${count})`;
                liSub.onclick = (e) => {
                    e.stopPropagation();
                    activeFilters = { chapter: chapName, subChapter: subName };
                    renderApp();
                };
                subUl.appendChild(liSub);
            });
        }
        const container = document.createElement('div');
        container.appendChild(liChap);
        if (data.subChapters.size > 0) container.appendChild(subUl);
        chapterList.appendChild(container);
    });
}

function handleSort(cIdx) {
    if (currentSort.colIndex === cIdx) {
        // Toggle direction: asc -> desc -> null (off)
        if (currentSort.direction === 'asc') currentSort.direction = 'desc';
        else if (currentSort.direction === 'desc') { currentSort.colIndex = -1; currentSort.direction = 'asc'; }
    } else {
        currentSort.colIndex = cIdx;
        currentSort.direction = 'asc';
    }
    renderTable();
}

function handleColumnFilter(cIdx, value) {
    if (value === "") {
        delete columnFilters[cIdx];
    } else {
        columnFilters[cIdx] = value;
    }
    renderTable();
}

function renderTable() {
    if (!tableContainer) return;
    tableContainer.innerHTML = "";
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    const getColClass = (col) => {
        if (col.type === 'chapitre' || col.type === 'sous-chapitre') return 'col-chapitre';
        if (col.type === 'popup') return 'col-popup';
        if (col.type === 'combo') return 'col-combo';
        if (col.type === 'qcm') return 'col-qcm';
        if (col.type === 'reponse') return 'col-reponse';
        if (col.type === 'ia') return 'col-ia';
        const size = col.size ? col.size.toUpperCase() : 'L';
        return size === 'S' ? 'col-s' : (size === 'M' ? 'col-m' : 'col-l');
    };

    // 1. HEADER & LOGIQUE DE TRI/FILTRE UI
    currentForm.columns.forEach((col, cIdx) => {
        if (col.visible === false) return;
        const th = document.createElement('th');
        th.className = getColClass(col) + " sortable-header";

        // Container Header
        const headerDiv = document.createElement('div');
        headerDiv.className = "th-header-content";

        // Label + Icone Tri
        const labelSpan = document.createElement('span');
        let sortIcon = "↕";
        if (currentSort.colIndex === cIdx) {
            sortIcon = currentSort.direction === 'asc' ? "▲" : "▼";
            th.classList.add('sorted');
        }
        labelSpan.innerText = `${col.label} ${sortIcon}`;
        labelSpan.style.cursor = "pointer";
        labelSpan.onclick = () => handleSort(cIdx);

        headerDiv.appendChild(labelSpan);

        // Ajout filtre pour Combo
        if (col.type === 'combo') {
            const selectFilter = document.createElement('select');
            selectFilter.className = "th-filter-select";
            selectFilter.onclick = (e) => e.stopPropagation(); // Empêcher le tri quand on clique le select

            // Option vide (Tout)
            selectFilter.appendChild(new Option("Tout", ""));

            // Options du combo
            const opts = col.params?.options || [];
            opts.forEach(opt => {
                const o = new Option(opt, opt);
                if (columnFilters[cIdx] === opt) o.selected = true;
                selectFilter.appendChild(o);
            });

            selectFilter.onchange = (e) => handleColumnFilter(cIdx, e.target.value);
            headerDiv.appendChild(selectFilter);
        }

        th.appendChild(headerDiv);
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // 2. PRÉPARATION DES DONNÉES (PIPELINE)
    const chapIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    // Étape A: Mapping pour garder l'index original (CRITIQUE pour updateValue)
    let rowsToProcess = currentForm.rows.map((row, index) => ({ data: row, originalIndex: index }));

    // Étape B: Filtrage Structurel (Chapitre / Sous-Chapitre)
    if (activeFilters.chapter && chapIdx !== -1) {
        rowsToProcess = rowsToProcess.filter(item => item.data[chapIdx] === activeFilters.chapter);
    }
    if (activeFilters.subChapter && subChapIdx !== -1) {
        rowsToProcess = rowsToProcess.filter(item => item.data[subChapIdx] === activeFilters.subChapter);
    }

    // Étape C: Filtrage par Colonne (Combo)
    Object.keys(columnFilters).forEach(keyIdx => {
        const filterVal = columnFilters[keyIdx];
        const cIdx = parseInt(keyIdx);
        rowsToProcess = rowsToProcess.filter(item => item.data[cIdx] === filterVal);
    });

    // Étape D: Recherche Globale
    if (currentSearch) {
        rowsToProcess = rowsToProcess.filter(item => {
            const rowText = item.data.map(cell => {
                if (cell === null || cell === undefined) return "";
                if (typeof cell === 'object') return JSON.stringify(cell);
                return String(cell);
            }).join(" ").toLowerCase();
            return rowText.includes(currentSearch);
        });
    }

    // Étape E: Tri
    if (currentSort.colIndex !== -1) {
        rowsToProcess.sort((a, b) => {
            const valA = a.data[currentSort.colIndex];
            const valB = b.data[currentSort.colIndex];

            // Gestion des nuls
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            let comparison = 0;
            // Détection numérique ou string
            if (!isNaN(parseFloat(valA)) && isFinite(valA) && !isNaN(parseFloat(valB)) && isFinite(valB)) {
                comparison = parseFloat(valA) - parseFloat(valB);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return currentSort.direction === 'asc' ? comparison : -comparison;
        });
    }

    // 3. RENDU DES LIGNES
    const tbody = document.createElement('tbody');
    let visibleCount = 0;

    rowsToProcess.forEach((item) => {
        visibleCount++;
        const tr = document.createElement('tr');
        item.data.forEach((cell, cIdx) => {
            const col = currentForm.columns[cIdx];
            if (col.visible === false) return;
            const td = document.createElement('td');
            td.className = getColClass(col);
            // On passe item.originalIndex (r) pour que l'édition cible la bonne ligne en mémoire
            renderCell(td, col, cell, item.originalIndex, cIdx);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // 4. STATUS INDICATOR
    let status = [];
    if (activeFilters.chapter) status.push(`Chap: ${activeFilters.chapter}`);
    if (activeFilters.subChapter) status.push(`Sous-Chap: ${activeFilters.subChapter}`);
    if (Object.keys(columnFilters).length > 0) status.push(`Filtres actifs: ${Object.keys(columnFilters).length}`);
    if (status.length === 0) status.push("Vue Globale");
    if (currentSearch) status.push(`Rech: "${currentSearch}"`);
    if (statusIndicator) statusIndicator.innerText = `${status.join(' | ')} (${visibleCount} lignes)`;
}

// Fonction pour déterminer si le texte doit être blanc ou noir en fonction du fond
function getContrastColor(color) {
    if (!color) return '';
    let r, g, b;

    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (color.startsWith('rgb')) {
        const vals = color.match(/\d+/g);
        if (vals) {
            r = parseInt(vals[0]);
            g = parseInt(vals[1]);
            b = parseInt(vals[2]);
        }
    } else {
        return '';
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function getComboColor(scheme, value, options) {
    if (!scheme || !value || !options || options.length === 0) return '';

    const index = options.indexOf(value);
    if (index === -1) return '';

    const fixedSchemes = {
        'alert6': ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#000000'],
        'alert3': ['#22c55e', '#eab308', '#ef4444'],

        'rainbow': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7']
    };

    if (fixedSchemes[scheme]) {
        const colors = fixedSchemes[scheme];
        if (index >= colors.length) return colors[colors.length - 1];
        return colors[index];
    }

    const baseColors = {
        'blue': '59, 130, 246', 'green': '34, 197, 94', 'red': '239, 68, 68',
        'purple': '168, 85, 247', 'orange': '249, 115, 22', 'yellow': '234, 179, 8'
    };

    const rgb = baseColors[scheme];
    if (!rgb) return '';

    let alpha = 0.9;
    if (options.length > 1) {
        const startAlpha = 0.1; const endAlpha = 0.9;
        const step = (endAlpha - startAlpha) / (options.length - 1);
        alpha = startAlpha + (index * step);
    }

    alpha = Math.round(alpha * 100) / 100;
    return `rgba(${rgb}, ${alpha})`;
}


// -- LOAD MODELS --
let auditAvailableModels = [];
async function loadModels() {
    try {
        const response = await fetch('models.json');
        if (response.ok) {
            auditAvailableModels = await response.json();
            if (!Array.isArray(auditAvailableModels)) auditAvailableModels = [];
        }
    } catch (e) {
        console.warn("Impossible de charger models.json", e);
    }
}
loadModels();

function renderCell(container, col, value, r, c) {
    switch (col.type) {
        case 'question': case 'chapitre': case 'sous-chapitre': case 'reference':
            container.classList.add('cell-readonly'); container.innerText = value || ""; break;
        case 'reponse':
            const txt = document.createElement('textarea'); txt.value = value || "";
            txt.oninput = (e) => updateValue(r, c, e.target.value); container.appendChild(txt); break;
        case 'combo':
            const sel = document.createElement('select');
            const options = col.params?.options || [];
            sel.appendChild(new Option("--", ""));
            options.forEach(opt => {
                const o = new Option(opt, opt);
                if (opt === value) o.selected = true;
                sel.appendChild(o);
            });

            const updateBg = (v) => {
                const colorScheme = col.params?.colorScheme;
                if (colorScheme && v) {
                    const bg = getComboColor(colorScheme, v, options);
                    sel.style.backgroundColor = bg;
                    if (bg) sel.style.color = getContrastColor(bg);
                    else sel.style.color = '';
                } else {
                    sel.style.backgroundColor = ''; sel.style.color = '';
                }
            };

            sel.onchange = (e) => { updateValue(r, c, e.target.value); updateBg(e.target.value); };
            updateBg(value);
            container.appendChild(sel); break;
        case 'qcm':
            const qcmDiv = document.createElement('div'); qcmDiv.className = 'qcm-container';
            const items = Array.isArray(value) ? value : (col.params?.options || []).map(o => ({ label: o, checked: false }));
            items.forEach((item, iIdx) => {
                const l = document.createElement('label'); l.className = 'qcm-item';
                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = item.checked;
                cb.onchange = (e) => { items[iIdx].checked = e.target.checked; updateValue(r, c, items); };
                l.appendChild(cb); l.append(item.label); qcmDiv.appendChild(l);
            });
            container.appendChild(qcmDiv); break;
        case 'popup':
            const w = document.createElement('div'); w.className = 'popup-wrapper';
            w.innerHTML = `<div class="popup-badge">Preuves</div><div class="popup-content">${value || "Vide"}</div>`;
            container.appendChild(w); break;
        case 'ia':
            const d = document.createElement('div'); d.className = 'ia-cell';
            const b = document.createElement('button'); b.className = 'btn-ia'; b.innerHTML = "✨ Générer";
            b.onclick = () => runIA(r, c, col, b, txtIA, preview);

            // Zone de saisie éditable
            const txtIA = document.createElement('textarea');
            txtIA.className = 'ia-textarea'; // Assurez-vous d'avoir du CSS pour ça ou utilisez le style par défaut
            txtIA.value = value || "";
            txtIA.placeholder = "Le résultat de l'IA s'affichera ici...";
            txtIA.oninput = (e) => {
                updateValue(r, c, e.target.value);
                // Mise à jour de la prévisualisation Markdown en temps réel (optionnel mais sympa)
                if (preview) preview.innerHTML = marked.parse(e.target.value);
            };

            // Prévisualisation Markdown (Optionnel, garder pour l'affichage riche)
            const preview = document.createElement('div');
            preview.id = `ia-${r}-${c}`;
            preview.className = 'ia-content';
            preview.innerHTML = value ? marked.parse(value) : "";
            // On masque la preview si on veut juste éditer, ou on l'affiche en dessous. 
            // Pour l'instant, affichons les deux ou juste le textarea selon le besoin. 
            // Le user a demandé "le champs qui accueillent le résultat de la requête IA soit un champs de saisie".
            // Donc le textarea est prioritaire.

            d.appendChild(b);
            d.appendChild(txtIA);
            // d.appendChild(preview); // Décommenter si on veut garder le rendu MD en plus
            container.appendChild(d); break;
        default: container.innerText = value || ""; break;
    }
}

async function runIA(r, c, col, btn, textareaInput, previewDiv) {
    // 1. Récupération du modèle configuré
    const modelName = col.params?.modele;
    if (!modelName) return alert("Aucun modèle IA configuré pour cette colonne.");

    const modelConfig = auditAvailableModels.find(m => m.nom === modelName);
    if (!modelConfig) return alert(`Le modèle '${modelName}' est introuvable dans la configuration.`);

    // 2. Préparation du contexte (Colonnes sélectionnées)
    const fmt = (v, t) => { if (t === 'qcm' && Array.isArray(v)) return v.map(i => `${i.label}:${i.checked ? '[x]' : '[ ]'}`).join("\n"); return v; };
    const contextData = {};

    if (col.params?.colonnes?.length) {
        col.params.colonnes.forEach(colLabel => {
            const idx = currentForm.columns.findIndex(cl => cl.label === colLabel); // Attention: ici on utilise label car c'est ce qu'on a stocké
            if (idx !== -1) {
                const val = currentForm.rows[r][idx];
                contextData[colLabel] = fmt(val, currentForm.columns[idx].type);
            }
        });
    }

    // 3. Construction du message (Format Spécifique Demandé)
    // "messages": [
    //   { "role": "system", "content": "ici tu reprendras le prompt du modèle..." },
    //   { "role": "user", "content": [ "ici le prompt paramétré...", { "colonne 1" : "valeur..." } ] }
    // ]

    const messages = [
        {
            "role": "system",
            "content": modelConfig.prompt || "Tu es un assistant expert."
        },
        {
            "role": "user",
            "content": [
                col.params?.requete || "Analyse :",
                contextData
            ]
        }
    ];

    btn.innerText = "⏳"; btn.disabled = true;
    try {
        // On passe la config COMPLÈTE du modèle et les messages
        const res = await window.ApiService.fetchLLM(modelConfig, messages);

        // Mise à jour valeur et UI
        updateValue(r, c, res);
        if (textareaInput) textareaInput.value = res;
        if (previewDiv) previewDiv.innerHTML = marked.parse(res);

    } catch (e) {
        alert("Erreur IA: " + e.message);
    } finally {
        btn.innerText = "✨ Générer"; btn.disabled = false;
    }
}
