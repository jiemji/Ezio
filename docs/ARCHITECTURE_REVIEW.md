# Revue d'Architecture et Pistes d'Amélioration (Refactoring)

Ce document présente une analyse de la base de code d'Ezio au **03 Mars 2026**, avec pour objectif de proposer des axes de refactorisation visant à simplifier le code, améliorer sa lisibilité, et faciliter son extension future (sans réécrire l'application de zéro ni utiliser de gros frameworks).

## 1. Mutualisation des Parseurs d'Export (Word & PPTX)
Actuellement, les fichiers `app_output_word.js` et `app_outputppt.js` contiennent des algorithmes de parsing très similaires qui décomposent le Markdown pour générer les documents :
- **Problème** : La logique de détection des balises HTML `<span style="background-color:...">` pour coloriser les cellules de tableau est dupliquée dans les deux fichiers (`parseMarkdownCell` dans Word, et `parseMarkdownTable` dans PPTX). De même pour le ciblage des balises `**`, `*`, ou `<u>`.
- **Solution (Simplification)** : Créer une méthode spécialisée `MarkdownUtils.parseToAST(markdown)` intermédiaire. Cette méthode renverrait un objet de données structuré (un *Abstract Syntax Tree*) contenant les informations "Ceci est une table, voici la ligne 1, cette cellule a le fond #FF0000". 
Ainsi, `app_output_word.js` et `app_outputppt.js` s'allègent de la tâche fastidieuse "d'analyser les chaînes de caractères" et se contentent uniquement de "dessiner les composants natifs Word/PPT" à partir d'un objet propre.

## 2. Découplage du module `app_dashboard.js` (Modèle-Vue-Contrôleur)
Le fichier `app_dashboard.js` (22 Ko) concentre trop de rôles différents à l'heure actuelle, le rendant plus difficile à maintenir.
- **Problème** : Il gère à la fois l'écoute des clics utilisateurs (UI de la Modale), le rendu du DOM HTML de la grille, le formatage très spécifique de Chart.js (`initWidgetChart`, configuration des couleurs, pourcentages), et l'exportation des images PNG (`exportWidgetImage`).
- **Solution (Factorisation)** : Scinder le fichier en trois entités distinctes :
  - `WidgetDataTransformer.js` : Une pure fonction utilitaire (sans aucun lien HTML) qui prend les rangées de l'Audit et sort les séries mathématiques (`labels`, `data`, `colors`).
  - `WidgetRenderer.js` : Un module focalisé sur l'API Chart.js qui "dessine" le canevas à l'écran.
  - `app_dashboard.js` : Ne conserverait que son rôle de chef d'orchestre (Création des boîtes du DOM et gestion du State).

## 3. Allègement des Délégations d'Événements (`app_deliveries.js`)
L'utilisation de la *Délégation d'Événements* (attacher un seul `onclick` sur le conteneur parent) dans `app_deliveries.js` est excellente pour la performance, mais mène ici à un bloc de code difficile à naviguer.
- **Problème** : La fonction `setupDelegation()` fait plus de 200 lignes et opère de gros `if/else` en chaîne sur `.classList.contains()`. De plus, le fichier contient des fonctions de pur formatage de données comme `buildContext()`.
- **Solution (Simplification)** : 
  - Déplacer `buildContext` (qui transforme les colonnes d'Audit en Tableau Markdown) dans `DataUtils.js` ou `MarkdownUtils.js`.
  - Extraire les actions de la délégation géante vers un dictionnaire de handlers (`ActionRouter`). Exemple : `const onClickActions = { 'btn-generate': handleGenerate, 'btn-remove-mod': handleRemove };`. Le `setupDelegation` ne ferait alors que 10 lignes pour router le clic dynamique vers la bonne fonction.

## 4. Bilan Global (Phase 1)
La base de code d'Ezio a été considérablement assainie. L'implémentation d'un pattern "State/Store" (`Store.js`) garantit une bonne stabilité métier, le Dashboard (MVC) est propre, et les exports partagent le même moteur AST Markdown.

---

## Nouveaux Axes de Refactorisation (Phase 2 - Propositions)

### 5. Axe 4 : Gestion Réactive de l'État (Store Pub/Sub)
- **Problème** : Actuellement, lorsque les données changent dans `Store.js` (ex: ajout d'une ligne d'audit), les contrôleurs (`app_audit.js`, `app_dashboard.js`) doivent appeler manuellement et impérativement les méthodes de rendu (ex: `AuditRenderer.render()`). Cela crée un couplage fort et un risque d'oubli de rafraîchissement de l'interface.
- **Solution (Réactivité)** : Transformer `Store.js` en un véritable *Event Emitter* (modèle Pub/Sub) ou utiliser des `Proxy` JavaScript. Ainsi, les composants UI pourront s'abonner aux changements (`Store.subscribe('data_changed', renderAudit)`). Toute modification de la donnée rafraîchira l'UI automatiquement.

### 6. Axe 5 : Isolation des Opérations d'Entrée/Sortie (Module I/O)
- **Problème** : La logique de manipulation de fichiers (lecture de FileReader, parsing JSON, manipulation de Blobs pour l'import de templates Word/Formulaires) est éparpillée entre `app_audit.js`, `app_creator.js` et `app_impression_logic.js`. C'est très verbeux et redondant.
- **Solution (Centralisation)** : Créer un fichier `js/core/IOManager.js` pour gérer toutes les lectures (`readTextFile`, `readAsBlob`) et écritures asynchrones de manière standardisée et sécurisée (try/catch unifiés).

### 7. Axe 6 : Standardisation des Composants UI (`UIFactory.js`)
- **Problème** : Beaucoup de fichiers (notamment `app_audit.js` et `app_deliveries.js`) créent du HTML lourd directement via des `Template Literals` (`innerHTML = ...`) ou des clics de modales directement dans la logique métier.
- **Solution (Web Components ou Factory Etendue)** : Enrichir le fichier existant `UIFactory.js` (ou passer à des vrais Web Components `customElements.define`) pour isoler l'agencement HTML des Modales, Toasts, et Tooltips, afin de libérer les contrôleurs de la gestion du code HTML brut.

---

## Nouveaux Axes de Refactorisation (Phase 3 - Validation partielle)

Suite à la finalisation réussie des Phases 1 et 2, l'application a abordé la **Phase 3** pour consolider la fiabilité et l'expérience développeur (DX).

### Axes Validés et Intégrés

#### Axe 8 : Robustesse et Gestion Globale des Erreurs (Error Boundaries)
- **Problème** : Si une erreur survenait (données corrompues dans `localStorage`, erreur asynchrone), l'application s'arrêtait ou affichait un écran vide sans prévenir l'utilisateur.
- **Solution Appliquée** : 
  - Filet de sécurité global (`window.onerror` / `unhandledrejection`) relié aux Toasts de l'UI.
  - Auto-réparation du Store : isolation des sauvegardes JSON corrompues et réinitialisation sécurisée au redémarrage.

#### Axe 9 : Migration vers des Web Components Natifs (`customElements`)
- **Problème** : La création de composants UI (Toasts, Widgets) nécessitait la manipulation de gros blocs HTML sous forme de chaînes de caractères.
- **Solution Appliquée** : Création de vrais Web Components isolés (`<ezio-toast>`, `<ezio-widget>`), allégeant massivement les contrôleurs (`UIFactory` et `app_dashboard`).

### Axes Restants (Proposés mais abandonnés)

#### Axe 7 : Typage statique progressif via JSDoc
- **Problème** : En l'absence de TypeScript, les objets complexes naviguent de fonction en fonction sans filet de sécurité pour le développeur.
- **Statut** : Abandonné pour l'instant afin de prioriser d'autres simplifications structurelles.

---

## Bilan de Simplification (Phase 4 - Complétée le 25/03/2026)

Les 4 pistes proposées ont été traitées. 3 ont été implémentées, 1 (Piste 3 — Routage) était déjà résolue lors de la Phase 2.

### Piste 1 ✅ : Transformer l'Éditeur Markdown en Web Component
- **Problème** : `MarkdownEditor.js` était un objet littéral retournant du HTML brut. La logique de clics (Gras, Titres, appel IA) était dupliquée dans `app_audit.js` et `app_deliveries.js`.
- **Solution Appliquée** : Création de `<ezio-markdown-editor>` (362 lignes), Web Component natif sans Shadow DOM gérant toolbar, formatting, AI tools modal, et émettant un événement `change` custom.
- **Résultat** : Suppression de `js/ui/MarkdownEditor.js`. ~80 lignes de délégation dupliquée retirées des consommateurs (`AuditRenderer.js`, `app_deliveries.js`).

### Piste 2 ✅ : Nettoyage du Créateur de Formulaire (`app_creator.js`)
- **Problème** : `renderParamsCell()` était un monolithe de 113 lignes avec un if/else géant. La fonction `parseImportJSON` dupliquait la logique du listener `csvInput`.
- **Solution Appliquée** (Option B — nettoyage léger) : Extraction de 4 sous-fonctions nommées (`renderSizeParams`, `renderComboParams`, `renderIAParams`, `renderQCMParams`). Suppression du code mort.
- **Résultat** : `app_creator.js` passe de 426 à 361 lignes (-15%).

### Piste 3 ⏭️ : Routage par URL
- **Statut** : Déjà résolu en Phase 2 via le hash-router natif (`Navigation.js`, `#audit`, `#dashboard`, etc.).

### Piste 4 ✅ : Cartes de Livrables en Web Component
- **Problème** : `DeliveriesRenderer.js` (171 lignes) générait le HTML des cartes. `app_deliveries.js` contenait ~170 lignes de délégation (`setupDelegation`) et 60 lignes de handlers checkbox (`handleChapterCheck`, etc.) pour gérer les événements des cartes.
- **Solution Appliquée** : Création de `<ezio-delivery-card>` (338 lignes), Web Component encapsulant le rendu complet et tous les événements internes. Émet 4 événements custom (`card-generate`, `card-move`, `card-remove`, `card-config-change`).
- **Résultat** : Suppression de `js/modules/DeliveriesRenderer.js`. `app_deliveries.js` passe de 692 à 528 lignes (-37%).

## Bilan de Simplification (Phase 5 - Complétée le 25/03/2026)

La Phase 5 s'est concentrée sur l'harmonisation finale de l'architecture et l'extraction des dernières grosses dépendances.

### Axe 2 ✅ : Éditeur de Rapports en Web Component
- **Problème** : `ReportsRenderer.js` (214 lignes) fonctionnait sur l'ancien pattern (chaîne HTML manuelle + delegation complexe gérée par le contrôleur parent `app_reports.js`).
- **Solution Appliquée** : Création de `<ezio-report-editor>` (206 lignes), un Web Component double-mode (éditeur de liste de modules / éditeur de configuration de module unique), émettant sagement 7 Custom Events.
- **Résultat** : Suppression de `js/modules/ReportsRenderer.js`. `app_reports.js` passe de 381 à 342 lignes (-10%). Gain massif de cohérence architecturale.

### Axe 1 ✅ : Extraction de `AuditSidebar.js`
- **Problème** : `app_audit.js` (413 lignes) était un monolithe concentrant filtrage, rendu du menu latéral, state local, exécution IA, CRUD lignes.
- **Solution Appliquée** : Extraction de toute la logique de construction de la hiérarchie latérale, de l'indicateur de statut, et de l'état local du filtre (`auditFilters`) vers un module dédié `AuditSidebar.js` (130 lignes).
- **Résultat** : `app_audit.js` passe à 280 lignes (-32%). Chaque fichier a désormais une responsabilité plus claire.

### Inventaire final des Web Components Ezio

| Composant | Fichier | Créé en |
|---|---|---|
| `<ezio-toast>` | `js/components/EzioToast.js` | Phase 3 |
| `<ezio-widget>` | `js/components/EzioWidget.js` | Phase 3 |
| `<ezio-markdown-editor>` | `js/components/EzioMarkdownEditor.js` | Phase 4 |
| `<ezio-delivery-card>` | `js/components/EzioDeliveryCard.js` | Phase 4 |
| `<ezio-report-editor>` | `js/components/EzioReportEditor.js` | Phase 5 |

---

## Bilan Final (Phase 6 - Complétée le 26/03/2026) ✅

La Phase 6 a scellé l'architecture d'Ezio en s'attaquant au dernier "gros" module et en introduisant une couche de types.

### Axe 1 : Modularisation des Builders PPT
- **Résultat** : `app_outputppt.js` ne contient plus que l'orchestration. Le "moteur" est dans `PptSlideBuilders.js`. La maintenance des templates complexes est maintenant isolée de la logique d'export.

### Axe 2 : Spécialisation du contexte IA
- **Résultat** : Création de `AIContextBuilder.js`. `DataUtils.js` redevient un utilitaire pur de filtrage/tri. Cette séparation permet d'enrichir les prompts IA sans polluer les algorithmes de recherche de la grille.

### Axe 3 : Typage et Documentation
- **Résultat** : Centralisation des contrats de données dans `Types.js`. L'utilisation systématique de JSDoc dans les nouveaux modules garantit une pérennité du code proche du confort de TypeScript.

## Bilan Final (Phase 7 - Complétée le 29/03/2026) ✅

La Phase 7 a transformé le module historique de rédaction de rapports (Deliveries V2) en un éditeur moderne de type "Notion".

### Axe 1 : Architecture Par Blocs (Deliveries V2)
- **Problème** : L'éditeur de rapport manipulait une immense chaîne `result` de Markdown mixé à des `<div contenteditable="false">` pour les widgets (KPI, Datatables), causant des corruptions de documents et rendant les exports Word/PPT complexes et fragiles.
- **Solution Appliquée** : Remplacement du texte monolithique par un Array d'objets `blocks`. Création d'un Web Component standardisé `<ezio-delivery-block>`.
- **Résultat** : Un système robuste où chaque bloc (Texte, Graphique, Synthèse IA, Données) possède ses propres données isolées et son propre cycle de vie (modification de configuration, regénération via l'API, suppression propre). La logique I/O (Export Markdown statique) redevient purement déterministe en itérant sur cet Array de blocs de manière séquentielle.

## Conclusion Générale
En l'espace d'un mois, Ezio est passé d'une collection de scripts globaux à une **SPA moderne modulaire**. L'utilisation de Web Components natifs (sans Shadow DOM) et d'un routeur Hash a permis de moderniser l'interface tout en conservant la légèreté et la rapidité du projet initial.
