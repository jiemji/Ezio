/**
 * EZIO - UI FACTORY
 * Shared UI component generators to ensure consistency and reduce duplication.
 */
import { Utils } from './Utils.js';

export const UI = {
    /**
     * Create a simple icon button
     * @param {string} icon Emoji or icon class
     * @param {Function} onClick Click handler
     * @param {string} title Tooltip text
     * @param {string} classes Extra CSS classes (e.g. 'btn-danger')
     * @returns {string} HTML string (if using template) or Element? 
     * NOTE: For template strings, we return HTML. For DOM, we would return Element.
     * Given the refactoring direction (Template Strings), we return HTML but we can't bind onClick easily.
     * So we return a builder pattern or just string helpers.
     */

    /**
     * Render a standard badge HTML
     * @param {string} label 
     * @param {string} color (css color)
     * @returns {string} HTML
     */
    renderBadge: (label, color = '#eee') => {
        const textColor = Utils.getContrastColor(color);
        return `<span class="badge" style="background-color:${color}; color:${textColor}; padding:2px 6px; border-radius:4px; font-size:0.8em;">${Utils.escapeHtml(label)}</span>`;
    },

    renderIconButton: (icon, title, cssClass = '', attrs = {}) => {
        const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
        return `<button class="btn-icon-action ${cssClass}" title="${Utils.escapeHtml(title)}" ${attrStr}>${icon}</button>`;
    },

    /**
     * Create a standard badge DOM Element
     * @param {string} label 
     * @param {string} color 
     * @returns {HTMLElement}
     */
    createBadge: (label, color = '#eee') => {
        const textColor = Utils.getContrastColor(color);
        const span = document.createElement('span');
        span.className = 'badge';
        span.style.cssText = `background-color:${color}; color:${textColor}; padding:2px 6px; border-radius:4px; font-size:0.8em;`;
        span.textContent = label;
        return span;
    },

    /**
     * Create a standard Icon Button DOM Element
     * @param {string} icon 
     * @param {string} title 
     * @param {string} cssClass 
     * @param {Function} onClick 
     * @returns {HTMLElement}
     */
    createIconButton: (icon, title, cssClass = '', onClick = null) => {
        const btn = document.createElement('button');
        btn.className = `btn-icon-action ${cssClass}`.trim();
        btn.title = title;
        btn.innerHTML = icon; // Icons are often HTML entities
        if (onClick) btn.onclick = onClick;
        return btn;
    },

    /**
     * Show a toast notification
     * @param {string} message 
     * @param {string} type 'success' | 'danger' | 'info' | 'warning'
     * @param {number} duration ms
     */
    showToast: (message, type = 'info', duration = 3000) => {
        const toast = document.createElement('ezio-toast');
        toast.setAttribute('message', message);
        toast.setAttribute('type', type);
        toast.setAttribute('duration', duration);
        document.body.appendChild(toast);
    }
};
