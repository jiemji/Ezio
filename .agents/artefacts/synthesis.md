# Synthèse du Projet Ezio

## Qu'est-ce qu'Ezio ?

**Ezio** est une application web **Single Page, Local-First** dédiée à la **gestion d'audits de conformité** et à la **génération de livrables assistée par Intelligence Artificielle**. Elle fonctionne 100 % dans le navigateur, sans backend ni étape de build — les données persistent dans le `localStorage` et s'échangent via des fichiers JSON.

---

## Stack Technique

| Couche | Technologie |
|---|---|
| Structure | HTML5, point d'entrée unique `index.html` |
| Logique | Vanilla JavaScript **ES6 Modules** (aucun framework) |
| Style | CSS3 variabilisé (thèmes clair/sombre), Glassmorphism, Google Fonts (Inter, Outfit) |
| Graphiques | Chart.js + plugin DataLabels (CDN) |
| Export Office | `PptxGenJS` (PPT), `docx` + `JSZip` (Word) — chargés via CDN |
| Stockage | `localStorage` + import/export JSON |
| IA | Appels HTTP REST vers LM Studio, OpenAI, Groq |

---

## Architecture des Fichiers

```
Ezio/
├── index.html              # SPA – point d'entrée unique
├── extract.html            # Utilitaire autonome d'extraction PPTX
├── js/
│   ├── main.js             # Bootstrap
│   ├── App.js              # Orchestrateur principal
│   ├── core/               # Cœur applicatif (9 fichiers)
│   │   ├── State.js        # Singleton d'état global
│   │   ├── Store.js        # Persistance localStorage + auto-réparation
│   │   ├── Config.js       # Constantes, couleurs, seuils
│   │   ├── Schemas.js      # Validation JSON
│   │   ├── DataUtils.js    # Logique métier pure (tri, filtre, contexte MD)
│   │   ├── MarkdownUtils.js# AST Markdown + conversion HTML↔MD
│   │   ├── IOManager.js    # Lectures/écritures fichiers centralisées
│   │   ├── UIFactory.js    # Composants UI (boutons, badges, toasts)
│   │   └── Utils.js        # Helpers (slugify, escapeHtml, debounce)
│   ├── ui/                 # Couche interface (6 fichiers)
│   │   ├── Navigation.js   # Hash-router SPA (#audit, #dashboard…)
│   │   ├── Sidebar.js      # Menu latéral rétractable
│   │   ├── Modal.js        # Service de modales
│   │   ├── MarkdownEditor.js # Éditeur riche WYSIWYG ↔ Markdown
│   │   ├── Notes.js        # Gestion des notes
│   │   └── DOM.js          # Cache de sélecteurs DOM
│   ├── api/
│   │   └── api_ia.js       # Abstraction multi-provider (LM Studio, OpenAI, Groq)
│   ├── components/         # Web Components natifs
│   │   ├── EzioToast.js    # <ezio-toast>
│   │   └── EzioWidget.js   # <ezio-widget>
│   └── modules/            # Modules fonctionnels (15 fichiers)
│       ├── app_audit.js & AuditRenderer.js     # Grille d'audit (MVC)
│       ├── app_dashboard.js                    # KPIs + Chart.js
│       ├── WidgetDataTransformer.js & WidgetRenderer.js # Données → Canvas
│       ├── app_deliveries.js & DeliveriesRenderer.js    # Livrables IA
│       ├── app_reports.js & ReportsRenderer.js          # Templates de rapports
│       ├── app_creator.js                      # Constructeur de formulaires
│       ├── app_models.js                       # Gestion des modèles IA
│       ├── app_export.js                       # Export JSON/CSV
│       ├── app_output_word.js                  # Export Word (.docx)
│       ├── app_outputppt.js                    # Export PowerPoint (.pptx)
│       └── app_impression_logic.js             # Orchestrateur d'impression
├── css/                    # 7 feuilles (shared + par module)
├── config/                 # Fichiers de configuration
│   ├── models.json         # Modèles IA (providers, prompts, endpoints)
│   ├── reports.json        # Templates de rapports (listes de modules)
│   ├── output_config.json  # Config export Word/PPT (masters, styles, tableaux)
│   ├── formats.json        # Formats disponibles
│   └── templates.json      # Références de templates
├── templates/              # Fichiers d'audit pré-remplis (ISO27002, ISO42001, GHI…)
├── tools/                  # Utilitaires Excel (Xls2Ezio.xlsm, mockup)
└── docs/                   # Documentation technique (5 fichiers)
```

---

## Modules Fonctionnels — Vue d'ensemble

| # | Module | Rôle |
|---|---|---|
| 1 | **Audit** | Grille tabulaire dynamique, IA contextuelle ligne par ligne (RAG simple) |
| 2 | **Dashboard** | KPIs Chart.js — croisements dynamiques, DataLabels, % |
| 3 | **Livrables** | Génération de rapports via IA global (RAG batch), éditeur WYSIWYG |
| 4 | **Rapports** | Gestion de templates (listes ordonnées de modules réutilisables) |
| 5 | **Créateur** | Import JSON → formulaire Ezio (types de colonnes, prompts IA, couleurs) |
| 6 | **Modèles IA** | CRUD `models.json`, test de connexion, propriétés `locked` / `outil` |
| 7 | **Export** | JSON complet / CSV |
| 8 | **Impression** | Export Word (`.docx` template + `{{CONTENU}}`) & PowerPoint (pagination auto) |
| 9 | **Extracteur PPT** | Rétro-ingénierie XML `.pptx` → JSON `output_config` |

---

## Flux IA

1. **Audit (ligne par ligne)** : System prompt (`models.json`) + User prompt (colonne) + contexte JSON de la ligne → réponse dans la cellule IA.
2. **Livrables (batch)** : Scope (global ou chapitre) → filtre colonnes → génération d'un tableau Markdown → envoi à l'IA → résultat dans l'éditeur WYSIWYG.
3. **Outils IA** : Modèles marqués `outil: true` → baguette magique dans l'éditeur Markdown (traduction, correction…).
4. **Adaptateur LM Studio** : Payload structuré `{ type: "text" }` pour contourner les limitations des petits modèles locaux.

---

## Données — Structure JSON (`currentForm`)

```
currentForm
├── columns[]        # Définitions (id, label, type, params, colorScheme…)
├── rows[][]         # Valeurs (tableau de tableaux)
├── rowMeta[]        # Métadonnées (isAdded pour les lignes clonées)
├── statics[]        # Widgets du Dashboard (vizType, columnId…)
└── deliveries[]     # Instances de rapports (structure de modules + résultats IA)
```

---

## Design & UX

- **Thème premium** : palette Midnight/Indigo (sombre) et Beige/Sable/Rose poudré (clair)
- **Hash Navigation** : routeur SPA natif (`#audit`, `#dashboard`, `#deliveries`…)
- **Sidebar rétractable** avec handle hover + épinglage
- **Web Components** : `<ezio-toast>`, `<ezio-widget>` pour isolation et réutilisabilité
- **Délégation d'événements** généralisée pour la performance sur de gros jeux de données

---

## État du Refactoring

| Phase | Statut | Points clés |
|---|---|---|
| Phase 1 | ✅ Complète | AST Markdown mutualisé, découplage Dashboard (MVC), Action Router livrables |
| Phase 2 | ✅ Complète | Store Pub/Sub, IOManager centralisé, UIFactory enrichie |
| Phase 3 | ✅ Partielle | Error Boundaries ✅, Web Components ✅, JSDoc abandonné |
| Phase 4 | 📋 Proposée | MarkdownEditor → Web Component, Refonte Créateur, Cartes Livrables WC |

---

## Documentation Existante

| Fichier | Contenu |
|---|---|
| [PROJECT_KNOWLEDGE.md](file:///g:/devapps/Ezio/docs/PROJECT_KNOWLEDGE.md) | Architecture complète, stack, structure JSON, détails IA |
| [ARCHITECTURE_REVIEW.md](file:///g:/devapps/Ezio/docs/ARCHITECTURE_REVIEW.md) | Axes de refactoring Phases 1→4 |
| [IA_IMPLEMENTATION.md](file:///g:/devapps/Ezio/docs/IA_IMPLEMENTATION.md) | Spécifications fonctionnelles & techniques de l'IA |
| [OUTPUT_CONFIG_GUIDE.md](file:///g:/devapps/Ezio/docs/OUTPUT_CONFIG_GUIDE.md) | Guide de configuration exports Word/PPT |
| [CHANGELOG.md](file:///g:/devapps/Ezio/docs/CHANGELOG.md) | Historique des versions (v1.0 → v2.6) |
| [documentation.html](file:///g:/devapps/Ezio/docs/documentation.html) | Documentation HTML embarquée |
