# Documentation Technique - Projet Ezio

**Ezio** est une application web "Local-First" conçue pour la gestion d'audits, la création de formulaires dynamiques et le pilotage assisté par Intelligence Artificielle.

---

## 1. Stack Technique
Le projet est construit avec une stack minimaliste et robuste pour assurer une exécution sans dépendances complexes ni étape de build.

*   **HTML5 / CSS3** : Structure et design responsif (Variables CSS, Flexbox/Grid).
*   **JavaScript (Vanilla ES6+)** : Logique applicative native.
*   **Librairies Externes** (via CDN) :
    *   `Chart.js` : Visualisation de données (Dashboard).
    *   `Marked` : Rendu Markdown pour les réponses de l'IA.
*   **Stockage** : `localStorage` pour la persistance des données et `JSON` pour l'import/export.

---

## 2. Architecture des Fichiers

### Core & Structure
*   `index.html` : Point d'entrée unique. Contient la structure du SPA (Single Page Application) avec les différantes vues (`#audit-view`, `#dashboard-view`, `#creator-view`).
*   `app_shared.js` :
    *   Gestion de l'état global (`currentForm`).
    *   Système de navigation (fonction `switchView`).
    *   Persistance des données (`loadState` / `saveState`).
    *   Utilitaires partagés.

### Modules Fonctionnels
1.  **Module Audit (`app_audit.js`)** :
    *   Cœur de l'application.
    *   Rendu dynamique du tableau d'audit (`renderTable`).
    *   Gestion des types de cellules : Texte, Combo (Couleurs), QCM, IA.
    *   Système de filtres (Chapitre/Sous-chapitre) et de tri.

2.  **Module IA (`api_ia.js`)** :
    *   Couche d'abstraction vers les LLMs.
    *   Supporte **LM Studio** (Local), **OpenAI**, **Groq**.
    *   Gestion de la transformation des messages pour compatibilité (sérialisation du contexte JSON).

3.  **Module Dashboard (`app_dashboard.js`)** :
    *   Génération de KPIs dynamiques basés sur les colonnes "Combo".
    *   Types de graphiques : Camembert, Anneau, Barres, Empilement par chapitre.

4.  **Module Créateur (`app_creator.js`)** :
    *   Outil de configuration pour transformer un JSON plat importé en structure Ezio.
    *   Définition des types de colonnes, paramètres IA (prompts), schémas de couleurs.

### Styles
*   `style_shared.css` : Styles globaux, variables (couleurs, fonts), layout de base.
*   `style_audit.css` : Styles spécifiques au tableau d'audit (cellules, filtres).
*   `style_dashboard.css` : Grilles et cartes du tableau de bord.
*   `style_creator.css` : Interface de configuration du générateur.

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
  ]
}
```

---

## 4. Fonctionnement de l'IA

### Configuration (`models.json`)
Fichier json définissant les modèles disponibles.
*   **Provider** : `lmstudio`, `openai`, `groq`.
*   **Endpoint** : URL de l'API (ex: `http://localhost:1234/api/v1/chat`).

### Flux d'Exécution (RAG Contextuel)
Lorsqu'un utilisateur clique sur "Générer" dans une cellule IA :
1.  Le système récupère la configuration de la colonne (Prompt système, Colonnes de contexte).
2.  Il extrait les données de la ligne courante pour les colonnes ciblées.
3.  Il construit un payload enrichi envoyé à `api_ia.js`.
4.  La réponse est affichée dans le `textarea` et rendue en Markdown.

---

## 5. Guide de Développement

### Ajouter un nouveau type de colonne
1.  **Frontend** : Ajouter le cas dans le `switch(col.type)` de `app_audit.js` (`renderCell`).
2.  **Créateur** : Ajouter l'option dans la liste des types de `app_creator.js` et gérer ses paramètres spécifiques dans `renderParamsCell`.

### Ajouter un Provider IA
1.  Modifier `api_ia.js` pour ajouter le cas dans la méthode `fetchLLM`.
2.  Implémenter la logique spécifique de transformation de requête si nécessaire.
