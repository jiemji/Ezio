# Documentation IA - Ezio (Fonctionnel & Technique)

Ce document consolide les spécifications fonctionnelles et les détails d'implémentation de l'intelligence artificielle dans Ezio.

## 1. Architecture Générale
L'intégration IA repose sur 4 composants principaux :
1.  **Configuration Centralisée** (`models.json`) : Définit les modèles disponibles et leurs paramètres techniques.
2.  **Service API** (`api_ia.js`) : Abstraction robuste pour communiquer avec les providers (LM Studio, OpenAI, Groq).
3.  **Module Audit** (`app_audit.js`) : IA contextuelle ligne par ligne (RAG simple).
4.  **Module Livrables** (`app_deliveries.js`) : IA générative sur l'ensemble de l'audit (RAG global ou scopé).

---

## 2. Configuration (`models.json`)
Fichier maître situé à la racine.
```json
[
    {
        "nom": "Nom affiché",
        "description": "Description...",
        "prompt": "Tu es un auditeur expert...", // System Prompt
        "provider": "lmstudio", // ou "openai", "groq", "mock"
        "endpoint": "http://localhost:1234/api/v1/chat",
        "apikey": "not-needed",
        "model": "model-id",
        "temperature": 0.7,
        "context_length": 32000
    }
]
```

---

## 3. Module Audit (Ligne par Ligne)

### Spécifications Fonctionnelles
*   **Objectif :** Analyser ou compléter une ligne spécifique du tableau d'audit.
*   **Trigger :** Clic sur le bouton "✨" d'une cellule `ia`.
*   **Portée (Scope) :** La ligne courante uniquement.
*   **Prompt :**
    *   *Système* : Défini dans `models.json`.
    *   *Utilisateur* : `[Instruction Colonne, Objet Données JSON]`.
*   **Exemple Contexte :**
    ```json
    { "Question": "Politique MDP ?", "Constat": "Pas de politique." }
    ```

### Implémentation Technique (`app_audit.js`)
*   **Fonction Clé :** `runIA(r, c, col, ...)`
*   **Flux :**
    1.  Lecture de la config colonne (`col.params.colonnes`).
    2.  Extraction des valeurs de la ligne `r`.
    3.  Construction du message composite.
    4.  Appel `ApiService.fetchLLM`.
    5.  Injection du résultat dans le `<textarea>` et la `<div>` de prévisualisation.

---

## 4. Module Livrables (Rapports)

### Spécifications Fonctionnelles
*   **Objectif :** Générer une section de rapport basée sur un ensemble de lignes.
*   **Actions :**
    *   **Générer Module** : Appel IA par module.
    *   **Télécharger Rapport** : Export global du livrable au format Markdown (`.md`).
    *   **Impression** : Génération de documents finaux (Word/PPT) via modèles.
*   **Trigger :** Bouton "Impression" (Header), "Tester / Générer" (Module) ou "Télécharger (MD)".
*   **Portée (Scope) :** 
    *   *Global* : Toutes les lignes.
    *   *Filtré* : Par Chapitre / Sous-chapitre.
*   **Prompt :**
    *   *Système* : Global (`models.json`).
    *   *Utilisateur* : `[Instruction Module, Chaîne Tableau Markdown]`.
*   **Exemple Contexte (Markdown Table) :**
    ```markdown
    | Question | Conformité |
    | :--- | :--- |
    | Politique MDP ? | Non Conforme |
    | Sauvegardes ? | Conforme |
    | Politique MDP ? | Non Conforme |
    | Sauvegardes ? | Conforme |
    ```
*   **Format de Sortie :**
    *   Si l'option **"Tableau"** est cochée : Le résultat inclut le tableau de contexte préfixé, suivi d'un double saut de ligne (`<br><br>`), puis de l'analyse.
    *   Sinon : Uniquement l'analyse/texte généré.

### Implémentation Technique (`app_deliveries.js`)
*   **Fonction Clé :** `generateModule(delivery, index)`
*   **Helper :** `buildContext(scope, columns, data)`
    *   Filtre les colonnes (config module).
    *   Filtre les lignes (config scope).
    *   Génère une string Markdown (`| Header |\n| --- |\n| Cell |...`).
    *   Gère les échappements (sauts de ligne -> `<br>`, pipes -> `\|`).
*   **Flux :**
    1.  `buildContext` retourne une string.
    2.  Message composite envoyé à l'API.
    3.  Résultat injecté dans une `div contenteditable`.
        *   *Note Implémentation* : Si `config.isTable` est actif, on concatène `contextData + "\n\n<br><br>\n\n" + response`.
*   **Export Global (`downloadDeliveryReport`)** :
    *   Concatène le titre du rapport (H1).
    *   Itère sur les modules (Titre H2 + Contenu).
    *   Génère un fichier `.md` via `Utils.downloadFile` (Blob).

---

## 5. Couche API Agnostique (`api_ia.js`)

Le service unifie les appels vers différents fournisseurs.

### Logique Universelle
*   Compatible **OpenAI**, **Groq**, **LM Studio**.
*   Gestion automatique des erreurs standard.

### Adaptateurs de Payload
1.  **Standard (OpenAI/Groq)** :
    *   Concatène le tableau `[Instruction, Contexte]` en une seule chaîne (Stringification si nécessaire).
    *   Format : `"content": "Instruction...\n\nContexte..."`
2.  **LM Studio (`lmStudioDirect`)** :
    *   Exploite le format structuré pour maximiser la compréhension du contexte local.
    *   Transforme le contexte (Objet JSON ou String Markdown) en segments distincts.
    *   Format :
        ```json
        "input": [
          { "type": "text", "content": "System Prompt" },
          { "type": "text", "content": "Instruction" },
          { "type": "text", "content": "Tableau Markdown..." }
        ]
        ```

---

## 6. Styles
*   `style_audit.css` : Gestion des cellules IA interactives.
*   `style_deliveries.css` :
    *   Gestion des cartes de livrables (Largeur fixe de **732px**).
    *   Conteneur de résultats avec **scroll horizontal** pour les tableaux larges.
