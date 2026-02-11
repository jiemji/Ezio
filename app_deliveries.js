/**
 * EZIO - MODULE LIVRABLES (DELIVERIES)
 * Gère la génération des rendus à partir des modèles de rapports.
 * Les instances sont stockées dans window.EzioData.deliveries (fichier Audit).
 * Les modèles proviennent de reports.json.
 */

const AppDeliveries = (() => {
    // -- ETAT LOCAL --
    let availableTemplates = []; // From reports.json
    let availableModels = []; // From models.json
    // Livrables are stored in window.EzioData.deliveries (accessed directly)

    let selection = { id: null }; // { id: instanceId }

    // -- DOM ELEMENTS --
    const els = {
        container: document.getElementById('deliveries-view'),
        sidebar: document.querySelector('#deliveries-view .deliveries-sidebar'),
        main: document.querySelector('#deliveries-view .deliveries-main'),
        listDeliveries: null
    };

    /**
     * Initialisation principale
     */
    async function init() {
        console.log("AppDeliveries: Init...");

        // Ensure DOM reference (might be hidden initially)
        els.container = document.getElementById('deliveries-view');
        els.sidebar = document.querySelector('#deliveries-view .deliveries-sidebar');
        els.main = document.querySelector('#deliveries-view .deliveries-main');

        // 1. Setup UI
        setupSidebar();

        // 2. Charger les dépendances
        await loadTemplates();
        await loadModelsList();

        // 3. Ensure Data Structure in Audit
        if (window.EzioData) {
            if (!window.EzioData.deliveries) window.EzioData.deliveries = [];
        }

        // 4. Update UI
        renderSidebarList();
        renderMainView();
    }

    /**
     * Structure de la Sidebar
     */
    function setupSidebar() {
        if (!els.sidebar) return;

        els.sidebar.innerHTML = `
            <!-- Header Section -->
            <div class="dlv-sidebar-header">
                <h3>Livrables</h3>
            </div>

            <!-- Deliveries List Section -->
            <div class="dlv-section-list">
                <div class="section-title">
                    <span>Mes Livrables</span>
                    <button id="btnAddDelivery" class="btn-icon-small" title="Nouveau Livrable">+</button>
                </div>
                <div id="dlvList" class="dlv-list-container"></div>
            </div>
        `;

        // Bind References
        els.listDeliveries = document.getElementById('dlvList');

        // Bind Events
        document.getElementById('btnAddDelivery').addEventListener('click', handleAddDelivery);
    }

    async function loadTemplates() {
        try {
            const res = await fetch('reports.json');
            if (res.ok) {
                const json = await res.json();
                availableTemplates = json.reports || [];
                // We also need availableModules to resolve module names later!
                // Let's store them loosely or fetch them.
                // For simplicity, let's attach modules to templates or store global.
                // We'll trust existing `AppReports` logic or Fetch again?
                // Fetch again to be independent.
                window.EzioReportsModules = json.modules || [];
            }
        } catch (e) {
            console.error("AppDeliveries: Error loading reports.json", e);
        }
    }

    async function loadModelsList() {
        try {
            const res = await fetch('models.json');
            if (res.ok) availableModels = await res.json();
        } catch (e) {
            console.warn("AppDeliveries: Impossible de charger models.json");
        }
    }

    /**
     * Rendu de la Sidebar
     */
    function renderSidebarList() {
        if (!els.listDeliveries || !window.EzioData || !window.EzioData.deliveries) return;

        els.listDeliveries.innerHTML = '';
        window.EzioData.deliveries.forEach(del => {
            const el = document.createElement('div');
            el.className = 'dlv-item';
            if (selection.id === del.id) el.classList.add('selected');

            el.innerHTML = `
                <span class="dlv-name">${escapeHtml(del.name)}</span>
                <span class="dlv-date">${new Date(del.created).toLocaleDateString()}</span>
            `;

            el.addEventListener('click', () => {
                selection = { id: del.id };
                renderSidebarList();
                renderMainView();
            });

            els.listDeliveries.appendChild(el);
        });
    }

    /**
     * Rendu Vue Principale (Horizontal Editor)
     */
    function renderMainView() {
        if (!els.main) return;

        if (!selection.id) {
            els.main.innerHTML = `
                <div class="deliveries-empty-state">
                    <p>Sélectionnez un livrable pour voir son contenu ou en créer un nouveau.</p>
                </div>`;
            return;
        }

        const delivery = window.EzioData.deliveries.find(d => d.id === selection.id);
        if (!delivery) return;

        // Header
        const headerHTML = `
            <div class="dlv-editor-header">
                <input type="text" id="inpDlvName" class="form-control" style="font-size: 1.2rem; font-weight: bold; width: 300px;" value="${escapeHtml(delivery.name)}">
                <div class="dlv-actions">
                    <button id="btnDeleteDelivery" class="btn-danger small" style="margin-left:10px;">🗑️ Supprimer ce Livrable</button>
                </div>
            </div>
        `;

        // Body (Horizontal Track)
        let trackHTML = `<div class="dlv-horizontal-track">`;

        const instances = delivery.structure || [];

        if (instances.length === 0) {
            trackHTML += `<div style="padding:2rem;">Ce livrable est vide (étrange pour un livrable basé sur un modèle...).</div>`;
        } else {
            instances.forEach((inst, idx) => {
                // Find source module info (Name, Type) from Loaded Modules
                const sourceMod = (window.EzioReportsModules || []).find(m => m.id === inst.sourceId) || { name: 'Module (Source Introuvable)', type: '?' };

                const config = inst.config || {};
                const aiPrompt = config.ai ? (config.ai.prompt || '') : '';
                const aiModel = config.ai ? (config.ai.model || '') : '';

                trackHTML += `
                    <div class="dlv-card" data-idx="${idx}">
                        <div class="dlv-card-header">
                             <div class="dlv-card-nav">
                                ${idx > 0 ? `<button class="btn-card-action btn-move-left" data-idx="${idx}" title="Reculer">&lt;</button>` : ''}
                                <span style="font-weight:bold; font-size:0.9rem;">${idx + 1}. ${escapeHtml(sourceMod.name)}</span>
                                ${idx < instances.length - 1 ? `<button class="btn-card-action btn-move-right" data-idx="${idx}" title="Avancer">&gt;</button>` : ''}
                             </div>
                             <!-- No Delete Module here, we adhere to template? Or allow modification? User said "Livrable can read reports.json... reports created in audit json" -->
                             <!-- Be permissive: Allow delete from delivery instance -->
                             <div class="dlv-card-actions">
                                <button class="btn-card-action danger btn-remove-mod" data-idx="${idx}" title="Retirer du livrable">🗑️</button>
                             </div>
                        </div>
                        <div class="dlv-card-body">
                            <!-- Customisation Instance -->
                            <div class="form-group">
                                <label>Prompt IA (Instance)</label>
                                <textarea class="form-control txt-inst-prompt" data-idx="${idx}" rows="6">${escapeHtml(aiPrompt)}</textarea>
                            </div>
                             <div class="form-group">
                                <label>Modèle IA</label>
                                <select class="form-control slc-inst-model" data-idx="${idx}">
                                    <option value="">-- Défaut --</option>
                                    ${availableModels.map(m => `<option value="${m.model}" ${m.model === aiModel ? 'selected' : ''}>${m.nom}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="dlv-card-footer">
                             <button class="btn-primary small btn-generate" data-idx="${idx}" style="width:100%;">Tester / Générer</button>
                             <div class="dlv-card-result">${inst.result ? marked.parse(inst.result) : ''}</div>
                        </div>
                    </div>
                `;
            });
        }
        trackHTML += `</div>`;

        els.main.innerHTML = headerHTML + `<div class="dlv-editor-body">${trackHTML}</div>`;

        // -- EVENTS --

        // Rename
        document.getElementById('inpDlvName').addEventListener('change', (e) => {
            delivery.name = e.target.value;
            saveState(); // Call global saveState via persistence hook or direct access if possible?
            // AppShared 'saveState' saves 'currentForm'. 'window.EzioData' IS 'currentForm'.
            // But we need to trigger localStorage write.
            // app_shared.js doesn't expose saveState publicly.
            // But modifying window.EzioData updates the object.
            // We need a way to persist.
            // WORKAROUND: Trigger a custom event or duplicate save logic?
            // Let's rely on 'saveBtn' in main header for FULL save, but for intermediate interactions we might lose data on refresh if not saved.
            // BETTER: Expose saveState in window from app_shared.js
            if (window.AppShared && window.AppShared.save) window.AppShared.save(); // Hypothetical
            else localStorage.setItem('ezio_audit_data', JSON.stringify(window.EzioData)); // Direct write fallback

            renderSidebarList();
        });

        // Delete Delivery
        document.getElementById('btnDeleteDelivery').addEventListener('click', () => {
            if (confirm("Supprimer ce livrable ?")) {
                window.EzioData.deliveries = window.EzioData.deliveries.filter(d => d.id !== selection.id);
                selection = { id: null };
                persist();
                renderSidebarList();
                renderMainView();
            }
        });

        // Generate
        els.main.querySelectorAll('.btn-generate').forEach(btn => {
            btn.onclick = () => generateModule(delivery, parseInt(btn.dataset.idx));
        });

        // Move
        els.main.querySelectorAll('.btn-move-left').forEach(btn => {
            btn.onclick = () => moveModule(delivery, parseInt(btn.dataset.idx), -1);
        });
        els.main.querySelectorAll('.btn-move-right').forEach(btn => {
            btn.onclick = () => moveModule(delivery, parseInt(btn.dataset.idx), 1);
        });
        // Remove
        els.main.querySelectorAll('.btn-remove-mod').forEach(btn => {
            btn.onclick = () => removeModule(delivery, parseInt(btn.dataset.idx));
        });

        // Config Changes
        els.main.querySelectorAll('.txt-inst-prompt').forEach(txt => {
            txt.onchange = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (!delivery.structure[idx].config.ai) delivery.structure[idx].config.ai = {};
                delivery.structure[idx].config.ai.prompt = e.target.value;
                persist();
            };
        });
        els.main.querySelectorAll('.slc-inst-model').forEach(slc => {
            slc.onchange = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (!delivery.structure[idx].config.ai) delivery.structure[idx].config.ai = {};
                delivery.structure[idx].config.ai.model = e.target.value;
                persist();
            };
        });
    }

    /**
     * Creation Process: Select Template
     */
    function handleAddDelivery(e) {
        e.stopPropagation();

        // Modal pour choisir le template
        const modalId = 'modalDlvTemplate';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.display = 'block';

        const listHTML = availableTemplates.map(t => `
            <div class="template-item" data-id="${t.id}" style="padding:1rem; border-bottom:1px solid #eee; cursor:pointer;">
                <strong>${escapeHtml(t.name)}</strong>
                <div style="font-size:0.8rem; color:#666;">${t.structure ? t.structure.length : 0} modules</div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" style="float:right; cursor:pointer;">&times;</span>
                <h3>Nouveau Livrable</h3>
                <p>Choisissez un modèle de rapport de base :</p>
                <div class="dlv-template-list" style="max-height:400px; overflow-y:auto; border:1px solid #ddd;">
                    ${listHTML || '<div style="padding:1rem;">Aucun modèle disponible.</div>'}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Events
        modal.querySelector('.close-modal').onclick = () => modal.remove();

        modal.querySelectorAll('.template-item').forEach(item => {
            item.onclick = () => {
                const tplId = item.dataset.id;
                createDeliveryFromTemplate(tplId);
                modal.remove();
            };
        });

        window.onclick = (event) => { if (event.target === modal) modal.remove(); };
    }

    function createDeliveryFromTemplate(tplId) {
        const template = availableTemplates.find(t => t.id === tplId);
        if (!template) return;

        const newId = 'dlv_' + Date.now();

        // Clone structure DEED COPY
        const structureClone = (template.structure || []).map(inst => {
            // New Instance ID to allow independent tracking if needed
            return {
                sourceId: inst.sourceId,
                instanceId: 'inst_' + Date.now() + Math.random().toString(36).substr(2, 5),
                config: JSON.parse(JSON.stringify(inst.config || {})),
                result: null // Reset result
            };
        });

        const newDelivery = {
            id: newId,
            name: template.name + ' (Copie)',
            created: new Date().toISOString(),
            structure: structureClone
        };

        if (!window.EzioData.deliveries) window.EzioData.deliveries = [];
        window.EzioData.deliveries.push(newDelivery);
        persist();

        selection = { id: newId };
        renderSidebarList();
        renderMainView();
    }

    /**
     * GENERATION LOGIC (Copied from AppReports)
     */
    async function generateModule(delivery, index) {
        const instance = delivery.structure[index];
        const card = els.main.querySelector(`.dlv-card[data-idx="${index}"]`);
        if (!card) return;

        const btn = card.querySelector('.btn-generate');
        const resultContainer = card.querySelector('.dlv-card-result');

        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
        btn.disabled = true;
        resultContainer.innerHTML = '';

        try {
            const auditData = window.EzioData;
            if (!auditData || !auditData.rows) throw new Error("Aucune donnée d'audit.");

            const contextData = await buildContext(instance.config.scope, auditData);

            const prompt = instance.config.ai.prompt || "Analyse ces données.";
            const modelKey = instance.config.ai.model;

            if (!modelKey) throw new Error("Aucun modèle IA sélectionné.");

            const modelConfig = availableModels.find(m => m.model === modelKey);
            if (!modelConfig) throw new Error("Configuration du modèle introuvable.");

            const messages = [
                { role: 'system', content: prompt },
                { role: 'user', content: JSON.stringify(contextData) }
            ];

            const response = await window.ApiService.fetchLLM(modelConfig, messages);

            instance.result = response;
            persist();

            resultContainer.innerHTML = marked.parse(response);

        } catch (e) {
            console.error("Generation Error", e);
            resultContainer.innerHTML = `<div style="color:var(--danger)">Erreur : ${e.message}</div>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async function buildContext(scope, data) {
        // Same context logic
        const labels = data.columns.map(c => c.label);
        let rows = data.rows;
        // Scope logic... placeholder for now
        return rows.map(row => {
            const obj = {};
            row.forEach((cell, idx) => {
                const label = labels[idx] || `Col_${idx}`;
                if (cell !== null && cell !== "") obj[label] = cell;
            });
            return obj;
        });
    }

    // Helpers
    function moveModule(delivery, index, direction) {
        if (index + direction < 0 || index + direction >= delivery.structure.length) return;
        const temp = delivery.structure[index];
        delivery.structure[index] = delivery.structure[index + direction];
        delivery.structure[index + direction] = temp;
        persist();
        renderMainView();
    }

    function removeModule(delivery, index) {
        if (confirm("Retirer ce module du livrable ?")) {
            delivery.structure.splice(index, 1);
            persist();
            renderMainView();
        }
    }

    function persist() {
        localStorage.setItem('ezio_audit_data', JSON.stringify(window.EzioData));
    }

    function escapeHtml(text) {
        if (!text) return text;
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    return { init };
})();
