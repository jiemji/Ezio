/**
 * Ezio Configuration
 * Centralizes constants, colors, and defaults.
 */
export const Config = {
    // Application Info
    APP_NAME: 'Ezio Audit',
    VERSION: '1.0.0',

    // Storage Keys
    STORAGE_KEYS: {
        AUDIT_DATA: 'ezio_audit_data',
        REPORTS_DATA: 'ezio_reports_data'
    },

    // UI Colors & Palettes
    COLORS: {
        // Semantic
        SUCCESS: '#22c55e',
        WARNING: '#eab308',
        DANGER: '#ef4444',
        INFO: '#3b82f6',

        // Schemes for Combo/Charts
        SCHEMES: {
            'alert6': ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#000000'],
            'alert3': ['#22c55e', '#eab308', '#ef4444'],
            'rainbow': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'],

            // Gradients base RGB
            'blue': '59, 130, 246',
            'green': '34, 197, 94',
            'red': '239, 68, 68',
            'purple': '168, 85, 247',
            'orange': '249, 115, 22',
            'yellow': '234, 179, 8'
        }
    },

    // Defaults
    DEFAULTS: {
        MODEL_IA: 'gpt-4o-mini',
        EXPORT_FILENAME: 'export_ezio'
    }
};
