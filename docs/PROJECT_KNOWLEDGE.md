# Documentation Technique - Projet Ezio

**Ezio** est une application web "Local-First" conçue pour la gestion d'audits, la création de formulaires dynamiques et le pilotage assisté par Intelligence Artificielle.

---

## 1. Stack Technique
Le projet est construit avec une stack minimaliste et robuste pour assurer une exécution sans dépendances complexes ni étape de build.

*   **HTML5 / CSS3** : Structure et design responsif (Variables CSS, Flexbox/Grid).
*   **JavaScript (Vanilla ES6+)** : Logique applicative native.
*   **Librairies Externes** (via CDN) :
    *   `Chart.js` : Visualisation de données (Dashboard).
    *   `Marked` : Rendu Markdown pour les réponses de l'IA et les Popups informatives.
*   **Stockage** : `localStorage` pour la persistance des données et `JSON` pour l'import/export.

---

## 2. Architecture des Fichiers

### Core & Structure
*   `index.html` : Point d'entrée unique. Charge le module principal via `<script type="module" src="js/main.js">`.
*   `js/main.js` : Point d'entrée JavaScript. Initialise l'application et les modules.
*   `js/core/` :
    *   `State.js` : Gestion centralisée de l'état (`store`, `currentForm`). Remplace l'ancien `app_shared.js`.
    *   `Store.js` : Classe de gestion du `localStorage` et du pattern Observer-Subscribe.
    *   `Utils.js` : Fonctions utilitaires génériques (helpers DOM, formatage, debounce...).
*   `js/ui/` :
    *   `Navigation.js` : Gestion de la navigation entre les vues (`switchView`) et initialisation des modules.
    *   `DOM.js` : Références centralisées aux éléments du DOM.
    *   `Modal.js` : Gestion des fenêtres modales.
    *   `Sidebar.js` : Gestion de la barre latérale et navigation.

### Modules Fonctionnels (`js/modules/`)
1.  **Module Audit (`app_audit.js`)** :
    *   Cœur de l'application.
    *   Rendu dynamique du tableau d'audit (`renderTable`).
    *   Gestion des types de cellules : Texte, Combo (Couleurs), QCM, IA.
    *   Système de filtres (Chapitre/Sous-chapitre) et de tri.

2.  **Module IA (`js/api/api_ia.js`)** :
    *   Couche d'abstraction vers les LLMs.
    *   Supporte **LM Studio** (Local), **OpenAI**, **Groq**.
    *   **Spécificité LM Studio** : Transforme le payload standard en une structure "plate" (`input: [{type:'text'}]`) pour maximiser la compatibilité avec les contextes longs locaux.

3.  **Module Dashboard (`app_dashboard.js`)** :
    *   Génération de KPIs dynamiques basés sur les colonnes "Combo".
    *   Types de graphiques : Camembert, Anneau, Barres, Empilement par chapitre.

4.  **Module Créateur (`app_creator.js`)** :
    *   Outil de configuration pour transformer un JSON plat importé en structure Ezio.
    *   Définition des types de colonnes, paramètres IA (prompts), schémas de couleurs.
    *   **Ajout dynamique de colonnes** : Possibilité d'étendre la structure existante directement depuis l'interface.

5.  **Module Modèles (`app_models.js`)** :
    *   Interface de gestion (CRUD) du fichier `models.json`.
    *   **Test de Connexion** : Vérifie la validité des crédenitals et récupère la liste des modèles disponibles via l'API du provider.

6.  **Module Rapports (`app_reports.js`)** :
    *   Gestion des **Modèles de Rapports** (Templates).
    *   Interface de définition de la structure : Ajout de modules re-utilisables dans une liste verticale.
    *   *Note :* Ce module ne génère plus de contenu, il sert uniquement à définir la structure.

7.  **Module Livrables (`app_deliveries.js`)** :
    *   **Moteur de Génération** : Instancie un modèle de rapport pour créer un livrable unique.
    *   **Interface Horizontale** : Workflow étape par étape pour customiser les prompts, le modèle IA, le périmètre (Scope), les colonnes contextuelles et l'option **"Tableau"** (inclure les données sources dans la réponse).
    *   **Export** : Possibilité de télécharger le livrable complet (concaténation de tous les modules) au format **Markdown** (`.md`).
    *   **Persistance** : Les livrables sont stockés directement dans le fichier d'audit (`ezio_data.json`) sous la clé (`reports` et non plus `deliveries` - *Legacy mismatch fix*). Les résultats générés sont éditables et sauvegardés.

8.  **Module Export (`app_export.js`)** :
    *   Gestion de l'export des données (JSON d'état complet, CSV pour Excel).
    *   Utilisation de l'API `Blob` pour générer le fichier et déclencher le téléchargement navigateur sans backend.
73: 
74: 9.  **Module Output Word (`app_output_word.js`)** :
75:     *   **Export Word Avancé** : Génère des fichiers `.docx` depuis les données de l'application.
76:     *   **Support des Modèles** : Capable de charger un template utilisateur (`.docx`/`.dotx`), de parser son XML interne et d'injecter (greffer) le contenu généré à un emplacement spécifique (tag `{{CONTENT}}`), préservant ainsi toute la mise en page d'origine.
77:     *   **Librairies** : Utilise `docx` pour la génération de contenu et `JSZip` pour la manipulation des archives Word.

10. **Module Output PPT (`app_outputppt.js`)** :
    *   **Génération PPTX** : Crée des présentations PowerPoint natives via `PptxGenJS`.
    *   **Templating JSON** : Système de templates défini par `ppt_config.json`. Permet de déclarer des "Masters" (Titres, Contenu) avec des positions absolues, des couleurs et des polices, sans toucher au code.
    *   **Parsing Markdown** : Convertit le Markdown (Titres, Textes, Tableaux) en éléments natifs PowerPoint (Shapes, Tables) avec gestion basique du débordement.

### Styles (`css/`)
*   `style_shared.css` : Styles globaux, variables, layout de base.
*   `style_audit.css`, `style_dashboard.css`, `style_creator.css` : Styles spécifiques par module.
*   `style_reports.css` : Styles pour l'éditeur de templates.
*   `style_deliveries.css` : Styles pour le générateur de livrables.
*   `style_models.css` : Styles pour la page modèles.
---

## 3. Structure des Données (JSON)

L'état de l'application (`currentForm`) repose sur une structure JSON standardisée :

```json
{
  "columns": [
    {
      "id": "col_1",
      "label": "Conformité",
      "type": "combo", // ou 'question', 'ia', 'qcm'...
      "visible": true,
      "params": {
         "options": ["Oui", "Non", "N/A"],
         "colorScheme": "alert3"
      }
    }
  ],
  "rows": [
    // Tableau de tableaux (valeurs des cellules)
    ["Chapitre 1", "Question A", "Oui", "..."]
  ],
  "statics": [
    // Widgets du Dashboard
    { "id": "widget_1", "vizType": "pie", "columnId": "col_1" }
  ],
  "deliveries": [
    // Instances de rapports générés
    {
      "id": "dlv_123",
      "name": "Rapport Mensuel - Janvier",
      "structure": [ 
          {
              "sourceId": "mod_1",
              "config": {
                  "ai": { "prompt": "...", "model": "..." },
                  "scope": { "type": "chapter", "selection": ["Chap A", "Chap B"] },
                  "columns": ["col_1", "col_3"],
                  "isTable": true
              },
              "result": "Contenu généré..."
          }
      ]
    }
  ]
}
```

---

## 4. Gestion des Rapports & Livrables

L'application distingue désormais la définition du modèle de l'exécution du rapport :

*   **Rapports (Templates)** : Définis dans `reports.json`. Ce sont des structures simplifiées contenant uniquement la liste des IDs des modules à inclure (ex: `["mod_intro", "mod_compliance"]`).
*   **Livrables (Instances)** : Stockés dans le fichier d'audit (`currentForm`). Ce sont des copies complètes des modules, enrichies avec les prompts spécifiques et les résultats générés par l'IA. Au moment de la création d'un livrable, l'application récupère la configuration par défaut de chaque module depuis la bibliothèque.

---

## 5. Configuration & Modèles IA

### Stockage (`models.json`)
C'est le fichier maître pour la configuration des LLM. Il est chargé par `app_audit.js` et `app_creator.js`.
```json
[
  {
    "nom": "Modèle local",
    "provider": "lmstudio",
    "endpoint": "http://localhost:1234/api/v1/chat",
    "model": "qwen-2.5-7b",
    "prompt": "Tu es un auditeur expert..."
  }
]
```

### Note sur `config.json`
Un fichier `config.json` était utilisé précédemment pour charger une configuration globale (`IA_CONFIG`). Bien que le code de chargement existe encore dans `app_shared.js` (souvent commenté ou inutilisé), la logique actuelle privilégie `models.json` pour une gestion multi-modèles plus flexible.

---

## 6. Détails Techniques - Flux IA

Le système utilise une approche **RAG Contextuel (Retrieval-Augmented Generation)** simplifiée, opérant ligne par ligne.

### Structure du Message (Interne)
Dans `app_audit.js` (`runIA`), le message est construit ainsi :
```javascript
const messages = [
    { "role": "system", "content": "Prompt Système (défini dans models.json)" },
    { "role": "user", "content": [
        "Prompt Utilisateur (défini dans la colonne)", 
        { "Conformité": "Non", "Preuve": "..." } // Objet de contexte
    ]}
];
```

### Transformation pour l'API
Le service `api_ia.js` adapte ce format selon le provider.
*   **Standard (OpenAI/Groq)** : Sérialise le tableau `content` en une seule chaîne JSON stringifiée.
*   **LM Studio (`lmStudioDirect`)** : Éclate le message en segments de texte distincts :
    ```json
    "input": [
        { "type": "text", "content": "System Prompt..." },
        { "type": "text", "content": "User Prompt..." },
        { "type": "text", "content": "Conformité:\nNon" }
    ]
    ```
    Cette méthode contourne certaines limitations de parsing des petits modèles locaux.

### Flux IA - Module Livrables (IA Globale)
Le module Livrables utilise un **RAG Global (Batch)** :
1.  **Construction du Contexte** :
    *   Récupère les lignes selon le Scope (Global/Chapitre).
    *   Filtre les colonnes sélectionnées.
    *   Génère un **Tableau Markdown** (`| Col1 | Col2 |...`).
2.  **Message Utilisateur** : Composite `[Instruction, Tableau Markdown]`.
3.  **Sortie** : Si l'option "Tableau" est active, le tableau Markdown est préfixé à l'analyse générée.

---

## 7. Gestion Dynamique des Lignes

### Fonctionnement
*   **Duplication** : Utilisable sur toutes les lignes via le bouton `+`. La nouvelle ligne est une copie profonde (`deep copy`) des données, insérée immédiatement après la ligne source.
*   **Contraintes** :
    *   Les champs `Réponse`, `IA`, `Combo` (sélection) sont réinitialisés.
    *   Les champs `Question` deviennent **éditables** (`textarea`) pour permettre la personnalisation.
    *   Les `QCM` conservent les options mais sont décochés.
*   **Suppression** : Uniquement possible pour les lignes ajoutées (identifiées par métadonnée).

### Structure des Données (`rowMeta`)
Pour distinguer les lignes d'origine des lignes ajoutées, une propriété `rowMeta` a été ajoutée à l'objet `currentForm`.
```json
{
  "rows": [ ... ],
  "rowMeta": [
    {},              // Ligne d'origine (vide)
    { "isAdded": true } // Ligne dupliquée
  ]
}
```
Ce tableau est synchronisé par index avec le tableau `rows`.

