/**
 * EZIO - SCHEMAS
 * Simple data validation schemas.
 */

export const Schemas = {
    /**
     * Validate data against a schema
     * @param {Object} data 
     * @param {Object} schema 
     * @returns {boolean} isValid
     */
    validate: (data, schema) => {
        if (!data) return false;
        // Simple structural check
        // Schema is an object where keys are expected types or properties
        // This is a lightweight validator, not a full Joi implementation

        for (const key in schema) {
            const expectedType = schema[key];

            if (expectedType === 'array') {
                if (!Array.isArray(data[key])) {
                    console.warn(`Schema Validation Failed: '${key}' expected array.`);
                    return false;
                }
            } else if (expectedType === 'object') {
                if (typeof data[key] !== 'object' || Array.isArray(data[key])) {
                    console.warn(`Schema Validation Failed: '${key}' expected object.`);
                    return false;
                }
            } else if (typeof expectedType === 'string') {
                if (typeof data[key] !== expectedType) {
                    // Optional check? For now strict
                    // If key is missing but expected, undefined !== type
                    if (data[key] === undefined) {
                        console.warn(`Schema Validation Failed: '${key}' is missing.`);
                        return false;
                    }
                }
            }
        }
        return true;
    },

    // DEFINITIONS
    REPORTS_DATA: {
        reports: 'array',
        modules: 'array'
    },

    MODELS_LIST: {
        // Validation for array root is tricky with this simple object structure
        // We will handle array root in Utils if needed or just validate items?
        // Let's assume this schema validates an ITEM of the list if we map, 
        // OR we wrap it.
    }
};
