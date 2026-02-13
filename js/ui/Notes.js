import { DOM } from './DOM.js';
import { store, currentForm } from '../core/State.js';

export function initNotes() {
    // Toggle
    if (DOM.btnToggleNotes && DOM.notesContainer) {
        DOM.btnToggleNotes.onclick = () => {
            DOM.notesContainer.classList.toggle('hidden');
            if (!DOM.notesContainer.classList.contains('hidden')) {
                if (DOM.notesTextarea) DOM.notesTextarea.focus();
            }
        };

        // Close
        if (DOM.btnCloseNotes) {
            DOM.btnCloseNotes.onclick = () => DOM.notesContainer.classList.add('hidden');
        }

        // Drag Logic
        const notesHeader = DOM.notesContainer.querySelector('.notes-header');
        if (notesHeader) {
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            notesHeader.onmousedown = (e) => {
                if (e.target.closest('button')) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = DOM.notesContainer.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;

                DOM.notesContainer.style.right = 'auto';
                DOM.notesContainer.style.bottom = 'auto';
                DOM.notesContainer.style.left = `${initialLeft}px`;
                DOM.notesContainer.style.top = `${initialTop}px`;
                DOM.notesContainer.style.transition = 'none';
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                DOM.notesContainer.style.left = `${initialLeft + dx}px`;
                DOM.notesContainer.style.top = `${initialTop + dy}px`;
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    DOM.notesContainer.style.transition = '';
                }
            });
        }
    }

    // Input Listener
    if (DOM.notesTextarea) {
        // Init value
        DOM.notesTextarea.value = currentForm.notes || "";

        DOM.notesTextarea.oninput = (e) => {
            currentForm.notes = e.target.value;
            store.update({ notes: e.target.value });
        };

        // Subscribe to store updates to keep notes in sync if changed elsewhere
        store.subscribe((state) => {
            if (document.activeElement !== DOM.notesTextarea) {
                DOM.notesTextarea.value = state.notes || "";
            }
        });
    }
}
