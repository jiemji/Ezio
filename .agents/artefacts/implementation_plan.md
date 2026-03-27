# Implementation Plan - Fix JSON Import in Form Creator

The "Générateur de Formulaire" (Form Creator) currently fails to import flat JSON arrays like `Tableau27001.json` because it strictly validates for a structured form object (containing `name` and `columns`). This plan updates the import logic to support both formats.

## Proposed Changes

### [Form Creator Logic] (file:///g:/devapps/Ezio/js/modules/app_creator.js)

#### [MODIFY] [app_creator.js](file:///g:/devapps/Ezio/js/modules/app_creator.js)

- Refactor the `csvInput` change listener to handle both **Source Data (flat JSON)** and **Form Configuration (structured JSON)**.
- **Logic for Flat JSON Arrays (Source Data):**
    - If `formData` is an array:
        - Extract all unique keys from all objects in the array to build `creatorData.headers`.
        - Map each object to an array of values based on these headers to build `creatorData.rows`.
        - Automatically initialize `creatorData.configs` for each header (Visible=true, Type=question).
- **Logic for Structured JSON (Form Configuration):**
    - Maintain existing logic that expects `name` and `columns`.
- Update the UI to show the `creatorConfig` section immediately after a successful import.
- Add a check to clear previously selected files on the input to allow re-importing the same file if needed.

## Verification Plan

### Manual Verification
1. Open the "Formulaires" page in the application.
2. Click on "📂 Importer un fichier de données".
3. Select `tools/Tableau27001.json`.
4. Verify that the table appears with columns like "Pilier de sécurité", "Ref Objectifs", etc.
5. Verify that the "Générer et Charger le JSON" button works and successfully loads the data into the "Audit" view.
6. Repeat with a structured JSON like `templates/ISO27002.json` (or a previously exported `audit_config.json`) to ensure no regression.
