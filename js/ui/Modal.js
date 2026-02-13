/**
 * EZIO - UI COMPONENT: MODAL
 * Standardized modal creation and management.
 */

import { Utils } from '../core/Utils.js';

export class Modal {
    constructor(id, title, contentHTML, actions = []) {
        this.id = id;
        this.title = title;
        this.contentHTML = contentHTML;
        this.actions = actions; // Array of { label, class, onClick }
        this.element = null;
    }

    render() {
        // Remove existing if any
        const existing = document.getElementById(this.id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = this.id;
        modal.className = 'modal';
        modal.style.display = 'block'; // Show immediately

        const actionsHTML = this.actions.map((action, idx) => `
            <button class="${action.class || 'btn-secondary'} action-btn-${idx}">${action.label}</button>
        `).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>${Utils.escapeHtml(this.title)}</h3>
                <div class="modal-body">${this.contentHTML}</div>
                <div class="modal-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this.bindEvents();
    }

    bindEvents() {
        if (!this.element) return;

        // Close button
        const closeBtn = this.element.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });

        // Action buttons
        this.actions.forEach((action, idx) => {
            const btn = this.element.querySelector(`.action-btn-${idx}`);
            if (btn && action.onClick) {
                btn.onclick = (e) => action.onClick(e, this);
            }
        });
    }

    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
