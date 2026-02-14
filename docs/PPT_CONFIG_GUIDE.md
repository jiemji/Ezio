# Guide de Configuration des Modèles PowerPoint

Ce document explique comment créer et modifier les modèles PowerPoint utilisés par l'application Ezio.
La configuration se trouve dans le fichier `ppt_config.json` à la racine de l'application.

## Structure du Fichier

Le fichier contient une liste de templates (`templates`). Chaque template possède un `id`, un nom, un thème de couleurs, des polices et des définitions de "Masters" (diapositives maîtresses).

```json
{
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

## 1. Thème et Polices

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

## 2. Diapositives Maîtresses (Masters)

Il y a deux types de diapositives obligatoires :
1.  `TITLE_SLIDE` : La première page (Titre du Livrable).
2.  `CONTENT_SLIDE` : Les pages suivantes (Une par Module).

### Éléments Statiques (`elements`)
Vous pouvez placer des formes (`rect`, `ellipse`) ou du texte fixe/dynamique.

**Propriétés disponibles :**
*   `type`: "text", "rect", "ellipse", "image" (support basique URL)
*   `x`, `y`, `w`, `h`: Position et taille en **pouces** (inches). (x=0, y=0 est le coin haut-gauche).
*   `fill`: Couleur de remplissage (HEX).
*   `color`: Couleur du texte (HEX).
*   `fontSize`: Taille de police.
*   `bold`: `true` ou `false`.
*   `align`: "left", "center", "right".

### Placeholders (Variables Dynamiques)
Dans les éléments de texte de type `TITLE_SLIDE`, vous pouvez utiliser :
*   `{{TITLE}}` : Sera remplacé par le nom du Livrable.
*   `{{DATE}}` : Sera remplacé par la date du jour.

Dans `CONTENT_SLIDE` :
*   `{{MODULE_TITLE}}` : Sera remplacé par le nom du module actuel.
*   `{{SLIDE_NUMBER}}` : Numéro de page.

### Zone de Contenu (`contentArea`)
Uniquement pour `CONTENT_SLIDE`. Définit la zone où le texte et les tableaux générés par l'IA seront insérés.

```json
"contentArea": {
  "x": 0.5, "y": 1.2, // Marge gauche et haut
  "w": 9.0, "h": 4.0  // Largeur et hauteur disponible
}
```
Si le contenu dépasse cette zone, il sera tronqué (dans cette version).

## Exemple

```json
"CONTENT_SLIDE": {
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
