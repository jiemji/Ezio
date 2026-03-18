/**
 * EZIO - CORE STORE
 * Centralized State Management (Observer Pattern)
 */
export class Store {
    constructor(storageKey, initialState = {}) {
        this.key = storageKey;
        this.state = initialState;
        this.listeners = {}; // { topicName: [listeners...] }
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
     * @param {string} topic Optional topic to notify
     */
    set(newState, topic = '*') {
        this.state = newState;
        this.save();
        this.notify(topic);
    }

    /**
     * Update partial state (shallow merge)
     * @param {Object} partialState 
     * @param {string} topic Optional topic to notify
     */
    update(partialState, topic = '*') {
        this.state = { ...this.state, ...partialState };
        this.save();
        this.notify(topic);
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
                console.error(`Store: Erreur critique lors du chargement de '${this.key}'. Les données sont corrompues.`, e);
                // Sauvegarde de secours au cas où
                localStorage.setItem(`${this.key}_backup_corrupted`, saved);
                localStorage.removeItem(this.key);

                // If UI is loaded, show a toast, else it will just reset cleanly
                setTimeout(() => {
                    if (window.UI && window.UI.showToast) {
                        window.UI.showToast(`Les données de sauvegarde étaient corrompues et ont été réinitialisées.`, 'error');
                    } else {
                        alert("Erreur critique: Les données sauvegardées étaient corrompues. L'application a été réinitialisée.");
                    }
                }, 1000); // Slight delay to ensure UI is ready
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
     * @param {string|Function} topicOrListener Topic string or listener function (defaults to '*')
     * @param {Function} [listenerFunc] Listener if topic is string
     * @returns {Function} unsubscribe function
     */
    subscribe(topicOrListener, listenerFunc) {
        let topic = '*';
        let listener = topicOrListener;

        if (typeof topicOrListener === 'string') {
            topic = topicOrListener;
            listener = listenerFunc;
        }

        if (!this.listeners[topic]) {
            this.listeners[topic] = [];
        }
        this.listeners[topic].push(listener);

        return () => {
            if (this.listeners[topic]) {
                this.listeners[topic] = this.listeners[topic].filter(l => l !== listener);
            }
        };
    }

    /**
     * Notify listeners of a specific topic, plus the global '*' listeners
     * @param {string} topic 
     */
    notify(topic = '*') {
        const toNotify = new Set();

        // Add specific topic listeners
        if (this.listeners[topic]) {
            this.listeners[topic].forEach(l => toNotify.add(l));
        }

        // Add global listeners if topic is not already '*'
        if (topic !== '*' && this.listeners['*']) {
            this.listeners['*'].forEach(l => toNotify.add(l));
        }

        toNotify.forEach(listener => listener(this.state, topic));
    }
}
