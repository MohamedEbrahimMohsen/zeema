# duolingo-backend

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_learner_client["Mobile and web clients<br/><i>mobile-app</i>"]
  n_apns["APNs<br/><i>apns</i>"]
  n_fcm["FCM<br/><i>fcm</i>"]
  subgraph n_g_aws_primary["AWS primary region (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_alb["Elastic / Application Load Balancer<br/><i>alb</i>"]
      n_migration_dns["Weighted DNS canary<br/><i>route53</i>"]
    end
    subgraph n_g_core["core (trust-zone)"]
      n_api_servers["API servers<br/><i>container-service</i>"]
      n_session_generator["Session Generator<br/><i>container-service</i>"]
      n_birdbrain["Birdbrain<br/><i>tensorflow-serving</i>"]
      n_course_build_job["Offline course build<br/><i>container-worker</i>"]
      n_ecs["Amazon ECS (500+ services)<br/><i>aws-ecs</i>"]
      n_eks["Amazon EKS<br/><i>aws-eks</i>"]
      n_argo_cd["Argo CD<br/><i>argo-cd</i>"]
      n_observability["Observability plane (Jaeger, CloudWatch, Prometheus, Athena)<br/><i>observability-stack</i>"]
      n_course_cache["Session Generator in-memory course cache<br/><i>cache-cluster</i>"]
      n_course_data["Course data files<br/><i>s3</i>"]
      n_proficiency_store["Birdbrain proficiency store<br/><i>dynamodb</i>"]
    end
    subgraph n_g_superb_owl["Superb Owl dedicated ECS cluster (system)"]
      n_campaign_api["Superb Owl campaign API<br/><i>container-service</i>"]
      n_interim_workers["Interim notification workers<br/><i>container-worker</i>"]
      n_push_workers["Push publishing workers<br/><i>container-worker</i>"]
      n_dispatch_queue["SQS FIFO, first tier<br/><i>sqs</i>"]
      n_batch_queue["SQS FIFO, second tier<br/><i>sqs</i>"]
      n_campaign_staging["Campaign S3 staging<br/><i>s3</i>"]
      n_campaign_lists["Campaign user-list store<br/><i>dynamodb</i>"]
    end
  end
  n_learner_client -->|"lesson requests [https]"| n_alb
  n_alb -->|"X-Amzn-Trace-Id stamped at the edge [http]"| n_api_servers
  n_api_servers -->|"generate lesson, learner state injected into the request [http]"| n_session_generator
  n_api_servers -->|"completed exercise outcomes [http]"| n_birdbrain
  n_session_generator -->|"course data lookup [in-process]"| n_course_cache
  n_session_generator -->|"download course data when the in-memory cache expires [https]"| n_course_data
  n_session_generator -->|"exercises at the right difficulty for this learner [http]"| n_birdbrain
  n_course_build_job -.->|"course data serialised offline into files [s3, at-least-once]"| n_course_data
  n_birdbrain -->|"proficiency writes buffered in memory with an LRU policy [dynamodb]"| n_proficiency_store
  n_migration_dns -->|"decreasing weight during the migration [dns]"| n_ecs
  n_migration_dns -->|"weight raised to 99%, ECS copy kept for rollback [dns]"| n_eks
  n_argo_cd -.->|"GitOps blue-green from GitHub [kubernetes, at-least-once]"| n_eks
  n_campaign_api -.->|"campaign user-ID list, created days ahead [dynamodb, at-least-once]"| n_campaign_lists
  n_campaign_api -.->|"asynchronous fetch DynamoDB to S3 [s3, at-least-once]"| n_campaign_staging
  n_campaign_staging -->|"payloads preloaded into worker memory during scale-up [s3]"| n_interim_workers
  n_campaign_api -.->|"go button; 5-minute FIFO dedup window [sqs, exactly-once]"| n_dispatch_queue
  n_dispatch_queue -.->|"coarse campaign messages [sqs, at-least-once]"| n_interim_workers
  n_interim_workers -.->|"batches of 500 iOS / 250 Android, under the 120K/s in-flight limit [sqs, at-least-once]"| n_batch_queue
  n_batch_queue -.->|"batched user groups [sqs, at-least-once]"| n_push_workers
  n_push_workers -.->|"APNs batch API [https]"| n_apns
  n_push_workers -.->|"FCM batch API [https]"| n_fcm
  n_api_servers -.->|"traces tagged with the cluster name [http, at-least-once]"| n_observability
  n_session_generator -.->|"traces and metrics [http, at-least-once]"| n_observability
  n_push_workers -.->|"per-message process times [http, at-least-once]"| n_observability
```
