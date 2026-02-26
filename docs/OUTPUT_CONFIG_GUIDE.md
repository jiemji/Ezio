# Guide de Configuration des Sorties (Output)

Ce document explique comment gérer les modèles PowerPoint et Word utilisés par l'application Ezio.
La configuration se trouve dans le fichier `output_config.json` à la racine de l'application.

## Structure du Fichier

Le fichier contient deux collections principales :
1.  `templates` : Pour les modèles PowerPoint (Styles, Masters, Thèmes).
2.  `documents` : Pour les modèles Word (Fichiers .docx servant de base).

```json
{
  "documents": [
    { 
       "name": "Rapport Isec", 
       "path": "Modele_word.docx" 
    }
  ],
  "templates": [
    {
      "id": "mon_template",
      "name": "Mon Design",
      "theme": { ... },
      "fonts": { ... },
      "masters": { ... }
    }
  ]
}
```

## 1. Modèles Word (`documents`)

Cette section liste les fichiers Word disponibles pour l'impression.
*   `name` : Le nom affiché dans la popup d'impression.
*   `path` : Le chemin relatif vers le fichier `.docx` ou `.dotx` (ex: `Modele_word.docx`).

## 2. Modèles PowerPoint (`templates`)

## 2.1. Thème et Polices

Définissez ici les couleurs principales (format HEX sans #) et les polices.

```json
"theme": {
  "primary": "003366",   // Couleur principale (Titres)
  "secondary": "c43e1c", // Couleur secondaire (Accents)
  "text": "333333",      // Couleur du texte standard
  "background": "FFFFFF",// Couleur de fond des slides
  "surface": "F7F7F7"    // Couleur de fond pour les tableaux (en-têtes)
},
"fonts": {
  "title": "Arial",      // Police des titres
  "body": "Arial"        // Police du texte
}
```

## 2.2. Diapositives Maîtresses (Masters)

Il y a trois types de diapositives identifiables par Ezio lors de la compilation :
1.  `TITRE` : La première page de couverture (Titre du Livrable).
2.  `CHAPITRE` : Les intercalaires de section (Créés dynamiquement avant chaque module, si ce modèle existe).
3.  `SLIDE` : Les diapositives de contenu pour les résultats.

### Éléments Statiques (`elements`)
Vous pouvez placer des formes (`rect`, `ellipse`) ou du texte fixe/dynamique. Il est fortement recommandé d'utiliser `extract.html` pour générer automatiquement cette structure depuis vos propres `.pptx`.

**Propriétés disponibles :**
*   `type`: "text", "rect", "ellipse", "image" (support basique URL)
*   `x`, `y`, `w`, `h`: Position et taille en **pouces** (inches). (x=0, y=0 est le coin haut-gauche).
*   `fill`: Couleur de remplissage de la boîte (HEX ou scheme de thème).
*   `color`: Couleur du texte ou de la ligne (HEX ou scheme de thème).
*   `fontSize`: Taille de police.
*   `margin`: Marges internes [Gauche, Droite, Bas, Haut] en **points (pt)** (très utile pour la compatibilité native PPTX).

### Placeholders (Variables Dynamiques)
Ces tags spéciaux placés dans n'importe quel élément de type `text` de votre masque seront automatiquement traduits par le moteur de rendu Ezio.

Dans les diapositives de couverture `TITRE` :
*   `{{titre}}` ou `{{TITLE}}` : Remplacé par le nom global du Livrable.
*   `{{date}}` ou `{{DATE}}` : Remplacé par la date du jour d'export.

Dans les intercalaires `CHAPITRE` :
*   `{{chapitre}}` ou `{{TITLE}}` : Remplacé par le nom du module/section actuel.
*   `{{date}}` ou `{{DATE}}` : Remplacé par la date du jour d'export.

Dans les contenus `SLIDE` :
*   `{{titre}}` ou `{{TITLE}}` : Remplacé par le nom du module/section actuel.
*   `{{date}}` ou `{{DATE}}` : Remplacé par la date du jour d'export.
*   `{{SLIDE_NUMBER}}` : Index automatique de la section (le 3e module aura le numéro 3 sur toutes ses diapositives générées).

### Zone de Contenu (`contentArea`)
Uniquement pour `SLIDE`. Définit la zone vide principale de la diapositive où le texte Markdown long et les Tableaux générés par l'IA seront insérés dynamiquement.

```json
"contentArea": {
  "x": 0.5, "y": 1.2, // Marge gauche et haut
  "w": 9.0, "h": 4.0  // Largeur et hauteur disponible
}
```
**Pagination Intelligente** : Si le texte généré par l'IA dépasse la surface définie par `h`, le moteur Pptx d'Ezio provoquera **un saut de page** (« overflow »), arrêtera l'écriture sur la diapositive pleine, et injectera la suite du texte sur une toute nouvelle diapositive (`SLIDE`) au même point `y`.

## Exemple

```json
"SLIDE": {
  "background": { "color": "FFFFFF" },
  "elements": [
    // Une barre latérale rouge
    { "type": "rect", "x": 0, "y": 0, "w": 0.5, "h": "100%", "fill": "FF0000" },
    // Le titre du module en haut
    { "type": "text", "text": "{{MODULE_TITLE}}", "x": 0.7, "y": 0.5, "w": 8.0, "h": 0.5, "color": "000000", "fontSize": 24 }
  ],
  "contentArea": { "x": 0.7, "y": 1.2, "w": 8.5, "h": 4.0 }
}
```
