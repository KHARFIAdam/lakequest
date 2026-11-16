/* LakeQuest — structure de l'examen DEA-C01 (guide officiel, version 1.1) et liste des missions.
   Pour ajouter une mission : une entrée dans LQ.topics, puis des questions portant le même `t`. */
window.LQ = window.LQ || {};

/* Les 4 domaines et leur poids dans le score. `n` = nombre de questions dans un examen de 65. */
LQ.domains = [
  { id: 1, name: 'Ingestion et transformation', en: 'Data Ingestion and Transformation', w: 34 },
  { id: 2, name: 'Gestion des stockages', en: 'Data Store Management', w: 26 },
  { id: 3, name: 'Opérations et support', en: 'Data Operations and Support', w: 22 },
  { id: 4, name: 'Sécurité et gouvernance', en: 'Data Security and Governance', w: 18 },
];

/* Les 17 tâches du guide : chaque question est rattachée à l'une d'elles par son champ `ts`. */
LQ.tasks = {
  '1.1': 'Perform data ingestion',
  '1.2': 'Transform and process data',
  '1.3': 'Orchestrate data pipelines',
  '1.4': 'Apply programming concepts',
  '2.1': 'Choose a data store',
  '2.2': 'Understand data cataloging systems',
  '2.3': 'Manage the lifecycle of data',
  '2.4': 'Design data models and schema evolution',
  '3.1': 'Automate data processing by using AWS services',
  '3.2': 'Analyze data by using AWS services',
  '3.3': 'Maintain and monitor data pipelines',
  '3.4': 'Ensure data quality',
  '4.1': 'Apply authentication mechanisms',
  '4.2': 'Apply authorization mechanisms',
  '4.3': 'Ensure data encryption and masking',
  '4.4': 'Prepare logs for audit',
  '4.5': 'Understand data privacy and governance',
};

/* Les missions, dans l'ordre d'affichage. `flows` et `cards` pointent vers les flux animés et les fiches à réviser avant de jouer. */
LQ.topics = [
  { id: 'kds', d: 1, name: 'Kinesis Data Streams', blurb: 'Shards, clé de partition, consommateurs et relecture.', flows: ['kds-partition'], cards: ['kinesis-data-streams', 'lambda'] },
  { id: 'firehose', d: 1, name: 'Firehose, MSK et Flink', blurb: 'Livraison sans code, Kafka managé, fenêtres en temps réel.', flows: ['firehose-parquet'], cards: ['firehose', 'msk', 'managed-flink'] },
  { id: 'ingest', d: 1, name: 'Ingestion par lots et migration', blurb: 'DMS, DataSync, Transfer Family, Snowball, AppFlow.', flows: ['dms-cdc'], cards: ['dms', 'datasync', 'transfer-family', 'snow', 'appflow'] },
  { id: 'glue', d: 1, name: 'AWS Glue ETL', blurb: 'Jobs Spark, bookmarks, DynamicFrames, maîtrise des coûts.', flows: ['glue-bookmarks'], cards: ['glue'] },
  { id: 'emr', d: 1, name: 'EMR et Spark', blurb: 'Clusters, instances Spot, EMR Serverless, performances Spark.', flows: [], cards: ['emr', 'file-formats'] },
  { id: 'compute', d: 1, name: 'Lambda et conteneurs', blurb: 'Concurrence, limites, ECS, Fargate, AWS Batch.', flows: ['sqs-lambda-dlq'], cards: ['lambda', 'ecs-eks', 'batch'] },
  { id: 'orchestration', d: 1, name: 'Orchestration', blurb: 'Step Functions, MWAA, EventBridge, workflows Glue.', flows: ['event-pipeline'], cards: ['step-functions', 'mwaa', 'eventbridge', 'sns', 'sqs'] },
  { id: 'dev', d: 1, name: 'Concepts de programmation', blurb: 'SQL, infrastructure as code, CI/CD, SAM, LLM dans les pipelines.', flows: [], cards: ['cloudformation-cdk', 'cicd', 'bedrock'] },

  { id: 's3', d: 2, name: 'Amazon S3', blurb: 'Classes de stockage, cycle de vie, versioning, résilience.', flows: ['s3-lifecycle'], cards: ['s3', 'backup'] },
  { id: 'redshift', d: 2, name: 'Amazon Redshift', blurb: 'COPY, clés de distribution et de tri, Spectrum, vues matérialisées.', flows: ['redshift-copy'], cards: ['redshift'] },
  { id: 'dynamodb', d: 2, name: 'Amazon DynamoDB', blurb: 'Clés, index, modes de capacité, Streams, TTL.', flows: ['dynamodb-design'], cards: ['dynamodb'] },
  { id: 'databases', d: 2, name: 'Bases spécialisées et vecteurs', blurb: 'Aurora, Neptune, DocumentDB, MemoryDB, index vectoriels.', flows: [], cards: ['rds-aurora', 'neptune', 'documentdb', 'keyspaces', 'memorydb', 'vector-index'] },
  { id: 'catalog', d: 2, name: 'Catalogues de données', blurb: 'Glue Data Catalog, crawlers, partitions, catalogue métier.', flows: [], cards: ['glue-catalog', 'sagemaker-catalog'] },
  { id: 'modeling', d: 2, name: 'Modélisation et formats', blurb: 'Parquet, Avro, Iceberg, schéma en étoile, compression.', flows: ['iceberg-snapshots'], cards: ['iceberg', 'file-formats', 'data-modeling', 'partitioning', 's3-tables'] },

  { id: 'athena', d: 3, name: 'Athena et SQL', blurb: 'Coût au volume scanné, workgroups, requêtes fédérées, fonctions de fenêtre.', flows: ['athena-pruning'], cards: ['athena'] },
  { id: 'automation', d: 3, name: 'Automatisation', blurb: 'SDK, API de données, événements, DataBrew, MWAA au quotidien.', flows: [], cards: ['eventbridge', 'api-gateway', 'glue-databrew', 'mwaa'] },
  { id: 'monitoring', d: 3, name: 'Supervision et dépannage', blurb: 'CloudWatch, journaux, alarmes, diagnostic Glue et EMR.', flows: ['cloudwatch-alarm'], cards: ['cloudwatch', 'cloudtrail'] },
  { id: 'quality', d: 3, name: 'Qualité des données', blurb: 'Règles Glue Data Quality, DataBrew, échantillonnage, données déséquilibrées.', flows: [], cards: ['glue-data-quality', 'glue-databrew'] },
  { id: 'viz', d: 3, name: 'Analyse et visualisation', blurb: 'QuickSight, OpenSearch, notebooks, serverless ou provisionné.', flows: [], cards: ['quicksight', 'opensearch', 'sagemaker'] },

  { id: 'authn', d: 4, name: 'Authentification et accès réseau', blurb: 'Rôles IAM, Secrets Manager, security groups, endpoints VPC.', flows: ['cross-account'], cards: ['iam', 'secrets-manager', 'vpc-endpoints'] },
  { id: 'authz', d: 4, name: 'Autorisations', blurb: 'Moindre privilège, Lake Formation, droits Redshift, RBAC et ABAC.', flows: ['lake-formation'], cards: ['lake-formation', 'iam'] },
  { id: 'encryption', d: 4, name: 'Chiffrement et masquage', blurb: 'KMS, chiffrement entre comptes, TLS, anonymisation.', flows: ['kms-envelope'], cards: ['kms', 's3'] },
  { id: 'audit', d: 4, name: 'Audit et gouvernance', blurb: 'CloudTrail, Config, Macie, souveraineté, partage de données.', flows: [], cards: ['cloudtrail', 'config', 'macie', 'organizations-scp', 'data-mesh', 'sagemaker-catalog'] },
];
