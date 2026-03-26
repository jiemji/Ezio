import { Utils } from '../core/Utils.js';
import { UI } from '../core/UIFactory.js';
import { downloadDeliveryWidgets } from './app_dashboard.js';
import { currentForm } from '../core/State.js';
import { DataUtils } from '../core/DataUtils.js';
import { AIContextBuilder } from '../core/AIContextBuilder.js';
import { drawMasterElements, parseMarkdownToSlide } from './PptSlideBuilders.js';

let pptConfig = null;
async function loadPptConfig() {
    if (pptConfig) return pptConfig;
    try {
        const res = await fetch('config/output_config.json');
        if (res.ok) {
            pptConfig = await res.json();
        } else {
            console.warn("Impossible de charger config/output_config.json, utilisation défaut.");
            pptConfig = { templates: [] }; // Fallback
        }
    } catch (e) {
        console.error("Erreur chargement config/output_config.json", e);
        pptConfig = { templates: [] };
    }
    return pptConfig;
}

/**
 * Génère et télécharge le fichier PowerPoint pour un livrable donné.
 * @param {Object} delivery - L'objet livrable
 * @param {String} templateId - L'ID du template choisi (défini dans ppt_config.json)
 */
export async function downloadDeliveryPpt(delivery, templateId = 'default') {
    if (!delivery || !delivery.structure || !window.PptxGenJS) {
        if (!window.PptxGenJS) UI.showToast("La librairie PptxGenJS n'est pas chargée.", "danger");
        return;
    }

    await loadPptConfig();

    let template = pptConfig.templates.find(t => t.id === templateId);
    if (!template) template = pptConfig.templates[0];
    if (!template) {
        template = {
            name: "Fallback",
            theme: { primary: "003366", secondary: "c43e1c", text: "333333", background: "FFFFFF", surface: "F7F7F7" },
            fonts: { title: "Arial", body: "Arial" },
            masters: {
                TITRE: { elements: [] },
                CHAPITRE: { elements: [] },
                SLIDE: { elements: [], contentArea: { x: 0.5, y: 1.0, w: 9.0, h: 4.5 } }
            }
        };
    }

    const tableFormat = template.tableFormat || pptConfig.tableFormat || {};
    const pptx = new window.PptxGenJS();
    pptx.author = 'Ezio IA';
    pptx.company = 'Ezio';
    pptx.title = delivery.name;

    if (template.layout) {
        pptx.defineLayout({ name: template.layout.name || 'customLayout', width: template.layout.width, height: template.layout.height });
        pptx.layout = template.layout.name || 'customLayout';
    } else {
        pptx.layout = 'LAYOUT_16x9';
    }

    const findMaster = (keys, searchTerms) => {
        let found = keys.find(k => k === searchTerms[0]);
        if (!found) found = keys.find(k => searchTerms.some(term => k.includes(term)));
        return found;
    };

    const masterKeys = Object.keys(template.masters);
    let titleMasterKey = findMaster(masterKeys, ['TITLE_SLIDE', 'TITRE']);
    if (!titleMasterKey && masterKeys.length > 0) titleMasterKey = masterKeys[0];

    const titleMaster = template.masters[titleMasterKey];
    const slideTitle = pptx.addSlide();

    if (titleMaster) {
        if (titleMaster.background && titleMaster.background.color) {
            slideTitle.background = { color: titleMaster.background.color };
        }
        drawMasterElements(pptx, slideTitle, titleMaster.elements, {
            TITLE: delivery.name,
            TITRE: delivery.name,
            DATE: new Date().toLocaleDateString()
        }, template);
    }

    let chapterMasterKey = findMaster(masterKeys, ['CHAPITRE', 'CHAPTER', 'SECTION']);
    let slideMasterKey = findMaster(masterKeys, ['SLIDE', 'CONTENT_SLIDE', 'CONTENU', 'CONTENT']);
    if (!slideMasterKey && masterKeys.length > 1) slideMasterKey = masterKeys[1];

    const chapterMaster = chapterMasterKey ? template.masters[chapterMasterKey] : null;
    const slideMaster = slideMasterKey ? template.masters[slideMasterKey] : null;

    for (let idx = 0; idx < delivery.structure.length; idx++) {
        const inst = delivery.structure[idx];
        const modTitle = inst.name || 'Module';

        if (chapterMaster) {
            const chapSlide = pptx.addSlide();
            if (chapterMaster.background && chapterMaster.background.color) {
                chapSlide.background = { color: chapterMaster.background.color };
            }
            drawMasterElements(pptx, chapSlide, chapterMaster.elements, {
                chapter: modTitle,
                chapitre: modTitle,
                TITLE: modTitle,
                DATE: new Date().toLocaleDateString()
            }, template);
        }

        const createContentSlide = (customTitle) => {
            const slideT = customTitle || modTitle;
            const slide = pptx.addSlide();
            if (slideMaster) {
                if (slideMaster.background && slideMaster.background.color) {
                    slide.background = { color: slideMaster.background.color };
                }
                drawMasterElements(pptx, slide, slideMaster.elements, {
                    title: slideT,
                    MODULE_TITLE: modTitle,
                    SLIDE_NUMBER: (idx + 1).toString(),
                    DATE: new Date().toLocaleDateString()
                }, template);
            } else {
                slide.addText(slideT, { x: 0.5, y: 0.5, fontSize: 18, bold: true, color: '363636' });
            }
            return slide;
        };

        const area = slideMaster?.contentArea || { x: 0.5, y: 1.0, w: 9.0, h: 4.5 };

        if (inst.config?.isTable) {
            inst.contextTable = AIContextBuilder.buildTable(inst.config.scope, inst.config.columns, currentForm);
            if (inst.contextTable) {
                parseMarkdownToSlide(createContentSlide, inst.contextTable, area, template, tableFormat, modTitle);
            }
        }

        if (inst.result) {
            parseMarkdownToSlide(createContentSlide, inst.result, area, template, tableFormat, modTitle);
        }
    }

    try {
        await downloadDeliveryWidgets(delivery);
    } catch (e) {
        console.error("Erreur downloadDeliveryWidgets PPT:", e);
    }

    pptx.writeFile({ fileName: `${Utils.toSlug(delivery.name)}.pptx` });
}
