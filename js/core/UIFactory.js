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

    /**
     * Render a standard Icon Button HTML
     * @param {string} icon 
     * @param {string} title 
     * @param {string} cssClass 
     * @param {object} attrs Data attributes { 'data-id': 123 }
     * @returns {string} HTML
     */
    renderIconButton: (icon, title, cssClass = '', attrs = {}) => {
        const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
        return `<button class="btn-icon-action ${cssClass}" title="${Utils.escapeHtml(title)}" ${attrStr}>${icon}</button>`;
    },

    /**
     * Show a toast notification
     * @param {string} message 
     * @param {string} type 'success' | 'danger' | 'info' | 'warning'
     * @param {number} duration ms
     */
    showToast: (message, type = 'info', duration = 3000) => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            // Simple inline styles to avoid dependency on css file update for now
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Colors mapping based on Config (or hardcoded for simplicity of this factory)
        const colors = {
            success: '#22c55e',
            danger: '#ef4444',
            warning: '#eab308',
            info: '#3b82f6'
        };
        const bgColor = colors[type] ?? colors.info;
        const textColor = '#fff';

        toast.style.cssText = `
            background-color: ${bgColor};
            color: ${textColor};
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            font-size: 0.9em;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s, transform 0.3s;
            min-width: 250px;
        `;
        toast.innerText = message;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, duration);
    }
};
