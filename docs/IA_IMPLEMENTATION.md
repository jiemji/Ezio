# Documentation Technique - Implémentation IA (Ezio)

## Architecture Générale
L'intégration IA repose sur 3 composants principaux :
1.  **Configuration Centralisée** (`models.json`) : Défini les modèles disponibles et leurs paramètres techniques.
2.  **Interface Audit** (`app_audit.js`) : Gère l'UI (bouton, champ éditable) et la construction du contexte.
3.  **Service API** (`api_ia.js`) : Abstraction pour communiquer avec les providers (LM Studio, OpenAI, Groq).

---

## 1. Configuration des Modèles (`models.json`)
Ce fichier situé à la racine du projet contient la liste des modèles disponibles.
Structure :
```json
[
    {
        "nom": "Nom affiché dans le créateur",
        "description": "Description optionnelle",
        "prompt": "Tu es un auditeur expert...", // System Prompt
        "provider": "lmstudio", // ou "openai", "groq"
        "endpoint": "http://localhost:1234/api/v1/chat",
        "apikey": "not-needed",
        "model": "nom-technique-du-modele",
        "temperature": 0.7,
        "context_length": 32000
    }
]
```

---

## 2. Logique Applicative (`app_audit.js`)
### Chargement
Au démarrage, `loadModels()` charge `models.json` dans `auditAvailableModels`.

### Exécution (`runIA`)
Lors du clic sur "Générer" :
1.  Récupération du modèle via `col.params.modele`.
2.  Construction du **Contexte** : Extraction des valeurs des colonnes ciblées dans `col.params.colonnes`.
3.  Construction du **Message** (Format Interne) :
    ```javascript
    const messages = [
        { "role": "system", "content": modelConfig.prompt },
        { "role": "user", "content": [ userPrompt, contextObject ] }
    ];
    ```
4.  Appel de `ApiService.fetchLLM(modelConfig, messages)`.
5.  Le résultat est injecté dans un `<textarea>` éditable (classe `.ia-textarea`).

---

## 3. Couche API (`api_ia.js`)
Le service normalise les appels vers différents providers.

### Spécificité LM Studio (`lmStudioDirect`)
Pour supporter les contraintes locales, le payload est transformé en un tableau plat d'objets `text`.
Entrée (Interne) -> Sortie (API LM Studio) :
```json
// Payload envoyé à LM Studio
{
  "input": [
    { "type": "text", "content": "System Prompt..." },
    { "type": "text", "content": "User Prompt..." },
    { "type": "text", "content": "Colonne 1:\nValeur 1" },
    { "type": "text", "content": "Colonne 2:\nValeur 2" }
  ]
}
```

---

## 4. Styles (`style_audit.css`)
- **.ia-cell** : Flex layout column.
- **.ia-textarea** :
    - Background : `var(--readonly)` (gris clair).
    - Texte Light Mode : `#001a33` (Bleu nuit).
    - Texte Dark Mode : `#f0f0f0` (Gris clair).
