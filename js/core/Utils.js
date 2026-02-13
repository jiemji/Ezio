/**
 * EZIO - CORE UTILS
 * Common helper functions used across the application.
 */

export const Utils = {
    /**
     * Generate a unique ID with a prefix
     * @param {string} prefix 
     * @returns {string}
     */
    generateId: (prefix = 'id') => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Escape HTML characters to prevent XSS
     * @param {string} text 
     * @returns {string}
     */
    escapeHtml: (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /**
     * Convert string to slug (URL friendly)
     * @param {string} str 
     * @returns {string}
     */
    toSlug: (str) => {
        if (!str) return '';
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    },

    /**
     * Debounce function execution
     * @param {Function} func 
     * @param {number} wait 
     * @returns {Function}
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Download content as file
     * @param {string} content 
     * @param {string} filename 
     * @param {string} mimeType 
     */
    downloadFile: (content, filename, mimeType = 'text/plain') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Download data as JSON file
     * @param {Object} data 
     * @param {string} filename 
     */
    downloadJSON: (data, filename) => {
        Utils.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
    }
};
