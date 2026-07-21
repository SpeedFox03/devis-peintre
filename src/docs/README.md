# Assets sources du thème PDF « Élégant »

Ce dossier contient les **sources** ayant servi à générer les modules d'assets
embarqués du devis « Élégant ». Les fichiers ici ne sont pas importés par
l'application (le runtime utilise les base64 embarqués), ils servent uniquement
à **régénérer** ces modules si besoin.

## Fichiers

- `b1daad83-f19f-446c-b417-b170de2eaaf1.jpg` — maquette de référence MomentD.Art.
- `paint_top.png`, `paint_botleft.png` — coups de pinceau découpés de la maquette
  et détourés en alpha (le fond crème #e1ded9 correspond au fond de la maquette,
  donc les découpes se fondent sans liseré).
- `fonts/PlayfairDisplay-Regular.ttf`, `fonts/PlayfairDisplay-Bold.ttf`,
  `fonts/GreatVibes-Regular.ttf` — polices sous-ensemblées au jeu de caractères FR
  (latin + accents + € + ponctuation), licence OFL.

## Modules générés (dans `src/features/quotes/pdf/`)

- `elegantPaintAssets.ts` — base64 des deux textures + rectangles de placement (pt).
- `elegantFontAssets.ts` — base64 des trois polices + `registerElegantFonts()`.

## Régénération

Les textures se régénèrent depuis la maquette par matte alpha (déviation locale de
luminance), les polices via `fonttools` (instanciation Playfair depuis la variable +
sous-ensemblage `pyftsubset`). Voir l'historique de la PR pour les scripts Python.
