# Phase 6 — Stabilité & Finitions (Proposition)

## Objectif
Finaliser le refactoring en s'attaquant aux derniers gros fichiers monolithiques et en améliorant la robustesse du typage (JSDoc).

## Axes Proposés

### Axe 1 : Refactoring des Exports (`app_outputppt.js`)
**Problème** : C'est le plus gros fichier restant (554 lignes). Il mélange orchestration, parsing Markdown v2, et dessin bas-niveau PptxGenJS.
**Solution Appliquée** :
#### [NEW] [PptSlideBuilders.js](file:///g:/devapps/Ezio/js/modules/PptSlideBuilders.js)
- Contiendra `drawMasterElements`, `parseMarkdownToSlide`, `addPptTable`, `formatAndPushRuns`.
- Sera l'unité spécialisée dans la conversion AST → Diapositives.
#### [MODIFY] [app_outputppt.js](file:///g:/devapps/Ezio/js/modules/app_outputppt.js)
- Ne conservera que `downloadDeliveryPpt` et `loadPptConfig`.
- Deviendra un simple orchestrateur de 150-200 lignes.

### Axe 2 : Spécialisation de `DataUtils.js`
**Problème** : `DataUtils.js` mélange le filtrage d'Audit, le calcul du Dashboard, et la préparation du contexte IA.
**Solution** : Scinder en `DataUtils.js` (Pure logic) et `AIContextBuilder.js` (Logique spécifique aux prompts).

### Axe 3 : Typage JSDoc (Axe 7 reporté)
**Problème** : Les objets `currentForm` et `config` circulent sans définition de type, rendant le refactoring dangereux.
**Solution** : Ajouter des définitions `@typedef` globales dans un fichier `types.d.ts` (virtuel via JSDoc) pour bénéficier de l'autocomplétion.

## Gains Attendus
| Module | Lignes Actuelles | Cible |
|---|---|---|
| `app_outputppt.js` | 467 | ~300 |
| `DataUtils.js` | 245 | ~150 |
