/**
 * EZIO - CORE STORE
 * Centralized State Management (Observer Pattern)
 */
export class Store {
    constructor(storageKey, initialState = {}) {
        this.key = storageKey;
        this.state = initialState;
        this.listeners = [];
        this.load();
    }

    /**
     * Get current state
     */
    get() {
        return this.state;
    }

    /**
     * Replace entire state
     * @param {Object} newState 
     */
    set(newState) {
        this.state = newState;
        this.save();
        this.notify();
    }

    /**
     * Update partial state (shallow merge)
     * @param {Object} partialState 
     */
    update(partialState) {
        this.state = { ...this.state, ...partialState };
        this.save();
        this.notify();
    }

    /**
     * Load from LocalStorage
     */
    load() {
        const saved = localStorage.getItem(this.key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with initial state to ensure structure
                this.state = { ...this.state, ...parsed };
            } catch (e) {
                console.error("Store: Error loading state", e);
            }
        }
    }

    /**
     * Save to LocalStorage
     */
    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.state));
        } catch (e) {
            console.error("Store: Error saving state", e);
        }
    }

    /**
     * Subscribe to changes
     * @param {Function} listener (state) => void
     * @returns {Function} unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners
     */
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
