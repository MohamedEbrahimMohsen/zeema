# canva-uploads

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_canva_client["Canva client (web, mobile, WebView)<br/><i>web-browser</i>"]
  subgraph n_g_edge["Cloudflare edge (trust-zone)"]
    n_cloudflare_waf["Cloudflare WAF / Bot Management<br/><i>cloudflare-waf</i>"]
    n_cloudflare_cdn["Cloudflare CDN + Workers<br/><i>cloudflare-cdn</i>"]
  end
  subgraph n_g_backend["JVM backend microservices (trust-zone)"]
    n_client_alb["Elastic Load Balancer<br/><i>alb</i>"]
    n_media_service["Media service<br/><i>vm-service</i>"]
    n_dual_read_comparator["Dual read and comparison<br/><i>vm-service</i>"]
    n_feature_flags["Flag system<br/><i>flipt</i>"]
    n_replication_worker["Replication worker<br/><i>container-worker</i>"]
    n_backfill_scanner["Backfill scanner<br/><i>container-worker</i>"]
    n_phash_worker["pHash computation<br/><i>container-worker</i>"]
    subgraph n_g_compute_isolation["Compute Service autoscaling group (system)"]
      n_compute_service_elb["Compute Service ELB<br/><i>aws-classic-load-balancer</i>"]
      n_compute_service["Compute Service (c4.large)<br/><i>vm-service</i>"]
    end
  end
  subgraph n_g_data["AWS data stores (trust-zone)"]
    n_sqs_high_priority["High-priority replication queue<br/><i>sqs</i>"]
    n_sqs_low_priority["Low-priority replication queue<br/><i>sqs</i>"]
    n_mysql_primary["media.primary (RDS MySQL 5.6)<br/><i>aws-rds</i>"]
    n_mysql_primary_1["media.primary-1 (second shard)<br/><i>aws-rds</i>"]
    n_mysql_replicas["RDS read replicas<br/><i>aws-rds</i>"]
    n_dynamodb_media["DynamoDB media table<br/><i>dynamodb</i>"]
    n_dynamodb_gsi["Composite global secondary indexes<br/><i>dynamodb</i>"]
    n_content_matching_index["Perceptual-hash content matching index<br/><i>dynamodb</i>"]
    n_s3_standard["S3 Standard (fresh uploads and stock library)<br/><i>s3</i>"]
    n_s3_standard_ia["S3 Standard-IA<br/><i>s3</i>"]
    n_s3_glacier_ir["S3 Glacier Instant Retrieval<br/><i>aws-s3-glacier</i>"]
  end
  n_canva_client -->|"ingress: WAF, bot management, DDoS [https]"| n_cloudflare_waf
  n_cloudflare_waf -->|"filtered traffic [https]"| n_cloudflare_cdn
  n_cloudflare_cdn -->|"origin [https]"| n_client_alb
  n_cloudflare_cdn -->|"signed-URL media fetch [https]"| n_s3_standard
  n_client_alb -->|"media API [http]"| n_media_service
  n_media_service -->|"store bytes, record storage location [s3]"| n_s3_standard
  n_media_service -->|"shard 0: media id below cut point [mysql]"| n_mysql_primary
  n_media_service -->|"shard 1: media id at or above cut point [mysql]"| n_mysql_primary_1
  n_mysql_primary -.->|"replication rate was the write ceiling [mysql-replication, at-least-once]"| n_mysql_replicas
  n_media_service -.->|"payload-free create/update notification [sqs, at-least-once]"| n_sqs_high_priority
  n_media_service -.->|"payload-free read notification (lazy migration) [sqs, at-least-once]"| n_sqs_low_priority
  n_backfill_scanner -->|"scan all media, newest first [mysql]"| n_mysql_primary
  n_backfill_scanner -.->|"enqueue behind live traffic [sqs, at-least-once]"| n_sqs_low_priority
  n_sqs_high_priority -.->|"live changes first [sqs, at-least-once]"| n_replication_worker
  n_sqs_low_priority -.->|"lazy and backfill [sqs, at-least-once]"| n_replication_worker
  n_replication_worker -->|"read current state, not the message body [mysql]"| n_mysql_primary
  n_replication_worker -->|"write only when it differs [dynamodb]"| n_dynamodb_media
  n_media_service -->|"post-cutover read/write path [dynamodb]"| n_dynamodb_media
  n_media_service -->|"list by owner via concatenated composite key [dynamodb]"| n_dynamodb_gsi
  n_media_service -->|"dual read on live traffic [http]"| n_dual_read_comparator
  n_dual_read_comparator -->|"old store result [mysql]"| n_mysql_primary
  n_dual_read_comparator -->|"new store result, compared [dynamodb]"| n_dynamodb_media
  n_media_service -->|"which store serves reads; revert in seconds [https]"| n_feature_flags
  n_media_service -->|"sign URL / hash password; cannot be made async [http]"| n_compute_service_elb
  n_compute_service_elb -->|"http"| n_compute_service
  n_compute_service -->|"SHA1-signed temporary URL for private media [https]"| n_canva_client
  n_media_service -.->|"hash the uploaded image [http, at-least-once]"| n_phash_worker
  n_phash_worker -->|"one write per hash segment [dynamodb]"| n_content_matching_index
  n_media_service -->|"one query per hash segment, then Hamming filter [dynamodb]"| n_content_matching_index
  n_s3_standard -.->|"lifecycle transition at 30 days [s3-lifecycle]"| n_s3_standard_ia
  n_s3_standard_ia -.->|"buckets averaging 400 KB or more [s3-lifecycle]"| n_s3_glacier_ir
```
