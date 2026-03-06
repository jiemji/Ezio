export class EzioToast extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.timeoutId = null;
    }

    connectedCallback() {
        const message = this.getAttribute('message') || 'Notification';
        const type = this.getAttribute('type') || 'info'; // 'info', 'success', 'warning', 'error'
        const duration = parseInt(this.getAttribute('duration')) || 3000;

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                background-color: var(--surface);
                color: var(--text);
                padding: 1rem 1.5rem;
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-lg);
                z-index: 9999;
                font-size: 0.875rem;
                font-weight: 500;
                transform: translateY(100px);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                border-left: 4px solid var(--border);
            }

            :host(.show) {
                transform: translateY(0);
                opacity: 1;
            }

            :host([type="success"]) { border-left-color: var(--success); }
            :host([type="error"]) { border-left-color: var(--danger); }
            :host([type="warning"]) { border-left-color: var(--warning); }
            :host([type="info"]) { border-left-color: var(--primary); }

            .icon {
                font-size: 1.25rem;
            }
            .message {
                flex: 1;
            }
        `;

        // Content
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        switch (type) {
            case 'success': iconSpan.textContent = '✅'; break;
            case 'error': iconSpan.textContent = '❌'; break;
            case 'warning': iconSpan.textContent = '⚠️'; break;
            default: iconSpan.textContent = 'ℹ️'; break;
        }

        const msgSpan = document.createElement('span');
        msgSpan.className = 'message';
        // HTML is allowed in message, but we might just use innerHTML or DOM creation. 
        // For security, if it's text we use textContent, if it has HTML we use innerHTML (requires trust).
        // Legacy showToast often had B tags. Let's use innerHTML but be aware.
        msgSpan.innerHTML = message;

        this.shadowRoot.append(style, iconSpan, msgSpan);

        // Entrance Animation
        // Small delay to ensure CSS transition triggers after DOM insertion
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add('show');
            });
        });

        // Auto Close
        this.timeoutId = setTimeout(() => {
            this.close();
        }, duration);

        // Click to dismiss
        this.addEventListener('click', () => this.close());
    }

    close() {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.classList.remove('show');

        // Remove from DOM after animation
        setTimeout(() => {
            this.remove();
        }, 300); // 300ms matches transition duration
    }
}

customElements.define('ezio-toast', EzioToast);
