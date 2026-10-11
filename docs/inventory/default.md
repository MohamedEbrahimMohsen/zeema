# Default inventory

Provider `default` covers everything that is not one of the five cloud providers: open-source
products, self-hosted software, and vendor SaaS. Sources are the CNCF landscape and project
list (<https://www.cncf.io/projects/>), the DB-Engines ranking (<https://db-engines.com/en/ranking>)
and each product's official documentation site.

Ids are the plain product name in kebab-case (`kafka`, `postgres`, `stripe`) â€” no provider
prefix. Existing ids in `components/default/` are kept verbatim.

Status: `done` = component exists in `components/default/`. `todo` = to be written.
`skip: <reason>` = not a placeable node (library or framework), abandoned, or already
covered by a cloud provider folder.

---

## Messaging A â€” queues and brokers

| resource | id | kind | status | source |
|---|---|---|---|---|
| RabbitMQ | rabbitmq | queue | done | https://www.rabbitmq.com/docs |
| Apache ActiveMQ Artemis | activemq | queue | done | https://activemq.apache.org/components/artemis/documentation/ |
| Redis list queue | redis-queue | queue | done | https://redis.io/docs/latest/develop/data-types/lists/ |
| Gearman | gearman | queue | done | https://gearman.org/documentation/ |
| Apache RocketMQ | rocketmq | stream | done | https://rocketmq.apache.org/docs/introduction/03limits |
| Apache Qpid Broker-J | qpid | queue | done | https://qpid.apache.org/releases/qpid-broker-j-9.2.1/book/Java-Broker-Concepts-Queues.html |
| IBM MQ | ibm-mq | queue | done | https://www.ibm.com/docs/en/ibm-mq/9.4.0?topic=ibm-mq-technical-overview |
| NSQ | nsq | queue | done | https://nsq.io/components/nsqd.html |
| Solace PubSub+ Event Broker | solace | queue | done | https://docs.solace.com/Basics/Direct-Messages.htm |
| TIBCO Enterprise Message Service | tibco-ems | queue | done | https://docs.tibco.com/pub/ems/8.6.0/doc/html/GUID-FD538023-D7B6-464B-9AAD-F3E603AC34EE.html |
| Apache Kafka Connect | kafka-connect | change-data-capture | done | https://docs.confluent.io/platform/current/connect/references/allconfigs.html |
| Apache ActiveMQ Classic | â€” | â€” | skip: predecessor of Artemis, same broker family, covered by activemq | https://activemq.apache.org/components/classic/ |
| Beanstalkd | â€” | â€” | skip: no release since 1.13 (November 2022), effectively unmaintained | https://beanstalkd.github.io/ |
| ZeroMQ | â€” | â€” | skip: in-process messaging library, no broker to place | https://zeromq.org/get-started/ |
| Celery | â€” | â€” | skip: Python task library, the placed node is its Redis or RabbitMQ broker | https://docs.celeryq.dev/ |
| Sidekiq | â€” | â€” | skip: Ruby job library backed by Redis, not a deployable broker | https://github.com/sidekiq/sidekiq/wiki |
| Memphis.dev | â€” | â€” | skip: project discontinued in 2024 | https://github.com/superstreamlabs/memphis |
| Amazon SQS / Google Pub/Sub / Azure Service Bus | â€” | â€” | skip: covered by the aws, gcp and azure provider folders | https://aws.amazon.com/sqs/ |

## Messaging B â€” streams, pub/sub and schema registries

| resource | id | kind | status | source |
|---|---|---|---|---|
| Apache Kafka | kafka | stream | done | https://kafka.apache.org/documentation/ |
| Apache Pulsar | pulsar | stream | done | https://pulsar.apache.org/docs/ |
| Redpanda | redpanda | stream | done | https://docs.redpanda.com/ |
| NATS JetStream | nats-jetstream | stream | done | https://docs.nats.io/nats-concepts/jetstream |
| Redis Pub/Sub | redis-pubsub | pubsub-topic | done | https://redis.io/docs/latest/develop/interact/pubsub/ |
| Confluent Platform / Confluent Cloud | confluent-cloud | stream | done | https://docs.confluent.io/cloud/current/client-apps/topics/manage.html |
| WarpStream | warpstream | stream | done | https://docs.warpstream.com/warpstream/overview/architecture |
| AutoMQ | automq | stream | done | https://docs.automq.com/automq/what-is-automq/overview |
| Confluent Schema Registry | confluent-schema-registry | schema-registry | done | https://docs.confluent.io/platform/current/schema-registry/index.html |
| Apicurio Registry | apicurio | schema-registry | done | https://www.apicur.io/registry/docs/ |
| Karapace | karapace | schema-registry | done | https://github.com/Aiven-Open/karapace |
| CloudEvents | â€” | â€” | skip: event envelope specification, not a deployable node | https://cloudevents.io/ |
| Strimzi | â€” | â€” | skip: Kubernetes operator that deploys Kafka; the drawn node is kafka | https://strimzi.io/documentation/ |
| NATS Core | â€” | â€” | skip: same broker as nats-jetstream without persistence | https://docs.nats.io/ |
| Kafka MirrorMaker 2 | â€” | â€” | skip: replication feature of Kafka Connect | https://kafka.apache.org/documentation/#georeplication |

## Databases A â€” relational engines

| resource | id | kind | status | source |
|---|---|---|---|---|
| PostgreSQL | postgres | sql-database | done | https://www.postgresql.org/docs/current/ |
| MySQL | mysql | sql-database | done | https://dev.mysql.com/doc/refman/8.4/en/ |
| MariaDB Server | mariadb | sql-database | done | https://mariadb.com/docs/server/ha-and-performance/standard-replication/replication-overview |
| SQLite | sqlite | sql-database | done | https://sqlite.org/pragma.html |
| Microsoft SQL Server | sql-server | sql-database | done | https://learn.microsoft.com/en-us/sql/sql-server/ |
| Oracle Database | oracle-db | sql-database | done | https://docs.oracle.com/en/database/oracle/oracle-database/ |
| IBM Db2 | db2 | sql-database | done | https://www.ibm.com/docs/en/db2/11.5.x?topic=dcp-hadr-syncmode-hadr-synchronization-mode-log-writes-in-peer-state |
| IBM Informix | informix | sql-database | done | https://www.ibm.com/docs/en/informix-servers/14.10.0?topic=servers-asynchronous-mode-hdr-replication |
| Firebird | firebird | sql-database | done | https://www.firebirdsql.org/file/documentation/release_notes/html/en/5_0/rlsnotes50.html |
| SAP HANA | sap-hana | sql-database | done | https://help.sap.com/docs/SAP_HANA_PLATFORM/6b94445c94ae495c83a19646e7c3fd56/bd6e6be8bb5710149e34e14608e07b76.html |
| SAP ASE (Sybase) | sap-ase | sql-database | done | https://help.sap.com/docs/SAP_ASE/86fcdd45cd3142af9f1b6dd75017260f/a8f5175bbc2b1014b5c7a94582fbf553.html |
| PostGIS | postgis | sql-database | done | https://postgis.net/documentation/getting_started/ |
| SingleStore | singlestore | sql-database | done | https://docs.singlestore.com/db/v9.1/user-and-cluster-administration/high-availability-and-disaster-recovery/replication-and-durability-concepts/replication/ |
| OceanBase | oceanbase | sql-database | done | https://en.oceanbase.com/docs/common-oceanbase-database-10000000001031451 |
| H2 / Apache Derby | â€” | â€” | skip: embedded Java databases, linked into the application process | https://h2database.com/html/main.html |
| Percona Server | â€” | â€” | skip: MySQL distribution, same engine as mysql | https://docs.percona.com/percona-server/ |
| Amazon Aurora / Google AlloyDB / Azure SQL | â€” | â€” | skip: covered by the aws, gcp and azure provider folders | https://aws.amazon.com/rds/aurora/ |

## Databases B â€” distributed SQL and managed Postgres/MySQL

| resource | id | kind | status | source |
|---|---|---|---|---|
| CockroachDB | cockroachdb | sql-database | done | https://www.cockroachlabs.com/docs/stable/ |
| YugabyteDB | yugabytedb | sql-database | done | https://docs.yugabyte.com/stable/architecture/docdb-replication/replication/ |
| TiDB | tidb | sql-database | done | https://docs.pingcap.com/tidb/stable/ |
| TiKV | tikv | nosql-database | done | https://tikv.org/docs/latest/reference/architecture/overview/ |
| Citus | citus | sql-database | done | https://docs.citusdata.com/en/stable/develop/api_guc.html |
| YDB | ydb | nosql-database | done | https://ydb.tech/docs/en/concepts/glossary |
| Neon | neon | sql-database | done | https://neon.com/docs/introduction/point-in-time-restore |
| PlanetScale | planetscale | sql-database | done | https://planetscale.com/docs/vitess/sharding |
| Supabase | supabase | sql-database | done | https://supabase.com/docs/guides/platform/backups |
| CockroachDB Cloud | cockroachdb-cloud | sql-database | done | https://www.cockroachlabs.com/docs/cockroachcloud/managed-backups |
| Turso (libSQL) | turso | sql-database | done | https://docs.turso.tech/features/embedded-replicas/introduction |
| Xata | xata | sql-database | done | https://xata.io/docs |
| Supabase Auth / Storage | â€” | â€” | skip: features of the Supabase platform, covered by supabase | https://supabase.com/docs/guides/auth |

## Databases C â€” NoSQL, document and wide-column

| resource | id | kind | status | source |
|---|---|---|---|---|
| MongoDB | mongodb | nosql-database | done | https://www.mongodb.com/docs/manual/ |
| MongoDB Atlas | mongodb-atlas | nosql-database | done | https://www.mongodb.com/docs/atlas/reference/faq/security/ |
| Apache Cassandra | cassandra | nosql-database | done | https://cassandra.apache.org/doc/stable/ |
| ScyllaDB | scylladb | nosql-database | done | https://docs.scylladb.com/ |
| Couchbase Server | couchbase | nosql-database | done | https://docs.couchbase.com/ |
| Apache CouchDB | couchdb | nosql-database | done | https://docs.couchdb.org/en/stable/cluster/theory.html |
| Riak KV | riak | nosql-database | done | https://www.riak.info/ |
| Apache HBase | hbase | nosql-database | done | https://hbase.apache.org/book.html |
| Apache Accumulo | accumulo | nosql-database | done | https://accumulo.apache.org/docs/2.x/getting-started/design |
| Aerospike Database | aerospike | nosql-database | done | https://aerospike.com/docs/server/architecture/data-distribution |
| FoundationDB | foundationdb | nosql-database | done | https://apple.github.io/foundationdb/configuration.html |
| RethinkDB | rethinkdb | nosql-database | done | https://rethinkdb.com/docs/architecture/ |
| RavenDB | ravendb | nosql-database | done | https://docs.ravendb.net/server/clustering/replication/replication-conflicts/ |
| MarkLogic Server | marklogic | nosql-database | done | https://docs.progress.com/bundle/marklogic-server-understand-concepts-12/page/topics/overview.html |
| OrientDB | orientdb | nosql-database | done | https://orientdb.dev/docs/3.2.x/distributed/Distributed-Configuration.html |
| LevelDB / RocksDB | â€” | â€” | skip: embedded storage engines linked into other databases | https://rocksdb.org/docs/getting-started.html |
| Berkeley DB | â€” | â€” | skip: embedded key-value library | https://docs.oracle.com/cd/E17076_05/html/index.html |
| DynamoDB / Firestore / Cosmos DB | â€” | â€” | skip: covered by the aws, gcp and azure provider folders | https://aws.amazon.com/dynamodb/ |

## Databases D â€” key-value stores and caches

| resource | id | kind | status | source |
|---|---|---|---|---|
| Redis | redis | cache | done | https://redis.io/docs/latest/ |
| Valkey | valkey | cache | done | https://valkey.io/topics/ |
| KeyDB | keydb | cache | done | https://github.com/Snapchat/KeyDB |
| Dragonfly | dragonfly | cache | done | https://www.dragonflydb.io/docs |
| Memcached | memcached | cache | done | https://docs.memcached.org/ |
| Hazelcast Platform | hazelcast | cache | done | https://docs.hazelcast.com/ |
| Apache Ignite | ignite | cache | done | https://ignite.apache.org/docs/latest/persistence/native-persistence |
| Infinispan | infinispan | cache | done | https://infinispan.org/docs/stable/titles/configuring/configuring.html |
| Microsoft Garnet | garnet | cache | done | https://microsoft.github.io/garnet/docs/getting-started/configuration |
| Netflix EVCache | evcache | cache | done | https://github.com/Netflix/EVCache/wiki |
| Redis Cloud | redis-cloud | cache | done | https://redis.io/docs/latest/operate/rc/databases/create-database/create-essentials-database/ |
| Upstash Redis | upstash | cache | done | https://upstash.com/docs/redis/features/eviction |
| Varnish Cache | varnish | cache | done | https://www.varnish.org/docs/users-guide/storage-backends.html |
| Squid | squid | cache | done | https://www.squid-cache.org/Doc/config/cache_dir/ |
| Apache Traffic Server | trafficserver | cdn | done | https://docs.trafficserver.apache.org/en/latest/admin-guide/storage/index.en.html |
| Groupcache / Caffeine / Ehcache | â€” | â€” | skip: in-process cache libraries, part of the app-server node | https://github.com/golang/groupcache |

## Databases E â€” time series and metrics stores

| resource | id | kind | status | source |
|---|---|---|---|---|
| InfluxDB | influxdb | timeseries-database | done | https://docs.influxdata.com/influxdb3/ |
| TimescaleDB | timescaledb | timeseries-database | done | https://docs.tigerdata.com/ |
| Prometheus TSDB | prometheus-tsdb | timeseries-database | done | https://prometheus.io/docs/prometheus/latest/storage/ |
| VictoriaMetrics | victoriametrics | timeseries-database | done | https://docs.victoriametrics.com/ |
| M3DB | m3db | timeseries-database | done | https://m3db.io/docs/ |
| Thanos | thanos | timeseries-database | done | https://thanos.io/tip/components/compact.md/ |
| Cortex | cortex | timeseries-database | done | https://cortexmetrics.io/docs/blocks-storage/ |
| Grafana Mimir | mimir | timeseries-database | done | https://grafana.com/docs/mimir/latest/references/architecture/components/compactor/ |
| QuestDB | questdb | timeseries-database | done | https://questdb.com/docs/concepts/ttl/ |
| TDengine | tdengine | timeseries-database | done | https://docs.tdengine.com/tdengine-reference/sql-manual/manage-databases/ |
| Apache IoTDB | iotdb | timeseries-database | done | https://iotdb.apache.org/UserGuide/latest/Reference/Common-Config-Manual.html |
| Graphite | graphite | timeseries-database | done | https://graphite.readthedocs.io/en/latest/config-carbon.html |
| OpenTSDB | â€” | â€” | skip: last release 2.4.1 (2021), unmaintained | http://opentsdb.net/docs/build/html/ |

## Databases F â€” graph stores

| resource | id | kind | status | source |
|---|---|---|---|---|
| Neo4j | neo4j | graph-database | done | https://neo4j.com/docs/ |
| JanusGraph | janusgraph | graph-database | done | https://docs.janusgraph.org/ |
| Meta TAO | tao | graph-database | done | https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/ |
| Dgraph | dgraph | graph-database | done | https://docs.dgraph.io/cli/zero/ |
| ArangoDB | arangodb | graph-database | done | https://docs.arango.ai/arangodb/stable/concepts/data-structure/collections/ |
| TigerGraph | tigergraph | graph-database | done | https://www.tigergraph.com/docs/tigergraph-server/current/cluster-and-ha-management/ha-cluster |
| Memgraph | memgraph | graph-database | done | https://memgraph.com/docs/fundamentals/storage-memory-usage |
| NebulaGraph | nebulagraph | graph-database | done | https://docs.nebula-graph.io/master/3.ngql-guide/9.space-statements/1.create-space/ |
| Stardog | stardog | graph-database | done | https://docs.stardog.com/operating-stardog/database-administration/managing-databases |
| OpenLink Virtuoso | virtuoso | graph-database | done | https://docs.openlinksw.com/virtuoso/clusterstcnf/ |
| Apache Jena Fuseki | fuseki | graph-database | done | https://jena.apache.org/documentation/fuseki2/fuseki-configuration.html |
| Apache TinkerPop | â€” | â€” | skip: graph traversal framework, not a store | https://tinkerpop.apache.org/docs/current/reference/ |
| Blazegraph | â€” | â€” | skip: last release 2.1.5 (2019), unmaintained | https://blazegraph.com/ |
| Amazon Neptune | â€” | â€” | skip: covered by the aws provider folder | https://aws.amazon.com/neptune/ |

## Search engines

| resource | id | kind | status | source |
|---|---|---|---|---|
| Elasticsearch | elasticsearch | search-index | done | https://www.elastic.co/docs/ |
| OpenSearch | opensearch | search-index | done | https://docs.opensearch.org/ |
| Apache Solr | solr | search-index | done | https://solr.apache.org/guide/ |
| Typesense | typesense | search-index | done | https://typesense.org/docs/ |
| Algolia | algolia | search-index | done | https://www.algolia.com/doc/ |
| Meilisearch | meilisearch | search-index | done | https://www.meilisearch.com/docs/learn/async/asynchronous_operations |
| Vespa | vespa | search-index | done | https://docs.vespa.ai/en/reference/services-content.html |
| Quickwit | quickwit | search-index | done | https://quickwit.io/docs/configuration/index-config |
| Manticore Search | manticore | search-index | done | https://manual.manticoresearch.com/Creating_a_table/Local_tables |
| Sonic | sonic | search-index | done | https://github.com/valeriansaliou/sonic |
| Elastic Cloud | elastic-cloud | search-index | done | https://www.elastic.co/docs/deploy-manage/deploy/elastic-cloud |
| Geo cell index | geo-cell-index | search-index | done | https://s2geometry.io/ |
| Trie index | trie-index | search-index | done | https://en.wikipedia.org/wiki/Trie |
| Apache Lucene / Bleve / Tantivy | â€” | â€” | skip: search libraries embedded in the engines above | https://lucene.apache.org/core/documentation.html |
| ZincSearch | â€” | â€” | skip: superseded by OpenObserve by the same authors | https://zincsearch-docs.zinc.dev/ |

## Vector databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Pinecone | pinecone | vector-database | done | https://docs.pinecone.io/guides/index-data/indexing-overview |
| Milvus | milvus | vector-database | done | https://milvus.io/api-reference/pymilvus/v2.5.x/MilvusClient/Collections/create_collection.md |
| Zilliz Cloud | zilliz-cloud | vector-database | done | https://docs.zilliz.com/docs/select-zilliz-cloud-service-plans |
| Weaviate | weaviate | vector-database | done | https://docs.weaviate.io/weaviate/config-refs/indexing/vector-index |
| Qdrant | qdrant | vector-database | done | https://qdrant.tech/documentation/concepts/indexing/ |
| Chroma | chroma | vector-database | done | https://docs.trychroma.com/docs/collections/configure |
| pgvector | pgvector | vector-database | done | https://github.com/pgvector/pgvector |
| LanceDB | lancedb | vector-database | done | https://docs.lancedb.com/indexing/vector-index |
| Vald | vald | vector-database | done | https://vald.vdaas.org/docs/overview/about-vald/ |
| Marqo | marqo | vector-database | done | https://docs.marqo.ai/latest/reference/api/indexes/create-structured-index/ |
| turbopuffer | turbopuffer | vector-database | done | https://turbopuffer.com/docs/schema |
| Faiss / hnswlib / Annoy | â€” | â€” | skip: ANN index libraries linked into an application | https://faiss.ai/ |
| pgvectorscale | pgvectorscale | vector-database | done | https://github.com/timescale/pgvectorscale |
| Deep Lake | deeplake | vector-database | done | https://docs.activeloop.ai/ |
| Vespa Cloud | vespa-cloud | vector-database | done | https://docs.vespa.ai/en/cloud/getting-started.html |
| MyScale | myscale | vector-database | skip: retired May 2025, MyScale ceased all services and clusters on 28 May 2025 | https://x.com/MyScaleDB/status/1917163010311037327 |
| Epsilla | epsilla | vector-database | done | https://github.com/epsilla-cloud/vectordb |
| KDB.AI Server | kdb-ai | vector-database | done | https://code.kx.com/kdbai/latest/gettingStarted/kdb-ai-server-setup.html |
| USearch | — | — | skip: ANN index library linked into an application | https://github.com/unum-cloud/usearch |

## Analytics warehouses and query engines

| resource | id | kind | status | source |
|---|---|---|---|---|
| Snowflake | snowflake | data-warehouse | done | https://docs.snowflake.com/ |
| ClickHouse | clickhouse | data-warehouse | done | https://clickhouse.com/docs |
| Apache Druid | druid | data-warehouse | done | https://druid.apache.org/docs/latest/design/ |
| Apache Pinot | pinot | data-warehouse | done | https://docs.pinot.apache.org/ |
| Apache Hive | hive | data-warehouse | done | https://hive.apache.org/docs/ |
| Databricks SQL | databricks-sql | data-warehouse | done | https://docs.databricks.com/aws/en/sql/ |
| Trino | trino | data-warehouse | done | https://trino.io/docs/current/overview.html |
| Presto | presto | data-warehouse | done | https://github.com/prestodb/presto |
| StarRocks | starrocks | data-warehouse | done | https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_TABLE/ |
| Apache Doris | doris | data-warehouse | done | https://doris.apache.org/docs/3.x/table-design/data-model/overview/ |
| Apache Impala | impala | data-warehouse | done | https://impala.apache.org/docs/build/html/topics/impala_kudu.html |
| Apache Kylin | kylin | data-warehouse | done | https://kylin.apache.org/docs/overview/ |
| Apache Drill | drill | data-warehouse | done | https://drill.apache.org/docs/architecture-introduction/ |
| DuckDB | duckdb | data-warehouse | done | https://duckdb.org/docs/current/connect/overview.html |
| MotherDuck | motherduck | data-warehouse | done | https://motherduck.com/docs/getting-started/ |
| Dremio | dremio | data-warehouse | done | https://docs.dremio.com/current/reference/sql/commands/apache-iceberg-tables/ |
| Firebolt | firebolt | data-warehouse | done | https://docs.firebolt.io/overview/ |
| Greenplum | greenplum | data-warehouse | done | https://techdocs.broadcom.com/us/en/vmware-tanzu/data-solutions/tanzu-greenplum/7/greenplum-database/admin_guide-ddl-ddl-storage.html |
| Teradata Vantage | teradata | data-warehouse | done | https://docs.teradata.com/r/Enterprise_IntelliFlex_VMware/Database-Design/Primary-Index-Primary-AMP-Index-and-NoPI-Objects/Column-Partitioning |
| Vertica | vertica | data-warehouse | done | https://docs.vertica.com/latest/en/architecture/ |
| Exasol | exasol | data-warehouse | done | https://docs.exasol.com/administration/on-premise/architecture/exasol_redundancy.htm |
| Apache Iceberg / Delta Lake / Hudi | â€” | â€” | skip: open table formats stored in an object store, not nodes | https://iceberg.apache.org/docs/latest/ |
| BigQuery / Redshift / Synapse | â€” | â€” | skip: covered by the gcp, aws and azure provider folders | https://cloud.google.com/bigquery/docs |

## Data movement â€” CDC and ingestion

| resource | id | kind | status | source |
|---|---|---|---|---|
| Debezium | debezium | change-data-capture | done | https://debezium.io/documentation/ |
| Maxwell's Daemon | maxwell | change-data-capture | done | https://maxwells-daemon.io/ |
| Brooklin | brooklin | change-data-capture | done | https://github.com/linkedin/brooklin/wiki |
| Alibaba Canal | canal | change-data-capture | done | https://github.com/alibaba/canal/wiki |
| Estuary Flow | estuary | change-data-capture | done | https://docs.estuary.dev/concepts/ |
| Striim | striim | change-data-capture | done | https://www.striim.com/docs/en/recovering-applications.html |
| Airbyte | airbyte | worker | done | https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-schedules |
| Fivetran | fivetran | worker | done | https://fivetran.com/docs/getting-started/syncoverview |
| Meltano | meltano | worker | done | https://docs.meltano.com/guide/integration/ |
| Apache NiFi | nifi | stream-processor | done | https://nifi.apache.org/nifi-docs/overview.html |
| Logstash | logstash | stream-processor | done | https://www.elastic.co/docs/reference/logstash/logstash-settings-file |
| Fluentd | fluentd | monitoring | done | https://docs.fluentd.org/configuration/buffer-section |
| Fluent Bit | fluent-bit | monitoring | done | https://docs.fluentbit.io/manual/about/what-is-fluent-bit.md |
| Vector (Datadog) | vector | monitoring | done | https://vector.dev/docs/architecture/buffering-model/ |
| dbt | â€” | â€” | skip: SQL transformation tool that runs inside the warehouse | https://docs.getdbt.com/ |
| AWS Glue / Azure Data Factory | â€” | â€” | skip: covered by the aws and azure provider folders | https://docs.aws.amazon.com/glue/ |

## Stream processing

| resource | id | kind | status | source |
|---|---|---|---|---|
| Apache Flink | flink | stream-processor | done | https://nightlies.apache.org/flink/flink-docs-stable/ |
| Spark Structured Streaming | spark-streaming | stream-processor | done | https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html |
| Kafka Streams | kafka-streams | stream-processor | done | https://kafka.apache.org/documentation/streams/ |
| Apache Samza | samza | stream-processor | done | https://samza.apache.org/learn/documentation/latest/ |
| ksqlDB | ksqldb | stream-processor | done | https://docs.confluent.io/platform/current/ksqldb/reference/server-configuration.html |
| Apache Beam | beam | stream-processor | done | https://beam.apache.org/documentation/basics/ |
| Apache Storm | storm | stream-processor | done | https://storm.apache.org/releases/current/Guaranteeing-message-processing.html |
| Bytewax | bytewax | stream-processor | done | https://docs.bytewax.io/latest/guide/concepts/recovery.html |
| RisingWave | risingwave | stream-processor | done | https://docs.risingwave.com/reference/data-persistence |
| Materialize | materialize | stream-processor | done | https://materialize.com/docs/get-started/isolation-level/ |
| Arroyo | arroyo | stream-processor | done | https://doc.arroyo.dev/configuration |
| Redpanda Connect | redpanda-connect | stream-processor | done | https://docs.redpanda.com/redpanda-connect/components/buffers/about/ |
| Hazelcast Jet | â€” | â€” | skip: merged into the Hazelcast Platform, covered by hazelcast | https://docs.hazelcast.com/ |
| Apache Heron | â€” | â€” | skip: last release 0.20.4 (2021), unmaintained | https://heron.apache.org/ |
| Norikra | norikra | stream-processor | done | https://norikra.github.io/ |

## Data catalog and BI

| resource | id | kind | status | source |
|---|---|---|---|---|
| DataHub | datahub | data-catalog | done | https://docs.datahub.com/docs/features/feature-guides/lineage |
| OpenMetadata | openmetadata | data-catalog | done | https://docs.open-metadata.org/latest/connectors/ingestion/workflows |
| Amundsen | amundsen | data-catalog | done | https://github.com/amundsen-io/amundsen |
| Apache Atlas | atlas | data-catalog | done | https://atlas.apache.org/2.0.0/index.html |
| Unity Catalog | unity-catalog | data-catalog | done | https://docs.unitycatalog.io/ |
| Apache Polaris | polaris | data-catalog | done | https://polaris.apache.org/releases/1.0.0/access-control/ |
| Collibra | collibra | data-catalog | done | https://productresources.collibra.com/docs/collibra/latest/Content/Products-and-features/co_products-and-features.htm |
| Alation | alation | data-catalog | done | https://docs.alation.com/ |
| Metabase | metabase | bi-service | done | https://www.metabase.com/docs/latest/permissions/row-and-column-security |
| Apache Superset | superset | bi-service | done | https://superset.apache.org/admin-docs/configuration/configuring-superset/ |
| Redash | redash | bi-service | done | https://redash.io/help/user-guide/dashboards/sharing-dashboards |
| Lightdash | lightdash | bi-service | done | https://docs.lightdash.com/references/user-attributes |
| Cube | cube | bi-service | done | https://docs.cube.dev/docs/introduction |
| Evidence | evidence | bi-service | done | https://docs.evidence.dev/ |
| Kibana | kibana | bi-service | done | https://www.elastic.co/docs/explore-analyze/report-and-share |
| Tableau Server | tableau | bi-service | done | https://help.tableau.com/current/server/en-us/users_guest.htm |
| Power BI Report Server | power-bi-report-server | bi-service | done | https://learn.microsoft.com/en-us/power-bi/report-server/get-started |
| Great Expectations | â€” | â€” | skip: Python data-quality library run inside a pipeline | https://docs.greatexpectations.io/ |
| Power BI / Looker | â€” | â€” | skip: covered by the azure and gcp provider folders | https://learn.microsoft.com/en-us/power-bi/ |

## Big data clusters and ML platforms

| resource | id | kind | status | source |
|---|---|---|---|---|
| Apache Hadoop YARN | hadoop-yarn | big-data-cluster | done | https://hadoop.apache.org/docs/stable/hadoop-yarn/hadoop-yarn-common/yarn-default.xml |
| Apache Spark cluster | spark-cluster | big-data-cluster | done | https://spark.apache.org/docs/latest/cluster-overview.html |
| Spark job | spark-job | worker | done | https://spark.apache.org/docs/latest/submitting-applications.html |
| Ray | ray | big-data-cluster | done | https://docs.ray.io/en/latest/cluster/kubernetes/user-guides/configuring-autoscaling.html |
| Dask | dask | big-data-cluster | done | https://docs.dask.org/en/stable/deploying.html |
| Slurm | slurm | big-data-cluster | done | https://slurm.schedmd.com/sched_config.html |
| Volcano | volcano | big-data-cluster | done | https://github.com/volcano-sh/volcano |
| Databricks | databricks | big-data-cluster | done | https://docs.databricks.com/aws/en/compute/configure |
| Kubeflow | kubeflow | ml-platform | done | https://github.com/kubeflow/kubeflow |
| MLflow | mlflow | ml-platform | done | https://mlflow.org/docs/latest/ml/tracking/ |
| Weights & Biases | weights-and-biases | ml-platform | done | https://docs.wandb.ai/guides/hosting/ |
| Metaflow | metaflow | ml-platform | done | https://docs.metaflow.org/getting-started/infrastructure |
| ClearML | clearml | ml-platform | done | https://clear.ml/docs/latest/docs/deploying_clearml/clearml_server/ |
| Determined AI | determined | ml-platform | done | https://github.com/determined-ai/determined |
| Feast | feast | ml-platform | done | https://docs.feast.dev/getting-started/quickstart |
| H2O.ai | h2o | ml-platform | done | https://docs.h2o.ai/h2o/latest-stable/h2o-docs/starting-h2o.html |
| Apache Mesos | â€” | â€” | skip: moved to the Apache Attic in 2021 | https://attic.apache.org/projects/mesos.html |
| SageMaker / Vertex AI / Azure ML | â€” | â€” | skip: covered by the aws, gcp and azure provider folders | https://docs.aws.amazon.com/sagemaker/ |
| Polyaxon | polyaxon | ml-platform | done | https://polyaxon.com/docs/ |

## ML serving

| resource | id | kind | status | source |
|---|---|---|---|---|
| TensorFlow Serving | tensorflow-serving | ml-inference | done | https://www.tensorflow.org/tfx/guide/serving |
| NVIDIA Triton Inference Server | triton | ml-inference | done | https://docs.nvidia.com/deeplearning/triton-inference-server/ |
| TorchServe | torchserve | ml-inference | done | https://docs.pytorch.org/serve/configuration.html |
| vLLM | vllm | ml-inference | done | https://docs.vllm.ai/en/latest/cli/serve.html |
| Text Generation Inference | text-generation-inference | ml-inference | done | https://huggingface.co/docs/text-generation-inference/en/basic_tutorials/launcher |
| SGLang | sglang | ml-inference | done | https://docs.sglang.io/advanced_features/server_arguments.html |
| Ollama | ollama | ml-inference | done | https://docs.ollama.com/faq |
| LocalAI | localai | ml-inference | done | https://localai.io/docs/basics/getting_started/ |
| KServe | kserve | ml-inference | done | https://github.com/kserve/kserve |
| Seldon Core | seldon-core | ml-inference | done | https://docs.seldon.ai/seldon-core-2/about/architecture |
| BentoML | bentoml | ml-inference | done | https://docs.bentoml.com/en/latest/get-started/hello-world.html |
| Ray Serve | ray-serve | ml-inference | done | https://docs.ray.io/en/latest/serve/configure-serve-deployment.html |
| ONNX Runtime | â€” | â€” | skip: inference library linked into a serving process | https://onnxruntime.ai/docs/ |
| LMDeploy | lmdeploy | ml-inference | done | https://lmdeploy.readthedocs.io/en/latest/llm/api_server.html |
| TensorRT-LLM (trtllm-serve) | tensorrt-llm | ml-inference | done | https://nvidia.github.io/TensorRT-LLM/commands/trtllm-serve/trtllm-serve.html |
| NVIDIA NIM for LLMs (self-hosted) | nvidia-nim | ml-inference | done | https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html |
| MLC LLM | mlc-llm | ml-inference | done | https://llm.mlc.ai/docs/deploy/rest.html |
| llama.cpp server | llama-cpp-server | ml-inference | done | https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md |
| LM Studio | lm-studio | ml-inference | done | https://lmstudio.ai/docs/developer/core/server |
| Jan | jan | ml-inference | done | https://www.jan.ai/docs/desktop/api-server |
| Xinference | xinference | ml-inference | done | https://inference.readthedocs.io/en/latest/getting_started/using_xinference.html |
| Infinity | infinity-embeddings | ml-inference | done | https://github.com/michaelfeil/infinity |
| Text Embeddings Inference | text-embeddings-inference | ml-inference | done | https://huggingface.co/docs/text-embeddings-inference/en/cli_arguments |
| Modal | modal | ml-inference | done | https://modal.com/docs/guide/cold-start |
| Baseten | baseten | ml-inference | done | https://docs.baseten.co/deployment/autoscaling |
| Anyscale Endpoints | anyscale-endpoints | ml-inference | skip: retired August 2024, the multi-tenant Endpoints API was removed and LLM serving moved to dedicated deployments on the Anyscale Platform | https://docs.anyscale.com/ |
| Mystic AI | mystic-ai | ml-inference | skip: retired 2025, Mystic sunset its serverless and bring-your-own-cloud services | https://cerebrium.ai/docs/migrations/mystic |
| Beam | beam-cloud | ml-inference | done | https://docs.beam.cloud/v2/endpoint/overview |
| OctoAI | octoai | ml-inference | skip: retired October 2024, NVIDIA acquired OctoAI and all services were terminated on 31 Oct 2024 | https://github.com/octoml |
| Banana | banana-dev | ml-inference | skip: retired March 2024, serverless GPU infrastructure shut down on 31 Mar 2024 | https://banana.dev/blog/sunset |
| Open WebUI | open-webui | app-server | done | https://docs.openwebui.com/reference/env-configuration/ |

## GPU clouds

| resource | id | kind | status | source |
|---|---|---|---|---|
| Runpod Pods | runpod | virtual-machine | done | https://docs.runpod.io/pods/overview |
| Lambda Cloud (Lambda Labs) | lambda-labs | virtual-machine | done | https://docs.lambda.ai/public-cloud/on-demand/ |
| CoreWeave Kubernetes Service | coreweave | container-orchestrator | done | https://docs.coreweave.com/products/cks |
| Nebius AI Cloud Compute | nebius | virtual-machine | done | https://docs.nebius.com/compute/virtual-machines/types |
| Crusoe Cloud | crusoe | virtual-machine | done | https://docs.crusoecloud.com/compute/virtual-machines/overview/ |
| Vast.ai | vast-ai | virtual-machine | done | https://docs.vast.ai/documentation/instances/rental-types |
| NVIDIA DGX Cloud (Lepton) | nvidia-dgx-cloud | ml-platform | done | https://docs.nvidia.com/dgx-cloud/lepton/get-started/index.html |
| Paperspace | — | — | skip: covered by digitalocean-paperspace in the digitalocean provider folder | https://docs.digitalocean.com/products/paperspace/ |
| AWS Trainium / AWS Inferentia | — | — | skip: covered by aws-ec2 in the aws provider folder (`accelerator: trainium` / `inferentia`) | https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html |

## Speech and voice agents

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cartesia API | cartesia | ai-service | done | https://docs.cartesia.ai/use-the-api/concurrency-limits-and-timeouts |
| PlayHT API | playht | ai-service | skip: retired December 2025, Meta acquired PlayAI and shut the platform down on 31 Dec 2025 | https://docs.play.ht/reference/api-getting-started |
| Rime TTS API | rime | ai-service | done | https://docs.rime.ai/api-reference/quickstart |
| Speechmatics API | speechmatics | ai-service | done | https://docs.speechmatics.com/introduction/authentication |
| Gladia API | gladia | ai-service | done | https://docs.gladia.io/chapters/limits-and-specifications/concurrency |
| Rev AI API | rev-ai | ai-service | done | https://docs.rev.ai/api/security/ |
| Hume AI API | hume-ai | ai-service | done | https://dev.hume.ai/docs/introduction/api-key |
| Vapi | vapi | ai-service | done | https://docs.vapi.ai/quickstart/introduction |
| Retell AI | retell-ai | ai-service | done | https://docs.retellai.com/general/introduction |
| Bland AI | bland-ai | ai-service | done | https://docs.bland.ai/welcome-to-bland |
| Synthflow | synthflow | ai-service | done | https://docs.synthflow.ai/ |
| Pipecat | pipecat | app-server | done | https://docs.pipecat.ai/getting-started/introduction |
| LiveKit Agents | livekit-agents | app-server | done | https://docs.livekit.io/agents/ |
| Twilio ConversationRelay | — | — | skip: covered by twilio-flex (`conversationRelay: true`), a Programmable Voice feature, not a box | https://www.twilio.com/docs/voice/conversationrelay |

## AI APIs

| resource | id | kind | status | source |
|---|---|---|---|---|
| OpenAI API | openai-api | ai-service | done | https://developers.openai.com/api/docs/guides/your-data |
| Anthropic API | anthropic-api | ai-service | done | https://platform.claude.com/docs/en/api/rate-limits |
| Hugging Face Inference Endpoints | huggingface-inference | ml-inference | done | https://huggingface.co/docs/inference-endpoints/en/guides/autoscaling |
| Cohere API | cohere-api | ai-service | done | https://docs.cohere.com/docs/rate-limits |
| Mistral AI API | mistral-api | ai-service | done | https://docs.mistral.ai/admin/user-management-finops/tier |
| Groq | groq | ai-service | done | https://console.groq.com/docs/rate-limits |
| Together AI | together-ai | ai-service | done | https://docs.together.ai/docs/rate-limits |
| Fireworks AI | fireworks-ai | ai-service | done | https://docs.fireworks.ai/getting-started/introduction |
| Replicate | replicate | ai-service | done | https://replicate.com/docs/topics/predictions/data-retention |
| OpenRouter | openrouter | ai-service | done | https://openrouter.ai/docs/api-reference/limits |
| ElevenLabs | elevenlabs | ai-service | done | https://elevenlabs.io/docs/models |
| Deepgram | deepgram | ai-service | done | https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program |
| AssemblyAI | assemblyai | ai-service | done | https://support.assemblyai.com/articles/2240096256-does-assemblyai-offer-zero-data-retention |
| LiteLLM proxy | litellm | api-gateway | done | https://docs.litellm.ai/docs/routing |
| LangSmith | langsmith | monitoring | done | https://docs.langchain.com/langsmith/administration-overview |
| LangChain / LlamaIndex | â€” | â€” | skip: application frameworks linked into the app-server | https://python.langchain.com/docs/ |
| Google Gemini API / Amazon Bedrock | â€” | â€” | skip: covered by the gcp and aws provider folders | https://ai.google.dev/gemini-api/docs |
| Recombee | recombee | ai-service | done | https://docs.recombee.com/ |
| AI21 API | ai21-api | ai-service | done | https://docs.ai21.com/docs/rate-limits |
| Aleph Alpha API | aleph-alpha-api | ai-service | skip: retired November 2024, public hosted API discontinued; API now ships inside customer-run PhariaAI | https://docs.aleph-alpha.com/phariaai-dev-guide/latest/pharia-openapi/index.html |
| BFL API | black-forest-labs-api | ai-service | done | https://docs.bfl.ai/api_integration/integration_guidelines |
| Baidu Qianfan ERNIE API | baidu-ernie-api | ai-service | done | https://intl.cloud.baidu.com/en/doc/qianfan/s/7m95lyy43-intl-en |
| Cerebras Inference API | cerebras-api | ai-service | done | https://inference-docs.cerebras.ai/support/rate-limits |
| DeepInfra API | deepinfra | ai-service | done | https://docs.deepinfra.com/account/data-privacy |
| DeepSeek API | deepseek-api | ai-service | done | https://api-docs.deepseek.com/quick_start/rate_limit |
| Ideogram API | ideogram-api | ai-service | done | https://developer.ideogram.ai/ideogram-api/api-overview |
| Jina AI API | jina-ai | ai-service | done | https://jina.ai/api-dashboard/rate-limit |
| Kimi Open Platform API | moonshot-kimi-api | ai-service | done | https://platform.kimi.ai/docs/pricing/limits |
| Lepton AI | lepton-ai | ai-service | skip: retired June 2025, acquired by NVIDIA and relaunched as DGX Cloud Lepton GPU marketplace | https://www.nvidia.com/en-us/data-center/dgx-cloud-lepton/ |
| Luma API | luma-api | ai-service | done | https://docs.lumalabs.ai/docs/rate-limits |
| MiniMax API | minimax-api | ai-service | done | https://platform.minimax.io/docs/guides/rate-limits |
| NVIDIA API catalog (hosted NIM) | nvidia-nim-api | ai-service | done | https://docs.api.nvidia.com/nim/docs/product |
| Nomic Embedding API | nomic-api | ai-service | done | https://docs.nomic.ai/api/getting-started/rate-limits |
| Novita AI API | novita-ai | ai-service | done | https://docs.novita.ai/guides/llm-rate-limits |
| Perplexity API | perplexity-api | ai-service | done | https://docs.perplexity.ai/docs/resources/privacy-security |
| Reka API | reka-api | ai-service | done | https://docs.reka.ai/vision/rate-limits |
| Runway API | runway-api | ai-service | done | https://docs.dev.runwayml.com/usage/tiers/ |
| SambaNova Cloud API | sambanova-api | ai-service | done | https://docs.sambanova.ai/docs/en/models/rate-limits |
| Stability AI API | stability-ai-api | ai-service | done | https://platform.stability.ai/docs/api-reference |
| Voyage AI API | voyage-ai | ai-service | done | https://docs.voyageai.com/docs/rate-limits |
| Writer API | writer-api | ai-service | done | https://dev.writer.com/api-reference/rate-limits |
| Z.ai (Zhipu) GLM API | zhipu-glm-api | ai-service | done | https://docs.z.ai/guides/overview/quick-start |
| fal Model APIs | fal-ai | ai-service | done | https://fal.ai/docs/model-apis/faq |
| xAI API | xai-api | ai-service | done | https://docs.x.ai/developers/faq/security |
| Midjourney | — | — | skip: no public API; images are made in the Midjourney app and Discord only | https://docs.midjourney.com/ |
| Suno API | — | — | skip: no official public API; a partner developer API was only opened to an intake form in July 2026 | https://suno.com |
| GitHub Models | github-models | ai-service | done | https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models |

## AI gateways and routers

| resource | id | kind | status | source |
|---|---|---|---|---|
| Helicone AI Gateway | helicone-gateway | api-gateway | done | https://docs.helicone.ai/gateway/provider-routing |
| Kong AI Gateway | kong-ai-gateway | api-gateway | done | https://developer.konghq.com/plugins/ai-proxy-advanced/reference/ |
| Martian Gateway | martian | api-gateway | done | https://docs.withmartian.com/gateway |
| Not Diamond router | not-diamond | api-gateway | done | https://docs.notdiamond.ai/docs/quickstart-routing |
| Portkey AI Gateway | portkey | api-gateway | done | https://portkey.ai/docs/product/ai-gateway/cache-simple-and-semantic |
| Requesty router | requesty | api-gateway | done | https://docs.requesty.ai/features/fallback-policies |
| Unify router | unify-ai | api-gateway | skip: retired September 2026, Unify pivoted away from routing (AI assistants, then agent post-training) and archived docs.unify.ai | https://github.com/unifyai/docs |
| Vercel AI Gateway | vercel-ai-gateway | api-gateway | done | https://vercel.com/docs/ai-gateway/security-and-compliance |

## LLM observability, evaluation and prompt management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Arize AX space | arize-ax | monitoring | done | https://arize.com/docs/ax |
| Arthur workspace | arthur-ai | monitoring | done | https://docs.arthur.ai/ |
| Braintrust organization | braintrust | monitoring | done | https://www.braintrust.dev/docs/guides/self-hosting |
| Confident AI project | confident-ai | monitoring | done | https://www.confident-ai.com/docs |
| Evidently workspace | evidently-ai | monitoring | done | https://docs.evidentlyai.com/faq/oss_vs_cloud |
| Fiddler project | fiddler-ai | monitoring | done | https://docs.fiddler.ai/ |
| Galileo project | galileo | monitoring | done | https://docs.galileo.ai/what-is-galileo |
| Giskard Hub project | giskard | monitoring | done | https://docs.giskard.ai/ |
| Helicone organization | helicone | monitoring | done | https://docs.helicone.ai/getting-started/quick-start |
| HoneyHive project | honeyhive | monitoring | done | https://docs.honeyhive.ai/v2/introduction/what-is-hhai |
| Humanloop organization | humanloop | monitoring | skip: retired September 2025, platform and API sunset 8 Sept 2025 after the team joined Anthropic | https://humanloop.com/docs |
| Langfuse project | langfuse | monitoring | done | https://langfuse.com/docs/data-retention |
| Lunary project | lunary | monitoring | done | https://docs.lunary.ai/docs |
| Opik workspace | opik | monitoring | done | https://www.comet.com/docs/opik/self-host/overview |
| Phoenix server | arize-phoenix | monitoring | done | https://arize.com/docs/phoenix/self-hosting |
| PromptLayer workspace | promptlayer | monitoring | done | https://docs.promptlayer.com/ |
| Traceloop environment | traceloop | monitoring | done | https://www.traceloop.com/docs/introduction |
| TruEra workspace | truera | monitoring | skip: retired May 2024, acquired by Snowflake and folded into its AI Data Cloud | https://www.snowflake.com/en/blog/snowflake-acquires-truera-to-bring-llm-ml-observability-to-data-cloud/ |
| WhyLabs organization | whylabs | monitoring | skip: retired January 2025, WhyLabs Inc. discontinued operations and open-sourced the platform | https://github.com/whylabs/whylabs-oss |
| DeepEval test workflow | deepeval | ci-pipeline | done | https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd |
| promptfoo workflow | promptfoo | ci-pipeline | done | https://www.promptfoo.dev/docs/integrations/ci-cd/ |
| Ragas | — | — | skip: evaluation library imported into the app or the test suite | https://docs.ragas.io/ |

## AI guardrails and security

| resource | id | kind | status | source |
|---|---|---|---|---|
| CalypsoAI platform | calypsoai | policy-engine | skip: retired September 2025, F5 acquired CalypsoAI and relaunched it as F5 AI Guardrails and F5 AI Red Team | https://www.f5.com/company/blog/what-are-ai-guardrails |
| Guardrails AI | guardrails-ai | policy-engine | done | https://www.guardrailsai.com/docs/concepts/validator_on_fail_actions |
| HiddenLayer AI Security Platform | hiddenlayer | policy-engine | done | https://docs.hiddenlayer.ai/docs/products/runtime/overview |
| LLM Guard | llm-guard | policy-engine | skip: retired 2026, Protect AI archived the LLM Guard repo and its models after the Palo Alto Networks acquisition | https://github.com/protectai/llm-guard |
| Lakera Guard | lakera-guard | policy-engine | done | https://docs.lakera.ai/docs/api |
| NeMo Guardrails | nemo-guardrails | policy-engine | done | https://docs.nvidia.com/nemo/guardrails/latest/index.html |
| Prompt Security | prompt-security | policy-engine | done | https://www.sentinelone.com/platform/securing-ai-prompt/ |
| Protect AI platform | protect-ai | policy-engine | skip: retired July 2025, Palo Alto Networks acquired Protect AI and folded Guardian, Layer, Recon and Radar into Prisma AIRS | https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai |
| Rebuff | rebuff | policy-engine | skip: retired May 2025, Protect AI archived the Rebuff repository (self-described prototype) | https://github.com/protectai/rebuff |
| Robust Intelligence platform | robust-intelligence | policy-engine | skip: retired September 2024, Cisco acquired Robust Intelligence and rebuilt it as Cisco AI Defense | https://blogs.cisco.com/news/fortifying-the-future-of-security-for-ai-cisco-announces-intent-to-acquire-robust-intelligence |
| Llama Guard | — | — | skip: a safety classifier model, served by an ml-inference or ai-service node | https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/ |

## Document parsing, web data and search APIs

| resource | id | kind | status | source |
|---|---|---|---|---|
| Unstructured API | unstructured-io | worker | done | https://docs.unstructured.io/api-reference/overview |
| LlamaParse | llamaparse | worker | done | https://developers.llamaindex.ai/python/cloud/general/rate_limits |
| Reducto | reducto | worker | done | https://docs.reducto.ai/reference/rate-limits |
| Chunkr | chunkr | worker | done | https://docs.chunkr.ai/pages/get-started/welcome |
| Docling | — | — | skip: document conversion library run inside a worker or app-server | https://docling-project.github.io/docling/ |
| Firecrawl | firecrawl | third-party-api | done | https://docs.firecrawl.dev/rate-limits |
| Apify | apify | third-party-api | done | https://docs.apify.com/platform/limits |
| ScrapingBee | scrapingbee | third-party-api | done | https://www.scrapingbee.com/documentation/ |
| Browserbase | browserbase | third-party-api | done | https://docs.browserbase.com/guides/concurrency-rate-limits |
| Steel | steel-dev | third-party-api | done | https://docs.steel.dev/overview/pricinglimits |
| Hyperbrowser | hyperbrowser | third-party-api | done | https://hyperbrowser.ai/docs |
| Tavily | tavily | third-party-api | done | https://docs.tavily.com/documentation/rate-limits |
| Exa | exa-ai | third-party-api | done | https://exa.ai/docs/reference/rate-limits |
| Serper | serper | third-party-api | done | https://serper.dev |
| SerpApi | serpapi | third-party-api | done | https://serpapi.com/pricing |
| Brave Search API | brave-search-api | third-party-api | done | https://api-dashboard.search.brave.com/documentation/guides/rate-limiting |
| You.com APIs | you-com-api | third-party-api | done | https://you.com/docs/rate-limits |
| Mixedbread | mixedbread-ai | ai-service | done | https://www.mixedbread.com/docs |

## Agent memory and code sandboxes

| resource | id | kind | status | source |
|---|---|---|---|---|
| Mem0 | mem0 | cache | done | https://docs.mem0.ai/platform/platform-vs-oss |
| Zep Cloud | zep | cache | done | https://help.getzep.com/ |
| Letta | letta | cache | done | https://docs.letta.com/guides/selfhosting |
| cognee | cognee | cache | done | https://docs.cognee.ai/ |
| Graphiti | graphiti | cache | done | https://github.com/getzep/graphiti |
| E2B sandbox | e2b | worker | done | https://docs.e2b.dev/billing |
| Daytona sandbox | daytona | worker | done | https://www.daytona.io/docs/en/limits/ |
| Vercel Sandbox | vercel-sandbox | worker | done | https://vercel.com/docs/sandbox |
| Runloop Devbox | runloop | worker | done | https://docs.runloop.ai/docs/overview/your-runloop-trial |
| Northflank Sandboxes | northflank-sandbox | worker | done | https://northflank.com/docs/v1/application/sandboxes |

## Agent runtimes and builders

| resource | id | kind | status | source |
|---|---|---|---|---|
| LangSmith Deployment (LangGraph Platform) | langgraph-platform | app-server | done | https://docs.langchain.com/langsmith/deployment |
| LlamaCloud | llamaindex-cloud | app-server | done | https://developers.llamaindex.ai/python/cloud/general/pricing/ |
| CrewAI AMP (CrewAI Enterprise) | crewai-enterprise | app-server | done | https://docs-platform.crewai.com/platform/en/introduction |
| AutoGen Studio | autogen-studio | app-server | done | https://microsoft.github.io/autogen/stable/user-guide/autogenstudio-user-guide/index.html |
| Dify | dify | app-server | done | https://docs.dify.ai/en/getting-started/install-self-hosted/docker-compose |
| Flowise | flowise | app-server | skip: retired August 2026, the Workday-owned project was archived read-only on 13 Aug 2026 | https://github.com/FlowiseAI/Flowise |
| Langflow | langflow | app-server | done | https://docs.langflow.org/deployment-overview |
| Botpress | botpress | app-server | done | https://botpress.com/docs/ |
| Rasa | rasa | app-server | done | https://rasa.com/docs/ |
| Voiceflow | voiceflow | app-server | done | https://www.voiceflow.com/docs/documentation/introduction |
| Agentforce | salesforce-agentforce | app-server | done | https://www.salesforce.com/agentforce/pricing/ |
| Zapier Agents | zapier-agents | app-server | done | https://help.zapier.com/hc/en-us/articles/45697420326285-Zapier-Agents-unexpected-activity-usage |
| Relevance AI | relevance-ai | app-server | done | https://relevanceai.com/docs/get-started/introduction |
| Lindy | lindy | app-server | done | https://docs.lindy.ai/ |
| MCP server | mcp-server | app-server | done | https://modelcontextprotocol.io/specification/2025-06-18/basic/transports |
| OpenAI Agents SDK | — | — | skip: agent framework library linked into the app-server | https://openai.github.io/openai-agents-python/ |
| Semantic Kernel | — | — | skip: agent framework library linked into the app-server | https://learn.microsoft.com/en-us/semantic-kernel/overview/ |
| Genkit | — | — | skip: AI framework library linked into the app-server | https://genkit.dev/docs/get-started/ |
| AI SDK (Vercel) | — | — | skip: TypeScript AI library linked into the app-server | https://ai-sdk.dev/docs/introduction |

## Data labelling and training data

| resource | id | kind | status | source |
|---|---|---|---|---|
| Label Studio | label-studio | ml-platform | done | https://labelstud.io/guide/install |
| Labelbox | labelbox | ml-platform | done | https://docs.labelbox.com/docs/overview |
| Scale AI | scale-ai | ml-platform | done | https://api-reference.scale.com/docs/api-reference/authentication |
| Snorkel Flow | snorkel | ml-platform | done | https://snorkel.ai/ai-data-development/ |
| Roboflow | roboflow | ml-platform | done | https://docs.roboflow.com/ |
| Encord | encord | ml-platform | done | https://docs.encord.com/platform-documentation/GettingStarted/gettingstarted-welcome |
| V7 Darwin | v7 | ml-platform | done | https://docs.v7labs.com/docs/registering-items-from-external-storage |
| SuperAnnotate | superannotate | ml-platform | done | https://doc.superannotate.com/docs/integrations |
| Argilla | argilla | ml-platform | done | https://docs.argilla.io/latest/getting_started/how-to-deploy-argilla-with-docker/ |
| CVAT | cvat | ml-platform | done | https://docs.cvat.ai/docs/administration/community/basics/installation/ |
| Prodigy | prodigy | ml-platform | done | https://prodi.gy/docs/install |
| Kili Technology | kili | ml-platform | done | https://docs.kili-technology.com/docs/hosting |
| Datasaur | datasaur | ml-platform | done | https://docs.datasaur.ai/integrations/external-object-storage |
| Toloka | toloka | ml-platform | done | https://toloka.ai/blog/toloka-platform-relaunch/ |
| Surge AI | surge-ai | ml-platform | done | https://github.com/surge-ai/surge-python |
| Hugging Face Hub | hugging-face-hub | artifact-repository | done | https://huggingface.co/docs/hub/repositories |
| Civitai | civitai | artifact-repository | done | https://github.com/civitai/civitai/wiki/REST-API-Reference |

## ML and data-science platforms

| resource | id | kind | status | source |
|---|---|---|---|---|
| DataRobot AI Platform | datarobot | ml-platform | done | https://docs.datarobot.com/en/docs/get-started/day0/orientation.html |
| Dataiku DSS | dataiku | ml-platform | done | https://doc.dataiku.com/dss/latest/installation/custom/advanced-customization.html |
| C3 Agentic AI Platform | c3-ai | ml-platform | done | https://docs.c3.ai/docs/platform/8.9/topic/admin-c3-deploy-overview |
| Domino Data Lab | domino-data-lab | ml-platform | done | https://docs.dominodatalab.com/en/6.2/user_guide/cece0f/deployment-offerings/ |
| Alteryx One / Alteryx Server | alteryx | ml-platform | done | https://help.alteryx.com/aac/en/platform/alteryx-one-app/overview.html |
| KNIME Business Hub | knime | ml-platform | done | https://docs.knime.com/latest/business_hub_installation_guide/index.html |
| RapidMiner AI Hub (formerly Altair AI Hub) | rapidminer | ml-platform | done | https://docs.rapidminer.com/2026.0/hub/releases/changes-2026.0.2.html |
| Abacus.AI | abacus-ai | ml-platform | done | https://abacus.ai/help/developer-platform/introduction |
| Valohai | valohai | ml-platform | done | https://docs.valohai.com/installation-and-setup |
| Union.ai | union-ai | ml-platform | done | https://www.union.ai/docs/v1/byoc/user-guide/introduction |
| Deepchecks LLM Evaluation | deepchecks | monitoring | done | https://llmdocs.deepchecks.com/docs/aws-sagemaker |
| DVC | dvc | ml-platform | done | https://dvc.org/doc/user-guide/data-management/remote-storage |
| lakeFS | lakefs | object-store | done | https://docs.lakefs.io/reference/configuration/ |
| Pachyderm | pachyderm | ml-platform | skip: retired January 2025, HPE retired HPE Machine Learning Data Management and the last release shipped 15 Jan 2025 | https://github.com/pachyderm/pachyderm |
| ZenML | zenml | ml-platform | done | https://docs.zenml.io/deploying-zenml/deploying-zenml |
| Flyte | flyte | ml-platform | done | https://docs.flyte.org/en/latest/deployment/deployment/index.html |
| neptune.ai | neptune-ai | ml-platform | skip: retired March 2026, OpenAI acquired Neptune and the SaaS shut down on 6 Mar 2026 with all data deleted | https://support.neptune.ai/en/articles/13925165-service-shutdown-overview |
| Comet | comet-ml | ml-platform | done | https://www.comet.com/docs/v2/ |
| H2O AI Cloud | — | — | skip: covered by h2o (alias H2O AI Cloud) | https://docs.h2o.ai/ |
| Databricks Mosaic AI | — | — | skip: covered by databricks (`mosaicAi: true`) | https://docs.databricks.com/aws/en/machine-learning/ |
| Snowflake Cortex AI | — | — | skip: covered by snowflake (`cortex: true`) | https://docs.snowflake.com/en/guides-overview-ai-features |
| Kedro | — | — | skip: Python pipeline library linked into a project, not a deployable node | https://docs.kedro.org/ |

## AI coding assistants

| resource | id | kind | status | source |
|---|---|---|---|---|
| GitHub Copilot | github-copilot | client | done | https://docs.github.com/en/copilot/get-started/plans |
| Cursor | cursor | client | done | https://cursor.com/data-use |
| Claude Code | claude-code | client | done | https://code.claude.com/docs/en/overview |
| Windsurf (Devin Desktop) | windsurf | client | done | https://docs.devin.ai/desktop/getting-started |
| Tabnine | tabnine | client | done | https://docs.tabnine.com/main/welcome/readme/architecture/deployment-options |
| Sourcegraph Cody | sourcegraph-cody | client | done | https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans |
| JetBrains AI Assistant / Junie | jetbrains-ai | client | done | https://www.jetbrains.com/help/ai-assistant/junie-agent.html |
| Replit Agent | replit-agent | client | done | https://docs.replit.com/replitai/agent |
| Lovable | lovable | client | done | https://docs.lovable.dev/integrations/supabase |
| Bolt.new | bolt-new | client | done | https://support.bolt.new/cloud/bolt-cloud |
| v0 | v0 | client | done | https://v0.app/docs |

## Object storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| MinIO | minio | object-store | done | https://docs.min.io/ |
| Ceph RADOS Gateway | ceph-rgw | object-store | done | https://docs.ceph.com/en/latest/radosgw/ |
| SeaweedFS | seaweedfs | object-store | done | https://github.com/seaweedfs/seaweedfs/wiki/Replication |
| Garage | garage | object-store | done | https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/ |
| Apache Ozone | ozone | object-store | done | https://ozone.apache.org/docs/current/feature/erasurecoding.html |
| OpenStack Swift | swift | object-store | done | https://docs.openstack.org/swift/latest/overview_architecture.html |
| Backblaze B2 | backblaze-b2 | object-store | done | https://www.backblaze.com/docs/cloud-storage-file-versions |
| Wasabi Hot Cloud Storage | wasabi | object-store | done | https://docs.wasabi.com/docs/how-does-wasabis-minimum-storage-duration-policy-work |
| Storj | storj | object-store | done | https://storj.dev/dcs/api/s3/object-versioning |
| Cloudinary | cloudinary | object-store | done | https://cloudinary.com/documentation/backups_and_version_management |
| imgix | imgix | cdn | done | https://docs.imgix.com/en-US/getting-started/setup/creating-sources |
| OpenIO | â€” | â€” | skip: acquired by OVH and discontinued as a product | https://www.ovhcloud.com/ |
| Amazon S3 / Azure Blob / Google Cloud Storage | â€” | â€” | skip: covered by the aws, azure and gcp provider folders | https://docs.aws.amazon.com/s3/ |

## Block storage, file storage and backup

| resource | id | kind | status | source |
|---|---|---|---|---|
| Ceph RBD | ceph-rbd | block-storage | done | https://docs.ceph.com/en/latest/rbd/ |
| CephFS | cephfs | file-storage | done | https://docs.ceph.com/en/latest/cephfs/ |
| Longhorn | longhorn | block-storage | done | https://longhorn.io/docs/1.9.0/references/settings/ |
| OpenEBS | openebs | block-storage | done | https://openebs.io/docs/concepts/architecture |
| OpenZFS | openzfs | block-storage | done | https://openzfs.github.io/openzfs-docs/man/master/7/zfsprops.7.html |
| GlusterFS | glusterfs | file-storage | done | https://docs.gluster.org/en/latest/Administrator-Guide/Setting-Up-Volumes/ |
| NFS server | nfs-server | file-storage | done | https://man7.org/linux/man-pages/man5/exports.5.html |
| Samba | samba | file-storage | done | https://www.samba.org/samba/docs/current/man-html/smbd.8.html |
| Lustre | lustre | file-storage | done | https://doc.lustre.org/lustre_manual.xhtml |
| BeeGFS | beegfs | file-storage | done | https://doc.beegfs.io/latest/advanced_topics/striping.html |
| MooseFS | moosefs | file-storage | done | https://docs.moosefs.com/ |
| JuiceFS | juicefs | file-storage | done | https://juicefs.com/docs/community/command_reference/ |
| CubeFS | cubefs | file-storage | done | https://cubefs.io/docs/master/dev-guide/admin-api/master/volume.html |
| HDFS | hdfs | file-storage | done | https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/hdfs-default.xml |
| Velero | velero | backup-service | done | https://velero.io/docs/main/api-types/backup/ |
| Restic | restic | backup-service | done | https://restic.readthedocs.io/en/stable/100_references.html |
| BorgBackup | borgbackup | backup-service | done | https://borgbackup.readthedocs.io/en/stable/usage/init.html |
| Bacula | bacula | backup-service | done | https://www.bacula.org/documentation/documentation/ |
| Bareos | bareos | backup-service | done | https://docs.bareos.org/TasksAndConcepts/CatalogMaintenance.html |
| Veeam Backup and Replication | veeam | backup-service | done | https://helpcenter.veeam.com/docs/backup/vsphere/overview.html |
| Veeam Kasten | kasten | backup-service | done | https://docs.kasten.io/latest/usage/protect.html |
| Rook | â€” | â€” | skip: Kubernetes operator that deploys Ceph; the drawn nodes are ceph-rbd and cephfs | https://rook.io/docs/rook/latest-release/Getting-Started/intro/ |
| rsync | â€” | â€” | skip: file transfer utility, not a running node | https://rsync.samba.org/documentation.html |
| Block volume | block-volume | block-storage | done | https://en.wikipedia.org/wiki/Block-level_storage |
| Tape library | tape-library | backup-service | done | https://en.wikipedia.org/wiki/Tape_library |
| Nextcloud | nextcloud | file-storage | done | https://docs.nextcloud.com/server/latest/admin_manual/ |
| Portworx | portworx | block-storage | done | https://docs.portworx.com/ |

## Load balancers, proxies and API gateways

| resource | id | kind | status | source |
|---|---|---|---|---|
| NGINX | nginx | load-balancer | done | https://nginx.org/en/docs/ |
| HAProxy | haproxy | load-balancer | done | https://docs.haproxy.org/ |
| Envoy | envoy | load-balancer | done | https://www.envoyproxy.io/docs/envoy/latest/ |
| Envoy Gateway | envoy-gateway | api-gateway | done | https://gateway.envoyproxy.io/docs/ |
| Traefik Proxy | traefik | load-balancer | done | https://doc.traefik.io/traefik/ |
| Caddy | caddy | load-balancer | done | https://caddyserver.com/docs/caddyfile/directives/reverse_proxy |
| Apache HTTP Server | apache-httpd | load-balancer | done | https://httpd.apache.org/docs/current/mod/mod_proxy.html |
| Contour | contour | load-balancer | done | https://projectcontour.io/docs/1.30/config/request-routing/ |
| Keepalived | keepalived | load-balancer | done | https://keepalived.readthedocs.io/en/latest/introduction.html |
| MetalLB | metallb | load-balancer | done | https://metallb.io/concepts/ |
| F5 BIG-IP | f5-big-ip | load-balancer | done | https://techdocs.f5.com/en-us/bigip-14-1-0/big-ip-local-traffic-management-basics-14-1-0/about-pools.html |
| Kong Gateway | kong | api-gateway | done | https://developer.konghq.com/gateway/ |
| Netflix Zuul | zuul | api-gateway | done | https://github.com/Netflix/zuul/wiki |
| Tyk Gateway | tyk | api-gateway | done | https://tyk.io/docs/tyk-oss-gateway/ |
| Apache APISIX | apisix | api-gateway | done | https://apisix.apache.org/docs/apisix/admin-api/ |
| KrakenD | krakend | api-gateway | done | https://www.krakend.io/docs/backends/ |
| Gloo Gateway | gloo | api-gateway | done | https://docs.solo.io/gateway/latest/about/overview/ |
| Emissary-ingress | emissary | api-gateway | done | https://emissary-ingress.dev/docs/ |
| Spring Cloud Gateway | spring-cloud-gateway | api-gateway | done | https://docs.spring.io/spring-cloud-gateway/reference/ |
| WSO2 API Manager | wso2-api-manager | api-gateway | done | https://apim.docs.wso2.com/en/latest/get-started/overview/ |
| ingress-nginx | â€” | â€” | skip: retired March 2026, superseded by Gateway API implementations | https://kubernetes.github.io/ingress-nginx/ |
| Apigee / Amazon API Gateway | â€” | â€” | skip: covered by the gcp and aws provider folders | https://cloud.google.com/apigee/docs |

## DNS and CDN

| resource | id | kind | status | source |
|---|---|---|---|---|
| CoreDNS | coredns | dns | done | https://coredns.io/manual/toc/ |
| BIND 9 | bind | dns | done | https://bind9.readthedocs.io/en/latest/reference.html |
| PowerDNS Authoritative Server | powerdns | dns | done | https://doc.powerdns.com/authoritative/settings.html |
| Unbound | unbound | dns | done | https://unbound.docs.nlnetlabs.nl/en/latest/manpages/unbound.conf.html |
| dnsmasq | dnsmasq | dns | done | https://thekelleys.org.uk/dnsmasq/docs/dnsmasq-man.html |
| Knot DNS | knot-dns | dns | done | https://www.knot-dns.cz/docs/latest/singlehtml/index.html |
| IBM NS1 Connect | ns1 | dns | done | https://www.ibm.com/products/ns1-connect |
| Akamai | akamai | cdn | done | https://techdocs.akamai.com/ |
| Fastly | fastly | cdn | done | https://docs.fastly.com/ |
| Bunny.net CDN | bunny | cdn | done | https://bunny.net/docs/cdn-overview |
| KeyCDN | keycdn | cdn | done | https://www.keycdn.com/features |
| CDN77 | cdn77 | cdn | done | https://client.cdn77.com/support/knowledgebase/general-faq/ssl-tech-specs |
| Vercel | vercel | cdn | done | https://vercel.com/docs/cdn |
| Netlify | netlify | cdn | done | https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/ |
| StackPath CDN | â€” | â€” | skip: CDN service shut down in 2023 | https://www.stackpath.com/ |
| Cloudflare CDN / Amazon Route 53 | â€” | â€” | skip: covered by the cloudflare and aws provider folders | https://developers.cloudflare.com/cache/ |
| ExternalDNS | external-dns | dns | done | https://kubernetes-sigs.github.io/external-dns/latest/ |

## Service mesh, coordination and network fabric

| resource | id | kind | status | source |
|---|---|---|---|---|
| Istio | istio | service-mesh | done | https://istio.io/latest/docs/ |
| Linkerd | linkerd | service-mesh | done | https://linkerd.io/docs/ |
| Consul Connect | consul-connect | service-mesh | done | https://developer.hashicorp.com/consul/docs/connect |
| Envoy sidecar | envoy-sidecar | service-mesh | done | https://www.envoyproxy.io/docs/envoy/latest/intro/deployment_types/service_to_service |
| Cilium | cilium | service-mesh | done | https://docs.cilium.io/en/stable/security/network/encryption/ |
| Kuma | kuma | service-mesh | done | https://kuma.io/docs/latest/policies/mutual-tls/ |
| Apache ZooKeeper | zookeeper | coordination-service | done | https://zookeeper.apache.org/documentation.html |
| etcd | etcd | coordination-service | done | https://etcd.io/docs/ |
| HashiCorp Consul | consul | coordination-service | done | https://developer.hashicorp.com/consul/docs |
| Netflix Eureka | eureka | coordination-service | done | https://github.com/Netflix/eureka/wiki |
| Apache Helix | apache-helix | coordination-service | done | https://helix.apache.org/ |
| Nacos | nacos | coordination-service | done | https://nacos.io/en/docs/latest/guide/user/auth/ |
| Spine-leaf fabric | spine-leaf-fabric | network-fabric | done | https://en.wikipedia.org/wiki/Clos_network |
| Multicast domain | multicast-domain | network-fabric | done | https://datatracker.ietf.org/doc/html/rfc1112 |
| ngrok | ngrok | network-fabric | done | https://ngrok.com/docs/universal-gateway/ |
| Open Service Mesh | â€” | â€” | skip: archived by CNCF in 2024 | https://github.com/openservicemesh/osm |
| Traefik Mesh | â€” | â€” | skip: archived in 2023 | https://github.com/traefik/mesh |
| Cisco Router | cisco-router | network-fabric | done | https://www.cisco.com/c/en/us/products/routers/index.html |
| Cisco switch | cisco-switch | network-fabric | done | https://www.cisco.com/c/en/us/products/switches/index.html |

## Firewalls, WAF and DDoS

| resource | id | kind | status | source |
|---|---|---|---|---|
| pfSense | pfsense | firewall | done | https://docs.netgate.com/pfsense/en/latest/firewall/fundamentals.html |
| OPNsense | opnsense | firewall | done | https://docs.opnsense.org/manual/firewall.html |
| nftables | nftables | firewall | done | https://wiki.nftables.org/wiki-nftables/index.php/Configuring_chains |
| Palo Alto Networks NGFW | palo-alto-ngfw | firewall | done | https://docs.paloaltonetworks.com/network-security/security-policy/administration/security-rules |
| Fortinet FortiGate | fortigate | firewall | done | https://docs.fortinet.com/document/fortigate/8.0.0/administration-guide/216765/implicit-rule |
| Suricata | suricata | firewall | done | https://docs.suricata.io/en/latest/rule-management/suricata-update.html |
| Snort | snort | firewall | done | https://docs.snort.org/start/inspection |
| ModSecurity | modsecurity | waf | done | https://github.com/owasp-modsecurity/ModSecurity/wiki/Reference-Manual-%28v3.x%29 |
| Coraza | coraza | waf | done | https://coraza.io/docs/tutorials/introduction/ |
| NAXSI | naxsi | waf | done | https://github.com/wargio/naxsi/wiki |
| Imperva Application Security | imperva | waf | done | https://docs-cybersec.thalesgroup.com/bundle/cloud-application-security/page/policies.htm |
| NETSCOUT Arbor DDoS | netscout-arbor | ddos-protection | done | https://www.netscout.com/product/arbor-edge-defense |
| Radware DefensePro | radware-defensepro | ddos-protection | done | https://webhelp.radware.com/dp/v6.14/index/DefensePro.htm |
| Cloudflare WAF | â€” | â€” | skip: covered by the cloudflare provider folder | https://developers.cloudflare.com/waf/ |
| Firewall appliance | firewall-appliance | firewall | done | https://en.wikipedia.org/wiki/Firewall_(computing) |
| MikroTik RouterOS | mikrotik-routeros | firewall | done | https://help.mikrotik.com/docs/spaces/ROS/overview |
| VyOS | vyos | firewall | done | https://docs.vyos.io/en/latest/ |

## VPN, bastion and remote access

| resource | id | kind | status | source |
|---|---|---|---|---|
| WireGuard | wireguard | vpn-gateway | done | https://www.wireguard.com/ |
| OpenVPN | openvpn | vpn-gateway | done | https://openvpn.net/community-resources/reference-manual-for-openvpn-2-6/ |
| strongSwan | strongswan | vpn-gateway | done | https://docs.strongswan.org/docs/latest/index.html |
| Tailscale | tailscale | vpn-gateway | done | https://tailscale.com/kb/1018/acls |
| ZeroTier | zerotier | vpn-gateway | done | https://docs.zerotier.com/what/ |
| NetBird | netbird | vpn-gateway | done | https://docs.netbird.io/about-netbird/how-netbird-works |
| Teleport | teleport | bastion-host | done | https://goteleport.com/docs/reference/architecture/session-recording/ |
| HashiCorp Boundary | boundary | bastion-host | done | https://developer.hashicorp.com/boundary/docs/overview/what-is-boundary |
| OpenSSH jump host | ssh-jump-host | bastion-host | done | https://man.openbsd.org/sshd_config |
| Headscale | â€” | â€” | skip: self-hosted control server for Tailscale clients, drawn as tailscale | https://headscale.net/stable/ |
| Pomerium | pomerium | bastion-host | done | https://www.pomerium.com/docs |

## Container orchestration and PaaS

| resource | id | kind | status | source |
|---|---|---|---|---|
| Kubernetes | kubernetes | container-orchestrator | done | https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/ |
| k3s | k3s | container-orchestrator | done | https://docs.k3s.io/networking/basic-network-options |
| k0s | k0s | container-orchestrator | done | https://docs.k0sproject.io/stable/networking/ |
| MicroK8s | microk8s | container-orchestrator | done | https://microk8s.io/docs/multi-user |
| Rancher | rancher | container-orchestrator | done | https://ranchermanager.docs.rancher.com/how-to-guides/new-user-guides/authentication-permissions-and-global-configuration/manage-role-based-access-control-rbac |
| Red Hat OpenShift | openshift | container-orchestrator | done | https://docs.redhat.com/en/documentation/openshift_container_platform/4.17/html/authentication_and_authorization/using-rbac |
| HashiCorp Nomad | nomad | container-orchestrator | done | https://developer.hashicorp.com/nomad/docs/configuration/acl |
| Docker Swarm | docker-swarm | container-orchestrator | done | https://docs.docker.com/engine/swarm/how-swarm-mode-works/pki/ |
| Karmada | karmada | container-orchestrator | done | https://karmada.io/docs/core-concepts/architecture/ |
| Knative | knative | app-server | done | https://knative.dev/docs/serving/autoscaling/scale-to-zero/ |
| Cloud Foundry | cloud-foundry | app-server | done | https://docs.cloudfoundry.org/devguide/deploy-apps/manifest-attributes.html |
| wasmCloud | wasmcloud | app-server | done | https://wasmcloud.com/docs/overview/workloads/components/ |
| Coolify | coolify | app-server | done | https://coolify.io/docs/get-started/introduction |
| Dokku | dokku | app-server | done | https://dokku.com/docs/processes/process-management/ |
| containerd / CRI-O | â€” | â€” | skip: container runtimes on a node, not a drawn resource | https://containerd.io/docs/ |
| Helm | â€” | â€” | skip: package manager for Kubernetes manifests | https://helm.sh/docs/ |
| KEDA | â€” | â€” | skip: autoscaler add-on, a property of the workload it scales | https://keda.sh/docs/ |
| Talos Linux / Flatcar | â€” | â€” | skip: operating systems for Kubernetes nodes | https://www.talos.dev/latest/ |
| Backstage | â€” | â€” | skip: internal developer portal web app, drawn as an app-server | https://backstage.io/docs/ |
| EKS / AKS / GKE | â€” | â€” | skip: covered by the aws, azure and gcp provider folders | https://docs.aws.amazon.com/eks/ |
| Apache OpenWhisk | openwhisk | app-server | done | https://openwhisk.apache.org/documentation.html |

## Virtualization and edge

| resource | id | kind | status | source |
|---|---|---|---|---|
| VM service (generic) | vm-service | app-server | done | https://en.wikipedia.org/wiki/Virtual_machine |
| VMware vSphere / ESXi | vsphere | virtual-machine | done | https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-security/configuring-and-managing-vsphere-native-key-provider/vsphere-native-key-provider-overview.html |
| Proxmox VE | proxmox | virtual-machine | done | https://pve.proxmox.com/pve-docs/pve-admin-guide.html |
| KVM with libvirt | libvirt | virtual-machine | done | https://libvirt.org/docs.html |
| Microsoft Hyper-V | hyper-v | virtual-machine | done | https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/plan/should-i-create-a-generation-1-or-2-virtual-machine-in-hyper-v |
| OpenStack Nova | openstack-nova | virtual-machine | done | https://docs.openstack.org/nova/latest/ |
| XCP-ng | xcp-ng | virtual-machine | done | https://docs.xcp-ng.org/ |
| XenServer | xenserver | virtual-machine | done | https://docs.xenserver.com/en-us/xenserver/8/ |
| oVirt | ovirt | virtual-machine | done | https://www.ovirt.org/documentation/administration_guide/ |
| KubeVirt | kubevirt | virtual-machine | done | https://kubevirt.io/user-guide/architecture/ |
| Firecracker | firecracker | virtual-machine | done | https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md |
| Nutanix AHV | nutanix-ahv | virtual-machine | done | https://www.nutanix.com/products/ahv |
| KubeEdge | kubeedge | edge-appliance | done | https://kubeedge.io/docs/architecture/edge/metamanager/ |
| OpenYurt | openyurt | edge-appliance | done | https://openyurt.io/docs/ |
| balena | balena | edge-appliance | done | https://docs.balena.io/learn/introduction/primer.md |
| Docker Engine | â€” | â€” | skip: host container runtime, the drawn node is docker-container | https://docs.docker.com/engine/ |
| Vagrant | â€” | â€” | skip: local development environment tool | https://developer.hashicorp.com/vagrant/docs |

## Application runtimes and web servers

| resource | id | kind | status | source |
|---|---|---|---|---|
| Container service (generic) | container-service | app-server | done | https://kubernetes.io/docs/concepts/workloads/ |
| Docker container | docker-container | app-server | done | https://docs.docker.com/engine/containers/run/ |
| Erlang/OTP node | erlang-node | app-server | done | https://www.erlang.org/docs |
| Apache Tomcat | tomcat | app-server | done | https://tomcat.apache.org/tomcat-11.0-doc/config/http.html |
| Eclipse Jetty | jetty | app-server | done | https://jetty.org/docs/jetty/12/operations-guide/begin/index.html |
| WildFly | wildfly | app-server | done | https://docs.wildfly.org/36/Getting_Started_Guide.html |
| Red Hat JBoss EAP | jboss-eap | app-server | done | https://docs.redhat.com/en/documentation/red_hat_jboss_enterprise_application_platform/8.0/html-single/configuration_guide/index |
| IBM WebSphere Liberty | websphere-liberty | app-server | done | https://www.ibm.com/docs/en/was-liberty/base?topic=liberty-overview |
| PHP-FPM | php-fpm | app-server | done | https://www.php.net/manual/en/install.fpm.configuration.php |
| Microsoft IIS | iis | app-server | done | https://learn.microsoft.com/en-us/iis/get-started/introduction-to-iis/introduction-to-iis-architecture |
| Node.js / Deno / Bun | â€” | â€” | skip: language runtimes, drawn as the app-server they run | https://nodejs.org/docs/latest/api/ |
| Gunicorn / uWSGI / Puma | â€” | â€” | skip: process managers inside an app-server node | https://docs.gunicorn.org/ |
| Spring Boot / Django / Rails / Express | â€” | â€” | skip: application frameworks, not deployable products | https://spring.io/projects/spring-boot |
| Eclipse GlassFish | glassfish | app-server | done | https://glassfish.org/documentation |
| Mattermost | mattermost | app-server | done | https://docs.mattermost.com/ |
| Rocket.Chat | rocket-chat | app-server | done | https://docs.rocket.chat/ |
| Gunicorn | — | — | skip: already recorded as a skip in docs/inventory/default.md ("Gunicorn / uWSGI / Puma — process managers inside an app-server node") | https://docs.gunicorn.org/en/stable/ |

## Registries and artifact repositories

| resource | id | kind | status | source |
|---|---|---|---|---|
| Harbor | harbor | container-registry | done | https://goharbor.io/docs/2.13.0/working-with-projects/create-projects/ |
| CNCF Distribution (Docker Registry) | docker-registry | container-registry | done | https://distribution.github.io/distribution/about/configuration/ |
| Docker Hub | docker-hub | container-registry | done | https://docs.docker.com/docker-hub/usage/ |
| Red Hat Quay | quay | container-registry | done | https://docs.projectquay.io/use_quay.html |
| zot | zot | container-registry | done | https://zotregistry.dev/v2.1.21/ |
| GitLab Container Registry | gitlab-registry | container-registry | done | https://docs.gitlab.com/user/packages/container_registry/ |
| JFrog Artifactory | artifactory | artifact-repository | done | https://docs.jfrog.com/artifactory/docs/repository-management |
| Sonatype Nexus Repository | nexus | artifact-repository | done | https://help.sonatype.com/en/sonatype-nexus-repository.html |
| GitHub Packages | github-packages | artifact-repository | done | https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages |
| Verdaccio | verdaccio | artifact-repository | done | https://verdaccio.org/docs/what-is-verdaccio |
| GitHub | github | artifact-repository | done | https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories |
| GitLab | gitlab | artifact-repository | done | https://docs.gitlab.com/user/public_access/ |
| Gitea | gitea | artifact-repository | done | https://docs.gitea.com/administration/config-cheat-sheet |
| Forgejo | forgejo | artifact-repository | done | https://forgejo.org/faq/ |
| Bitbucket | bitbucket | artifact-repository | done | https://support.atlassian.com/bitbucket-cloud/docs/create-a-git-repository/ |
| CNCF Dragonfly | dragonfly-d7y | cdn | done | https://d7y.io/docs/ |
| Artifact Hub | â€” | â€” | skip: public index of Helm charts and operators, not a deployed node | https://artifacthub.io/docs/ |
| Apache Subversion | subversion | artifact-repository | done | https://subversion.apache.org/docs/ |

## CI/CD and configuration management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Jenkins | jenkins | ci-pipeline | done | https://www.jenkins.io/doc/book/pipeline/ |
| GitLab CI/CD | gitlab-ci | ci-pipeline | done | https://docs.gitlab.com/ci/pipelines/settings/ |
| GitHub Actions | github-actions | ci-pipeline | done | https://docs.github.com/en/actions/reference/limits |
| CircleCI | circleci | ci-pipeline | done | https://circleci.com/docs/reference/configuration-reference/ |
| Travis CI | travis-ci | ci-pipeline | done | https://docs.travis-ci.com/user/customizing-the-build/ |
| Buildkite | buildkite | ci-pipeline | done | https://buildkite.com/docs/agent/v3 |
| JetBrains TeamCity | teamcity | ci-pipeline | done | https://www.jetbrains.com/help/teamcity/licensing-policy.html |
| Atlassian Bamboo | bamboo | ci-pipeline | done | https://confluence.atlassian.com/bamboo/configuring-agents-289277172.html |
| Drone | drone | ci-pipeline | done | https://docs.drone.io/runner/docker/configuration/reference/drone-runner-capacity/ |
| Woodpecker CI | woodpecker | ci-pipeline | done | https://woodpecker-ci.org/docs/administration/configuration/agent |
| Concourse | concourse | ci-pipeline | done | https://concourse-ci.org/docs/resources/ |
| Tekton | tekton | ci-pipeline | done | https://tekton.dev/docs/pipelines/ |
| Argo CD | argo-cd | ci-pipeline | done | https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/ |
| Flux | flux | ci-pipeline | done | https://fluxcd.io/flux/components/kustomize/kustomizations/ |
| Spinnaker | spinnaker | ci-pipeline | done | https://spinnaker.io/docs/concepts/ |
| Crossplane | crossplane | ci-pipeline | done | https://docs.crossplane.io/v1.20/concepts/managed-resources/ |
| HCP Terraform | hcp-terraform | ci-pipeline | done | https://developer.hashicorp.com/terraform/cloud-docs/overview |
| Ansible AWX | awx | ci-pipeline | done | https://docs.ansible.com/projects/awx/en/latest/ |
| Puppet Enterprise | puppet | ci-pipeline | done | https://www.puppet.com/docs/puppet/7/configuration.html |
| Chef Infra | chef | ci-pipeline | done | https://docs.chef.io/platform_overview/ |
| Salt Project | salt | ci-pipeline | done | https://docs.saltproject.io/en/latest/ref/configuration/master.html |
| Terraform CLI | â€” | â€” | skip: infrastructure-as-code CLI, not a runtime node | https://developer.hashicorp.com/terraform/docs |
| Argo Rollouts | â€” | â€” | skip: progressive delivery controller, part of the argo-cd delivery path | https://argo-rollouts.readthedocs.io/ |
| Cloud Native Buildpacks | â€” | â€” | skip: image build specification used inside a pipeline | https://buildpacks.io/docs/ |
| Zuul | zuul-ci | ci-pipeline | done | https://zuul-ci.org/docs/zuul/latest/ |
| Atlantis | atlantis | ci-pipeline | done | https://www.runatlantis.io/docs/ |

## Workflow and orchestration engines

| resource | id | kind | status | source |
|---|---|---|---|---|
| Temporal | temporal | workflow-engine | done | https://docs.temporal.io/ |
| Temporal Cloud | temporal-cloud | workflow-engine | done | https://docs.temporal.io/cloud/overview |
| Uber Cadence | cadence | workflow-engine | done | https://cadenceworkflow.io/docs/ |
| Netflix Conductor | conductor | workflow-engine | done | https://conductor-oss.github.io/conductor/ |
| Apache Airflow DAG | airflow-dag | worker | done | https://airflow.apache.org/docs/ |
| Prefect | prefect | workflow-engine | done | https://docs.prefect.io/v3/concepts/server |
| Dagster | dagster | workflow-engine | done | https://docs.dagster.io/deployment/oss/oss-instance-configuration |
| Argo Workflows | argo-workflows | workflow-engine | done | https://argo-workflows.readthedocs.io/en/latest/retries/ |
| Camunda 8 | camunda | workflow-engine | done | https://docs.camunda.io/docs/components/modeler/bpmn/compensation-events/ |
| Flowable | flowable | workflow-engine | done | https://www.flowable.com/open-source/docs/bpmn/ch03-Configuration |
| jBPM | jbpm | workflow-engine | done | https://docs.jbpm.org/latest/jbpm-docs/html_single/ |
| Kestra | kestra | workflow-engine | done | https://kestra.io/docs/architecture |
| Windmill | windmill | workflow-engine | done | https://www.windmill.dev/docs/advanced/self_host |
| n8n | n8n | workflow-engine | done | https://docs.n8n.io/deploy/host-n8n/configure-n8n/choose-n8ns-database/ |
| Node-RED | node-red | workflow-engine | done | https://nodered.org/docs/user-guide/concepts |
| Luigi | luigi | workflow-engine | done | https://luigi.readthedocs.io/en/stable/index.html |
| Restate | restate | workflow-engine | done | https://docs.restate.dev/concepts/durable_execution/ |
| Inngest | inngest | workflow-engine | done | https://www.inngest.com/docs/features/inngest-functions/error-retries/retries |
| Trigger.dev | trigger-dev | workflow-engine | done | https://trigger.dev/docs/introduction |
| Zeebe | â€” | â€” | skip: the workflow engine inside Camunda 8, covered by camunda | https://docs.camunda.io/docs/components/zeebe/zeebe-overview/ |
| Activiti | â€” | â€” | skip: superseded by Flowable, which the original team maintains | https://www.activiti.org/ |
| Digdag | digdag | workflow-engine | done | https://docs.digdag.io/ |
| Apache Airflow | airflow | workflow-engine | done | https://airflow.apache.org/docs/apache-airflow/stable/index.html |

## Observability A â€” metrics, tracing and profiling

| resource | id | kind | status | source |
|---|---|---|---|---|
| Prometheus | prometheus | monitoring | done | https://prometheus.io/docs/ |
| Grafana | grafana | monitoring | done | https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/ |
| Grafana Cloud | grafana-cloud | monitoring | done | https://grafana.com/docs/grafana-cloud/introduction/ |
| Grafana Loki | loki | monitoring | done | https://grafana.com/docs/loki/latest/operations/storage/retention/ |
| Grafana Tempo | tempo | monitoring | done | https://grafana.com/docs/tempo/latest/configuration/ |
| Grafana Pyroscope | pyroscope | monitoring | done | https://grafana.com/docs/pyroscope/latest/configure-server/reference-configuration-parameters/ |
| Jaeger | jaeger | monitoring | done | https://www.jaegertracing.io/docs/ |
| Zipkin | zipkin | monitoring | done | https://github.com/openzipkin/zipkin/blob/master/zipkin-server/README.md |
| OpenTelemetry Collector | opentelemetry-collector | monitoring | done | https://opentelemetry.io/docs/collector/ |
| Uber M3 | m3 | monitoring | done | https://m3db.io/docs/ |
| Datadog | datadog | monitoring | done | https://docs.datadoghq.com/ |
| New Relic | new-relic | monitoring | done | https://docs.newrelic.com/ |
| Dynatrace | dynatrace | monitoring | done | https://docs.dynatrace.com/docs/manage/data-privacy-and-security/data-privacy/data-retention-periods |
| Cisco AppDynamics | appdynamics | monitoring | done | https://help.splunk.com/en/appdynamics-on-premises/plan-your-deployment/physical-machine-controller-deployment-guide/controller-data-and-backups/database-size-and-data-retention/modify-metric-data-retention-periods |
| Elastic APM | elastic-apm | monitoring | done | https://www.elastic.co/docs/solutions/observability/apm/index-lifecycle-management |
| SigNoz | signoz | monitoring | done | https://signoz.io/docs/userguide/retention-period/ |
| Honeycomb | honeycomb | monitoring | done | https://docs.honeycomb.io/security-compliance/security-data-protection |
| Netdata | netdata | monitoring | done | https://learn.netdata.cloud/docs/netdata-agent/configuration/database |
| OpenTelemetry SDKs | â€” | â€” | skip: instrumentation libraries linked into the application | https://opentelemetry.io/docs/languages/ |

## Observability B â€” logs, alerting and incident response

| resource | id | kind | status | source |
|---|---|---|---|---|
| Graylog | graylog | monitoring | done | https://go2docs.graylog.org/current/setting_up_graylog/index_model.html |
| Splunk Enterprise | splunk | monitoring | done | https://help.splunk.com/en/splunk-enterprise/administer/admin-manual/10.4/configuration-file-reference/10.4.0-configuration-file-reference/indexes.conf |
| Sumo Logic | sumo-logic | monitoring | done | https://www.sumologic.com/help/docs/get-started/ |
| OpenObserve | openobserve | monitoring | done | https://openobserve.ai/docs/environment-variables/ |
| Zabbix | zabbix | monitoring | done | https://www.zabbix.com/documentation/current/en/manual/introduction/about |
| Nagios Core | nagios | monitoring | done | https://assets.nagios.com/downloads/nagioscore/docs/nagioscore/4/en/activechecks.html |
| Icinga 2 | icinga | monitoring | done | https://icinga.com/docs/icinga-2/latest/doc/03-monitoring-basics/ |
| Checkmk | checkmk | monitoring | done | https://docs.checkmk.com/latest/en/graphing.html |
| Uptime Kuma | uptime-kuma | monitoring | done | https://github.com/louislam/uptime-kuma/wiki/Environment-Variables |
| Sentry | sentry | monitoring | done | https://docs.sentry.io/ |
| Rollbar | rollbar | monitoring | done | https://docs.rollbar.com/docs/data-retention |
| SmartBear Insight Hub (BugSnag) | bugsnag | monitoring | done | https://docs.bugsnag.com/product/getting-started/ |
| Falco | falco | monitoring | done | https://falco.org/docs/concepts/event-sources/kernel/ |
| Wazuh | wazuh | monitoring | done | https://documentation.wazuh.com/current/getting-started/index.html |
| Prometheus Alertmanager | alertmanager | notification-service | done | https://prometheus.io/docs/alerting/latest/configuration/ |
| PagerDuty | pagerduty | notification-service | done | https://support.pagerduty.com/main/docs/user-profile |
| incident.io | incident-io | notification-service | done | https://incident.io/on-call |
| Atlassian Opsgenie | â€” | â€” | skip: end of life announced, customers moved to Jira Service Management | https://www.atlassian.com/software/opsgenie |
| Sensu Go | â€” | â€” | skip: commercial support ended and development stopped in 2024 | https://docs.sensu.io/ |

## Identity providers

| resource | id | kind | status | source |
|---|---|---|---|---|
| Keycloak | keycloak | identity-provider | done | https://www.keycloak.org/documentation |
| Auth0 | auth0 | identity-provider | done | https://auth0.com/docs |
| Okta Workforce Identity | okta | identity-provider | done | https://help.okta.com/ |
| Ping Identity Platform | ping-identity | identity-provider | done | https://www.pingidentity.com/en/platform.html |
| Ory (Hydra, Kratos) | ory | identity-provider | done | https://www.ory.com/docs/ecosystem/projects |
| authentik | authentik | identity-provider | done | https://docs.goauthentik.io/docs/ |
| Authelia | authelia | identity-provider | done | https://www.authelia.com/configuration/security/access-control/ |
| Zitadel | zitadel | identity-provider | done | https://zitadel.com/docs |
| FreeIPA | freeipa | identity-provider | done | https://www.freeipa.org/page/About |
| Active Directory Domain Services | active-directory | identity-provider | done | https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview |
| OpenLDAP | openldap | identity-provider | done | https://www.openldap.org/doc/admin26/intro.html |
| SPIRE | spire | identity-provider | done | https://spiffe.io/docs/latest/spire-about/spire-concepts/ |
| WorkOS | workos | identity-provider | done | https://workos.com/docs/rbac/integration |
| Clerk | clerk | identity-provider | done | https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions |
| Stytch | stytch | identity-provider | done | https://stytch.com/docs/get-started/guides/authentication |
| Amazon Cognito / Firebase Auth / Entra ID | â€” | â€” | skip: covered by the aws, gcp and azure provider folders | https://docs.aws.amazon.com/cognito/ |
| OAuth2 Proxy | oauth2-proxy | identity-provider | done | https://oauth2-proxy.github.io/oauth2-proxy/ |
| Dex | dex | identity-provider | done | https://dexidp.io/docs/ |

## Authorization and policy engines

| resource | id | kind | status | source |
|---|---|---|---|---|
| SpiceDB | spicedb | identity-provider | done | https://authzed.com/docs |
| OpenFGA | openfga | identity-provider | done | https://openfga.dev/docs/getting-started/setup-openfga/configure-openfga |
| Open Policy Agent | opa | policy-engine | done | https://www.openpolicyagent.org/docs |
| OPA Gatekeeper | gatekeeper | policy-engine | done | https://open-policy-agent.github.io/gatekeeper/website/docs/violations/ |
| Kyverno | kyverno | policy-engine | done | https://kyverno.io/docs/policy-types/cluster-policy/validate/ |
| Cerbos | cerbos | policy-engine | done | https://docs.cerbos.dev/cerbos/latest/policies/resource_policies.html |
| Permit.io | permit-io | policy-engine | done | https://docs.permit.io/concepts/pdp/overview/ |
| Casbin | â€” | â€” | skip: authorization library linked into the application | https://casbin.org/docs/overview |
| Cloud Custodian | â€” | â€” | skip: policy-as-code CLI run from a pipeline | https://cloudcustodian.io/docs/ |
| SonarQube Server | sonarqube | policy-engine | done | https://docs.sonarsource.com/sonarqube-server/latest/ |

## Secrets, keys and certificates

| resource | id | kind | status | source |
|---|---|---|---|---|
| HashiCorp Vault | hashicorp-vault | key-management | done | https://developer.hashicorp.com/vault/docs |
| HCP Vault Dedicated | hcp-vault | key-management | done | https://developer.hashicorp.com/hcp/docs/vault/get-started/deployment-considerations/tiers-and-features |
| OpenBao | openbao | key-management | done | https://openbao.org/docs/concepts/seal/ |
| Infisical | infisical | key-management | done | https://infisical.com/docs/documentation/platform/kms/overview |
| Doppler | doppler | key-management | done | https://docs.doppler.com/docs/secrets-rotation |
| CyberArk Conjur | conjur | key-management | done | https://cyberark.github.io/conjur/ |
| 1Password Connect | onepassword-connect | key-management | done | https://www.1password.dev/connect/ |
| Thales Luna HSM | thales-luna-hsm | key-management | done | https://thalesdocs.com/gphsm/luna/7/docs/network/Content/Product_Overview/the_luna_hsm.htm |
| Entrust nShield HSM | entrust-nshield | key-management | done | https://nshielddocs.entrust.com/security-world-docs/secworld-admin/security-worlds.html |
| cert-manager | cert-manager | key-management | done | https://cert-manager.io/docs/usage/certificate/ |
| Smallstep step-ca | step-ca | key-management | done | https://smallstep.com/docs/step-ca/ |
| EJBCA | ejbca | key-management | done | https://docs.keyfactor.com/ejbca/latest/ejbca-introduction |
| Sealed Secrets | sealed-secrets | key-management | done | https://github.com/bitnami-labs/sealed-secrets |
| Let's Encrypt | lets-encrypt | third-party-api | done | https://letsencrypt.org/docs/rate-limits/ |
| SOPS | â€” | â€” | skip: file encryption CLI used in a repository, not a running node | https://getsops.io/docs/ |
| Bitwarden | bitwarden | key-management | done | https://bitwarden.com/help/ |

## Feature flags and configuration

| resource | id | kind | status | source |
|---|---|---|---|---|
| LaunchDarkly | launchdarkly | feature-flag-service | done | https://launchdarkly.com/docs/ |
| Unleash | unleash | feature-flag-service | done | https://docs.getunleash.io/ |
| Flagsmith | flagsmith | feature-flag-service | done | https://docs.flagsmith.com/ |
| Flipt | flipt | feature-flag-service | done | https://docs.flipt.io/v2/concepts |
| GrowthBook | growthbook | feature-flag-service | done | https://docs.growthbook.io/ |
| Harness FME (Split) | split | feature-flag-service | done | https://developer.harness.io/docs/feature-management-experimentation/getting-started/overview/install-the-sdk/ |
| ConfigCat | configcat | feature-flag-service | done | https://configcat.com/docs/sdk-reference/js/ |
| Statsig | statsig | feature-flag-service | done | https://docs.statsig.com/server/introduction |
| Optimizely Feature Experimentation | optimizely | feature-flag-service | done | https://docs.developers.optimizely.com/feature-experimentation/docs/initialize-sdk-javascript |
| Apollo Config | apollo-config | feature-flag-service | done | https://github.com/apolloconfig/apollo |
| Spring Cloud Config Server | spring-cloud-config | feature-flag-service | done | https://docs.spring.io/spring-cloud-config/reference/server.html |
| OpenFeature | â€” | â€” | skip: vendor-neutral SDK specification, not a deployable service | https://openfeature.dev/docs/reference/intro |
| Consul KV | â€” | â€” | skip: key-value feature of consul | https://developer.hashicorp.com/consul/docs/dynamic-app-config/kv |

## Notification, email and SMS

| resource | id | kind | status | source |
|---|---|---|---|---|
| Twilio Programmable Messaging | twilio-sms | third-party-api | done | https://www.twilio.com/docs/messaging |
| Twilio SendGrid | sendgrid | third-party-api | done | https://www.twilio.com/docs/sendgrid |
| Mailgun | mailgun | third-party-api | done | https://documentation.mailgun.com/docs/mailgun/api-reference/api-overview |
| Postmark | postmark | third-party-api | done | https://postmarkapp.com/developer/api/overview |
| Resend | resend | third-party-api | done | https://resend.com/docs/dashboard/emails/idempotency-keys |
| Mailchimp Transactional (Mandrill) | mandrill | third-party-api | done | https://mailchimp.com/developer/transactional/docs/fundamentals/ |
| Vonage | vonage | third-party-api | done | https://developer.vonage.com/en/messages/technical-details |
| Plivo | plivo | third-party-api | done | https://www.plivo.com/docs/voice/concepts/account-limits |
| Bird (MessageBird) | bird | third-party-api | done | https://bird.com/docs/api |
| Postfix | postfix | third-party-api | done | https://www.postfix.org/OVERVIEW.html |
| SMTP relay | smtp-relay | third-party-api | done | https://datatracker.ietf.org/doc/html/rfc5321 |
| SMTP server | smtp-server | third-party-api | done | https://datatracker.ietf.org/doc/html/rfc5321 |
| Apple Push Notification service | apns | third-party-api | done | https://developer.apple.com/documentation/usernotifications |
| OneSignal | onesignal | notification-service | done | https://documentation.onesignal.com/ |
| Notification platform (generic) | notification-platform | notification-service | done | https://en.wikipedia.org/wiki/Push_technology |
| Novu | novu | notification-service | done | https://docs.novu.co/community/self-hosting-novu/overview |
| Courier | courier | notification-service | done | https://www.courier.com/docs/platform/ |
| Knock | knock | notification-service | done | https://docs.knock.app/getting-started/what-is-knock |
| Braze | braze | notification-service | done | https://www.braze.com/docs/api/basics/ |
| Customer.io | customer-io | notification-service | done | https://docs.customer.io/get-started/set-up-messages/ |
| Iterable | iterable | notification-service | done | https://support.iterable.com/hc/en-us/articles/204780529-Message-Channels-and-Message-Types-Overview |
| Slack API | slack | third-party-api | done | https://docs.slack.dev/apis/web-api/rate-limits |
| Amazon SES / Firebase Cloud Messaging | â€” | â€” | skip: covered by the aws and gcp provider folders | https://docs.aws.amazon.com/ses/ |
| Windows Push Notification Service | wns | third-party-api | done | https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/notifications/push-notifications/ |
| Pushover | pushover | notification-service | done | https://pushover.net/api |
| Discord API | discord | third-party-api | done | https://docs.discord.com/developers/intro |
| LINE Messaging API | line | third-party-api | done | https://developers.line.biz/en/docs/messaging-api/ |
| Messenger Platform | messenger | third-party-api | done | https://developers.facebook.com/docs/messenger-platform/ |
| Microsoft Teams | microsoft-teams | third-party-api | done | https://learn.microsoft.com/en-us/microsoftteams/platform/ |
| Telegram Bot API | telegram | third-party-api | done | https://core.telegram.org/bots/api |

## Payments and financial rails

| resource | id | kind | status | source |
|---|---|---|---|---|
| Stripe | stripe | third-party-api | done | https://docs.stripe.com/ |
| Adyen | adyen | third-party-api | done | https://docs.adyen.com/ |
| PayPal | paypal | third-party-api | done | https://developer.paypal.com/api/rest/reference/idempotency/ |
| Braintree | braintree | third-party-api | done | https://developer.paypal.com/braintree/docs/guides/webhooks/parse/node |
| Checkout.com | checkout-com | third-party-api | done | https://www.checkout.com/docs/developer-resources/api/idempotency |
| Square | square | third-party-api | done | https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency |
| Mollie | mollie | third-party-api | done | https://docs.mollie.com/reference/api-idempotency |
| Razorpay | razorpay | third-party-api | done | https://razorpay.com/docs/webhooks/validate-test/ |
| PayU | payu | third-party-api | done | https://developers.payu.com/europe/docs/payment-flows/lifecycle/ |
| Worldpay | worldpay | third-party-api | done | https://docs.worldpay.com/access/products/reference/api-principles |
| Plaid | plaid | third-party-api | done | https://plaid.com/docs/api/webhooks/webhook-verification/ |
| Payment service provider (generic) | payment-service-provider | third-party-api | done | https://en.wikipedia.org/wiki/Payment_service_provider |
| Card network | card-network | third-party-api | done | https://www.iso.org/standard/31482.html |
| Bank API | bank-api | third-party-api | done | https://www.openbanking.org.uk/standards/ |
| Supplier API | supplier-api | third-party-api | done | https://en.wikipedia.org/wiki/Business-to-business |
| Amazon Pay | amazon-pay | third-party-api | done | https://developer.amazon.com/docs/amazon-pay/intro.html |

## Ledgers, matching, id generation and rate limiting

| resource | id | kind | status | source |
|---|---|---|---|---|
| Double-entry ledger | double-entry-ledger | ledger | done | https://en.wikipedia.org/wiki/Double-entry_bookkeeping |
| TigerBeetle | tigerbeetle | ledger | done | https://docs.tigerbeetle.com/concepts/safety/ |
| Formance Ledger | formance | ledger | done | https://docs.formance.com/ledger/ |
| Order book matcher | order-book-matcher | matching-engine | done | https://en.wikipedia.org/wiki/Order_matching_system |
| Snowflake id generator | snowflake-id | id-generator | done | https://en.wikipedia.org/wiki/Snowflake_ID |
| Ticket server | ticket-server | id-generator | done | https://en.wikipedia.org/wiki/Auto-increment |
| ULID service | ulid-service | id-generator | done | https://github.com/ulid/spec |
| UUID generator | uuid-generator | id-generator | done | https://datatracker.ietf.org/doc/html/rfc9562 |
| Envoy rate limit service | envoy-ratelimit | rate-limiter | done | https://github.com/envoyproxy/ratelimit |
| NGINX limit_req | nginx-limit-req | rate-limiter | done | https://nginx.org/en/docs/http/ngx_http_limit_req_module.html |
| Redis rate limiter | redis-rate-limiter | rate-limiter | done | https://redis.io/docs/latest/develop/use/patterns/ |
| In-process rate limiter | in-process-limiter | rate-limiter | done | https://en.wikipedia.org/wiki/Token_bucket |
| Hyperledger Fabric | hyperledger-fabric | ledger | done | https://hyperledger-fabric.readthedocs.io/en/release-2.5/ |

## Event stores and generic runtime nodes

Generic nodes carry no vendor. They exist so a design that draws an unlabelled box ("Cache",
"Database", "Message queue") can be encoded without inventing a product; they assert nothing
beyond what the role itself implies, so the lint rules still fire on them.

| resource | id | kind | status | source |
|---|---|---|---|---|
| EventStoreDB (KurrentDB) | eventstoredb | event-store | done | https://docs.kurrent.io/ |
| Axon Server | axon-server | event-store | done | https://docs.axoniq.io/ |
| Raft event log | raft-event-log | event-store | done | https://raft.github.io/ |
| Apache BookKeeper | bookkeeper | event-store | done | https://bookkeeper.apache.org/docs/reference/config |
| Container worker | container-worker | worker | done | https://kubernetes.io/docs/concepts/workloads/controllers/job/ |
| Cron job | cron-job | worker | done | https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/ |
| Fanout daemon | fanout-daemon | worker | done | https://en.wikipedia.org/wiki/Fan-out_(software) |
| Message queue | message-queue | queue | done | generic node drawn without a vendor; no product documentation |
| Cache cluster | cache-cluster | cache | done | generic node drawn without a vendor; no product documentation |
| Relational database | relational-database | sql-database | done | generic node drawn without a vendor; no product documentation |
| NoSQL store | nosql-store | nosql-database | done | generic node drawn without a vendor; no product documentation |
| Blob store | blob-store | object-store | done | generic node drawn without a vendor; no product documentation |
| Content delivery network | content-delivery-network | cdn | done | generic node drawn without a vendor; no product documentation |
| Load balancer | load-balancer-tier | load-balancer | done | generic node drawn without a vendor; no product documentation |
| DNS | dns-resolver | dns | done | generic node drawn without a vendor; no product documentation |
| Observability stack | observability-stack | monitoring | done | generic node drawn without a vendor; no product documentation |
| Automation pipeline | automation-pipeline | ci-pipeline | done | generic node drawn without a vendor; no product documentation |
| File store | file-store | file-storage | done | generic node drawn without a vendor; no product documentation |
| Graph store | graph-store | graph-database | done | generic node drawn without a vendor; no product documentation |
| User device | user-device | client | done | generic node drawn without a vendor; no product documentation |
| Chronicle Queue / Marten | â€” | â€” | skip: embedded event-log libraries, not deployable nodes | https://chronicle.software/queue/ |

## Media transcoding and realtime communications

| resource | id | kind | status | source |
|---|---|---|---|---|
| FFmpeg | ffmpeg | media-transcoder | done | https://ffmpeg.org/ffmpeg.html |
| HandBrake | handbrake | media-transcoder | done | https://handbrake.fr/docs/en/latest/technical/official-presets.html |
| Shaka Packager | shaka-packager | media-transcoder | done | https://shaka-project.github.io/shaka-packager/html/documentation.html |
| Bento4 | bento4 | media-transcoder | done | https://github.com/axiomatic-systems/Bento4 |
| Mux | mux | media-transcoder | done | https://www.mux.com/docs/api-reference/video/assets |
| Janus WebRTC Server | janus | media-router | done | https://janus.conf.meetecho.com/docs/ |
| mediasoup | mediasoup | media-router | done | https://mediasoup.org/documentation/v3/ |
| Twilio Video | twilio-video | media-router | done | https://www.twilio.com/docs/video |
| LiveKit | livekit | media-router | done | https://docs.livekit.io/home/self-hosting/ports-firewall/ |
| Jitsi Videobridge | jitsi | media-router | done | https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart/ |
| Agora | agora | media-router | done | https://docs.agora.io/en/video-calling/reference/firewall |
| Daily | daily | media-router | done | https://docs.daily.co/reference/rest-api/rooms/set-room-config |
| Wowza Streaming Engine | wowza | media-router | done | https://www.wowza.com/docs/wowza-streaming-engine-product-articles |
| Ant Media Server | ant-media | media-router | done | https://antmedia.io/docs/get-started/enterprise-and-community-edition/ |
| SRS (Simple Realtime Server) | srs | media-router | done | https://ossrs.io/lts/en-us/docs/v6/doc/introduction |
| Red5 | red5 | media-router | done | https://www.red5.net/docs/red5-pro/users-guide/protocols/rtmp/ |
| Icecast | icecast | media-router | done | https://icecast.org/docs/icecast-2.4.1/config-file.html |
| coturn (TURN/STUN) | coturn | media-router | done | https://github.com/coturn/coturn/wiki/turnserver |
| GStreamer | â€” | â€” | skip: multimedia framework library | https://gstreamer.freedesktop.org/documentation/ |
| Kurento | â€” | â€” | skip: last release 6.18 (2021), unmaintained | https://doc-kurento.readthedocs.io/ |
| nginx-rtmp-module | â€” | â€” | skip: module of nginx, not a separate product | https://github.com/arut/nginx-rtmp-module |

## IoT and MQTT

| resource | id | kind | status | source |
|---|---|---|---|---|
| MQTT broker (generic) | mqtt-broker | pubsub-topic | done | https://mqtt.org/mqtt-specification/ |
| IoT device | iot-device | client | done | https://www.iso.org/standard/79323.html |
| Eclipse Mosquitto | mosquitto | pubsub-topic | done | https://mosquitto.org/man/mosquitto-conf-5.html |
| EMQX | emqx | iot-hub | done | https://docs.emqx.com/en/emqx/latest/ |
| HiveMQ | hivemq | iot-hub | done | https://docs.hivemq.com/hivemq/latest/user-guide/configuration.html |
| VerneMQ | vernemq | iot-hub | done | https://docs.vernemq.com/configuring-vernemq/options |
| NanoMQ | nanomq | pubsub-topic | done | https://nanomq.io/docs/en/latest/config-description/broker.html |
| ThingsBoard | thingsboard | iot-hub | done | https://thingsboard.io/docs/getting-started-guides/what-is-thingsboard/ |
| Eclipse Hono | hono | iot-hub | done | https://eclipse.dev/hono/docs/architecture/component-view/ |
| Eclipse Ditto | ditto | iot-hub | done | https://eclipse.dev/ditto/intro-overview.html |
| OPC UA server | opc-ua-server | iot-hub | done | https://reference.opcfoundation.org/Core/Part6/v105/docs/7.1 |
| AWS IoT Core / Azure IoT Hub | â€” | â€” | skip: covered by the aws and azure provider folders | https://docs.aws.amazon.com/iot/ |

## Realtime gateways and webhooks

| resource | id | kind | status | source |
|---|---|---|---|---|
| WebSocket gateway | websocket-gateway | realtime-gateway | done | https://datatracker.ietf.org/doc/html/rfc6455 |
| Socket.IO server | socket-io-server | realtime-gateway | done | https://socket.io/docs/v4/ |
| Phoenix Channels | phoenix-channels | realtime-gateway | done | https://hexdocs.pm/phoenix/channels.html |
| Pusher Channels | pusher | realtime-gateway | done | https://pusher.com/docs/channels/ |
| Ably | ably | realtime-gateway | done | https://ably.com/docs |
| Multicast feed | multicast-feed | realtime-gateway | done | https://datatracker.ietf.org/doc/html/rfc3208 |
| Centrifugo | centrifugo | realtime-gateway | done | https://centrifugal.dev/docs/server/engines |
| Soketi | soketi | realtime-gateway | done | https://github.com/soketi/soketi |
| Mercure | mercure | realtime-gateway | done | https://mercure.rocks/spec |
| Pushpin | pushpin | realtime-gateway | done | https://pushpin.org/docs/about/ |
| ASP.NET Core SignalR (self-hosted) | signalr | realtime-gateway | done | https://learn.microsoft.com/en-us/aspnet/core/signalr/scale |
| Liveblocks | liveblocks | realtime-gateway | done | https://liveblocks.io/docs/platform/limits |
| PartyKit | partykit | realtime-gateway | done | https://docs.partykit.io/ |
| Webhook receiver | webhook-receiver | webhook-endpoint | done | https://www.rfc-editor.org/rfc/rfc9421.html |
| Svix | svix | webhook-endpoint | done | https://docs.svix.com/retries |
| Hookdeck | hookdeck | webhook-endpoint | done | https://hookdeck.com/docs/introduction |

## Database proxies

| resource | id | kind | status | source |
|---|---|---|---|---|
| PgBouncer | pgbouncer | database-proxy | done | https://www.pgbouncer.org/config.html |
| PgCat | pgcat | database-proxy | done | https://github.com/postgresml/pgcat |
| Pgpool-II | pgpool | database-proxy | done | https://www.pgpool.net/docs/latest/en/html/runtime-config-connection-pooling.html |
| Supavisor | supavisor | database-proxy | done | https://github.com/supabase/supavisor |
| Odyssey | odyssey | database-proxy | done | https://github.com/yandex/odyssey/blob/master/docs/configuration/rules.md |
| ProxySQL | proxysql | database-proxy | done | https://proxysql.com/documentation/ |
| MariaDB MaxScale | maxscale | database-proxy | done | https://mariadb.com/docs/maxscale/reference/maxscale-routers/maxscale-readwritesplit.md |
| Vitess VTGate | vitess | database-proxy | done | https://vitess.io/docs/ |
| mongos | mongos | database-proxy | done | https://www.mongodb.com/docs/manual/core/sharded-cluster-query-router/ |
| Amazon RDS Proxy | â€” | â€” | skip: covered by the aws provider folder | https://docs.aws.amazon.com/rds/ |

## Virtual desktop and contact center

| resource | id | kind | status | source |
|---|---|---|---|---|
| Apache Guacamole | guacamole | virtual-desktop | done | https://guacamole.apache.org/doc/gug/administration.html |
| Citrix Virtual Apps and Desktops | citrix-virtual-apps | virtual-desktop | done | https://docs.citrix.com/en-us/citrix-virtual-apps-desktops/2411/install-configure/load-balance-machines |
| Omnissa Horizon (VMware Horizon) | omnissa-horizon | virtual-desktop | done | https://docs.omnissa.com/HorizonOverviewDeployment/DesktopPools |
| Kasm Workspaces | kasm | virtual-desktop | done | https://kasm.com/docs/latest/guide/persistent_data.html |
| Asterisk | asterisk | contact-center | done | https://docs.asterisk.org/Getting-Started/Beginning-Asterisk/ |
| FreeSWITCH | freeswitch | contact-center | done | https://developer.signalwire.com/freeswitch/applications/call-queues/ |
| Kamailio | kamailio | contact-center | done | https://www.kamailio.org/w/ |
| OpenSIPS | opensips | contact-center | done | https://opensips.org/About/About |
| FreePBX | freepbx | contact-center | done | https://sangomakb.atlassian.net/wiki/spaces/PG/pages/24510614/Queues+Module+User+Guide |
| 3CX | threecx | contact-center | done | https://www.3cx.com/docs/manual/call-center-queues/ |
| Twilio Flex | twilio-flex | contact-center | done | https://www.twilio.com/docs/flex/admin-guide/core-concepts/voice |
| Genesys Cloud CX | genesys-cloud | contact-center | done | https://help.genesys.cloud/articles/about-genesys-cloud/ |
| Five9 | five9 | contact-center | done | https://www.five9.com/products |
| Talkdesk | talkdesk | contact-center | done | https://docs.talkdesk.com/docs/contact-center-overview |
| Amazon Connect | â€” | â€” | skip: covered by the aws provider folder | https://docs.aws.amazon.com/connect/ |

## Product analytics and third-party APIs

| resource | id | kind | status | source |
|---|---|---|---|---|
| Maps API | maps-api | third-party-api | done | https://developers.google.com/maps/documentation |
| Mapbox | mapbox | third-party-api | done | https://docs.mapbox.com/api/overview/ |
| HERE Location Services | here | third-party-api | done | https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases |
| Nominatim | nominatim | third-party-api | done | https://nominatim.org/release-docs/latest/admin/Installation/ |
| GeoServer | geoserver | third-party-api | done | https://docs.geoserver.org/latest/en/user/gettingstarted/web-admin-quickstart/index.html |
| TileServer GL | tileserver-gl | third-party-api | done | https://maptiler-tileserver.readthedocs.io/en/latest/config.html |
| Segment | segment | third-party-api | done | https://segment.com/docs/connections/rate-limits/ |
| PostHog | posthog | bi-service | done | https://posthog.com/docs/product-analytics/sharing |
| Amplitude | amplitude | bi-service | done | https://amplitude.com/docs/apis/analytics/http-v2 |
| Mixpanel | mixpanel | bi-service | done | https://docs.mixpanel.com/reference/import-events |
| Matomo | matomo | bi-service | done | https://matomo.org/faq/on-premise/ |
| Snowplow | snowplow | stream-processor | done | https://docs.snowplow.io/docs/api-reference/stream-collector/ |
| Salesforce API | salesforce | third-party-api | done | https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm |
| HubSpot API | hubspot | third-party-api | done | https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines |
| Zendesk API | zendesk | third-party-api | done | https://developer.zendesk.com/api-reference/introduction/rate-limits/ |
| Shopify API | shopify | third-party-api | done | https://shopify.dev/docs/api/usage/rate-limits |
| Google Analytics | â€” | â€” | skip: covered by the gcp provider folder | https://developers.google.com/analytics |
| Intercom | intercom | third-party-api | done | https://developers.intercom.com/docs |
| Facebook Graph API | facebook | third-party-api | done | https://developers.facebook.com/docs/graph-api/ |
| X API | x-api | third-party-api | done | https://docs.x.com/x-api/introduction |

## Clients and load generators

| resource | id | kind | status | source |
|---|---|---|---|---|
| Web browser | web-browser | client | done | https://developer.mozilla.org/en-US/docs/Web |
| Mobile app | mobile-app | client | done | https://developer.android.com/guide |
| Desktop app | desktop-app | client | done | https://www.electronjs.org/docs/latest/ |
| Smart TV app | smart-tv-app | client | done | https://developer.roku.com/docs |
| SDK client | sdk-client | client | done | https://grpc.io/docs/ |
| Grafana k6 | k6 | client | done | https://grafana.com/docs/k6/latest/ |
| Apache JMeter | jmeter | client | done | https://jmeter.apache.org/usermanual/get-started.html |
| Locust | locust | client | done | https://docs.locust.io/en/stable/what-is-locust.html |
| Gatling | gatling | client | done | https://docs.gatling.io/reference/script/core/simulation/ |
| Selenium Grid | selenium-grid | client | done | https://www.selenium.dev/documentation/grid/ |
| React / Vue / Angular / Flutter / SwiftUI | â€” | â€” | skip: UI frameworks; the placed node is the client app they build | https://react.dev/learn |
| Playwright / Cypress | â€” | â€” | skip: test libraries run from a CI pipeline | https://playwright.dev/docs/intro |

---

## Kind proposals

None. Every product in this inventory maps onto one of the 68 existing kinds. The kinds added
during the azure and aws passes (`virtual-machine`, `container-orchestrator`,
`container-registry`, `block-storage`, `file-storage`, `firewall`, `waf`, `vpn-gateway`,
`bastion-host`, `ddos-protection`, `backup-service`, `ci-pipeline`, `artifact-repository`,
`policy-engine`, `ai-service`, `ml-platform`, `big-data-cluster`, `data-catalog`, `iot-hub`,
`edge-appliance`, `virtual-desktop`, `bi-service`) cover the self-hosted and SaaS equivalents
without change.

Two mapping decisions worth recording:

- Product analytics platforms (PostHog, Amplitude, Mixpanel, Matomo) use `bi-service`: they
  are reporting surfaces over event data, with the same dashboard, refresh and access
  properties. Customer data platforms that only forward events (Segment) use `third-party-api`.
- Forward and reverse HTTP caches (Varnish, Squid) use `cache`; Apache Traffic Server is
  listed as `cdn` because it is deployed as an edge delivery tier.

## Data movement — CDC and ingestion

| resource | id | kind | status | source |
|---|---|---|---|---|
| Elastic Agent | elastic-agent | monitoring | done | https://www.elastic.co/guide/en/fleet/current/index.html |
| Auditbeat | auditbeat | monitoring | done | https://www.elastic.co/guide/en/beats/auditbeat/current/index.html |
| Filebeat | filebeat | monitoring | done | https://www.elastic.co/guide/en/beats/filebeat/current/index.html |
| Heartbeat | heartbeat | monitoring | done | https://www.elastic.co/guide/en/beats/heartbeat/current/index.html |
| Metricbeat | metricbeat | monitoring | done | https://www.elastic.co/guide/en/beats/metricbeat/current/index.html |
| Packetbeat | packetbeat | monitoring | done | https://www.elastic.co/guide/en/beats/packetbeat/current/index.html |
| Winlogbeat | winlogbeat | monitoring | done | https://www.elastic.co/guide/en/beats/winlogbeat/current/index.html |
| rsyslog | rsyslog | monitoring | done | https://www.rsyslog.com/doc/ |
| syslog-ng | syslog-ng | monitoring | done | https://syslog-ng.github.io/admin-guide/ |
| Embulk | embulk | worker | done | https://www.embulk.org/docs/ |
| Stitch | stitch | worker | done | https://www.stitchdata.com/docs/ |

## Observability B — logs, alerting and incident response

| resource | id | kind | status | source |
|---|---|---|---|---|
| Elastic Defend | elastic-defend | monitoring | done | https://www.elastic.co/guide/en/security/current/install-endpoint.html |
| Elastic Security | elastic-security | monitoring | done | https://www.elastic.co/docs/solutions/security |
| CrowdStrike Falcon LogScale | falcon-logscale | monitoring | done | https://library.humio.com/ |
| SolarWinds Papertrail | papertrail | monitoring | done | https://www.papertrail.com/ |
| xMatters | xmatters | notification-service | done | https://help.xmatters.com/ondemand/ |

## Chaos engineering

| resource | id | kind | status | source |
|---|---|---|---|---|
| Chaos Mesh | chaos-mesh | worker | done | https://chaos-mesh.org/docs/ |
| Litmus | litmus | worker | done | https://docs.litmuschaos.io/ |

## Observability A — metrics, tracing and profiling

| resource | id | kind | status | source |
|---|---|---|---|---|
| CrowdStrike Falcon | crowdstrike-falcon | monitoring | done | https://www.crowdstrike.com/en-us/platform/endpoint-security/ |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Fleet | — | — | skip: Agent management plane inside Kibana; the drawn node is elastic-agent. | https://www.elastic.co/guide/en/fleet/current/manage-agents-in-fleet.html |
| Elastic Integrations | — | — | skip: Packaged input and dashboard configuration for Elastic Agent, not a node. | https://www.elastic.co/docs/reference/integrations/ |
| Functionbeat | — | — | skip: Reached End of Support on 18 October 2023; replaced by Elastic Serverless Forwarder. | https://www.elastic.co/guide/en/beats/functionbeat/current/index.html |
| Alerting | — | — | skip: Rules and connectors feature inside Kibana, not a separate node. | https://www.elastic.co/docs/explore-analyze/alerts-cases |
| Beats | — | — | skip: Umbrella brand covering Filebeat, Metricbeat, Packetbeat, Heartbeat, Auditbeat and Winlogbeat, each added separately. | https://www.elastic.co/guide/en/beats/libbeat/current/beats-reference.html |
| Logstash pipeline | — | — | skip: Configuration inside Logstash; the drawn node is logstash. | https://www.elastic.co/guide/en/logstash/current/configuration.html |
| Machine learning | — | — | skip: Anomaly detection and inference feature of Elasticsearch and Kibana, not a separate product. | https://www.elastic.co/docs/explore-analyze/machine-learning |
| Elastic Maps Service | — | — | skip: Hosted basemap tile and boundary service backing the Kibana Maps app, not a node a designer places. | https://www.elastic.co/docs/explore-analyze/visualize/maps/maps-connect-to-ems |
| Maps | — | — | skip: Geospatial visualisation app inside Kibana, not a separate node. | https://www.elastic.co/docs/explore-analyze/visualize/maps |
| Stack Monitoring | — | — | skip: Self-monitoring feature of the Elastic Stack, not a separate node. | https://www.elastic.co/docs/deploy-manage/monitor/stack-monitoring |
| Searchable snapshots | — | — | skip: Storage tier feature of Elasticsearch; snapshots are a property of the cluster, not a node. | https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots |
| Security settings | — | — | skip: Configuration object, not a node. | https://www.elastic.co/docs/deploy-manage/security |
| Elasticsearch SQL | — | — | skip: Query interface of Elasticsearch, not a separate node. | https://www.elastic.co/docs/explore-analyze/query-filter/languages/sql |
| Elastic Stack | — | — | skip: Umbrella brand covering Elasticsearch, Kibana, Logstash and Beats. | https://www.elastic.co/elastic-stack |
| Elastic App Search | — | — | skip: Standalone product discontinued; last shipped in 8.19 and not available in Elastic 9.x. | https://www.elastic.co/guide/en/app-search/current/index.html |
| Web crawler | — | — | skip: Content ingestion tool inside the discontinued standalone Enterprise Search, not a placeable runtime node. | https://www.elastic.co/guide/en/enterprise-search/current/crawler.html |
| Elastic Enterprise Search | — | — | skip: Standalone product discontinued; last shipped in 8.19 and not available in Elastic 9.x. | https://www.elastic.co/guide/en/enterprise-search/current/index.html |
| Site Search | — | — | skip: Swiftype Site Search, retired by Elastic and superseded by App Search, itself discontinued. | https://www.elastic.co/guide/en/swiftype/index.html |
| Elastic Workplace Search | — | — | skip: Standalone product discontinued; last shipped in 8.19 and not available in Elastic 9.x. | https://www.elastic.co/guide/en/workplace-search/current/index.html |
| Logs | — | — | skip: Log Explorer app inside Kibana, not a separate node. | https://www.elastic.co/docs/solutions/observability/logs |
| Metrics | — | — | skip: Infrastructure metrics app inside Kibana, not a separate node. | https://www.elastic.co/docs/solutions/observability/infra-and-hosts |
| Elastic Observability | — | — | skip: Umbrella solution name covering APM, logs, metrics and synthetics. | https://www.elastic.co/docs/solutions/observability |
| Uptime | — | — | skip: Synthetics and uptime app inside Kibana; the shipper is heartbeat. | https://www.elastic.co/docs/solutions/observability/synthetics |
| Elastic Cloud Enterprise | — | — | skip: Self-managed orchestration platform that deploys Elastic Stack deployments; the drawn nodes are elasticsearch and kibana. | https://www.elastic.co/docs/deploy-manage/deploy/cloud-enterprise |
| Elastic Cloud on Kubernetes | — | — | skip: Kubernetes operator that deploys the Elastic Stack; the drawn node is elasticsearch (same call as the Strimzi skip). | https://www.elastic.co/docs/deploy-manage/deploy/cloud-on-k8s |
| Elastic | — | — | skip: Vendor logo, not a node. | https://www.elastic.co/ |
| SIEM | — | — | skip: Duplicate of security/Security; SIEM is the detection engine inside Elastic Security. | https://www.elastic.co/docs/solutions/security |
| XDR | — | — | skip: Duplicate of security/Security; XDR is the positioning of Elastic Security, not a separate product. | https://www.elastic.co/docs/solutions/security |
| Power BI | — | — | skip: covered by the azure and gcp provider folders | https://learn.microsoft.com/en-us/power-bi/ |
| Singer | — | — | skip: open specification for ETL taps and targets; the deployable node is the runner that executes them (meltano) | https://www.singer.io/ |
| BuzzFeed sso | — | — | skip: archived by BuzzFeed and no longer maintained; upstream points users at other SSO proxies | https://github.com/buzzfeed/sso |
| Tekton CLI | — | — | skip: command-line client for Tekton, not a runtime node | https://tekton.dev/docs/cli/ |
| User | — | — | skip: people icon for an actor; the placeable node is the generic client (`user-device`) | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Users | — | — | skip: people icon for an actor; the placeable node is the generic client (`user-device`) | https://diagrams.mingrammer.com/docs/nodes/onprem |
| containerd | — | — | skip: container runtime on a node, not a drawn resource | https://containerd.io/docs/ |
| CRI-O | — | — | skip: container runtime on a node, not a drawn resource | https://cri-o.io/ |
| gVisor | — | — | skip: container runtime (sandboxed runsc) on a node, not a drawn resource | https://gvisor.dev/docs/ |
| LXC | — | — | skip: host container runtime, the drawn node is docker-container | https://linuxcontainers.org/lxc/documentation/ |
| rkt | — | — | skip: container runtime; project ended and archived by the CNCF in February 2020 | https://github.com/rkt/rkt |
| Flagger | — | — | skip: progressive delivery controller, part of the flux delivery path (as Argo Rollouts is for argo-cd) | https://fluxcd.io/flagger/ |
| Ansible | — | — | skip: agentless configuration-management CLI run from a control node; the deployable node is Ansible AWX (`awx`) | https://docs.ansible.com/ |
| Pulumi | — | — | skip: infrastructure-as-code CLI, not a runtime node (same call as the existing Terraform CLI row) | https://www.pulumi.com/docs/ |
| Terraform | — | — | skip: infrastructure-as-code CLI, not a runtime node (the hosted service is `hcp-terraform`) | https://developer.hashicorp.com/terraform/docs |
| Prometheus Operator | — | — | skip: Kubernetes operator that deploys Prometheus; the placed node is Prometheus itself | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Cisco Switch (Layer 3) | — | — | skip: Layer variant of the same device; the L2/L3 distinction is a property of cisco-switch | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Internet | — | — | skip: Generic boundary icon, not a product a designer configures | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Ocelot | — | — | skip: .NET library embedded in an ASP.NET app, not a deployed gateway product | https://diagrams.mingrammer.com/docs/nodes/onprem |
| YARP | — | — | skip: .NET reverse proxy library compiled into an app, not a deployed product | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Trivy | — | — | skip: Vulnerability scanner CLI run in a pipeline, not a placed runtime node | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Ceph OSD | — | — | skip: Internal daemon of a Ceph cluster, not a separately placed product | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Git | — | — | skip: Version control tool and protocol; the placed node is the hosting server | https://diagrams.mingrammer.com/docs/nodes/onprem |
| Twilio | — | — | skip: umbrella brand; the placeable products are twilio-sms, twilio-video, twilio-flex and segment | https://diagrams.mingrammer.com/docs/nodes/saas |

## Zeema designs

A design on Zeema placed in another as one box. The node's `ref` names the design and pins a
release (docs/format.md, "Referencing another design").

| resource | id | kind | status | source |
|---|---|---|---|---|
| Zeema design | zeema-design | subsystem | done | docs/intake/design-ref.md |

## Generic components — one per kind

Every kind has a vendor-neutral component whose id is the kind id. It sets no defaults and
adds no properties, so an architect who has a queue but not Kafka still places a typed node and
every rule for the kind still fires. The source is the kind file itself.

| resource | id | kind | status | source |
|---|---|---|---|---|
| Generic AI service | ai-service | ai-service | done | kinds/ai-service.yaml |
| Custom (untyped escape hatch) | custom | custom | done | kinds/custom.yaml |
| Generic API gateway | api-gateway | api-gateway | done | kinds/api-gateway.yaml |
| Generic application server | app-server | app-server | done | kinds/app-server.yaml |
| Generic artifact repository | artifact-repository | artifact-repository | done | kinds/artifact-repository.yaml |
| Generic backup vault | backup-service | backup-service | done | kinds/backup-service.yaml |
| Generic bastion host | bastion-host | bastion-host | done | kinds/bastion-host.yaml |
| Generic BI service | bi-service | bi-service | done | kinds/bi-service.yaml |
| Generic big data cluster | big-data-cluster | big-data-cluster | done | kinds/big-data-cluster.yaml |
| Generic block storage volume | block-storage | block-storage | done | kinds/block-storage.yaml |
| Generic bot management | bot-management | bot-management | done | kinds/bot-management.yaml |
| Generic cache | cache | cache | done | kinds/cache.yaml |
| Generic CDN | cdn | cdn | done | kinds/cdn.yaml |
| Generic change data capture | change-data-capture | change-data-capture | done | kinds/change-data-capture.yaml |
| Generic CI/CD pipeline | ci-pipeline | ci-pipeline | done | kinds/ci-pipeline.yaml |
| Generic client | client | client | done | kinds/client.yaml |
| Generic contact center | contact-center | contact-center | done | kinds/contact-center.yaml |
| Generic container orchestrator | container-orchestrator | container-orchestrator | done | kinds/container-orchestrator.yaml |
| Generic container registry | container-registry | container-registry | done | kinds/container-registry.yaml |
| Generic content repository | content-repository | content-repository | done | kinds/content-repository.yaml |
| Generic coordination service | coordination-service | coordination-service | done | kinds/coordination-service.yaml |
| Generic data catalog | data-catalog | data-catalog | done | kinds/data-catalog.yaml |
| Generic data warehouse | data-warehouse | data-warehouse | done | kinds/data-warehouse.yaml |
| Generic database proxy | database-proxy | database-proxy | done | kinds/database-proxy.yaml |
| Generic DDoS protection plan | ddos-protection | ddos-protection | done | kinds/ddos-protection.yaml |
| Generic DNS | dns | dns | done | kinds/dns.yaml |
| Generic edge appliance | edge-appliance | edge-appliance | done | kinds/edge-appliance.yaml |
| Generic email security gateway | email-security-gateway | email-security-gateway | done | kinds/email-security-gateway.yaml |
| Generic event store | event-store | event-store | done | kinds/event-store.yaml |
| Generic feature flag service | feature-flag-service | feature-flag-service | done | kinds/feature-flag-service.yaml |
| Generic file share | file-storage | file-storage | done | kinds/file-storage.yaml |
| Generic firewall | firewall | firewall | done | kinds/firewall.yaml |
| Generic graph database | graph-database | graph-database | done | kinds/graph-database.yaml |
| Generic ID generator | id-generator | id-generator | done | kinds/id-generator.yaml |
| Generic identity provider | identity-provider | identity-provider | done | kinds/identity-provider.yaml |
| Generic IoT hub | iot-hub | iot-hub | done | kinds/iot-hub.yaml |
| Generic key management | key-management | key-management | done | kinds/key-management.yaml |
| Generic ledger | ledger | ledger | done | kinds/ledger.yaml |
| Generic load balancer | load-balancer | load-balancer | done | kinds/load-balancer.yaml |
| Generic matching engine | matching-engine | matching-engine | done | kinds/matching-engine.yaml |
| Generic media router | media-router | media-router | done | kinds/media-router.yaml |
| Generic media transcoder | media-transcoder | media-transcoder | done | kinds/media-transcoder.yaml |
| Generic ML inference | ml-inference | ml-inference | done | kinds/ml-inference.yaml |
| Generic ML platform | ml-platform | ml-platform | done | kinds/ml-platform.yaml |
| Generic monitoring | monitoring | monitoring | done | kinds/monitoring.yaml |
| Generic NAT gateway | nat-gateway | nat-gateway | done | kinds/nat-gateway.yaml |
| Generic network fabric | network-fabric | network-fabric | done | kinds/network-fabric.yaml |
| Generic NoSQL database | nosql-database | nosql-database | done | kinds/nosql-database.yaml |
| Generic notification service | notification-service | notification-service | done | kinds/notification-service.yaml |
| Generic object store | object-store | object-store | done | kinds/object-store.yaml |
| Generic policy engine | policy-engine | policy-engine | done | kinds/policy-engine.yaml |
| Generic private endpoint | private-link | private-link | done | kinds/private-link.yaml |
| Generic Pub/Sub topic | pubsub-topic | pubsub-topic | done | kinds/pubsub-topic.yaml |
| Generic queue | queue | queue | done | kinds/queue.yaml |
| Generic rate limiter | rate-limiter | rate-limiter | done | kinds/rate-limiter.yaml |
| Generic real-time gateway | realtime-gateway | realtime-gateway | done | kinds/realtime-gateway.yaml |
| Generic schema registry | schema-registry | schema-registry | done | kinds/schema-registry.yaml |
| Generic search index | search-index | search-index | done | kinds/search-index.yaml |
| Generic service mesh | service-mesh | service-mesh | done | kinds/service-mesh.yaml |
| Generic SQL database | sql-database | sql-database | done | kinds/sql-database.yaml |
| Generic stream | stream | stream | done | kinds/stream.yaml |
| Generic stream processor | stream-processor | stream-processor | done | kinds/stream-processor.yaml |
| Generic third-party API | third-party-api | third-party-api | done | kinds/third-party-api.yaml |
| Generic time-series database | timeseries-database | timeseries-database | done | kinds/timeseries-database.yaml |
| Generic vector database | vector-database | vector-database | done | kinds/vector-database.yaml |
| Generic virtual desktop pool | virtual-desktop | virtual-desktop | done | kinds/virtual-desktop.yaml |
| Generic virtual machine | virtual-machine | virtual-machine | done | kinds/virtual-machine.yaml |
| Generic VPN gateway | vpn-gateway | vpn-gateway | done | kinds/vpn-gateway.yaml |
| Generic web application firewall | waf | waf | done | kinds/waf.yaml |
| Generic webhook endpoint | webhook-endpoint | webhook-endpoint | done | kinds/webhook-endpoint.yaml |
| Generic worker | worker | worker | done | kinds/worker.yaml |
| Generic workflow engine | workflow-engine | workflow-engine | done | kinds/workflow-engine.yaml |

## Coverage pass 2026-09-21

Diffed against the three sources named in the header: the CNCF Graduated, Incubating and
Sandbox lists (from `landscape.yml`, 39 graduated, 38 incubating, 150 sandbox), the DB-Engines
ranking top 150, and the fixed list of major independent SaaS and infrastructure products
commonly drawn in architecture diagrams.

### CNCF — added

| resource | id | kind | status | source |
|---|---|---|---|---|
| Dapr | dapr | service-mesh | done | https://docs.dapr.io/concepts/dapr-services/sidecar/ |
| OpenCost | opencost | monitoring | done | https://www.opencost.io/docs/ |
| Oxia | oxia | coordination-service | done | https://oxia-db.github.io/docs/getting-started |
| Perses | perses | monitoring | done | https://github.com/perses/perses |
| Pixie | pixie | monitoring | done | https://docs.px.dev/about-pixie/what-is-pixie/ |
| Trickster | trickster | cache | done | https://trickstercache.org/docs/ |
| Antrea | antrea | network-fabric | done | https://antrea.io/docs/ |
| Armada | armada | big-data-cluster | done | https://armadaproject.io/ |
| Athenz | athenz | identity-provider | done | https://www.athenz.io |
| BFE | bfe | load-balancer | done | https://www.bfe-networks.net |
| ContainerSSH | containerssh | bastion-host | done | https://containerssh.io |
| Curvine | curvine | file-storage | done | https://curvineio.github.io/ |
| Drasi | drasi | stream-processor | done | https://drasi.io |
| Easegress | easegress | api-gateway | done | https://megaease.cn/docs/easegress/ |
| Higress | higress | api-gateway | done | https://higress.cn/en/docs/latest/overview/what-is-higress/ |
| Kmesh | kmesh | service-mesh | done | https://kmesh.net/docs/ |
| Kubewarden | kubewarden | policy-engine | done | https://docs.kubewarden.io/ |
| KubeArmor | kubearmor | policy-engine | done | https://docs.kubearmor.io/kubearmor/ |
| Kuberhealthy | kuberhealthy | monitoring | done | https://kuberhealthy.github.io/kuberhealthy/ |
| loxilb | loxilb | load-balancer | done | https://docs.loxilb.io/latest/ |
| OpenFunction | openfunction | app-server | done | https://openfunction.dev/docs/ |
| Paralus | paralus | bastion-host | done | https://www.paralus.io/docs |
| PipeCD | pipecd | ci-pipeline | done | https://pipecd.dev/docs/ |
| Submariner | submariner | vpn-gateway | done | https://submariner.io/getting-started/ |
| Tremor | tremor | stream-processor | done | https://github.com/tremor-rs/tremor-runtime |
| llm-d | llm-d | ml-inference | done | https://llm-d.ai/docs/architecture |
| openGemini | opengemini | timeseries-database | done | https://docs.opengemini.org/guide/ |

### CNCF — not placeable nodes

| resource | id | kind | status | source |
|---|---|---|---|---|
| Microcks | — | — | skip: API mocking and contract testing server used from a pipeline, not a production node | https://microcks.io |
| KubeVela | — | — | skip: application delivery controller; the drawn nodes are the workloads it rolls out | https://kubevela.io |
| k8gb | — | — | skip: controller that writes records into an external DNS provider; the drawn node is the zone | https://www.k8gb.io |
| in-toto / Notary Project / The Update Framework | — | — | skip: supply-chain attestation and signing specifications | https://in-toto.io |
| OpenFeature | — | — | skip: vendor-neutral feature-flag SDK and specification; the node is the flag service | https://openfeature.dev/ |
| Container Network Interface (CNI) | — | — | skip: network plugin interface specification | https://www.cni.dev/ |
| gRPC / Connect RPC | — | — | skip: RPC frameworks and libraries linked into the application | https://grpc.io |
| Operator Framework | — | — | skip: SDK and lifecycle manager for operators | https://operatorframework.io/ |
| Kubescape / Trivy-style scanners | — | — | skip: security posture scanners, tooling rather than nodes | https://kubescape.io/ |
| Meshery | — | — | skip: service-mesh management and visualisation plane, tooling | https://meshery.io |
| Cloud Custodian | — | — | skip: policy-as-code rules engine run as tooling against cloud APIs | https://cloudcustodian.io/ |
| Lima / Podman Desktop / Headlamp / Telepresence | — | — | skip: developer-machine and desktop tooling | https://github.com/lima-vm/lima |
| Confidential Containers / Kuasar / youki / WasmEdge / urunc / Spin / bootc | — | — | skip: container and Wasm runtimes on a node, not drawn resources | https://confidentialcontainers.org/ |
| Fluid / OpenKruise / KAITO / Koordinator / KAI Scheduler / HAMi / Virtual Kubelet | — | — | skip: Kubernetes controllers, schedulers and device plugins; the drawn node is the workload | https://fluid-cloudnative.github.io/ |
| Kube-OVN / OVN-Kubernetes / Spiderpool / NMstate / Network Service Mesh / kube-vip | — | — | skip: Kubernetes networking plugins, a property of the cluster fabric | https://www.kube-ovn.io/ |
| HwameiStor / Piraeus Datastore / Carina / K8up / Kanister | — | — | skip: CSI drivers and backup operators; the drawn nodes are the volumes and the backup target | https://piraeus.io/ |
| Eraser / Ratify / Copa / ORAS / KitOps / ModelPack / SlimToolkit / Stacker / Dalec | — | — | skip: image build, signing and inspection tooling | https://oras.land/ |
| Carvel / KCL / kpt / ko / Score / KUDO / Porter / Radius / Shipwright / DevSpace / Devfile / werf / OpenTofu / SOPS / SchemaHero / external-secrets | — | — | skip: build, configuration and infrastructure-as-code tooling | https://carvel.dev/ |
| Capsule / Clusternet / Clusterpedia / KubeFleet / KubeStellar / Kubean / KubeClipper / Open Cluster Management / kcp / KubeSlice / KubeElasti / Kured | — | — | skip: multi-cluster and lifecycle controllers | https://capsule.clastix.io/ |
| Kepler / Inspektor Gadget / Kube-burner / bpfman | — | — | skip: exporters and diagnostic tooling on the node | https://sustainable-computing.io/ |
| Chaosblade / Krkn | — | — | skip: chaos tooling, in the same family as the existing chaos skips | https://chaosblade.io/ |
| Keylime / Parsec / Tokenetes / Open Policy Containers / OSCAL-COMPASS / Cedar / Kuadrant / KubeArmor policies | — | — | skip: attestation services, policy languages and admission policy sets | https://keylime.dev/ |
| Cozystack / OpenChoreo / Kairos / Talos / Flatcar | — | — | skip: platform distributions and node operating systems | https://cozystack.io/ |
| Tinkerbell / metal3-io | — | — | skip: bare-metal provisioning services, tooling | https://tinkerbell.org/ |
| K8sGPT / HolmesGPT / kagent / Cartography / Konveyor / Runme | — | — | skip: analysis and assistant tooling | https://k8sgpt.ai/ |
| Agones / Akri / Aeraki Mesh / Sermant / Logging Operator / Serverless Devs / SlimFaaS / OpenEverest / OpenGitOps / Open Workflow Specification / xRegistry | — | — | skip: operators, agents, specifications and domain stacks outside the drawn topology | https://agones.dev/ |

### CNCF — already covered under another name

| resource | id | kind | status | source |
|---|---|---|---|---|
| Distribution (CNCF) | — | — | skip: the reference OCI registry, already catalogued as docker-registry | https://distribution.github.io/distribution/ |
| Kgateway (formerly Gloo Gateway) | — | — | skip: the renamed Gloo Gateway, already catalogued as gloo | https://kgateway.dev/ |
| Cadence Workflow | — | — | skip: already catalogued as cadence | https://cadenceworkflow.io/ |

### DB-Engines top 150 — added

| resource | id | kind | status | source |
|---|---|---|---|---|
| kdb+ | kdb | timeseries-database | done | https://code.kx.com/q/ |
| Sphinx | sphinx | search-index | done | http://sphinxsearch.com/docs/current.html |
| DolphinDB | dolphindb | timeseries-database | done | https://docs.dolphindb.com/en/ |
| Apache Jackrabbit Oak | jackrabbit | content-repository | done | https://jackrabbit.apache.org/oak/docs/ |
| VMware GemFire | gemfire | cache | done | https://docs.vmware.com/en/VMware-GemFire/index.html |
| InterBase | interbase | sql-database | done | https://docwiki.embarcadero.com/InterBase/2020/en/Main_Page |
| Progress OpenEdge | openedge | sql-database | done | https://docs.progress.com/category/openedge |
| Actian Ingres | ingres | sql-database | done | https://docs.actian.com/ingres/12.0/ |
| SAP SQL Anywhere | sql-anywhere | sql-database | done | https://help.sap.com/docs/SAP_SQL_Anywhere |
| Ontotext GraphDB | graphdb | graph-database | done | https://graphdb.ontotext.com/documentation/ |
| Coveo | coveo | search-index | done | https://docs.coveo.com/ |
| InterSystems IRIS | intersystems-iris | sql-database | done | https://docs.intersystems.com/ |
| MonetDB | monetdb | data-warehouse | done | https://www.monetdb.org/documentation/ |
| Datomic | datomic | sql-database | done | https://docs.datomic.com/ |
| DataStax Enterprise | datastax-enterprise | nosql-database | done | https://docs.datastax.com/en/dse/6.9/index.html |
| EDB Postgres Advanced Server | edb-postgres | sql-database | done | https://www.enterprisedb.com/docs/epas/latest/ |
| Claris FileMaker Server | filemaker | sql-database | done | https://help.claris.com/en/server-help/ |

### DB-Engines top 150 — not placeable, retired or owned by a cloud folder

| resource | id | kind | status | source |
|---|---|---|---|---|
| Microsoft Access / dBASE | — | — | skip: desktop database file formats opened by an application, not a server | https://support.microsoft.com/en-us/access |
| Realm | — | — | skip: embedded mobile database linked into the app process | https://www.mongodb.com/docs/atlas/device-sdks/ |
| RocksDB / LevelDB / LMDB / Oracle Berkeley DB / SpatiaLite / PouchDB | — | — | skip: embedded storage libraries linked into the application | https://rocksdb.org/ |
| Ehcache / HyperSQL | — | — | skip: in-process Java caches and databases, like the existing H2 and Derby skips | https://www.ehcache.org/ |
| Apache Phoenix | — | — | skip: SQL layer over HBase; the drawn node is hbase | https://phoenix.apache.org/ |
| SAP MaxDB | — | — | skip: in maintenance only, no new development | https://help.sap.com/docs/SAP_MaxDB |
| Rockset | — | — | skip: service shut down after the 2024 acquisition | https://rockset.com/ |
| Fauna | — | — | skip: service shut down in 2025 | https://fauna.com/ |
| Oracle Essbase / Oracle NoSQL / Oracle Coherence | — | — | skip: Oracle products, they belong to the oci provider folder | https://www.oracle.com/database/ |
| IBM IMS / Netezza / Cloudant | — | — | skip: IBM products, they belong to the ibm provider folder | https://www.ibm.com/products/ims |
| Alibaba Cloud PolarDB | — | — | skip: covered by the alibabacloud provider folder | https://www.alibabacloud.com/product/polardb |
| Apache Jena - TDB | — | — | skip: the TDB store is served by Fuseki, already catalogued as fuseki | https://jena.apache.org/documentation/fuseki2/ |

### DB-Engines top 150 — genuine gaps left for a later pass

| resource | id | kind | status | source |
|---|---|---|---|---|
| Adabas | — | — | todo | https://documentation.softwareag.com/adabas/ |
| UniData / UniVerse | — | — | todo | https://www.rocketsoftware.com/products/rocket-multivalue |
| GBase | — | — | todo | https://www.gbase.cn/ |
| 4D | — | — | todo | https://developer.4d.com/docs/ |

### Independent SaaS and infrastructure — added

| resource | id | kind | status | source |
|---|---|---|---|---|
| mParticle | mparticle | third-party-api | done | https://docs.mparticle.com/ |
| Fly.io | fly-io | app-server | done | https://fly.io/docs/ |
| Render | render | app-server | done | https://render.com/docs |
| Railway | railway | app-server | done | https://docs.railway.com/ |
| Heroku | heroku | app-server | done | https://devcenter.heroku.com/categories/reference |
| Hasura | hasura | api-gateway | done | https://hasura.io/docs/2.0/index/ |
| Apollo GraphOS | apollo-graphos | api-gateway | done | https://www.apollographql.com/docs/graphos |
| Kong Konnect | kong-konnect | api-gateway | done | https://docs.konghq.com/konnect/ |
| Prefect Cloud | prefect-cloud | workflow-engine | done | https://docs.prefect.io/v3/manage/cloud/index |
| Astronomer Astro | astronomer | workflow-engine | done | https://www.astronomer.io/docs/astro/ |
| Retool | retool | app-server | done | https://docs.retool.com/ |
| Zapier | zapier | workflow-engine | done | https://help.zapier.com/hc/en-us |
| Workato | workato | workflow-engine | done | https://docs.workato.com/ |
| Pi-hole | pi-hole | dns | done | https://docs.pi-hole.net/ |

### Independent SaaS and infrastructure — not added

| resource | id | kind | status | source |
|---|---|---|---|---|
| HCP Consul Dedicated | — | — | skip: end of life 12 November 2025, clusters decommissioned | https://support.hashicorp.com/hc/en-us/articles/34859329877011-HCP-Consul-Dedicated-End-Of-Life |
| Cloudflare products | — | — | skip: covered by the cloudflare provider folder | https://developers.cloudflare.com/ |

## Counts

total 1263, todo 4, done 1038, skip 221.
