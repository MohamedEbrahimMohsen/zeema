# Alibaba Cloud inventory

Official product directory: <https://www.alibabacloud.com/product> and the Alibaba Cloud help
centre <https://www.alibabacloud.com/help>. Ids are `alibaba-<product>`.

Status: `done` = component exists in `components/alibabacloud/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Analytics

| resource | id | kind | status | source |
|---|---|---|---|---|
| AnalyticDB | alibaba-analyticdb | data-warehouse | done | https://www.alibabacloud.com/help/en/analyticdb/ |
| ApsaraDB for ClickHouse | alibaba-clickhouse | data-warehouse | done | https://www.alibabacloud.com/help/en/clickhouse/ |
| E-MapReduce | alibaba-e-mapreduce | big-data-cluster | done | https://www.alibabacloud.com/help/en/emr/ |
| OpenSearch | alibaba-open-search | search-index | done | https://www.alibabacloud.com/help/en/open-search/ |

## Application

| resource | id | kind | status | source |
|---|---|---|---|---|
| API Gateway | alibaba-api-gateway | api-gateway | done | https://www.alibabacloud.com/help/en/api-gateway/ |
| Intelligent Robot | alibaba-intelligent-robot | ai-service | done | https://www.alibabacloud.com/product/bot |
| Blockchain as a Service | alibaba-blockchain-as-a-service | ledger | done | https://www.alibabacloud.com/help/en/blockchain-as-a-service/latest/architecture |
| Cloud Call Center | alibaba-cloud-call-center | contact-center | done | https://www.alibabacloud.com/product/cloud-call-center |
| Alibaba Cloud DevOps Flow | alibaba-devops-flow | ci-pipeline | done | https://www.alibabacloud.com/help/en/yunxiao/ |
| DirectMail | alibaba-direct-mail | notification-service | done | https://www.alibabacloud.com/help/en/directmail/ |
| Simple Log Service | alibaba-log-service | monitoring | done | https://www.alibabacloud.com/help/en/sls/ |
| Simple Message Queue (formerly MNS) | alibaba-mns | queue | done | https://www.alibabacloud.com/help/en/mns/ |
| Performance Testing Service | alibaba-pts | client | done | https://www.alibabacloud.com/help/en/pts/ |
| Smart Conversation Analysis | alibaba-smart-conversation-analysis | ai-service | done | https://www.alibabacloud.com/product/sca |
| YIDA | alibaba-yida | app-server | done | https://www.alibabacloud.com/product/yida |

## Communication

| resource | id | kind | status | source |
|---|---|---|---|---|
| Mobile Push | alibaba-mobile-push | notification-service | done | https://www.alibabacloud.com/help/en/mobile-push/ |

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Auto Scaling | alibaba-auto-scaling | virtual-machine | done | https://www.alibabacloud.com/help/en/auto-scaling/ |
| Container Registry | alibaba-container-registry | container-registry | done | https://www.alibabacloud.com/help/en/acr/ |
| Container Service for Kubernetes | alibaba-ack | container-orchestrator | done | https://www.alibabacloud.com/help/en/ack/ |
| Elastic Compute Service | alibaba-ecs | virtual-machine | done | https://www.alibabacloud.com/help/en/ecs/ |
| Elastic Container Instance | alibaba-eci | app-server | done | https://www.alibabacloud.com/help/en/eci/ |
| Elastic High Performance Computing | alibaba-e-hpc | big-data-cluster | done | https://www.alibabacloud.com/help/en/ehpc/ |
| Alibaba Cloud Elasticsearch | alibaba-elasticsearch | search-index | done | https://www.alibabacloud.com/help/en/es/ |
| Function Compute | alibaba-function-compute | app-server | done | https://www.alibabacloud.com/help/en/fc/ |
| CloudOps Orchestration Service | alibaba-oos | workflow-engine | done | https://www.alibabacloud.com/help/en/oos/ |
| Server Load Balancer | alibaba-slb | load-balancer | done | https://www.alibabacloud.com/help/en/slb/ |
| Serverless App Engine | alibaba-sae | app-server | done | https://www.alibabacloud.com/help/en/sae/ |
| Simple Application Server | alibaba-simple-application-server | virtual-machine | done | https://www.alibabacloud.com/help/en/simple-application-server/ |

## Database

| resource | id | kind | status | source |
|---|---|---|---|---|
| ApsaraDB for HBase | alibaba-apsaradb-hbase | nosql-database | done | https://www.alibabacloud.com/help/en/hbase/ |
| ApsaraDB for Memcache | alibaba-apsaradb-memcache | cache | done | https://www.alibabacloud.com/help/en/apsaradb-for-memcache/ |
| ApsaraDB for MongoDB | alibaba-apsaradb-mongodb | nosql-database | done | https://www.alibabacloud.com/help/en/mongodb/ |
| ApsaraDB for OceanBase | alibaba-oceanbase | sql-database | done | https://www.alibabacloud.com/help/en/apsaradb-for-oceanbase |
| PolarDB | alibaba-polardb | sql-database | done | https://www.alibabacloud.com/help/en/polardb/product-overview/ |
| ApsaraDB for Redis | alibaba-apsaradb-redis | cache | done | https://www.alibabacloud.com/help/en/redis/product-overview/what-is-apsaradb-for-redis |
| Data Transmission Service | alibaba-dts | change-data-capture | done | https://www.alibabacloud.com/help/en/dts/product-overview/what-is-dts |
| Database Backup | alibaba-dbs | backup-service | done | https://www.alibabacloud.com/product/database-backup |
| PolarDB-X | alibaba-polardb-x | sql-database | done | https://www.alibabacloud.com/help/en/polardb/polardb-for-xscale/scenarios-1 |
| Graph Database | alibaba-graph-database | graph-database | done | https://help.aliyun.com/en/gdb/product-overview/ |
| ApsaraDB RDS | alibaba-rds | sql-database | done | https://www.alibabacloud.com/help/en/rds/product-overview/what-is-apsaradb-rds |

## Iot

| resource | id | kind | status | source |
|---|---|---|---|---|
| IoT Device ID | — | — | skip: retired, the documentation is published as "IoT Device ID (Deprecated)" | https://help.aliyun.com/en/iot-device-id/ |
| Alibaba Cloud Link WAN | alibaba-link-wan | iot-hub | done | https://help.aliyun.com/en/link-wan/product-overview/hybrid-gateway |
| IoT Platform | alibaba-iot-platform | iot-hub | done | https://www.alibabacloud.com/help/en/iot/product-overview/what-is-iot-platform |

## Network

| resource | id | kind | status | source |
|---|---|---|---|---|
| Alibaba Cloud CDN | alibaba-cdn | cdn | done | https://www.alibabacloud.com/help/en/cdn/product-overview/what-is-alibaba-cloud-cdn |
| Cloud Enterprise Network | alibaba-cen | network-fabric | done | https://www.alibabacloud.com/help/en/cen/product-overview/what-is-cen |
| Elastic IP Address | alibaba-eip | network-fabric | done | https://www.alibabacloud.com/help/en/eip/product-overview/what-is-eip |
| Express Connect | alibaba-express-connect | network-fabric | done | https://www.alibabacloud.com/help/en/express-connect/product-overview/what-is-express-connect |
| NAT Gateway | alibaba-nat-gateway | nat-gateway | done | https://www.alibabacloud.com/help/en/nat-gateway/product-overview/what-is-nat-gateway |
| Smart Access Gateway | alibaba-smart-access-gateway | edge-appliance | done | https://www.alibabacloud.com/help/en/sag/product-overview/what-is-sag |
| Virtual Private Cloud | alibaba-vpc | network-fabric | done | https://www.alibabacloud.com/help/en/vpc/product-overview/what-is-a-vpc |
| VPN Gateway | alibaba-vpn-gateway | vpn-gateway | done | https://www.alibabacloud.com/help/en/vpn-gateway/ |

## Security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Anti-DDoS Pro | alibaba-anti-ddos-pro | ddos-protection | done | https://www.alibabacloud.com/help/en/anti-ddos/anti-ddos-pro-and-premium/product-overview/what-are-anti-ddos-pro-and-anti-ddos-premium |
| Fraud Detection | alibaba-fraud-detection | ai-service | done | https://www.alibabacloud.com/help/en/fraud-detection/product-overview/overview |
| Bastionhost | alibaba-bastionhost | bastion-host | done | https://www.alibabacloud.com/help/en/bh/bastionhost/user-guide/o-and-m-auditing/ |
| Cloud Firewall | alibaba-cloud-firewall | firewall | done | https://www.alibabacloud.com/help/en/cloud-firewall/cloudfirewall/user-guide/introduction-of-intrusion-protection-principle |
| Content Moderation | alibaba-content-moderation | ai-service | done | https://www.alibabacloud.com/help/en/content-moderation/ |
| Data Encryption Service | alibaba-data-encryption-service | key-management | done | https://www.alibabacloud.com/help/en/kms/key-management-service/support/overview-12 |
| Database Audit | — | — | skip: end of sale, the console page is labelled "Traditional data audit (stop new purchase)" and auditing now ships inside Data Security Center | https://help.aliyun.com/en/dsc/database-audit/product-overview/what-is-dbaudit |
| Game Shield | alibaba-game-shield | ddos-protection | done | https://www.alibabacloud.com/product/gameshield |
| ID Verification | alibaba-id-verification | ai-service | done | https://www.alibabacloud.com/product/id-verification |
| Security Center | alibaba-security-center | monitoring | done | https://help.aliyun.com/en/security-center/product-overview/what-is-security-center |
| Certificate Management Service | alibaba-certificate-management | key-management | done | https://www.alibabacloud.com/help/en/ssl-certificate/ |
| Web Application Firewall | alibaba-waf | waf | done | https://www.alibabacloud.com/help/en/waf/ |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Storage Gateway | alibaba-cloud-storage-gateway | edge-appliance | done | https://www.alibabacloud.com/help/en/cloud-storage-gateway/ |
| Apsara File Storage for HDFS | alibaba-file-storage-hdfs | file-storage | done | https://www.alibabacloud.com/help/en/oss/support/apsara-file-storage-for-hdfs |
| Apsara File Storage NAS | alibaba-nas | file-storage | done | https://www.alibabacloud.com/help/en/nas/ |
| Cloud Backup | alibaba-hbr | backup-service | done | https://www.alibabacloud.com/help/en/cloud-backup/ |
| Hybrid Cloud Disaster Recovery | — | — | skip: retired as a standalone product, folded into Cloud Backup ECS disaster recovery | https://www.alibabacloud.com/help/en/cloud-backup/user-guide/what-is-ecs-disaster-recovery |
| Intelligent Media Management | alibaba-imm | media-transcoder | done | https://www.alibabacloud.com/help/en/imm/ |
| Object Storage Service | alibaba-oss | object-store | done | https://www.alibabacloud.com/help/en/oss/ |
| Tablestore | alibaba-tablestore | nosql-database | done | https://www.alibabacloud.com/help/en/tablestore/ |

## Web

| resource | id | kind | status | source |
|---|---|---|---|---|
| Alibaba Cloud DNS | alibaba-dns | dns | done | https://www.alibabacloud.com/help/en/dns/ |
| Domain Names | alibaba-domains | dns | done | https://www.alibabacloud.com/help/en/dws/ |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Data Lake Analytics | — | — | skip: skip: discontinued from 1 January 2024, lake analytics folded into AnalyticDB for MySQL | https://www.alibabacloud.com/help/en/data-lake-analytics/latest/notice-stop-selling-cloud-native-data-lake-analysis-dla |
| Node.js Performance Platform | — | — | skip: skip: Node.js runtime profiling and troubleshooting tooling (alinode), no product on the international site | https://www.alibabacloud.com/blog/node-js-application-troubleshooting-manual---node-js-performance-platform-user-guide_594966 |
| RDC (R&D Collaboration) | — | — | skip: skip: RDC ceased service 30 October 2024, replaced by Alibaba Cloud DevOps (covered by alibaba-devops-flow) | https://help.aliyun.com/zh/yunxiao/product-overview/old-cloud-efficiency-rdc-migration-instructions |
| Batch Compute | — | — | skip: skip: deprecated, the documentation set is published as Batch Compute (Deprecated) | https://www.alibabacloud.com/help/en/batchcompute/ |
| Resource Orchestration Service | — | — | skip: skip: deployment control plane (same call as the AWS CloudFormation inventory row) | https://www.alibabacloud.com/help/en/ros/ |
| Web App Service | — | — | skip: skip: end of service 19 July 2023 (Web+), migrate to EDAS | https://www.alibabacloud.com/en/notice/web_app_service_end_of_service_announcement_22d |
| ApsaraDB for Cassandra | — | — | skip: skip: discontinued 17 October 2023, integrated into Lindorm | https://www.alibabacloud.com/help/en/apsaradb-for-cassandra/latest/cassandra-delisting-notice |
| ApsaraDB RDS for PostgreSQL | — | — | skip: skip: engine option of ApsaraDB RDS (alibaba-rds), a property not a separate component | https://www.alibabacloud.com/help/en/rds/ |
| ApsaraDB RDS for PPAS | — | — | skip: skip: end of sale 16 May 2021, end of service 16 May 2022, replaced by PolarDB for Oracle | https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/end-of-service-for-apsaradb-rds-for-ppas |
| ApsaraDB RDS for SQL Server | — | — | skip: skip: engine option of ApsaraDB RDS (alibaba-rds), a property not a separate component | https://www.alibabacloud.com/help/en/rds/ |
| Data Management (DMS) | — | — | skip: skip: browser-based database console and administration tool, not a runtime node | https://www.alibabacloud.com/help/en/dms/ |
| HybridDB for MySQL | — | — | skip: skip: legacy name, superseded by AnalyticDB for MySQL (alibaba-analyticdb) | https://www.alibabacloud.com/products/hybriddb-for-mysql |
| IoT Mobile Connection Package | — | — | skip: skip: purchased cellular data/SIM plan, not a drawn resource | https://www.alibabacloud.com/product/iot-connect |
| Anti-Bot Service | — | — | skip: skip: sold as the Bot Management module of WAF 3.0, not a standalone resource | https://www.alibabacloud.com/help/en/waf/web-application-firewall-3-0/user-guide/enable-and-configure-the-bot-management-module |
| Anti-DDoS Basic | — | — | skip: skip: free baseline mitigation enabled on every public IP, not a separate resource | https://www.alibabacloud.com/help/en/ddos-protection/ |
| Cloud Security Scanner | — | — | skip: skip: on-demand web vulnerability scanning, folded into Security Center | https://www.alibabacloud.com/help/en/security-center/ |
| Crowdsourced Security Testing | — | — | skip: skip: human penetration-testing engagement, not a deployable resource | https://www.alibabacloud.com/product/crowdsourced-security-testing |
| Managed Security Service | — | — | skip: skip: professional services engagement, not a node | https://www.alibabacloud.com/product/managed-security-service |
| Server Guard | — | — | skip: skip: legacy name (Aegis) for Security Center, no longer available for purchase | https://www.alibabacloud.com/help/en/security-center/ |

## Counts

total 91, todo 0, done 69, skip 22.
