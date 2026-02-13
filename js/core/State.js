import { Store } from './Store.js';

const STORAGE_KEY = 'ezio_audit_data';

// Initial State Schema
const INITIAL_STATE = {
    columns: [],
    rows: [],
    rowMeta: [],
    statics: [],
    notes: "",
    deliveries: [] // Ensure deliveries array exists
};

// Initialize Store
export const store = new Store(STORAGE_KEY, INITIAL_STATE);

// Live binding for currentForm
export let currentForm = store.get();

store.subscribe((newState) => {
    currentForm = newState;
    // console.log("State Updated:", newState);
});

// Legacy support if needed (can be removed later)
window.EzioStore = store;
window.EzioData = currentForm;
