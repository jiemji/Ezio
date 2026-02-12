/**
 * EZIO - UI COMPONENT: SIDEBAR
 * reusable sidebar list renderer.
 */

import { Utils } from '../core/Utils.js';

export class Sidebar {
    constructor(containerId, title, items = [], options = {}) {
        this.containerId = containerId;
        this.title = title;
        this.items = items; // Array of objects
        this.options = Object.assign({
            onItemClick: null,
            onAddClick: null,
            itemRenderer: null // Custom render function (item) => html string
        }, options);

        this.selectionId = null;
        this.element = document.getElementById(this.containerId);
    }

    setItems(items) {
        this.items = items;
        this.render();
    }

    setSelection(id) {
        this.selectionId = id;
        this.renderList(); // Re-render just the list to update selection classes
    }

    render() {
        if (!this.element) {
            this.element = document.getElementById(this.containerId);
            if (!this.element) return;
        }

        const headerHtml = this.title ? `
            <div class="sidebar-header">
                <h3>${Utils.escapeHtml(this.title)}</h3>
            </div>` : '';

        const listTitleHtml = this.options.hideListTitle ? '' : `
            <div class="section-title">
                <span>${this.options.listTitle || 'Liste'}</span>
                ${this.options.onAddClick ? `<button class="btn-icon-small btn-add">+</button>` : ''}
            </div>`;

        this.element.innerHTML = `
            ${headerHtml}
            <div class="sidebar-list-section">
                ${listTitleHtml}
                <div class="sidebar-items-container"></div>
            </div>
        `;

        this.bindHeaderEvents();
        this.renderList();
    }

    renderList() {
        const container = this.element.querySelector('.sidebar-items-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.items.length === 0) {
            container.innerHTML = `<div class="empty-list">Aucun élément</div>`;
            return;
        }

        this.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'sidebar-item';
            if (this.selectionId === item.id) el.classList.add('selected');

            // Default Renderer or Custom
            if (this.options.itemRenderer) {
                el.innerHTML = this.options.itemRenderer(item);
            } else {
                el.innerHTML = `<span class="item-name">${Utils.escapeHtml(item.name || item.id)}</span>`;
            }

            el.onclick = () => {
                this.selectionId = item.id;
                this.renderList(); // Highlight selection
                if (this.options.onItemClick) this.options.onItemClick(item);
            };

            container.appendChild(el);
        });
    }

    bindHeaderEvents() {
        const addBtn = this.element.querySelector('.btn-add');
        if (addBtn && this.options.onAddClick) {
            addBtn.onclick = (e) => {
                e.stopPropagation();
                this.options.onAddClick();
            };
        }
    }
}
