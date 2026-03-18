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

## Nouveaux Axes de Simplification (Phase 4 - Propositions)

Voici les 4 pistes les plus viables pour continuer à alléger et moderniser le fonctionnement du projet.

### Piste 1 : Transformer l'Éditeur Markdown en Web Component (Suite Axe 9)
- **Problème** : `MarkdownEditor.js` est une classe qui retourne une énorme chaîne HTML ("usine à texte"). La logique de ses clics/boutons (Gras, Titres, appel IA) est redéclarée manuellement plusieurs fois à l'extérieur (dans `app_audit.js`, `app_deliveries.js`).
- **Solution** : Créer une balise autonome `<ezio-markdown-editor>`. Elle gérera elle-même ses propres clics, sa barre d'outils et son `contenteditable`. L'extérieur n'aura plus qu'à écrire `editor.value` ou `editor.addEventListener('change', ...)`.

### Piste 2 : Refonte du Créateur de Formulaire (`app_creator.js`)
- **Problème** : Le constructeur de formulaire (`app_creator.js`) est l'un des fichiers les plus complexes à maintenir (17 Ko). Il gère le Drag & Drop des lignes et colonnes de manière très impérative, via beaucoup de manipulation directe du DOM et des injections `innerHTML`.
- **Solution** : Abstraire la complexité visuelle en créant des Web Components natifs tels que `<ezio-builder-row>` et `<ezio-builder-col>`, de la même façon que nous avons encapsulé l'immense structure des widgets Dashboard.

### Piste 3 : Un vrai système de Routage (Navigation par URL)
- **Problème** : Quand on change de module ("Dashboard", "Livrables", "Audit"), l'application masque/affiche de gros blocs `div` (display: none). L'URL du navigateur reste figée (`index.html`). Conséquence: le bouton "Précédent" du navigateur fait quitter complètement l'application au lieu de ramener à l'écran précédent, et aucun lien vers "juste un livrable" n'est partageable.
- **Solution** : Intégrer un mini-routeur natif basé sur le `location.hash` (`#dashboard`, `#deliveries`). Cela modernisera totalement l'expérience (UX de type Single Page Application complète).

### Piste 4 : Système de "Cartes de Livrables" (Suite Axe 3)
- **Problème** : `app_deliveries.js` génère les cartes de chaque bloc audit/markdown via une gigantesque fonction dans `DeliveriesRenderer.js` produisant des centaines de lignes de chaînes HTML manuelles.
- **Solution** : Utiliser la puissance de la nouvelle balise `<ezio-markdown-editor>` (Piste 1) pour créer un composant `<ezio-delivery-card>` qui encapsule sa propre structure de carte (header, boutons de déplacement, paramètres et contenu), purifiant radicalement le fichier des livrables.
