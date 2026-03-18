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

        // Background / Overlay
        const modal = document.createElement('div');
        modal.id = this.id;
        modal.className = 'modal';
        modal.style.display = 'block'; // Show immediately

        // Content Wrapper
        const contentDiv = document.createElement('div');
        contentDiv.className = 'modal-content';

        // Close button
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-modal';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.close();

        // Title
        const titleEl = document.createElement('h3');
        titleEl.textContent = this.title;

        // Body
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'modal-body';
        if (typeof this.contentHTML === 'string') {
            bodyDiv.innerHTML = this.contentHTML;
        } else if (this.contentHTML instanceof HTMLElement) {
            bodyDiv.appendChild(this.contentHTML);
        }

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'modal-actions';

        this.actions.forEach((action) => {
            const btn = document.createElement('button');
            btn.className = action.class || 'btn-secondary';
            btn.textContent = action.label;
            if (action.onClick) {
                btn.onclick = (e) => action.onClick(e, this);
            }
            actionsDiv.appendChild(btn);
        });

        // Assemble
        contentDiv.appendChild(closeBtn);
        contentDiv.appendChild(titleEl);
        contentDiv.appendChild(bodyDiv);
        contentDiv.appendChild(actionsDiv);
        modal.appendChild(contentDiv);

        document.body.appendChild(modal);
        this.element = modal;
        this.bindEvents();
    }

    bindEvents() {
        if (!this.element) return;

        // Click outside to close (background overlay)
        window.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
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
