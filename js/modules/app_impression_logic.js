import { Modal } from '../ui/Modal.js';
import { downloadDeliveryWord } from './app_output_word.js';
import { downloadDeliveryPpt } from './app_outputppt.js';
import { UI } from '../core/UIFactory.js';

/**
 * Affiche la popup d'impression
 */
/**
 * Affiche la popup d'impression
 */
export async function showImpressionPopup(delivery) {
    const modalContent = `
        <div id="impressionContent" style="min-width: 400px;">
            <p class="loading-msg">Chargement des configurations...</p>
        </div>
    `;

    const modal = new Modal('modalImpression', 'Impression', modalContent);
    modal.render();

    // Charger la config
    try {
        const res = await fetch('output_config.json');
        const config = await res.json();

        const container = document.getElementById('impressionContent');
        if (!container) return;

        let html = `<div style="display:flex; gap:20px;">`;

        // Colonne Word
        html += `<div style="flex:1;">
            <h4 style="border-bottom:1px solid #ccc; padding-bottom:5px;">Modèles Word</h4>
            <div class="list-group">`;

        if (config.documents && config.documents.length > 0) {
            config.documents.forEach((doc, idx) => {
                html += `<button class="list-group-item btn-doc-word" data-path="${doc.path}" data-name="${doc.name}">${doc.name}</button>`;
            });
        } else {
            html += `<div style="font-style:italic; color:#666;">Aucun modèle Word</div>`;
        }
        html += `</div></div>`;

        // Colonne PPT
        html += `<div style="flex:1;">
            <h4 style="border-bottom:1px solid #ccc; padding-bottom:5px;">Modele Powerpoint</h4>
            <div class="list-group">`;

        if (config.templates && config.templates.length > 0) {
            config.templates.forEach((tpl, idx) => {
                html += `<button class="list-group-item btn-tpl-ppt" data-id="${tpl.id}">${tpl.name}</button>`;
            });
        } else {
            html += `<div style="font-style:italic; color:#666;">Aucun modèle PPT</div>`;
        }
        html += `</div></div>`;

        html += `</div>`;
        container.innerHTML = html;

        // Bind Events
        container.querySelectorAll('.btn-doc-word').forEach(btn => {
            btn.onclick = async () => {
                const path = btn.getAttribute('data-path');
                const oldText = btn.innerHTML;
                btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
                btn.disabled = true;
                try {
                    await downloadWordWithTemplate(delivery, path);
                } finally {
                    modal.close();
                }
            };
        });

        container.querySelectorAll('.btn-tpl-ppt').forEach(btn => {
            btn.onclick = async () => {
                const tplId = btn.getAttribute('data-id');
                const oldText = btn.innerHTML;
                btn.innerHTML = `<span class="rpt-loading">↻</span> Génération...`;
                btn.disabled = true;
                try {
                    await downloadDeliveryPpt(delivery, tplId);
                } finally {
                    modal.close();
                }
            };
        });

    } catch (err) {
        console.error(err);
        const container = document.getElementById('impressionContent');
        if (container) container.innerHTML = `<div class="text-danger">Erreur de chargement: ${err.message}</div>`;
    }
}

/**
 * Télécharge le modèle Word depuis le serveur puis lance la génération
 */
async function downloadWordWithTemplate(delivery, templatePath) {
    if (!templatePath) {
        // Fallback sans template
        await downloadDeliveryWord(delivery, null);
        return;
    }

    try {
        const res = await fetch(templatePath);
        if (!res.ok) throw new Error("Impossible de télécharger le modèle");
        const buffer = await res.arrayBuffer();
        await downloadDeliveryWord(delivery, buffer);
    } catch (err) {
        console.error(err);
        UI.showToast("Erreur chargement modèle Word : " + err.message, "danger");
    }
}
