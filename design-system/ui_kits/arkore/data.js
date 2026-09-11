const A = "../../assets/icons/";

window.KIT = {
  catalog: [
    { name: "Simple Queue Service", slug: "aws-sqs", provider: "aws", kind: "queue", icon: A+"components/aws/sqs.svg", tax: "green" },
    { name: "Simple Notification Service", slug: "aws-sns", provider: "aws", kind: "pubsub-topic", icon: A+"components/aws/sns.svg", tax: "green" },
    { name: "Lambda", slug: "aws-lambda", provider: "aws", kind: "worker", icon: A+"components/aws/lambda.svg", tax: "blue" },
    { name: "API Gateway", slug: "aws-api-gateway", provider: "aws", kind: "api-gateway", icon: A+"components/aws/aws-api-gateway.svg", tax: "teal" },
    { name: "CloudFront", slug: "aws-cloudfront", provider: "aws", kind: "cdn", icon: A+"components/aws/cloudfront.svg", tax: "teal" },
    { name: "RDS", slug: "aws-rds", provider: "aws", kind: "sql-database", icon: A+"components/aws/aws-rds.svg", tax: "amber" },
    { name: "DynamoDB", slug: "aws-dynamodb", provider: "aws", kind: "nosql-database", icon: A+"components/aws/dynamodb.svg", tax: "amber" },
    { name: "S3", slug: "aws-s3", provider: "aws", kind: "object-store", icon: A+"components/aws/s3.svg", tax: "amber" },
    { name: "ElastiCache", slug: "aws-elasticache", provider: "aws", kind: "cache", icon: A+"components/aws/aws-elasticache.svg", tax: "rose" },
    { name: "Kinesis", slug: "aws-kinesis", provider: "aws", kind: "stream", icon: A+"components/aws/kinesis.svg", tax: "green" },
    { name: "Cosmos DB", slug: "azure-cosmos-db", provider: "azure", kind: "nosql-database", icon: A+"components/azure/azure-cosmos-db.svg", tax: "amber" },
    { name: "Service Bus", slug: "azure-service-bus", provider: "azure", kind: "queue", icon: A+"components/azure/azure-service-bus.svg", tax: "green" },
    { name: "Event Hubs", slug: "azure-event-hubs", provider: "azure", kind: "stream", icon: A+"components/azure/azure-event-hubs.svg", tax: "green" },
    { name: "Pub/Sub", slug: "google-pubsub", provider: "gcp", kind: "pubsub-topic", icon: A+"components/gcp/google-pubsub.svg", tax: "green" },
    { name: "Spanner", slug: "gcp-spanner", provider: "gcp", kind: "sql-database", icon: A+"components/gcp/spanner.svg", tax: "amber" },
    { name: "Workers", slug: "cloudflare-workers", provider: "cloudflare", kind: "worker", icon: A+"components/cloudflare/cloudflare-workers.svg", tax: "blue" },
    { name: "R2", slug: "cloudflare-r2", provider: "cloudflare", kind: "object-store", icon: A+"components/cloudflare/cloudflare-r2.svg", tax: "amber" },
    { name: "Object Storage", slug: "oci-object-storage", provider: "oci", kind: "object-store", icon: A+"components/oci/oci-object-storage.svg", tax: "amber" },
    { name: "Streaming", slug: "oci-streaming", provider: "oci", kind: "stream", icon: A+"components/oci/oci-streaming.svg", tax: "green" },
    { name: "Kafka", slug: "kafka", kind: "stream", icon: A+"components/default/kafka.svg", iconKind: "kind", tax: "green" },
    { name: "PostgreSQL", slug: "postgres", kind: "sql-database", icon: A+"components/default/postgres.svg", iconKind: "kind", tax: "amber" },
    { name: "Redis", slug: "redis", kind: "cache", icon: A+"components/default/redis.svg", iconKind: "kind", tax: "rose" },
    { name: "Stripe", slug: "stripe", kind: "third-party-api", icon: A+"components/default/stripe.svg", tax: "red" },
    { name: "Slack", slug: "slack", kind: "third-party-api", icon: A+"components/default/slack.svg", tax: "red" },
    { name: "GitHub", slug: "github", kind: "third-party-api", icon: A+"components/default/github.svg", iconKind: "kind", tax: "red" },
    { name: "Cron job", slug: "cron-job", kind: "worker", icon: A+"kinds/worker.svg", iconKind: "kind", tax: "blue" },
  ],

  nodes: [
    { id: "web", label: "web", kind: "client", tax: "rose", icon: A+"kinds/client.svg", iconKind: "kind", x: 40, y: 150 },
    { id: "gateway", label: "gateway", kind: "api-gateway", tax: "teal", icon: A+"components/aws/aws-api-gateway.svg", x: 200, y: 150 },
    { id: "orders", label: "orders", kind: "sqs", tax: "green", icon: A+"components/aws/sqs.svg", x: 360, y: 70, status: "warn", port: true },
    { id: "events", label: "events", kind: "sns", tax: "green", icon: A+"components/aws/sns.svg", x: 360, y: 240, status: "err" },
    { id: "fulfil", label: "fulfil", kind: "worker", tax: "blue", icon: A+"kinds/worker.svg", iconKind: "kind", x: 520, y: 70 },
    { id: "session", label: "session", kind: "redis", tax: "rose", icon: A+"components/default/redis.svg", iconKind: "kind", x: 520, y: 240, status: "err" },
    { id: "ledger", label: "ledger", kind: "rds", tax: "amber", icon: A+"components/aws/aws-rds.svg", x: 680, y: 150 },
  ],

  edges: [
    { x: 152, y: 187, len: 40 },
    { x: 312, y: 175, len: 40, rotate: -24 },
    { x: 312, y: 200, len: 40, rotate: 24 },
    { x: 472, y: 107, len: 40, dashed: false },
    { x: 472, y: 277, len: 40 },
    { x: 632, y: 100, len: 40, rotate: 24, dashed: false },
    { x: 632, y: 270, len: 40, rotate: -24, dashed: false },
  ],

  findings: [
    { severity: "err", message: "Topic 'events' cannot replay messages, but the design requires replay.", rule: "pubsub-replay-required", target: "node events" },
    { severity: "err", message: "Cache 'session' is the primary store for its data but has persistence disabled.", rule: "cache-as-primary-store-without-persistence", target: "node session" },
    { severity: "warn", message: "Cache 'session' has no eviction policy.", rule: "cache-missing-eviction-policy", target: "node session" },
  ],

  designs: [
    { title: "YouTube", description: "Upload, transcode, serve at scale.", author: "arkore", componentCount: 14, clones: 212, thumb: "mark" },
    { title: "Order processing", description: "Checkout to fulfilment with a replayable log.", author: "arkore", componentCount: 9, provider: "aws", clones: 88, thumb: "diagram" },
    { title: "Rate limiter", author: "@mira", componentCount: 3, visibility: "private", thumb: "plate" },
    { title: "Multi-region reads", description: "Spanner primary with regional read replicas.", author: "arkore", componentCount: 11, provider: "gcp", clones: 47, thumb: "diagram" },
    { title: "Stripe webhooks", description: "Idempotent ingest with a dead-letter path.", author: "@dev", componentCount: 6, clones: 31, thumb: "plate" },
    { title: "Edge image pipeline", description: "Transform at the edge, cache in R2.", author: "arkore", componentCount: 7, provider: "cloudflare", clones: 19, thumb: "diagram" },
  ],
};
