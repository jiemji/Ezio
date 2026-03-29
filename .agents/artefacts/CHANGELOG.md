# Historique des Changements (Changelog)

Ce document retrace l'évolution du projet Ezio, les nouvelles fonctionnalités, les corrections de bugs et les refontes techniques.

## [2.8.0] - 2026-03-29
### Refonte Deliveries V2 (Cartes / Blocs)
- **Architecture par Blocs** : Migration de l'éditeur Markdown monolithique (`result`) vers un système de liste de blocs ordonnés (`blocks`). Les rapports sont désormais construits par l'assemblage de composants modulaires (Texte, KPI, Synthèses IA, Table de données).
- **Web Component `<ezio-delivery-block>`** : Création d'un nouveau composant contenant l'interface universelle (titre, boutons ⚙️, 🗑️, ↻) pour l'encapsulation de chaque bloc du rapport.
- **Barre d'outils Globale** : Ajout d'une barre flottante (`dlv2-global-toolbar`) permettant l'ajout intuitif de composants dans le document.
- **Refonte des Modales et Export** :
  - L'insertion de contenu via `document.execCommand` a été remplacée par la manipulation pure d'un tableau d'états `currentModule.blocks`.
  - Le générateur Markdown (`downloadDeliveryReport`) a été réécrit pour itérer sur la liste des blocs et recomposer dynamiquement le contenu final (génération des tableaux et inclusion des textes de l'IA).
- **Affichage Réactif (Mode Allongé / Droit)** : Ajout d'un bouton de bascule permettant d'élargir la zone d'édition centrale (jusqu'à 1550px) ou de la contraindre (1050px).
- **Sélection Multiple de Graphiques** : Le bloc KPI permet désormais d'inclure plusieurs graphiques à la fois. Ils se disposent automatiquement (Flexbox) pour remplir l'espace horizontal de la page avant de passer à la ligne.
- **Tableaux de Données Flexibles & Redimensionnables** : Les colonnes des tableaux générés s'adaptent dynamiquement à la taille du texte tout en forçant des retours à la ligne (`max-width: 300px`). Ajout d'une fonctionnalité de **redimensionnement manuel strict** des colonnes (glisser-déposer sur l'en-tête), contraint aux seules colonnes adjacentes, et sauvegardé en temps réel dans l'état du composant.
- **Fix AIContextBuilder** : Protection contre les références nulles lorsque aucune colonne n'est spécifiée, garantissant la fiabilité des Synthèses IA globales.

## [2.7.5] - 2026-03-27
### Correction Import Générateur (Axe 10)
- **Import Flexible (`app_creator.js`)** : Le bouton d'import dans le Générateur de Formulaire accepte désormais les fichiers JSON "plats" (liste d'objets) en plus des configurations structurées.
- **Transformation Automatique** : Extraction dynamique des en-têtes et transformation des objets en lignes (arrays) lors de l'import de données sources, permettant de construire un audit à partir de n'importe quel JSON simple.
- **Amélioration UX** : Réinitialisation automatique du champ de sélection de fichier après l'import pour permettre des imports successifs sans rechargement.

## [2.7.0] - 2026-03-26
### Refactorisation Finales & Stabilité (Phase 6)
- **Modularisation PowerPoint (`PptSlideBuilders.js`)** : La logique titanesque de construction des slides, de pagination et de rendu des tableaux a été extraite de `app_outputppt.js`. Ce dernier est désormais un orchestrateur léger (-70% de lignes de code).
- **Spécialisation Datation (`AIContextBuilder.js`)** : Séparation nette entre le traitement des données (`DataUtils.js`) et la construction de contextes Markdown pour l'IA ou les rapports.
- **Typage JSDoc Centralisé (`Types.js`)** : Introduction d'un système de types robuste pour `AuditData`, `Delivery`, `Column`, etc. Amélioration massive de l'auto-complétion et de la sécurité du code dans l'IDE.
- **Consommation Unifiée** : Tous les formats d'export (Word, PPT) et le module Livrables utilisent désormais le même bâtisseur de contexte (`AIContextBuilder`).

## [2.6.5] - 2026-03-25
### Harmonisation UI & Sidebar (Phase 5)
- **Composant Rapport (`<ezio-report-editor>`)** : Migration de l'éditeur de rapports vers un Web Component unifié, supprimant `ReportsRenderer.js`.
- **Sidebar Audit (`AuditSidebar.js`)** : Extraction de la logique de navigation latérale et des filtres d'audit.
- **Indicateur de Statut** : Déplacement de l'indicateur de lignes filtrées vers le haut de la sidebar pour une meilleure visibilité.
- **Fix Layout Flexbox** : Correction d'un bug majeur de débordement CSS dans la grille d'audit qui masquait les dernières lignes du tableau.

## [2.6.0] - 2026-03-06
### Fiabilité et Standardisation Web (Axe 8 & Axe 9)
- **Gestion Globale des Erreurs (Error Boundaries)** : Ajout d'intercepteurs d'erreurs globaux (`window.onerror` et `window.onunhandledrejection`) dans le cœur de l'application permettant d'afficher des notifications (Toasts) propres et d'éviter les crashs silencieux (écrans figés).
- **Auto-réparation du Store** : Le `Store` détecte désormais les corruptions critiques des données JSON dans le `localStorage` au démarrage. Il isole automatiquement la sauvegarde corrompue et réinitialise l'application de manière sécurisée en prévenant l'utilisateur.
- **Migration Web Components (Custom Elements)** : Introduction de véritables balises HTML personnalisées (`<ezio-toast>` et `<ezio-widget>`).
  - L'affichage éphémère (Toasts) est géré de façon 100% autonome et isolée par son propre composant.
  - La logique du Dashboard a été drastiquement simplifiée. La construction titanesque du DOM des Widgets est externalisée dans `<ezio-widget>`, favorisant un code JavaScript beaucoup plus lisible, déclaratif et réutilisable.
- **Routage d'URL (Hash Navigation)** : Implémentation d'un routeur front-end natif écoutant les changements de `#hash` dans l'URL.
  - L'application supporte dorénavant les boutons "Précédent" et "Suivant" du navigateur de manière fluide.
  - Les modules (Audit, Dashboard, Livrables) disposent d'URLs partageables (`#audit`, `#dashboard`, etc.), permettant de recharger la page directement sur la vue souhaitée.
  - Remplacement des fonctions programmatiques `switchView()` attachées aux boutons par de simples redirections d'URL (`window.location.hash`), offrant un comportement standardisé de "Single Page Application" (SPA).

## [2.5.0] - 2026-03-03
### Refactorisation et Architecture (Zero Régression)
- **Découplage analytique (`WidgetDataTransformer.js` & `WidgetRenderer.js`)** : Le cœur du Dashboard a été scindé. La logique métier d'extraction des métriques d'audit est dorénavant isolée de la logique de dessin sur le canevas (Chart.js), allégeant considérablement `app_dashboard.js`.
- **Routage d'Actions (Deliveries)** : Remplacement de l'immense bloc de conditions liés à la délégation d'événements dans `app_deliveries.js` par un dictionnaire d'actions (`ActionRouter`), offrant une lecture directe et une extensibilité instantanée. La génération du tableau de contexte (Markdown) a été extraite vers `DataUtils.js`.
- **Analyse Syntaxique Abstraite (AST) pour le Markdown** : Les moteurs d'export Word et PowerPoint reposent dorénavant sur un socle commun robuste (`MarkdownUtils.parseToAST`). La détection des balises complexes (couleurs injectées dans les span, niveaux de titres, styles inline) n'est plus dupliquée et interprétée à la volée par chaque exportateur, mais unifiée au sein d'un utilitaire générant un arbre syntaxique propre, garantissant une cohérence parfaite du rendu final entre tous les formats de sortie.

## [2.4.5] - 2026-02-27
### Impression Word Avancée & Corrections
- **Styles Dynamiques Word** : Les éléments Markdown (Titres, Paragraphes, Listes à puces `ul`/`ol`) peuvent désormais être mappés directement sur les IDs de styles internes MS Word via la propriété `styles` dans `output_config.json`.
- **Tableaux Word** : Ajout du support de la propriété `tableFormat` pour les documents Word, permettant un contrôle des couleurs d'en-tête, des bordures et du zébrage des lignes.
- **Variables de Template** : Le moteur Word scanne désormais le document entier (y compris les en-têtes et pieds de page) pour remplacer dynamiquement `{{TITRE}}` et `{{DATE}}`. Le point de greffe du contenu principal devient `{{CONTENU}}`.
- **Fix Export Word/PPTX** : Résolution du plantage "Invalid hex value" lors de la génération de tableaux comportant des couleurs HEX à 3 caractères.
- **Fix Corruption Word** : Contournement d'une corruption de document `.docx` générée par la bibliothèque lors de l'export de listes à puces. La puce est désormais gérée à 100% par le style natif du modèle Word.
- **Refonte UI Éditeur Markdown** : La barre d'outils de formatage a été épurée : sélection de titres explicite (`N`, `T3`, `T4`, `T5`) remplaçant l'incrémentation floue (`H+`/`H-`). Ajout du bouton de support natif pour le texte "Souligné" (`S`). Remplacement de l'icône anglaise "B" (Bold) par "G" (Gras).
- **Optimisation Parseur Markdown (htmlToMarkdown)** : Refonte du parseur réversible pour garantir un export propre : suppression totale de l'espacement visuel (verrues de retours à la ligne injectés par `marked.js` ou l'éditeur WYSIWYG `contenteditable`), préservation absolue des vrais sauts de ligne utilisateurs (`<br>\n`), effacement dynamique de la graisse Markdown (`**`) quand un texte est mis en forme de Titre, et annulation des retours à la ligne parasites autour des sous-listes imbriquées.
- **Nettoyage** : Suppression du support désuet de l'ancien format d'export PPTX brut.

## [2.4.4] - 2026-02-26
### Impression Tableaux Dynamiques (PPTX, Word, MD)
- **Couleurs de Cellules Combo** : Le moteur de génération intercepte désormais les codes couleurs (`colorScheme`) définis sur les colonnes de type "Combo" (listes déroulantes) dans l'Audit. Ces couleurs sont converties à la volée en balises HTML furtives dans le code Markdown du Tableau de Contexte.
- **Support Natif Word & PPTX** : Les moteurs d'export PPTX (`app_outputppt.js`) et Word (`app_output_word.js`) intègrent un nouveau parseur pour lire ces balises HTML. Les cellules des tableaux reprennent nativement la couleur de fond associée à la valeur sélectionnée, tout en adaptant dynamiquement la couleur du texte (noir/blanc) pour garantir le contraste. Le fichier `.md` téléchargé intègre également ces marqueurs de couleurs prêts à être interprétés par un viewer.
- **Global Table Styling PPTX** : Ajout de la configuration `tableFormat` au niveau de chaque `template` PPTX dans `output_config.json`, permettant de configurer finement les tons de l'en-tête (Gras, Couleur Fond, Couleur Texte) et le zébrage des lignes (RowFill, RowAltFill) de manière granulaire par template.
- **Rendu Markdown Fidèle (PPTX)** : Le parseur PowerPoint simule désormais la mise en forme du texte riche (WYSIWYG) avec prise en charge automatique des **Puces** (`- ` ou `* `), des niveaux d'**Indentation** et du texte **Gras** en ligne (`**texte**`), le tout s'intégrant parfaitement dans le système de pagination automatique.

## [2.4.3] - 2026-02-26
### Impression PowerPoint (PPTX) Avancée
- **Extracteur Intelligent (`extract.html`)** : Récupération des dimensions réelles du modèle (`layout` en pouces), conversion et préservation exacte des marges internes (en points `pt`), et ajout de la gestion avancée des couleurs de thèmes de police (`schemeClr`). Configuration simplifiée des familles de typographies "Titres" et "Corps" via l'interface.
- **Pagination Automatique (Overflow)** : Le moteur d'export PPT (`app_outputppt.js`) incorpore désormais une fonctionnalité de saut de page mathématique. Si le texte généré dépasse la zone allouée (`contentArea`) d'une diapositive, le contenu débordant est instantanément reporté sur une **nouvelle diapositive fraîchement générée**, évitant toute troncature.
- **Diapositives Dédiées** : Isolation intelligente des `Tableaux` sur des slides uniques générées à la volée, et support natif de slides intercalaires de couverture `TITRE` et de sous-sections `CHAPITRE`.

## [2.4.2] - 2026-02-22
### Ajouts et Améliorations
- **Modèles IA Non-Supprimables** : Ajout d'une propriété `locked: true` pour protéger les modèles vitaux configurés par défaut dans `models.json`.
- **Outils IA rapides** : Ajout d'une propriété `outil: true` sur les modèles. L'éditeur Markdown (Audit & Livrables) s'enrichit d'un bouton "Baguette magique" permettant d'invoquer ces outils IA (ex: Relecture, Traduction) directement sur le texte sélectionné via une fenêtre modale ergonomique (Split-view).

## [2.4.1] - 2026-02-22
### Refonte UI/UX (Mode Clair)
- **Nouvelle Palette** : Remplacement de la palette Indigo/Ardoise du mode clair par des tons plus chaleureux et moins contrastés (Beige chaud, Sable, et Rose poudré "Dusty Rose"). Le contraste texte/fond a été adouci pour limiter la fatigue visuelle (fonds crème au lieu de blanc pur, textes brun sombre au lieu de noir).

## [2.4.0] - 2026-02-21
### Refactoring & UI
- **WYSIWYG Global (`MarkdownEditor.js`)** : Extraction de l'éditeur de texte enrichi (Markdown) des Livrables vers un composant UI autonome et réutilisable.
- **Audit Interactif** : Intégration du `MarkdownEditor` directement dans les cellules du tableau d'Audit pour les colonnes "IA" et "Réponse".
    - Conversion automatique bidirectionnelle HTML <-> Markdown à la volée.
    - Ajout d'un mode d'affichage "Compact" pour que la barre de formatage s'intègre harmonieusement dans les cellules de la grille.
    - Hauteur initiale des champs "IA" et "Réponse" fixée strictement à 100px (avec défilement interne et redimensionnement manuel) pour éviter l'explosion de la hauteur de ligne lors de textes volumineux.
    - Les résultats générés par l'IA (bouton ✨) sont désormais formatés immédiatement (Titres, Listes, Gras) via le moteur enrichi sans ouvrir de pop-up.
- **Module Rapports (`ReportsRenderer.js`)** : Découpage de `app_reports.js` en appliquant le patron d'architecture MVC (Model-View-Controller).
    - L'intégralité de la génération HTML de l'interface et de la gestion des évènements (Délégation) est extraite vers `ReportsRenderer.js`.
    - `app_reports.js` est allégé et se concentre désormais sur l'état des données (modèles de rapports, librairie de modules) et sur les actions métier, augmentant la lisibilité et la maintenance du module.
- **Évolution Dashboard (`app_dashboard.js`)** : Refonte de la création et de l'édition des widgets.
    - Ajout d'une **Modale de configuration** complète remplaçant les listes déroulantes basiques du header, permettant de définir un titre personnalisé.
    - Support des **Croisements Dynamiques** : l'Axe Principal et l'Axe Secondaire ne sont plus restreints aux colonnes de type "chapitre" ou "liste", mais acceptent **toutes les colonnes** valides du formulaire. Les valeurs sont extraites dynamiquement à la volée.
    - Intégration du composant officiel `chartjs-plugin-datalabels` : nouvelle option cosmétique pour afficher les valeurs directement sur les graphiques.
    - **Format de Valeurs** : Option pour afficher les valeurs en comptes bruts ou en pourcentages (%). Dans le cas des graphiques croisés en %, l'axe horizontal complet (X) s'ajuste dynamiquement sur une échelle de 0 à 100.
    - Ajout d'un bouton d'édition (⚙️) sur chaque carte de graphique pour modifier sa configuration à la volée sans devoir le recréer.

## [2.3.0] - 2026-02-20
### Ajouts
- **Livrables WYSIWYG** : Remplacement de la zone de texte brut par un éditeur de texte enrichi dynamique (Gras, Titres, Listes, Tableaux avec redimensionnement intelligent des colonnes et scroll horizontal embarqué). L'éditeur s'agrandit automatiquement jusqu'au bas de l'écran après génération (et reste redimensionnable manuellement). Conversion automatique bidirectionnelle parfaite vers le format Markdown. Ajout d'une barre d'outils avec icônes. La présence du "Tableau" de contexte est désormais invisible dans l'éditeur pour plus de propreté, mais correctement greffé lors de l'export final.
- **Impression Unifiée** : Remplacement des boutons d'export Word/PPT par un bouton unique "Impression" avec une interface de sélection de modèles. L'export déclenche également le téléchargement séparé des widgets (graphiques) sélectionnés sous forme d'images PNG.
- **Configuration Output** : Centralisation des configurations de sortie dans `output_config.json` (remplace `ppt_config.json`) avec support d'une liste de documents Word modèles.
- **Office Export** : Ajout de l'export des livrables au format Word (`.docx`) avec conservation des tableaux et de la hiérarchie des titres. L'export Markdown (`.md`) a aussi été enrichi de l'export des tableaux de contexte cachés.
- **Refonte UI/UX (Premium)** : Nouvelle identité visuelle "Midnight/Indigo".
    - **Design** : Adoption des polices *Inter* & *Outfit*, Glassmorphism sur le header, Ombres portées modernes.
    - **Navigation** : Nouveau menu latéral rétractable avec activation au survol (Handle) et épinglage (Pin). Optimisation de l'espace de travail.
    - **Ergonomie** : Amélioration des inputs (textarea), des tables (sticky headers) et des cartes du dashboard.

## [2.2.1] - 2026-02-19
### Optimisation des Performances (Phase 1 & 2)
Focus sur la réactivité de l'interface et la réduction de la charge mémoire.

- **Moteur de Rendu Audit (`AuditRenderer.js`)** :
    - **Délégation d'Événements** : Remplacement des milliers d'écouteurs individuels (un par cellule) par un écouteur unique sur le conteneur principal. Gain significatif de mémoire et de temps d'initialisation pour les gros audits.
- **Module Livrables (`app_deliveries.js`)** :
    - **Debounce** : Temporisation de la sauvegarde automatique (500ms) lors de la frappe pour éviter les écritures disques excessives.
    - **Délégation** : Adoption du même modèle de délégation d'événements que l'audit.
- **Tableau de Bord (`app_dashboard.js`)** :
    - **Smart Rendering** : Réutilisation des instances `Chart.js` existantes lors des mises à jour de données, éliminant le scintillement (flicker) et la charge CPU inutile.
- **Core (`DataUtils.js`)** :
    - **Recherche Optimisée** : Réécriture de la logique de recherche globale pour éviter la sérialisation JSON excessive de chaque cellule.

## [2.2.0] - 2026-02-15
### Refactoring & Modernisation (Phases 1-4)
Une refonte profonde du code pour améliorer la maintenabilité, la robustesse et l'expérience utilisateur.

- **Architecture Unifiée** :
    - **Cœur** : Création de `js/core/Config.js` (constantes, couleurs), `js/core/UIFactory.js` (composants réutilisables), `js/core/DataUtils.js` (logique de tri/filtre extraite), et `js/core/Schemas.js` (validation données).
    - **État** : Unification de la gestion d'état des Rapports (`reportsStore`) dans `State.js`.
- **Robustesse & Sécurité** :
    - **Validation** : Intégration de schémas de validation JSON lors des imports et chargements via `Utils.safeFetch`.
    - **Nettoyage** : Extraction de la logique métier (tri, filtre) hors des contrôleurs de vue (`app_audit.js`).
- **Modernisation (DX)** :
    - **Syntaxe** : Migration complète vers **Async/Await**, suppression des chaînes de promesses `.then()` legacy.
    - **Code Mort** : Suppression massive de code commenté et obsolète.
- **Expérience Utilisateur (UX)** :
    - **Toasts** : Remplacement des `alert()` intrusifs par des notifications non-bloquantes (Toasts) pour les succès/erreurs.
    - **UI Audit** : Ajustement du padding des cellules (mode "Compact" 10px) et élargissement des colonnes "Réponse" (450px) et "S" (100px).

## [2.1.0] - 2026-02-14
### Refonte Header & Navigation
- **Menu Global** : Centralisation des actions "Fichier" (Charger, Sauvegarder, Exporter, Réinitialiser) et "Configuration" (Formulaires, Agents, Rapports) dans un menu unique accessible via l'icône ☰.
- **Header Épuré** : Suppression des boutons d'action individuels pour alléger l'interface.
- **Logique d'État** :
    - Les actions contextuelles (Sauvegarder, Exporter, Rénitialiser) sont désactivées si aucune donnée n'est chargée.
    - Les accès de configuration (Créateur, Modèles, Rapports) restent toujours disponibles.
- **Correctifs UI** :
    - Alignement flexbox corrigé dans le header.
    - Indentation visuelle des sous-éléments du menu pour une meilleure lisibilité.
    - Suppression de la dépendance à la visibilité des boutons selon la vue (le menu est désormais global).
    - **Correctif Z-Index** : Correction de la superposition du menu déroulant qui passait derrière les sidebars (Header Z-Index passé à 2000).
    - **Correctif Export** : Rétablissement du lien entre le bouton "Exporter" du menu et le module d'export.

## [2.0.0] - 2026-02-12
### Refonte Technique Majeure (ES6 Modules)
Une refonte complète de l'architecture JavaScript a été effectuée pour passer d'un système de scripts globaux à des **Modules ES6** natifs.
- **Export Word Avancé** : Support des modèles `.docx` / `.dotx`.
- **Export PowerPoint Configurable** : Nouveau moteur d'export PPTX (`js/modules/app_outputppt.js`). Support des thèmes personnalisés (Couleurs, Polices, Masters) via un simple fichier de configuration `ppt_config.json`. Sélection du style directement depuis l'interface.
- **Point d'entrée** : Création de `js/main.js` qui orchestre l'initialisation de l'application.
- **Nettoyage** : Suppression de `js/app_shared.js` (legacy) et nettoyage de `index.html`.
- **Refactoring** : Extraction de la logique d'export Word dans `js/modules/app_output_word.js`.
- **État Global** : Centralisation de la gestion d'état dans `js/core/State.js` (Pattern Singleton/Store).

### Corrections
- **Livrables** : Correction d'un bug bloquant l'ajout de nouveaux livrables (problème de propagation d'événement).
- **Export** : Refonte du module export en ES6.
- **UI Livrables** : Amélioration de l'ergonomie (cartes largeur 1/3, scrollbars page entière fixées aux bords de l'écran).
- **Architecture** : Simplification de la structure `reports.json`. Les rapports sont maintenant définis par une simple liste d'IDs de modules au lieu d'objets de configuration complets. Logiciels d'import/export et de sauvegarde mis à jour en conséquence.

### Fonctionnalités
- **Livrables - Scope** : Ajout d'une configuration de périmètre (Global ou par Chapitre/Sous-chapitre) avec sélection hiérarchique.
- **Livrables - Colonnes** : Ajout d'un sélecteur de colonnes pour choisir quelles données de l'audit envoyer à l'IA.
- **Livrables - Format** : Ajout d'une option "Tableau" (booléen) pour demander un formatage spécifique.
- **Livrables - Édition** : Le résultat généré par l'IA est maintenant directement éditable par l'utilisateur (avec sauvegarde automatique).

## [1.5.0] - 2026-02-11
### Fonctionnalités
- **Module Livrables** : Ajout de la vue "Livrables" pour générer des rapports basés sur des modèles.
- **Module Rapports** : Interface de création de templates de rapports (liste ordonnée de modules).

## [1.0.0] - 2026-01-01
### Version Initiale
- **Audit** : Grille d'audit dynamique.
- **Tableau de Bord** : Visualisation des KPIs.
- **Formulaires** : Créateur de formulaires via import JSON.
- **IA** : Intégration initiale avec LM Studio et OpenAI.
