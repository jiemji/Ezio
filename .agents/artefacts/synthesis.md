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
│   ├── core/               # Cœur applicatif (11 fichiers)
│   │   ├── State.js        # Singleton d'état global (typé JSDoc)
│   │   ├── Store.js        # Persistance localStorage + auto-réparation
│   │   ├── Config.js       # Constantes, couleurs, seuils
│   │   ├── Schemas.js      # Validation JSON
│   │   ├── DataUtils.js    # Logique métier pure (tri, filtre)
│   │   ├── AIContextBuilder.js # Bâtisseur de contexte IA & Rapports
│   │   ├── Types.js        # Centralisation JSDoc (@typedef)
│   │   ├── MarkdownUtils.js# AST Markdown + conversion HTML↔MD
│   │   ├── IOManager.js    # Lectures/écritures fichiers centralisées
│   │   ├── UIFactory.js    # Composants UI (boutons, badges, toasts)
│   │   └── Utils.js        # Helpers (slugify, escapeHtml, debounce)
│   ├── ui/                 # Couche interface (5 fichiers)
│   │   ├── Navigation.js   # Hash-router SPA (#audit, #dashboard…)
│   │   ├── Sidebar.js      # Menu latéral rétractable
│   │   ├── Modal.js        # Service de modales
│   │   ├── Notes.js        # Gestion des notes
│   │   └── DOM.js          # Cache de sélecteurs DOM
│   ├── api/
│   │   └── api_ia.js       # Abstraction multi-provider (LM Studio, OpenAI, Groq)
│   ├── components/         # Web Components natifs (5)
│   │   ├── EzioToast.js    # <ezio-toast>
│   │   ├── EzioWidget.js   # <ezio-widget>
│   │   ├── EzioMarkdownEditor.js  # <ezio-markdown-editor>
│   │   ├── EzioDeliveryCard.js    # <ezio-delivery-card>
│   │   └── EzioReportEditor.js    # <ezio-report-editor>
│   └── modules/            # Modules fonctionnels (15 fichiers)
│       ├── app_audit.js            # Orchestrateur Grille d'audit
│       ├── AuditRenderer.js        # Rendu de la grille (MVC)
│       ├── AuditSidebar.js         # Menu hiérarchique & state des filtres
│       ├── app_dashboard.js        # KPIs + Chart.js
│       ├── WidgetDataTransformer.js # Extraction séries de données
│       ├── WidgetRenderer.js       # Rendu Canvas Chart.js
│       ├── app_deliveries.js       # Livrables IA
│       ├── app_reports.js          # Templates de rapports
│       ├── app_creator.js          # Constructeur de formulaires
│       ├── app_models.js           # Gestion des modèles IA
│       ├── app_export.js           # Export JSON/CSV
│       ├── app_output_word.js      # Export Word (.docx)
│       ├── app_outputppt.js        # Export PowerPoint (Orchestrateur)
│       ├── PptSlideBuilders.js     # Export PowerPoint (Bâtisseur)
│       └── app_impression_logic.js # Orchestrateur d'impression
├── css/                    # 7 feuilles (shared + par module)
├── config/                 # Fichiers de configuration
│   ├── formats.json
│   ├── models.json         # Configuration des LLM
│   ├── output_config.json  # Templates Word/PPT
│   ├── reports.json        # Définitions de rapports
│   └── templates.json
├── templates/              # Fichiers d'audit pré-remplis + modèle Word
└── docs/                   # Documentation technique (6 fichiers)
```

---

## Modules Fonctionnels

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

## Web Components

| Composant | Fichier | Créé en |
|---|---|---|
| `<ezio-toast>` | `js/components/EzioToast.js` | Phase 3 |
| `<ezio-widget>` | `js/components/EzioWidget.js` | Phase 3 |
| `<ezio-markdown-editor>` | `js/components/EzioMarkdownEditor.js` | Phase 4 |
| `<ezio-delivery-card>` | `js/components/EzioDeliveryCard.js` | Phase 4 |
| `<ezio-report-editor>` | `js/components/EzioReportEditor.js` | Phase 5 |

---

## Bilan du Refactoring

| Phase | Statut | Points clés |
|---|---|---|
| Phase 1 | ✅ | AST Markdown mutualisé, découplage Dashboard (MVC), Action Router livrables |
| Phase 2 | ✅ | Store Pub/Sub, IOManager centralisé, UIFactory enrichie |
| Phase 3 | ✅ Partielle | Error Boundaries ✅, Web Components ✅, JSDoc abandonné |
| Phase 4 | ✅ | `<ezio-markdown-editor>` WC, `<ezio-delivery-card>` WC, nettoyage Créateur |
| Phase 5 | ✅ | `<ezio-report-editor>` WC, extraction `AuditSidebar.js` (-32% `app_audit.js`) |
| Phase 6 | ✅ | Modularisation PPT (`PptSlideBuilders.js`), `AIContextBuilder.js`, `Types.js` |

Version actuelle : **v2.7.0** (26/03/2026)
