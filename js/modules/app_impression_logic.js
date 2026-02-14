import { Modal } from '../ui/Modal.js';
import { downloadDeliveryWord } from './app_output_word.js';
import { downloadDeliveryPpt } from './app_outputppt.js';

/**
 * Affiche la popup d'impression
 */
export function showImpressionPopup(delivery) {
    const modalContent = `
        <div id="impressionContent" style="min-width: 400px;">
            <p class="loading-msg">Chargement des configurations...</p>
        </div>
    `;

    const modal = new Modal('modalImpression', 'Impression', modalContent);
    modal.render();

    // Charger la config
    fetch('output_config.json')
        .then(res => res.json())
        .then(config => {
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
                btn.onclick = () => {
                    const path = btn.getAttribute('data-path');
                    downloadWordWithTemplate(delivery, path);
                    modal.close();
                };
            });

            container.querySelectorAll('.btn-tpl-ppt').forEach(btn => {
                btn.onclick = () => {
                    const tplId = btn.getAttribute('data-id');
                    downloadDeliveryPpt(delivery, tplId);
                    modal.close();
                };
            });

        })
        .catch(err => {
            console.error(err);
            const container = document.getElementById('impressionContent');
            if (container) container.innerHTML = `<div class="text-danger">Erreur de chargement: ${err.message}</div>`;
        });
}

/**
 * Télécharge le modèle Word depuis le serveur puis lance la génération
 */
function downloadWordWithTemplate(delivery, templatePath) {
    if (!templatePath) {
        // Fallback sans template
        downloadDeliveryWord(delivery, null);
        return;
    }

    fetch(templatePath)
        .then(res => {
            if (!res.ok) throw new Error("Impossible de télécharger le modèle");
            return res.arrayBuffer();
        })
        .then(buffer => {
            downloadDeliveryWord(delivery, buffer);
        })
        .catch(err => {
            console.error(err);
            alert("Erreur chargement modèle Word : " + err.message);
        });
}
