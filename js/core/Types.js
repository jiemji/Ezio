/**
 * @typedef {Object} Column
 * @property {string} id - Unique identifier for the column
 * @property {string} label - Display label
 * @property {string} type - Column type (e.g., 'text', 'chapitre', 'combobox', 'qcm')
 * @property {Object} [params] - Type-specific parameters (options, colors, etc.)
 */

/**
 * @typedef {Array<any>} Row
 * An array representing a single row in the audit table, where each element corresponds to a column.
 */

/**
 * @typedef {Object} AuditData
 * @property {Column[]} columns - List of column definitions
 * @property {Row[]} rows - The raw data rows
 * @property {Array<any>} rowMeta - Metadata for each row (usually used for tracking or internal state)
 * @property {Array<any>} statics - Static data/references
 * @property {string} notes - Global notes for the audit
 * @property {Delivery[]} deliveries - List of associated deliverables
 */

/**
 * @typedef {Object} DeliveryModule
 * @property {string} id - Unique identifier
 * @property {string} name - Module name
 * @property {string} [result] - Generated content in Markdown
 * @property {Object} [config] - Module specific configuration (scope, columns, ai prompt, etc.)
 * @property {string} [contextTable] - Generated Markdown table context
 */

/**
 * @typedef {Object} Delivery
 * @property {string} id - Unique identifier
 * @property {string} name - Deliverable name
 * @property {DeliveryModule[]} structure - Modules composing the deliverable
 * @property {string} [templateId] - Bound template ID
 */

/**
 * @typedef {Object} ThemePPT
 * @property {string} primary - Primary color hex
 * @property {string} secondary - Secondary color hex
 * @property {string} text - Default text color hex
 * @property {string} background - Background color hex
 */

/**
 * @typedef {Object} TemplatePPT
 * @property {string} id - Unique ID
 * @property {string} name - Template name
 * @property {ThemePPT} theme - Color theme
 * @property {Object} fonts - { title: string, body: string }
 * @property {Object} masters - Dictionary of master slide definitions
 * @property {Object} [tableFormat] - Default formatting for PPT tables
 */

// This file is purely for JSDoc documentation and is not meant to be executed dynamically 
// beyond serving as a type reference for modern IDEs.
export const Types = {};
