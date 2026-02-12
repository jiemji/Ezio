# Historique des Changements (Changelog)

Ce document retrace l'évolution du projet Ezio, les nouvelles fonctionnalités, les corrections de bugs et les refontes techniques.

## [Non Publié] - En cours
### Ajouts
- Création de ce fichier `CHANGELOG.md` pour le suivi historique.

## [2.0.0] - 2026-02-12
### Refonte Technique Majeure (ES6 Modules)
Une refonte complète de l'architecture JavaScript a été effectuée pour passer d'un système de scripts globaux à des **Modules ES6** natifs.
- **Modularisation** : Tous les fichiers JavaScript (`js/modules/`, `js/core/`, `js/ui/`) sont désormais des modules (`export` / `import`).
- **Point d'entrée** : Création de `js/main.js` qui orchestre l'initialisation de l'application.
- **Nettoyage** : Suppression de `js/app_shared.js` (legacy) et nettoyage de `index.html`.
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
