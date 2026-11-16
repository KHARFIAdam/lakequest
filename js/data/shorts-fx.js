/* LakeQuest — shorts animés : des scénarios dessinés, à la manière d'un short vidéo.
   Clé = identifiant de la fiche du codex. Une fiche sans scénario garde son short « texte ».
   Une scène : { hook: [l1, l2, MOT FORT] }  ou  { tag, big, tone, sub, v (visuel), caps: [[type, texte]] }
   Visuels :
     route : { src, tiles: "ABCD…", n, rule: "none" | "round" | "key" | "all", unit: "NŒUD", key: "étiquette de la clé" }
     bars  : { title, items: [[libellé, valeur 0-100, texte, ton]] }
     chain : { steps: [[sigle, libellé, détail]] }
     tree  : { qs: [[question, réponse, ton]] }
   Types de légende : ok, ko, warn, ou "" (neutre). Tons : teal, gold, green, violet, red. */
window.LQ = window.LQ || {};
LQ.shortsFx = {

  redshift: { title: 'Redshift : les 4 styles de distribution', scenes: [
    { hook: ['Ta requête', 'Redshift', 'RAME ?'] },
    { big: 'Un cluster = plusieurs nœuds', tone: 'teal', small: 1, v: { type: 'route', src: 'table reviews', tiles: 'ABCDBADC', n: 4, rule: 'none', unit: 'NŒUD' }, caps: [['', 'Le **style de distribution** décide où va chaque ligne.']] },
    { tag: 'Style 1 / 4', big: 'EVEN', tone: 'teal', sub: 'distribution à tour de rôle', v: { type: 'route', src: 'table reviews', tiles: 'ABCDBADCACBD', n: 4, rule: 'round', unit: 'NŒUD' }, caps: [['ok', 'Les lignes partent **une par une**, sans regarder le contenu.'], ['ko', 'Une jointure fait **voyager** les lignes entre nœuds.']] },
    { tag: 'Style 2 / 4', big: 'KEY', tone: 'gold', sub: 'même clé, même nœud', v: { type: 'route', src: 'table reviews', tiles: 'ABCDBADCACBD', n: 4, rule: 'key', unit: 'NŒUD', key: 'DISTKEY (asin)' }, caps: [['ok', 'Deux tables avec la même clé : jointure **locale**, sans transfert.']] },
    { tag: 'Style 2 / 4', big: 'KEY', tone: 'gold', sub: 'le piège', v: { type: 'route', src: 'table reviews', tiles: 'AAAABAAACAAA', n: 4, rule: 'key', unit: 'NŒUD', key: 'DISTKEY (asin)' }, caps: [['warn', 'Une clé mal répartie **surcharge** un seul nœud.']] },
    { tag: 'Style 3 / 4', big: 'ALL', tone: 'green', sub: 'une copie complète partout', v: { type: 'route', src: 'table metadata · 4 lignes', tiles: 'ABCD', n: 4, rule: 'all', unit: 'NŒUD' }, caps: [['ok', 'Jointures **toujours locales**.'], ['ko', 'Stockage **× 4**, écritures lentes.']] },
    { tag: 'Style 4 / 4', big: 'AUTO', tone: 'violet', sub: 'Redshift choisit pour toi', v: { type: 'bars', title: 'la table grossit', items: [['petite', 22, 'ALL', 'green'], ['moyenne', 55, 'EVEN', 'teal'], ['grande', 100, 'KEY ou EVEN', 'gold']] }, caps: [['', 'Le **choix par défaut** quand tu n’as pas de raison de changer.']] },
    { big: 'Comment choisir ?', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Petite table de référence, rarement modifiée ?', 'ALL', 'green'], ['Deux grandes tables jointes sur la même colonne ?', 'KEY', 'gold'], ['Aucune jointure dominante ?', 'EVEN', 'teal'], ['Pas de raison de trancher ?', 'AUTO', 'violet']] } },
  ] },

  'kinesis-data-streams': { title: 'Kinesis : la clé de partition', scenes: [
    { hook: ['Tes événements', 'arrivent dans', 'LE DÉSORDRE ?'] },
    { big: 'Un flux = plusieurs shards', tone: 'teal', small: 1, v: { type: 'route', src: 'événements clients', tiles: 'ABCABCAB', n: 3, rule: 'none', unit: 'SHARD' }, caps: [['', 'L’ordre n’est garanti qu’**à l’intérieur d’un shard**.']] },
    { tag: 'Clé aléatoire', big: 'DISPERSÉ', tone: 'red', sub: 'un UUID comme clé de partition', v: { type: 'route', src: 'événements clients', tiles: 'ABCABCABC', n: 3, rule: 'round', unit: 'SHARD' }, caps: [['ko', 'Les événements d’un même client sont **éparpillés** : plus d’ordre.']] },
    { tag: 'Clé = client', big: 'ORDONNÉ', tone: 'green', sub: 'même clé, même shard', v: { type: 'route', src: 'événements clients', tiles: 'ABCABCABC', n: 3, rule: 'key', unit: 'SHARD', key: 'PartitionKey = client' }, caps: [['ok', 'Chaque client reste dans **son** shard : ordre garanti.']] },
    { tag: 'Le piège', big: 'SHARD CHAUD', tone: 'gold', sub: 'une clé concentre le trafic', v: { type: 'route', src: 'événements clients', tiles: 'AAAABAAAACAA', n: 3, rule: 'key', unit: 'SHARD', key: 'PartitionKey = pays' }, caps: [['warn', 'Ajouter des shards **ne change rien** : il faut une clé plus variée.']] },
    { big: 'Le bon réflexe', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Ordre par client ou par appareil ?', 'clé = son identifiant', 'green'], ['Un seul shard limité en écriture ?', 'clé plus variée', 'gold'], ['Plusieurs lecteurs qui se gênent ?', 'enhanced fan-out', 'teal'], ['Rejouer les 7 derniers jours ?', 'rétention', 'violet']] } },
  ] },

  dynamodb: { title: 'DynamoDB : choisir ses clés', scenes: [
    { hook: ['Ta table DynamoDB', 'est limitée alors qu’elle', 'N’EST PAS PLEINE ?'] },
    { tag: 'Clé = date du jour', big: 'PARTITION CHAUDE', tone: 'red', sub: 'toutes les écritures au même endroit', v: { type: 'route', src: 'écritures du jour', tiles: 'AAAAAAAAAAAA', n: 4, rule: 'key', unit: 'PARTITION', key: 'PK = date' }, caps: [['ko', 'La capacité est **répartie entre les partitions** : une seule sature.']] },
    { tag: 'Clé = appareil', big: 'RÉPARTI', tone: 'green', sub: 'une clé très variée', v: { type: 'route', src: 'écritures du jour', tiles: 'ABCDBADCACBD', n: 4, rule: 'key', unit: 'PARTITION', key: 'PK = device_id' }, caps: [['ok', 'Forte cardinalité : la charge **s’étale**.'], ['', 'La clé de tri ordonne **à l’intérieur** d’une partition.']] },
    { big: 'Les outils à connaître', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Chercher par un autre attribut ?', 'index global (GSI)', 'teal'], ['Même partition, autre tri ?', 'index local, à la création', 'gold'], ['Lectures en microsecondes ?', 'DAX', 'green'], ['Expirer sans coût d’écriture ?', 'TTL', 'violet']] } },
    { tag: 'À retenir', big: 'Query, pas Scan', tone: 'teal', small: 1, v: { type: 'bars', title: 'éléments lus pour une recherche', items: [['Scan + filtre', 100, 'toute la table', 'red'], ['Query sur la clé', 6, 'une partition', 'green']] }, caps: [['warn', 'Un **Scan** lit tout, même avec un filtre.']] },
  ] },

  s3: { title: 'S3 : choisir la classe de stockage', scenes: [
    { hook: ['Ta facture S3', 'gonfle', 'POUR RIEN ?'] },
    { tag: 'Ordre de grandeur', big: 'Le prix', tone: 'teal', small: 1, v: { type: 'bars', title: 'coût du stockage, Standard = 100', items: [['Standard', 100, '', 'teal'], ['Standard-IA', 54, '', 'teal'], ['Glacier Instant', 17, '', 'green'], ['Glacier Flexible', 16, '', 'gold'], ['Deep Archive', 4, '', 'violet']] }, caps: [['', 'Moins on lit, **moins on paie** le stockage.']] },
    { tag: 'La contrepartie', big: 'Le délai', tone: 'gold', small: 1, v: { type: 'bars', title: 'temps pour relire un objet', items: [['Standard', 3, 'immédiat', 'green'], ['Standard-IA', 3, 'immédiat', 'green'], ['Glacier Instant', 3, 'millisecondes', 'green'], ['Glacier Flexible', 55, 'minutes à heures', 'gold'], ['Deep Archive', 100, 'jusqu’à 12 h', 'red']] }, caps: [['warn', 'Le **délai accepté** dans l’énoncé désigne la classe.']] },
    { big: 'Comment choisir ?', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Accès imprévisible ?', 'Intelligent-Tiering', 'teal'], ['Rare, mais immédiat ?', 'Standard-IA', 'green'], ['Archive lue chaque trimestre, tout de suite ?', 'Glacier Instant', 'gold'], ['Archive, 12 heures d’attente acceptées ?', 'Deep Archive', 'violet']] } },
    { tag: 'Le piège', big: '128 Ko', tone: 'red', sub: 'taille minimale facturée en Standard-IA', v: { type: 'bars', title: 'un objet de 10 Ko est facturé…', items: [['en Standard', 8, '10 Ko', 'green'], ['en Standard-IA', 100, '128 Ko', 'red']] }, caps: [['ko', 'Des millions de petits objets en IA : la facture **monte**.']] },
  ] },

  athena: { title: 'Athena : ne payer que ce qu’on lit', scenes: [
    { hook: ['Ta requête Athena', 'coûte', 'UNE FORTUNE ?'] },
    { tag: 'La règle', big: 'Volume lu', tone: 'teal', sub: 'c’est lui qui est facturé', v: { type: 'bars', title: 'données lues pour la même question', items: [['CSV brut', 100, 'toute la table', 'red'], ['+ Parquet', 12, 'colonnes utiles', 'gold'], ['+ partitions', 1, 'le jour demandé', 'green']] }, caps: [['ok', '**Parquet** + **partitions** + colonnes utiles.'], ['ko', '`LIMIT` ne réduit pas ce qui est lu.']] },
    { tag: 'Le trajet', big: 'Élagage', tone: 'green', small: 1, v: { type: 'chain', steps: [['SQL', 'WHERE dt = hier', 'la requête'], ['CAT', 'Data Catalog', '1 partition sur 365'], ['S3', 'Parquet', '2 colonnes sur 40'], ['RES', 'Résultat', 'écrit dans S3']] }, caps: [['', 'Le catalogue choisit les dossiers, Parquet choisit les colonnes.']] },
    { big: 'Les cas d’examen', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Nouvelle date, zéro ligne ?', 'partition non enregistrée', 'red'], ['Des milliers de partitions régulières ?', 'projection de partitions', 'green'], ['Limiter et facturer par équipe ?', 'workgroups', 'teal'], ['Joindre S3 et DynamoDB ?', 'requête fédérée', 'gold']] } },
  ] },

  firehose: { title: 'Firehose : livrer sans code', scenes: [
    { hook: ['Du JSON qui arrive,', 'du Parquet dans S3,', 'SANS CODE ?'] },
    { tag: 'Le trajet', big: 'Firehose', tone: 'teal', sub: 'il accumule, puis il livre', v: { type: 'chain', steps: [['APP', 'Producteurs', 'événements JSON'], ['FH', 'Tampon', 'taille ou durée atteinte'], ['LAM', 'Lambda (facultatif)', 'transformer, masquer'], ['CAT', 'Conversion', 'JSON → Parquet'], ['S3', 'Amazon S3', 'préfixes par date']] }, caps: [['warn', 'Le tampon en fait du **quasi** temps réel.']] },
    { tag: 'Le réglage', big: 'Le tampon', tone: 'gold', small: 1, v: { type: 'bars', title: 'taille des fichiers livrés', items: [['tampon court', 12, 'pluie de petits fichiers', 'red'], ['tampon long', 100, 'gros fichiers', 'green']] }, caps: [['', 'Petits fichiers = requêtes Athena **lentes**.']] },
    { big: 'Firehose ou Data Streams ?', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Moins d’une seconde, code sur mesure ?', 'Data Streams', 'teal'], ['Juste déposer dans S3 ?', 'Firehose', 'green'], ['Rejouer les événements ?', 'Data Streams', 'teal'], ['Charger Redshift ?', 'Firehose : S3 puis COPY', 'gold']] } },
  ] },

  kms: { title: 'KMS : qui tient la clé ?', scenes: [
    { hook: ['SSE-S3 ou SSE-KMS :', 'la vraie question,', 'QUI TIENT LA CLÉ ?'] },
    { tag: 'SSE-KMS', big: 'L’enveloppe', tone: 'teal', sub: 'une clé protège une autre clé', v: { type: 'chain', steps: [['APP', 'PutObject', 'l’objet arrive sous TLS'], ['KMS', 'GenerateDataKey', 'une clé de données, en clair et chiffrée'], ['S3', 'Chiffrement', 'objet chiffré + clé de données chiffrée'], ['CT', 'CloudTrail', 'chaque usage de la clé est tracé']] }, caps: [['ok', 'La clé KMS **ne sort jamais** de KMS.']] },
    { tag: 'Pour lire', big: '2 droits', tone: 'gold', small: 1, v: { type: 'chain', steps: [['S3', 's3:GetObject', 'sur l’objet'], ['KMS', 'kms:Decrypt', 'sur la clé']] }, caps: [['warn', 'Entre comptes : la **politique de clé** doit autoriser l’autre compte.']] },
    { big: 'Comment choisir ?', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Auditer et contrôler la clé ?', 'SSE-KMS, clé du client', 'teal'], ['Chiffrer sans exigence particulière ?', 'SSE-S3', 'green'], ['Trop d’appels à KMS ?', 'S3 Bucket Keys', 'gold'], ['AWS ne doit jamais voir le clair ?', 'chiffrement côté client', 'violet']] } },
  ] },

  sqs: { title: 'SQS : tampon, ordre et doublons', scenes: [
    { hook: ['Tes messages', 'sont traités', 'DEUX FOIS ?'] },
    { tag: 'Le mécanisme', big: 'Visibilité', tone: 'teal', sub: 'un message lu devient invisible… un temps', v: { type: 'chain', steps: [['API', 'Producteur', 'envoie le message'], ['SQS', 'File', 'le garde en attente'], ['WRK', 'Worker', 'le reçoit : message invisible'], ['OK', 'Suppression', 'après traitement réussi']] }, caps: [['warn', 'Délai de visibilité **trop court** : le message réapparaît.']] },
    { tag: 'File FIFO', big: 'ORDONNÉ', tone: 'green', sub: 'un groupe de messages par client', v: { type: 'route', src: 'messages', tiles: 'ABCABCABC', n: 3, rule: 'key', unit: 'GROUPE', key: 'MessageGroupId = client' }, caps: [['ok', 'Ordre garanti **dans chaque groupe**, groupes en parallèle.']] },
    { big: 'Les cas d’examen', tone: 'violet', small: 1, v: { type: 'tree', qs: [['Traitement de 5 minutes ?', 'visibilité > 5 minutes', 'teal'], ['Un message échoue sans fin ?', 'file de lettres mortes', 'red'], ['Lambda rejoue tout le lot ?', 'ReportBatchItemFailures', 'gold'], ['Plusieurs lecteurs du même message ?', 'SNS + une file chacun', 'green']] } },
  ] },
};
