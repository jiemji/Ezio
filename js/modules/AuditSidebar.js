/**
 * EZIO - AUDIT SIDEBAR
 * Manages the chapter/sub-chapter sidebar navigation and filter state.
 * Extracted from app_audit.js to reduce its size and separate concerns.
 *
 * Exports:
 *   - auditFilters  : reactive filter/sort/search state object
 *   - renderSidebar(onFilterChange) : renders the chapter hierarchy sidebar
 *   - resetFilters() : clears all filters and search
 *   - getStatusText(visibleCount) : returns formatted status indicator string
 */

import { currentForm } from '../core/State.js';

// --- Filter State (shared with app_audit.js) ---

export const auditFilters = {
    chapter: null,
    subChapter: null,
    columnFilters: {},
    sort: { colIndex: -1, direction: 'asc' },
    search: ''
};

export function resetFilters() {
    auditFilters.chapter = null;
    auditFilters.subChapter = null;
    auditFilters.columnFilters = {};
    auditFilters.sort = { colIndex: -1, direction: 'asc' };
    auditFilters.search = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
}

// --- Sidebar Rendering ---

export function renderSidebar(onFilterChange) {
    const chapterList = document.getElementById('chapterList');
    if (!chapterList) return;
    chapterList.innerHTML = '';

    const chapColIdx = currentForm.columns.findIndex(c => c.type === 'chapitre');
    const subChapColIdx = currentForm.columns.findIndex(c => c.type === 'sous-chapitre');

    if (chapColIdx === -1) return;

    const hierarchy = new Map();
    let totalCount = 0;

    currentForm.rows.forEach(row => {
        const chapName = row[chapColIdx] || 'Sans chapitre';
        const subChapName = subChapColIdx !== -1 ? (row[subChapColIdx] ?? null) : null;

        if (!hierarchy.has(chapName)) {
            hierarchy.set(chapName, { count: 0, subChapters: new Map() });
        }

        const chapObj = hierarchy.get(chapName);
        chapObj.count++;
        totalCount++;

        if (subChapName) {
            const currentSubCount = chapObj.subChapters.get(subChapName) || 0;
            chapObj.subChapters.set(subChapName, currentSubCount + 1);
        }
    });

    // "Vue Globale" item
    const allItem = document.createElement('li');
    allItem.className = `chapter-item ${(!auditFilters.chapter) ? 'active' : ''}`;
    allItem.innerHTML = `<span>Vue Globale</span> <span class="count-badge">${totalCount}</span>`;
    allItem.onclick = () => {
        auditFilters.chapter = null;
        auditFilters.subChapter = null;
        auditFilters.columnFilters = {};
        onFilterChange();
    };
    chapterList.appendChild(allItem);

    // Chapter hierarchy
    hierarchy.forEach((data, chapName) => {
        const isChapActive = auditFilters.chapter === chapName;
        const liChap = document.createElement('li');
        liChap.className = `chapter-item ${isChapActive && !auditFilters.subChapter ? 'active' : ''}`;
        liChap.innerHTML = `<span>${chapName}</span> <span class="count-badge">${data.count}</span>`;
        liChap.onclick = () => {
            auditFilters.chapter = chapName;
            auditFilters.subChapter = null;
            onFilterChange();
        };

        const subUl = document.createElement('ul');
        subUl.className = `sub-chapter-list ${isChapActive ? 'open' : ''}`;

        if (data.subChapters.size > 0) {
            data.subChapters.forEach((count, subName) => {
                const liSub = document.createElement('li');
                const isSubActive = isChapActive && auditFilters.subChapter === subName;
                liSub.className = `sub-chapter-item ${isSubActive ? 'active' : ''}`;
                liSub.innerText = `${subName} (${count})`;
                liSub.onclick = (e) => {
                    e.stopPropagation();
                    auditFilters.chapter = chapName;
                    auditFilters.subChapter = subName;
                    onFilterChange();
                };
                subUl.appendChild(liSub);
            });
        }
        const container = document.createElement('div');
        container.appendChild(liChap);
        if (data.subChapters.size > 0) container.appendChild(subUl);
        chapterList.appendChild(container);
    });
}

// --- Status Indicator ---

export function getStatusText(visibleCount) {
    const status = [];
    if (auditFilters.chapter) status.push(`Chap: ${auditFilters.chapter}`);
    if (auditFilters.subChapter) status.push(`Sous-Chap: ${auditFilters.subChapter}`);
    const filterCount = Object.keys(auditFilters.columnFilters).length;
    if (filterCount > 0) status.push(`Filtres actifs: ${filterCount}`);
    if (status.length === 0) status.push('Vue Globale');
    if (auditFilters.search) status.push(`Rech: "${auditFilters.search}"`);
    return `${status.join(' | ')} (${visibleCount} lignes)`;
}
