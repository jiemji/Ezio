/**
 * EZIO - IO MANAGER
 * Centralizes file reading, parsing, and exporting logic safely.
 */
import { UI } from './UIFactory.js';
import { Utils } from './Utils.js';

export const IOManager = {
    /**
     * Reads a File object as Text.
     * @param {File} file 
     * @returns {Promise<string>}
     */
    readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Erreur de lecture du fichier texte."));
            reader.readAsText(file);
        });
    },

    /**
     * Reads a File object as ArrayBuffer.
     * @param {File} file 
     * @returns {Promise<ArrayBuffer>}
     */
    readAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Erreur de lecture du fichier binaire."));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Reads a JSON file safely and parses it.
     * @param {File} file 
     * @returns {Promise<Object>}
     */
    async readJSON(file) {
        try {
            const text = await this.readAsText(file);
            return JSON.parse(text);
        } catch (error) {
            UI.showToast("Fichier JSON invalide: " + error.message, "danger");
            throw error;
        }
    },

    /**
     * Downloads data as a file.
     * @param {string} content The string content
     * @param {string} filename The file name
     * @param {string} mimeType The mime type
     */
    downloadFile(content, filename, mimeType = "application/json") {
        const dataStr = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", filename);
        dlAnchorElem.click();
    },

    /**
     * Downloads an ArrayBuffer or Blob
     * @param {Blob|ArrayBuffer} data 
     * @param {string} filename 
     */
    downloadBlob(data, filename) {
        let blob = data;
        if (!(data instanceof Blob)) {
            blob = new Blob([data]);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
