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
*   `index.html` : Point d'entrée unique. Structure SPA (Single Page Application).
*   `js/app_shared.js` : Gestion de l'état global (`currentForm`), navigation (`switchView`) et persistance.
*   `js/core/` :
    *   `Store.js` : Gestion centralisée du `localStorage`.
    *   `Utils.js` : Fonctions utilitaires génériques (helpers DOM, formatage, debounce...).
*   `js/ui/` :
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
    *   **Interface Horizontale** : Workflow étape par étape pour customiser les prompts et générer le contenu via l'IA.
    *   **Persistance** : Les livrables sont stockés directement dans le fichier d'audit (`ezio_data.json`) sous la clé `.deliveries`.

8.  **Module Export (`app_export.js`)** :
    *   Gestion de l'export des données (JSON d'état complet, CSV pour Excel).
    *   Utilisation de l'API `Blob` pour générer le fichier et déclencher le téléchargement navigateur sans backend.

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
      "structure": [ ... ] // Copie du template avec résultats
    }
  ]
}
```

---

## 4. Gestion des Rapports & Livrables

L'application distingue désormais la définition du modèle de l'exécution du rapport :

*   **Rapports (Templates)** : Définis dans `reports.json`. Ce sont des structures vides (liste de modules).
*   **Livrables (Instances)** : Stockés dans le fichier d'audit (`currentForm`). Ce sont des copies des templates, enrichies avec les prompts spécifiques et les résultats générés par l'IA. Cette architecture permet de modifier un rapport généré sans altérer le modèle original.

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

