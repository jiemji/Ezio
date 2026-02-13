# Cahier des Charges - Comportements IA Cibles

Ce document recense les comportements attendus pour les interactions IA dans Ezio.

## 1. Module Audit (Ligne par Ligne)
### Comportement Actuel
Le module Audit utilise une approche **RAG Contextuel Ligne par Ligne**. L'IA est invoquée manuellement par l'utilisateur pour traiter une ligne spécifique du tableau.

### Trigger (Déclencheur)
*   **Action :** Clic sur le bouton "✨" d'une cellule de type `ia`.
*   **Portée (Scope) :** La ligne courante uniquement.

### Construction de la Requête (Prompt)

La requête est composée de deux rôles distincts :

#### 1. Rôle Système (`system`)
*   **Source :** `models.json` > `prompt`.
*   **Contenu :** Définit la persona de l'IA (ex: "Tu es un auditeur expert ISO 27001...").

#### 2. Rôle Utilisateur (`user`)
C'est un contenu composite comprenant :
*   **L'Instruction (Query) :**
    *   **Source :** Configuration de la colonne (`col.params.requete`).
    *   **Exemple :** "Analyse la non-conformité ci-contre et propose une action corrective."
*   **Le Contexte de Données (Data Context) :**
    *   **Source :** Configuration de la colonne (`col.params.colonnes`).
    *   **Format :** Objet JSON (Clé/Valeur) construit dynamiquement à partir des colonnes ciblées sur la ligne active.
    *   **Exemple :**
        ```json
        {
          "Question": "La politique de sécurité est-elle documentée ?",
          "Constat": "Aucun document trouvé lors de l'entretien.",
          "Preuve": "Interview du RSI le 12/02."
        }
        ```

### Sortie Attendue
*   **Format :** Texte brut (Markdown supporté).
*   **Destination :** Injection directe dans le champ `textarea` de la cellule IA.
*   **Édition :** Le contenu généré est immédiatement modifiable par l'utilisateur.

### Spécificités Techniques par Provider

#### Format Standard (OpenAI / Groq)
Le contexte est "aplati" en une chaîne de caractères pour compatibilité maximale.
*   **Message Utilisateur :**
    ```json
    {
      "role": "user",
      "content": "Analyse la non-conformité...\n\nContexte JSON :\n{\n  \"Question\": \"...\"\n}"
    }
    ```

#### Format LM Studio (`lmStudioDirect`)
Le payload est structuré en segments distincts pour contourner les limitations de parsing des modèles locaux.
*   **Payload `input` :**
    ```json
    [
      { "type": "text", "content": "Prompt Système..." },
      { "type": "text", "content": "Instruction Utilisateur..." },
      { "type": "text", "content": "Question:\nLa politique est-elle..." },
      { "type": "text", "content": "Constat:\nAbsence de document..." }
    ]
    ```


## 2. Module Livrables (Génération de Rapports)
### Comportement Cible
Le module Livrables utilise une approche **RAG Global (Batch)**. L'IA est invoquée pour traiter un ensemble de données et générer une synthèse ou un rapport.

### Trigger (Déclencheur)
*   **Action :** Clic sur le bouton "Tester / Générer" d'une carte module.
*   **Portée (Scope) :** Variable (Global ou Filtré par Chapitre/Sous-chapitre).

### Construction de la Requête (Prompt)

La structure des rôles est identique à celle de l'Audit :

#### 1. Rôle Système (`system`)
*   **Source :** `models.json` > `prompt` du modèle sélectionné.

#### 2. Rôle Utilisateur (`user`)
Contenu composite :
*   **L'Instruction (Query) :**
    *   **Source :** Configuration du module (`instance.config.ai.prompt`).
    *   **Exemple :** "Rédige une synthèse managériale des points suivants..."
*   **Le Contexte de Données (Data Context) :**
    *   **Format :** Une chaîne de caractères contenant un **tableau Markdown**.
    *   **Contenu :** 
        *   Une ligne d'en-tête avec les noms des colonnes sélectionnées.
        *   Une ligne par donnée correspondant au périmètre (Scope).
    *   **Filtrage (Scope) :**
        *   *Global* : Toutes les lignes de l'audit.
        *   *Chapitre/Sous-chapitre* : Uniquement les lignes appartenant aux chapitres sélectionnés.
    *   **Colonnes :** Uniquement les colonnes cochées dans la configuration du module.

### Exemple de Contexte Généré
*Basé sur `audit_config.json` avec les colonnes "Question" et "Conformité" sélectionnées.*

```markdown
| Question | Conformité |
| :--- | :--- |
| La politique de sécurité est-elle approuvée par la direction ? | Non conforme |
| Les responsabilités sont-elles définies ? | Conforme |
| Un inventaire des actifs est-il maintenu ? | En cours |
```

### Sortie Attendue
*   **Format :** Texte brut (Markdown supporté).
*   **Destination :** Injection dans la zone de résultat de la carte module (`div contenteditable`).

