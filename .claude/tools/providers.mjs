// provider key -> simple-icons slug (or null => original neutral badge defined below)
export const PROVIDER_SLUG = {
  aws: null, azure: null,                       // Simple Icons no longer carries these marks
  googlecloud: 'googlecloud', cloudflare: 'cloudflare',
  googlebigquery: 'googlebigquery', googlebigtable: 'googlebigtable',
  googlecloudspanner: 'googlecloudspanner', googlecloudstorage: 'googlecloudstorage',
  googledataflow: 'googledataflow', googledataproc: 'googledataproc',
  googlepubsub: 'googlepubsub',
  akamai: 'akamai', adyen: 'adyen', algolia: 'algolia',
  apacheairflow: 'apacheairflow', apachecassandra: 'apachecassandra',
  apacheflink: 'apacheflink', apachehbase: 'apachehbase', apachehive: 'apachehive',
  apachekafka: 'apachekafka', apachepulsar: 'apachepulsar', apachesolr: 'apachesolr',
  apachespark: 'apachespark',
  apple: 'apple', auth0: 'auth0', ceph: 'ceph', clickhouse: 'clickhouse',
  cockroachlabs: 'cockroachlabs', consul: 'consul', couchbase: 'couchbase',
  databricks: 'databricks', datadog: 'datadog', elasticsearch: 'elasticsearch',
  envoyproxy: 'envoyproxy', erlang: 'erlang', etcd: 'etcd', eventstore: 'eventstore',
  fastly: 'fastly', firebase: 'firebase', influxdb: 'influxdb', istio: 'istio',
  jaeger: 'jaeger', keycloak: 'keycloak', kong: 'kong', linkerd: 'linkerd',
  minio: 'minio', mongodb: 'mongodb', mqtt: 'mqtt', mysql: 'mysql',
  natsdotio: 'natsdotio', neo4j: 'neo4j', netflix: 'netflix', newrelic: 'newrelic',
  nginx: 'nginx', nvidia: 'nvidia', okta: 'okta', opensearch: 'opensearch',
  opentelemetry: 'opentelemetry', phoenixframework: 'phoenixframework',
  postgresql: 'postgresql', prometheus: 'prometheus', pusher: 'pusher',
  rabbitmq: 'rabbitmq', redis: 'redis', scylladb: 'scylladb', sentry: 'sentry',
  snowflake: 'snowflake', socketdotio: 'socketdotio', stripe: 'stripe',
  tensorflow: 'tensorflow', temporal: 'temporal', tidb: 'tidb', timescale: 'timescale',
  traefikproxy: 'traefikproxy', vault: 'vault', victoriametrics: 'victoriametrics',
  vitess: 'vitess',
};

// Original, non-brand badge artwork for providers Simple Icons does not carry.
// A neutral cloud glyph; the provider is identified by the badge colour.
const CLOUD = 'M18.6 15.4H7.7a3.3 3.3 0 0 1-.5-6.5 5 5 0 0 1 9.5-1.1 4 4 0 0 1 1.9 7.6z';
export const ORIGINAL_BADGES = {
  aws:   { hex: 'FF9900', title: 'AWS (original neutral mark)',            path: CLOUD },
  azure: { hex: '0078D4', title: 'Microsoft Azure (original neutral mark)', path: CLOUD },
};

// component id -> provider key. Anything absent gets the bare kind glyph.
export const COMPONENT_PROVIDER = {
  // --- AWS ---
  'alb': 'aws', 'aurora': 'aws', 'aws-api-gateway': 'aws',
  'aws-api-gateway-websocket': 'aws', 'aws-app-mesh': 'aws', 'aws-appconfig': 'aws',
  'aws-batch': 'aws', 'aws-cognito': 'aws', 'aws-direct-connect': 'aws',
  'aws-dms': 'aws', 'aws-iam': 'aws', 'aws-ivs': 'aws', 'aws-kms': 'aws',
  'aws-pinpoint': 'aws', 'aws-secrets-manager': 'aws', 'aws-step-functions': 'aws',
  'aws-transit-gateway': 'aws', 'cloudfront': 'aws', 'cloudhsm': 'aws',
  'cloudwatch': 'aws', 'dynamodb': 'aws', 'glue-job': 'aws',
  'glue-schema-registry': 'aws', 'kinesis': 'aws', 'lambda': 'aws', 'neptune': 'aws',
  'nlb': 'aws', 'qldb': 'aws', 'redshift': 'aws', 'route53': 'aws', 'rds-proxy': 'aws', 's3': 'aws',
  'sagemaker-endpoint': 'aws', 'sqs': 'aws', 'sns': 'aws',

  // --- Azure ---
  'azure-ai-search': 'azure', 'azure-api-management': 'azure',
  'azure-app-configuration': 'azure', 'azure-app-service': 'azure',
  'azure-application-gateway': 'azure', 'azure-blob-storage': 'azure',
  'azure-cosmos-db': 'azure', 'azure-data-explorer': 'azure',
  'azure-data-factory': 'azure', 'azure-dns': 'azure',
  'azure-durable-functions': 'azure', 'azure-entra-id': 'azure',
  'azure-event-grid': 'azure', 'azure-event-hubs': 'azure',
  'azure-expressroute': 'azure', 'azure-front-door': 'azure',
  'azure-functions': 'azure', 'azure-key-vault': 'azure',
  'azure-load-balancer': 'azure', 'azure-ml-endpoint': 'azure',
  'azure-monitor': 'azure', 'azure-notification-hubs': 'azure',
  'azure-schema-registry': 'azure', 'azure-service-bus': 'azure',
  'azure-signalr': 'azure', 'azure-sql': 'azure', 'azure-stream-analytics': 'azure',
  'azure-synapse': 'azure', 'azure-virtual-wan': 'azure',

  // --- Google Cloud ---
  'bigquery': 'googlebigquery', 'bigtable': 'googlebigtable',
  'dataproc-job': 'googledataproc', 'gcs': 'googlecloudstorage',
  'google-dataflow': 'googledataflow', 'google-pubsub': 'googlepubsub',
  'spanner': 'googlecloudspanner', 'firestore': 'firebase', 'fcm': 'firebase',
  'google-cloud-cdn': 'googlecloud', 'google-cloud-dns': 'googlecloud',
  'google-cloud-kms': 'googlecloud', 'google-cloud-load-balancing': 'googlecloud',
  'google-cloud-monitoring': 'googlecloud', 'google-cloud-run': 'googlecloud',
  'google-cloud-tasks': 'googlecloud', 'google-identity-platform': 'googlecloud',
  'vertex-ai-endpoint': 'googlecloud', 'apigee': 'googlecloud',

  // --- Cloudflare ---
  'cloudflare-cdn': 'cloudflare', 'cloudflare-dns': 'cloudflare',
  'cloudflare-rate-limiting': 'cloudflare',

  // --- other branded products ---
  'adyen': 'adyen', 'airflow-dag': 'apacheairflow', 'akamai': 'akamai',
  'algolia': 'algolia', 'apns': 'apple', 'auth0': 'auth0',
  'cassandra': 'apachecassandra', 'ceph-rgw': 'ceph', 'clickhouse': 'clickhouse',
  'cockroachdb': 'cockroachlabs', 'confluent-schema-registry': 'apachekafka',
  'conductor': 'netflix', 'consul': 'consul', 'consul-connect': 'consul',
  'couchbase': 'couchbase', 'databricks-sql': 'databricks', 'datadog': 'datadog',
  'elasticsearch': 'elasticsearch', 'envoy': 'envoyproxy',
  'envoy-gateway': 'envoyproxy', 'envoy-ratelimit': 'envoyproxy',
  'envoy-sidecar': 'envoyproxy', 'erlang-node': 'erlang', 'etcd': 'etcd',
  'eureka': 'netflix', 'evcache': 'netflix', 'eventstoredb': 'eventstore',
  'fastly': 'fastly', 'flink': 'apacheflink', 'hashicorp-vault': 'vault',
  'hbase': 'apachehbase', 'hive': 'apachehive', 'influxdb': 'influxdb',
  'istio': 'istio', 'jaeger': 'jaeger', 'kafka': 'apachekafka',
  'kafka-streams': 'apachekafka', 'keycloak': 'keycloak', 'kong': 'kong',
  'linkerd': 'linkerd', 'minio': 'minio', 'mongodb': 'mongodb',
  'mongos': 'mongodb', 'mqtt-broker': 'mqtt', 'mysql': 'mysql',
  'nats-jetstream': 'natsdotio', 'neo4j': 'neo4j', 'new-relic': 'newrelic',
  'nginx': 'nginx', 'nginx-limit-req': 'nginx', 'okta': 'okta',
  'opensearch': 'opensearch', 'opentelemetry-collector': 'opentelemetry',
  'phoenix-channels': 'phoenixframework',
  'postgres': 'postgresql', 'prometheus': 'prometheus',
  'prometheus-tsdb': 'prometheus', 'pulsar': 'apachepulsar', 'pusher': 'pusher',
  'rabbitmq': 'rabbitmq', 'redis': 'redis', 'redis-pubsub': 'redis',
  'redis-queue': 'redis', 'redis-rate-limiter': 'redis', 'scylladb': 'scylladb',
  'sentry': 'sentry', 'snowflake': 'snowflake', 'socket-io-server': 'socketdotio',
  'solr': 'apachesolr', 'spark-job': 'apachespark',
  'spark-streaming': 'apachespark', 'stripe': 'stripe', 'temporal': 'temporal',
  'tensorflow-serving': 'tensorflow', 'tidb': 'tidb', 'timescaledb': 'timescale',
  'traefik': 'traefikproxy', 'triton': 'nvidia',
  'victoriametrics': 'victoriametrics', 'vitess': 'vitess', 'zuul': 'netflix',
};
