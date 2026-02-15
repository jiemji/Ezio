/**
 * EZIO - CORE STATE
 * Manages the main application state (Audit Data) and Reports state.
 * Acts as a singleton source of truth.
 */
import { Store } from './Store.js';

const STORAGE_KEY = 'ezio_audit_data';

/**
 * Default Audit State Schema
 */
const INITIAL_STATE = {
    columns: [],
    rows: [],
    rowMeta: [],
    statics: [],
    notes: "",
    deliveries: []
};

/**
 * Main Store Instance (Audit)
 * @type {Store}
 */
export const store = new Store(STORAGE_KEY, INITIAL_STATE);

// Live binding for currentForm
export let currentForm = store.get();

store.subscribe((newState) => {
    currentForm = newState;
    // console.log("State Updated:", newState);
});

// Legacy support if needed (can be removed later)
// Legacy support if needed (can be removed later)
window.EzioStore = store;
window.EzioData = currentForm;

// --- REPORTS STORE ---
const STORAGE_KEY_REPORTS = 'ezio_reports_data';
const INITIAL_REPORTS_STATE = {
    reports: [],
    modules: []
};

export const reportsStore = new Store(STORAGE_KEY_REPORTS, INITIAL_REPORTS_STATE);
export let reportsData = reportsStore.get();

reportsStore.subscribe((newState) => {
    reportsData = newState;
});
