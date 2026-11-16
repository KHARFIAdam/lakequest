# LakeQuest

Un jeu pour préparer l'examen **AWS Certified Data Engineer – Associate (DEA-C01)** : on apprend en regardant les données circuler, on s'entraîne en conditions réelles, et on collectionne les trophées jusqu'au fond du lac.

Site statique, sans compilation ni serveur : du HTML, du CSS et du JavaScript. La progression est enregistrée dans le navigateur.

## Ce qu'il y a dedans

| Mode | Contenu |
| --- | --- |
| **Flux animés** | 15 mécanismes AWS racontés un message à la fois (Kinesis, Firehose, DMS, Glue, Redshift, Iceberg, KMS, Lake Formation…), avec lecture pas à pas, vue en séquence, inspecteur de champs et pièges d'examen. |
| **Shorts** | 73 séquences verticales de 30 à 45 secondes, une par fiche et par comparatif du codex : usage, cas d'emploi, pièges d'examen, confusions à éviter. Huit d'entre eux sont des shorts animés, avec des visuels dessinés (lignes qui se répartissent entre nœuds, barres, chaînes, arbres de décision) ; leurs scénarios sont dans `js/data/shorts-fx.js`. Lecture automatique, voix facultative. |
| **Missions** | 23 missions, 184 questions d'entraînement, 3 étoiles par mission, un gardien par domaine. |
| **Examens blancs** | Trois examens inédits de 65 questions (A, B, et C au format long, le plus proche des énoncés réels), répartis comme le vrai (34 % / 26 % / 22 % / 18 %), 130 minutes ou 160 avec l'aménagement ESL, note sur 1 000, seuil à 720, résultat par domaine. Plus des examens aléatoires de 20, 33 ou 65 questions. |
| **Blitz** | 60 secondes pour associer un besoin au bon service, ou trancher vrai/faux. |
| **Chantiers** | 12 architectures à assembler, choix par choix. |
| **Codex** | 57 fiches, 16 comparatifs, et un décodeur des expressions qui orientent la réponse (« LEAST operational overhead », « near real-time »…). |
| **Progression** | Niveaux, série quotidienne, défi du jour, révision espacée, 53 trophées, et une jauge de complétion : la profondeur atteinte dans le lac. |

Les questions sont en anglais, comme à l'examen. Les explications sont en français.

## Jouer en local

Ouvre `index.html` dans un navigateur. C'est tout.

Si tu préfères passer par un serveur local :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Mettre en ligne avec GitHub Pages

```bash
cd lakequest
git init -b main
git add .
git commit -m "LakeQuest, première version"
gh repo create lakequest --public --source=. --push
```

Puis, sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, **Save**. Une à deux minutes plus tard, le jeu est en ligne à l'adresse `https://<ton-compte>.github.io/lakequest/`.

Chaque `git push` sur `main` met le site à jour. Tous les chemins sont relatifs : le site fonctionne aussi bien à la racine d'un domaine que dans un sous-dossier.

N'importe quel hébergement de fichiers statiques convient aussi (S3 + CloudFront, Netlify, Cloudflare Pages…).

## Structure

```
index.html            page unique, charge les données puis le moteur
css/style.css         styles, thèmes clair et sombre
js/core.js            état, sauvegarde, niveaux, trophées, révision espacée
js/quiz.js            moteur de questions (entraînement et examen)
js/views-*.js         écrans : jouer, examen, flux et codex, trophées et profil
js/views-shorts.js    shorts générés à partir du codex
js/packs.js           import de questions personnelles (CSV, stockage local)
js/app.js             navigation et démarrage
js/data/              tout le contenu, en fichiers lisibles
tools/validate.js     contrôle de cohérence du contenu
tools/build.js        assemblage en un seul fichier (facultatif)
```

## Ajouter ou corriger du contenu

Tout le contenu est dans `js/data/`. Une question ressemble à ceci :

```js
{ id: "kds-09", ts: "1.1", t: "kds",
  q: "English stem. Which solution meets these requirements?",
  o: ["Option A.", "Option B.", "Option C.", "Option D."],
  a: [1],
  e: "Explication en français, avec du **gras** et du `code`.",
  r: ["kinesis-data-streams"] },
```

- `ts` : la tâche du guide d'examen (`1.1` à `4.5`) ; son premier chiffre donne le domaine.
- `t` : la mission (voir `js/data/meta.js`).
- `a` : l'index des bonnes réponses. Pour une question à plusieurs réponses, ajoute `k: "mr"`, au moins cinq options, et termine l'énoncé par `(Select TWO.)`.
- `x: "A"`, `"B"` ou `"C"` : réserve la question à un examen blanc ; elle rejoint l'entraînement après la première tentative.
- `r` : les fiches du codex proposées après la réponse.

Les options sont mélangées à chaque affichage. Après une modification :

```bash
node tools/validate.js
```

Le script vérifie les identifiants, les renvois, la forme des questions, la composition des examens et l'équilibre des longueurs d'options (la bonne réponse ne doit pas être systématiquement la plus longue).

Pour renommer le jeu, cherche « LakeQuest » dans `index.html` et `js/app.js`.

## Questions personnelles

L'écran **Profil** permet d'importer tes propres questions depuis des fichiers CSV (un cours ou des annales que tu possèdes). Elles sont enregistrées dans le navigateur uniquement : elles n'entrent ni dans le dépôt ni sur le site publié, et restent donc privées.

Colonnes attendues : `test, question_no, type, domain, question, option_A … option_F, correct_answer, explanation, feedback_A … feedback_F`. Chaque valeur de `test` devient un examen blanc sur la page Examen ; le commentaire de chaque option s'affiche à la correction. Après le premier passage, les questions rejoignent la révision espacée et les examens aléatoires.

## Sauvegarde

La progression vit dans le `localStorage` du navigateur : elle est propre à chaque appareil. L'écran **Profil** permet de l'exporter sous forme de texte et de l'importer ailleurs.

## Sources et limites

- Le contenu suit le **guide officiel de l'examen DEA-C01, version 1.1** : quatre domaines, dix-sept tâches, y compris les ajouts récents (Apache Iceberg et S3 Tables, index vectoriels, Amazon Bedrock, SageMaker Catalog et Unified Studio).
- **Toutes les questions sont originales.** Aucune ne provient de l'examen réel ni d'une banque de questions commerciale.
- Les services AWS évoluent. Les limites chiffrées changent régulièrement : en cas de doute, la documentation AWS fait foi. Les corrections sont les bienvenues.
- Le score d'un examen blanc est une conversion linéaire du taux de bonnes réponses vers l'échelle 100–1 000. Le vrai barème est différent : vise 800 ici pour être serein le jour J.

LakeQuest est un projet indépendant, sans lien avec Amazon Web Services. AWS et les noms de ses services sont des marques d'Amazon.com, Inc. ou de ses filiales.

## Licence

MIT. Voir [LICENSE](LICENSE).
