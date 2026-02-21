/**
 * EZIO - CORE UTILS
 * Common helper functions used across the application.
 */

import { Config } from './Config.js';
import { Schemas } from './Schemas.js';

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
    },

    /**
     * Get contrast text color (black or white) for a given background color
     * @param {string} color (hex or rgb/rgba)
     * @returns {string} HEX color code
     */
    getContrastColor: (color) => {
        if (!color) return '';
        let r, g, b;

        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.substr(0, 2), 16);
                g = parseInt(hex.substr(2, 2), 16);
                b = parseInt(hex.substr(4, 2), 16);
            }
        } else if (color.startsWith('rgb')) {
            const vals = color.match(/\d+/g);
            if (vals) {
                [r, g, b] = vals.map(Number);
            }
        } else {
            return '';
        }

        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    },

    /**
     * Get color from a scheme for a specific value in a list of options
     * @param {string} scheme Color scheme name
     * @param {string} value Current value
     * @param {string[]} options List of all possible options
     * @returns {string} Color code (rgba or hex)
     */
    /**
     * Get color from a scheme for a specific value in a list of options
     * @param {string} scheme Color scheme name
     * @param {string} value Current value
     * @param {string[]} options List of all possible options
     * @returns {string} Color code (rgba or hex)
     */
    getComboColor: (scheme, value, options) => {
        if (!scheme || !value || !options || options.length === 0) return '';
        const index = options.indexOf(value);
        if (index === -1) return '';

        // Check if scheme exists in Config
        if (Config.COLORS.SCHEMES[scheme]) {
            const schemeData = Config.COLORS.SCHEMES[scheme];

            // If it's an array (Fixed Scheme like alert6)
            if (Array.isArray(schemeData)) {
                if (index >= schemeData.length) return schemeData[schemeData.length - 1];
                return schemeData[index];
            }

            // If it's a string (Gradient Base RGB like 'blue')
            if (typeof schemeData === 'string') {
                const rgb = schemeData;
                let alpha = 0.9;
                if (options.length > 1) {
                    const startAlpha = 0.1; const endAlpha = 0.9;
                    const step = (endAlpha - startAlpha) / (options.length - 1);
                    alpha = startAlpha + (index * step);
                }
                alpha = Math.round(alpha * 100) / 100;
                return `rgba(${rgb}, ${alpha})`;
            }
        }

        return '';
    },

    /**
     * Safe fetch wrapper with error handling and optional validation
     * @param {string} url 
     * @param {Object} options 
     * @param {Object|null} schema Optional schema to validate response
     * @returns {Promise<any>} JSON response or null
     */
    safeFetch: async (url, options = {}, schema = null) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                console.warn(`Utils.safeFetch: Response not OK for ${url} (${response.status})`);
                return null;
            }
            const data = await response.json();

            if (schema) {
                if (!Schemas.validate(data, schema)) {
                    console.error(`Utils.safeFetch: Validation failed for ${url}`);
                    return null;
                }
            }

            return data;
        } catch (error) {
            console.error(`Utils.safeFetch: Error fetching ${url}`, error);
            return null;
        }
    }
};
