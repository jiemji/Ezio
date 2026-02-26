# Documentation Fonctionnelle Ezio

Ezio est un outil applicatif métier conçu pour simplifier et automatiser la saisie d'audits, de formulaires complexes, et la génération de rapports via l'Intelligence Artificielle.
Ce document décrit exclusivement les fonctions offertes par chaque écran (interface utilisateur) et la façon de s'en servir efficacement.

---

## 1. Écran : Éditeur de Formulaire / Audit (Accueil)
C'est le cœur de la saisie des données. Il se présente sous la forme d'un tableur dynamique interactif.

### Fonctions principales
- **Création du formulaire** : Définition des colonnes libres (Texte, Liste déroulante, Chapitre) via le bouton "Gérer les colonnes".
- **Saisie en grille** : Les utilisateurs peuvent ajouter des lignes (Constats, Questions) et les remplir comme dans Excel.
- **Intervention IA (Baguette Magique ✨)** : Colonnes dédiées (`ia`) permettant de générer automatiquement un contenu à partir des autres cellules de la ligne courante, en utilisant les directives du modèle d'IA (ex: "Rédige une recommandation basée sur le constat de cette ligne").
- **Éditeur de texte enrichi** : Les grandes cellules peuvent être éditées via un mini-éditeur Markdown (Titres, Gras, Listes) pour une meilleure mise en page, et disposent aussi d'outils de "Traitement IA rapide" (Traduction, Relecture) accessibles via une nouvelle fenêtre pop-up 🛠️.
- **Filtres et Tris** : Permet de filtrer l'affichage par chapitre ou sous-chapitre pour naviguer dans les formulaires massifs.

### Exemple d'utilisation
> Un auditeur cybersécurité définit une colonne "Question", une "Constat", et une "Recommandation (IA)". Il remplit 50 lignes de constats techniques, clique sur "Générer tout" (ou ligne par ligne avec ✨), et l'IA rédige instantanément les recommandations formelles adaptées à chaque ligne. L'auditeur relit, modifie directement le texte via l'éditeur enrichi, et le verrouille (🔒).

---

## 2. Écran : Dashboard (Tableau de bord interactif)
Construit automatiquement des graphiques statistiques à partir des données saisies dans l'Audit.

### Fonctions principales
- **Création de Widgets (Graphiques)** : Bouton "Ajouter" pour créer des camemberts (Pie), des barres (Bar), etc.
- **Croisement de données matricielles** : Chaque graphique permet de croiser deux colonnes de l'audit (ex: Axe X = "Gravité", Axe Y = "Statut").
- **Filtres** : Chaque graphique peut être restreint à un seul "Chapitre" du formulaire.
- **Affichages personnalisés** : Options pour afficher les DataLabels (valeurs ou pourcentages sur les portions du graphique), définir des couleurs, et sélectionner si on inclut le widget dans les rapports d'impression finaux.

### Exemple d'utilisation
> L'utilisateur ajoute un graphique de type "Pie", sélectionne la colonne "Statut" de son audit. Le graphique affiche immédiatement la répartition "Fait / Non Fait / En cours". En cochant "Inclure aux rapports", il s'assure que cette image sera ajoutée automatiquement dans ses exports finaux Word ou PowerPoint.

---

## 3. Écran : Modèles de Rapports
Gère la bibliothèque logicielle des "briques" (Modules) qui serviront à composer les livrables IA.

### Fonctions principales
- **Gestion des Modèles** : Permet de créer différents types de modèles finaux (ex: "Synthèse Managériale", "Rapport Technique Détaillé").
- **Composition par Modules** : Dans chaque modèle, on glisse/dépose des modules IA.
- **Configuration des Modules IA** : Chaque module possède une instruction système (prompt) et un "Périmètre de données" (Scope). 
    - *Scope* : Définit quelles données l'IA va lire. Soit l'intégralité du formulaire (Global), soit un filtre précis en croisant Chapitre et Colonnes.

### Exemple d'utilisation
> Le chef de projet crée un Modèle "Résumé Décideurs". Il y ajoute un module IA nommé "Synthèse des Risques Hauts". Il configure le module pour ne filtrer que les lignes de l'audit où "Gravité" = "Haute", et demande à l'IA : "Rédige une page de synthèse alarmante mais professionnelle basée sur les données qui vont suivre".

---

## 4. Écran : Rapports / Livrables
Le moteur d'exécution et de relecture finaux des modèles créés précédemment.

### Fonctions principales
- **Création de Livrable** : L'utilisateur instancie ("Génère") un nouveau livrable en sélectionnant l'un de ses *Modèles de Rapports*.
- **Génération / Exécution IA** : Il clique sur "Tester / Générer" sur un module. L'application rassemble les données de l'Audit (selon le Scope), les envoie à l'IA avec le Prompt, et récupère un texte complet.
- **Éditeur WYSIWYG Global** : Le résultat atterrit dans un grand éditeur Markdown interactif. L'utilisateur peut y faire de la mise en page, corriger le texte ou utiliser les "Outils IA" modaux (Baguette magique : Traduire, Reformuler).
- **Ressources furtives** : Lors de la génération d'un module configuré en "Tableau de données", le tableau n'encombre pas la vue éditeur mais est sauvegardé en arrière-plan pour les exports physiques.

### Exemple d'utilisation
> C'est l'étape finale. L'utilisateur sélectionne son modèle et lance le calcul de chaque bloc de rapport un par un. Il lit le "Résumé Décideurs" généré, trouve un paragraphe trop faible, sélectionne le texte, ouvre la Modale "Outils IA", demande une "Reformulation Punchy (Executive)", valide le résultat qui remplace l'ancien paragraphe.

---

## 5. Écran : Impression (Exportation PPT / Word / MD)
Le centre de compilation physique des données. 

### Fonctions principales
- **Export MarkdownBrut** : Téléchargement rapide des réponses IA en un seul fichier `.md`.
- **Injection dans gabarit Word (.docx)** : Utilise des fichiers locaux Word comme modèles. Cherche la balise `{{CONTENT}}` dans ce Word et y coule ("greffe") l'ensemble des textes générés dans les livrables, ainsi que les graphiques du Dashboard.
- **Export PowerPoint (.pptx)** : Regénère des matrices complètes, les tableaux, et les widgets d'analyse sous forme de diapositives de présentation structurées.

### Exemple d'utilisation
> Tout le travail intellectuel est validé. L'utilisateur clique sur "Imprimer" dans l'en-tête de l'application. Il choisit "Export Word", sélectionne le fichier "ma_charte_entreprise.docx". En trois secondes, Ezio génère et fait télécharger un rapport Word parfaitement formaté de 30 pages, incluant son logo, sa page de garde, suivi des synthèses de l'IA et de son pie-chart, prêts à être envoyés.

---

## 6. Écran : Agents IA (Configuration Modèles)
L'espace d'administration technique de l'Intelligence Artificielle.

### Fonctions principales
- **Répertoire API & Logiciels** : Permet de lier l'application à différents moteurs IA (LMStudio en local offline par défaut, ou API Cloud comme OpenAI, Anthropic).
- **Verrouillage (🔒)** : Identification des modèles structurels ineffaçables (ex: Modèles locaux).
- **Outils rapides (🛠️)** : Permet de typer certains modèles en tant que "Macro" / "Outils". S'ils sont typés ainsi avec `outil: true`, ils apparaîtront dans les listes déroulantes de l'éditeur Markdown (la Modale "Outils IA").
- **Prompts Systèmes** : Définition de l'âme et du comportement inhérent de chaque modèle.

### Exemple d'utilisation
> L'entreprise veut que tous les textes générés soient plus incisifs. L'administrateur va dans cet onglet, modifie le modèle IA par défaut en rajoutant au prompt système : "Utilise des phrases très courtes et un ton direct". Il coche aussi la case "Définir comme outil" sur un modèle nommé "Traduction FR-EN" pour que les collaborateurs puissent traduire à la volée n'importe quel bloc dans l'éditeur de l'application.
