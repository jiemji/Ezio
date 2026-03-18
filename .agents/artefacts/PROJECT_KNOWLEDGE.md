# Documentation Technique - Projet Ezio

**Ezio** est une application web "Local-First" conçue pour la gestion d'audits, la création de formulaires dynamiques et le pilotage assisté par Intelligence Artificielle.

---

## 1. Stack Technique
Le projet est construit avec une stack minimaliste et robuste pour assurer une exécution sans dépendances complexes ni étape de build.

*   **HTML5 / CSS3** : Structure et design responsif (Variables CSS, Flexbox/Grid).
*   **JavaScript (Vanilla ES6+)** : Logique applicative native.
*   **Librairies Externes** (via CDN) :
    *   `Chart.js` : Visualisation de données (Dashboard).
*   **Fonts** : `Inter` (Corps) et `Outfit` (Titres) via Google Fonts.
*   **Design** : Approche "Premium" avec variables CSS (Thèmes Clair/Sombre), Glassmorphism et Ombres portées.
*   **Stockage** : `localStorage` pour la persistance des données et `JSON` pour l'import/export.

---

## 2. Architecture des Fichiers

### Diagramme de Flux (Architecture Simplifiée)

```mermaid
graph TD
    User((Utilisateur))
    
    subgraph UI [Interface Utilisateur]
        Nav[Navigation.js]
        Side[Sidebar.js]
        Mod[Modal.js]
        Toast[UIFactory.js]
    end

    subgraph Components [Web Components natifs]
        W_Toast["<ezio-toast>"]
        W_Widget["<ezio-widget>"]
    end

    subgraph Modules [Modules Fonctionnels]
        Audit[app_audit.js]
        Renderer[AuditRenderer.js]
        Dlv[app_deliveries.js]
        Dash[app_dashboard.js]
    end

    subgraph Core [Cœur Applicatif]
        State[State.js]
        Logic[DataUtils.js]
        IO[IOManager.js]
        Config[Config.js]
        API[api_ia.js]
    end

    %% Interactions
    User -->|Clics/Saisie| Audit
    User -->|Navigation| Nav
    
    Audit -->|Met à jour (Pub/Sub)| State
    Audit -->|Calcule| Logic
    Audit -->|Appelle IA| API
    Audit -->|Context| Renderer
    
    Renderer -->|Génère HTML| User
    Renderer -->|Bind Events| Audit
    
    Dlv -->|Lit| State
    Dlv -->|Génère Doc| API
    Dash -->|Instancie| W_Widget
    
    State -->|Persistance| LocalStorage[(LocalStorage)]
    State -->|Notifie| Audit
```

### Core & Structure
*   `index.html` : Point d'entrée unique. Charge le module principal via `<script type="module" src="js/main.js">`.
*   `js/main.js` : Point d'entrée JavaScript. Initialise l'application et les modules.
*   `js/core/State.js` : **État Global**. Singleton gérant les données de l'application (`currentForm`, `reportsStore`) et la persistance (`Store.js`).
*   `js/core/Utils.js` : Helpers basiques (slugify, escapeHtml, **debounce**) et extensions de prototypes.
*   `js/core/DataUtils.js` : **Logique Métier Pure**. Contient les algorithmes de tri, filtrage, recherche et traitement des données. Totalement découplé du DOM.
*   `js/core/UIFactory.js` : **Composants UI**. Bibliothèque de générateurs d'éléments (Boutons, Badges, Toasts) pour une UX cohérente. Remplace les `alert()` par des Toasts.
*   `js/core/Config.js` : Constantes (Couleurs, Seuils, Valeurs par défaut).
*   `js/core/Schemas.js` : Validation et structures de données par défaut.

### UI & Navigation (`js/ui/`)
*   `Navigation.js` : **Vue Routeur**. Écoute les changements d'URL (`hashchange`) pour instancier et afficher le bon module.
*   `Sidebar.js` : Gestionnaire générique de listes latérales.
*   `Modal.js` : Service de fenêtres modales.
*   `MarkdownEditor.js` : Composant d'édition de texte enrichi (WYSIWYG) avec barre d'outils et conversion Markdown.
*   `DOM.js` : Cache des sélecteurs DOM fréquents.

### Modules Fonctionnels (`js/modules/`)
1.  **Module Audit (`app_audit.js` & `AuditRenderer.js`)** : Contrôleur et Vue de l'audit. Utilise la délégation d'événements.
2.  **Module IA (`js/api/api_ia.js`)** : Couche d'abstraction vers les LLMs (LM Studio, OpenAI, Groq).
3.  **Module Dashboard (`app_dashboard.js`)** : Génération de KPIs avec Chart.js.
4.  **Module Créateur (`app_creator.js`)** : Outil de configuration de formulaires.
5.  **Module Modèles (`app_models.js`)** : Interface de gestion du fichier `models.json`.
6.  **Module Rapports (`app_reports.js` & `ReportsRenderer.js`)** : Gestion des Modèles de Rapports.
7.  **Module Livrables (`app_deliveries.js`)** : Moteur de Génération de livrables avec MarkdownEditor.
8.  **Module Export (Data) (`app_export.js`)** : Export JSON/CSV.
9.  **Module Output Word (`app_output_word.js`)** : Module dédié à l'export Word (docx).
10. **Module Impression & Output (`app_outputppt.js`, `app_output_word.js`)** : Menu d'impression global vers Word et PPTX.
11. **Outil d'Extraction PowerPoint (`extract.html`)** : Récupère les layouts XML depuis PPTX.

---

## 3. Structure des Données (JSON)
L'état de l'application (`currentForm`) repose sur une structure JSON standardisée (`columns`, `rows`, `statics`, `deliveries`).

---

## 4. Gestion des Rapports & Livrables
*   **Rapports (Templates)** : Listes d'IDs modules stockées dans `reports.json`.
*   **Livrables (Instances)** : Copies complètes stockées dans `currentForm.deliveries`.

---

## 5. Configuration & Modèles IA
Stockée dans `models.json` pour appeler l'API.

---

## 6. Détails Techniques - Flux IA
*   **Audit** : RAG Contextuel sur une seule ligne.
*   **Livrables** : RAG Global (Batch) basé sur Markdown table.
*   **LM Studio** : Conversion en payload `{ type: "text" }` pour contourner les limitations locales.

---

## 7. Gestion Dynamique des Lignes
*   La propriété `rowMeta` tracke les lignes ajoutées/clonées pour permettre leur suppression.
