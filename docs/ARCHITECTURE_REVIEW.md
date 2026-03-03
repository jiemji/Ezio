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

## 4. Bilan Global
La base de code d'Ezio est **étonnamment propre et robuste** pour du *Vanilla JS*. L'implémentation d'un pattern "State/Store" (`Store.js`) garantit une bonne stabilité métier. Les actions de refonte suggérées ci-dessus ne sont pas urgentes mais sont des "**Quick Wins**" : elles permettront surtout de rendre le code beaucoup plus agréable à survoler lorsqu'il faudra rajouter de nouvelles fonctionnalités à l'avenir.
