# Historique des Changements (Changelog)

Ce document retrace l'évolution du projet Ezio, les nouvelles fonctionnalités, les corrections de bugs et les refontes techniques.

## [2.3.0] - 2026-02-20
### Ajouts
- **Livrables WYSIWYG** : Remplacement de la zone de texte brut par un éditeur de texte enrichi dynamique (Gras, Titres, Listes, Tableaux avec redimensionnement intelligent des colonnes et scroll horizontal embarqué). Conversion automatique bidirectionnelle parfaite vers le format Markdown. Ajout d'une barre d'outils avec icônes.
- **Impression Unifiée** : Remplacement des boutons d'export Word/PPT par un bouton unique "Impression" avec une interface de sélection de modèles.
- **Configuration Output** : Centralisation des configurations de sortie dans `output_config.json` (remplace `ppt_config.json`) avec support d'une liste de documents Word modèles.
- **Office Export** : Ajout de l'export des livrables au format Word (`.docx`) avec conservation des tableaux et de la hiérarchie des titres.
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
