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
30: │   ├── main.js             # Bootstrap
31: │   ├── App.js              # Orchestrateur principal
32: │   ├── core/               # Cœur applicatif (11 fichiers)
33: │   │   ├── State.js        # Singleton d'état global
34: │   │   ├── Store.js        # Persistance localStorage + auto-réparation
35: │   │   ├── Config.js       # Constantes, couleurs, seuils
36: │   │   ├── Schemas.js      # Validation JSON
37: │   │   ├── DataUtils.js    # Logique métier pure (tri, filtre)
38: │   │   ├── AIContextBuilder.js # Bâtisseur de contexte IA & Rapports (Phase 6)
39: │   │   ├── Types.js        # Centralisation JSDoc (Phase 6)
40: │   │   ├── MarkdownUtils.js# AST Markdown + conversion HTML↔MD
41: │   │   ├── IOManager.js    # Lectures/écritures fichiers centralisées
42: │   │   ├── UIFactory.js    # Composants UI (boutons, badges, toasts)
43: │   │   └── Utils.js        # Helpers (slugify, escapeHtml, debounce)
44: │   ├── ui/                 # Couche interface (5 fichiers)
45: │   │   ├── Navigation.js   # Hash-router SPA (#audit, #dashboard…)
46: │   │   ├── Sidebar.js      # Menu latéral rétractable
47: │   │   ├── Modal.js        # Service de modales
48: │   │   ├── Notes.js        # Gestion des notes
49: │   │   └── DOM.js          # Cache de sélecteurs DOM
50: │   ├── api/
51: │   │   └── api_ia.js       # Abstraction multi-provider (LM Studio, OpenAI, Groq)
52: │   ├── components/         # Web Components natifs
53: │   │   ├── EzioToast.js    # <ezio-toast>
54: │   │   ├── EzioWidget.js   # <ezio-widget>
55: │   │   ├── EzioMarkdownEditor.js  # <ezio-markdown-editor>
56: │   │   ├── EzioDeliveryCard.js    # <ezio-delivery-card>
57: │   │   └── EzioReportEditor.js    # <ezio-report-editor>
58: │   └── modules/            # Modules fonctionnels (13 fichiers)
59: │       ├── app_audit.js                        # Orchestrateur Grille d'audit
60: │       ├── AuditRenderer.js                    # Rendu de la grille (MVC)
61: │       ├── AuditSidebar.js                     # Menu hiérarchique & state des filtres
62: │       ├── app_dashboard.js                    # KPIs + Chart.js
63: │       ├── WidgetDataTransformer.js & WidgetRenderer.js # Données → Canvas
64: │       ├── app_deliveries.js                          # Livrables IA
65: │       ├── app_reports.js                             # Templates de rapports
66: │       ├── app_creator.js                      # Constructeur de formulaires
67: │       ├── app_models.js                       # Gestion des modèles IA
68: │       ├── app_export.js                       # Export JSON/CSV
69: │       ├── app_output_word.js                  # Export Word (.docx)
70: │       ├── app_outputppt.js                    # Export PowerPoint (Orchestrateur)
71: │       ├── PptSlideBuilders.js                 # Export PowerPoint (Bâtisseur) (Phase 6)
72: │       └── app_impression_logic.js             # Orchestrateur d'impression
├── css/                    # 7 feuilles (shared + par module)
├── config/                 # Fichiers de configuration
├── templates/              # Fichiers d'audit pré-remplis (ISO27002, ISO42001, GHI…)
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

## Bilan du Refactoring

| Phase | Statut | Points clés |
|---|---|---|
| Phase 1 | ✅ Complète | AST Markdown mutualisé, découplage Dashboard (MVC), Action Router livrables |
| Phase 2 | ✅ Complète | Store Pub/Sub, IOManager centralisé, UIFactory enrichie |
| Phase 3 | ✅ Partielle | Error Boundaries ✅, Web Components ✅, JSDoc abandonné |
| Phase 4 | ✅ Complète | `<ezio-markdown-editor>` WC, `<ezio-delivery-card>` WC, Nettoyage Créateur |
| Phase 5 | ✅ Complète | `<ezio-report-editor>` WC, extraction `AuditSidebar.js` (`app_audit.js` -32%) |
| Phase 6 | ✅ Complète | Modularisation PPT, spécialisation AIContext, Typage JSDoc |
