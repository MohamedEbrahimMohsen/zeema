# datadog-husky

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_query_client["Datadog app and public API clients<br/><i>web-browser</i>"]
  subgraph n_g_customer_hosts["Customer infrastructure (trust-zone)"]
    n_datadog_agent["Datadog Agent<br/><i>sdk-client</i>"]
  end
  subgraph n_g_us1["US1 (region)"]
    n_k8s_fleet["Node fleet (Cilium CNI, Watermark Pod Autoscaler)<br/><i>kubernetes</i>"]
    subgraph n_g_intake_edge["Public intake (trust-zone)"]
      n_intake_lb["Intake load balancer<br/><i>load-balancer-tier</i>"]
      n_intake_service["Intake<br/><i>container-service</i>"]
    end
    subgraph n_g_streaming_platform["Streaming Platform (system)"]
      n_intake_stream["Stream (per-priority lanes)<br/><i>kafka</i>"]
      n_dlq_lane["DLQ lane<br/><i>kafka</i>"]
      n_assigner["Assigner<br/><i>apache-helix</i>"]
      n_shard_router["Shard Router<br/><i>container-worker</i>"]
      n_sharding_allocator["Sharding Allocator<br/><i>apache-helix</i>"]
      n_autosharder["Autosharder<br/><i>container-worker</i>"]
      n_shard_stream["Shard topics<br/><i>kafka</i>"]
    end
    subgraph n_g_husky_storage["Husky storage plane (system)"]
      n_husky_writers["Husky Writers<br/><i>container-worker</i>"]
      n_husky_compactors["Husky Compactors<br/><i>container-worker</i>"]
      n_metadata_service["Metadata Service<br/><i>container-service</i>"]
      n_metadata_store["FoundationDB metadata store<br/><i>foundationdb</i>"]
      n_blob_store["Blob storage (fragments)<br/><i>s3</i>"]
    end
    subgraph n_g_husky_query["Husky query plane (system)"]
      n_query_planner["Query Planner<br/><i>container-service</i>"]
      n_query_orchestrator["Query Orchestrator<br/><i>container-service</i>"]
      n_husky_readers["Reader Service<br/><i>container-service</i>"]
      n_result_cache["Result cache<br/><i>cache-cluster</i>"]
      n_blob_range_cache["Blob range cache<br/><i>cache-cluster</i>"]
      n_predicate_cache["Predicate cache<br/><i>cache-cluster</i>"]
    end
  end
  n_datadog_agent -->|"ship logs, traces, RUM, NPM, profiles [https]"| n_intake_lb
  n_intake_lb -->|"http"| n_intake_service
  n_intake_service -.->|"publish payload, intake-in to intake-out [kafka, at-least-once]"| n_intake_stream
  n_intake_stream -.->|"consume via libstreaming [kafka, at-least-once]"| n_shard_router
  n_shard_router -->|"placement for tenant and timestamp [rpc]"| n_sharding_allocator
  n_sharding_allocator -->|"immutable shard placements [foundationdb]"| n_metadata_store
  n_autosharder -.->|"raise or lower per-tenant shard count [rpc]"| n_sharding_allocator
  n_shard_router -.->|"deterministic routing to the shard partition [kafka, at-least-once]"| n_shard_stream
  n_shard_router -.->|"poison event copied aside [kafka, at-least-once]"| n_dlq_lane
  n_assigner -.->|"multi-cluster partition assignment [rpc]"| n_shard_router
  n_assigner -.->|"multi-cluster partition assignment [rpc]"| n_husky_writers
  n_shard_stream -.->|"one writer owns a shard partition set [kafka, at-least-once]"| n_husky_writers
  n_husky_writers -->|"write fragment, page in event-ID intervals [s3]"| n_blob_store
  n_husky_writers -->|"event data and event IDs in one transaction [rpc]"| n_metadata_service
  n_husky_compactors -->|"scan small fragments, swap inputs for outputs [foundationdb]"| n_metadata_store
  n_husky_compactors -->|"1 GET per input fragment, PUT the merged fragment [s3]"| n_blob_store
  n_metadata_service -->|"chunked under the 5 s transaction limit [foundationdb]"| n_metadata_store
  n_query_client -->|"query [https]"| n_query_planner
  n_query_planner -->|"one step per time slice [rpc]"| n_query_orchestrator
  n_query_orchestrator -->|"fragment metadata, then prune [rpc]"| n_metadata_service
  n_query_orchestrator -->|"fragment queries, consistent hash plus shuffle shard [rpc]"| n_husky_readers
  n_husky_readers -->|"whole fragment-query results, 80% hit [in-process]"| n_result_cache
  n_husky_readers -->|"byte ranges, 70% hit [in-process]"| n_blob_range_cache
  n_husky_readers -->|"evaluated predicates, 3% hit, efficiency 11 [in-process]"| n_predicate_cache
  n_husky_readers -->|"byte-range GET, 0.4% of fragment queries [s3]"| n_blob_store
  n_husky_readers -.->|"partial aggregates streamed back [rpc]"| n_query_orchestrator
  n_query_orchestrator -.->|"merge sub-results progressively [rpc]"| n_query_planner
  n_k8s_fleet -.->|"Watermark Pod Autoscaler on CPU [internal]"| n_husky_readers
  n_k8s_fleet -.->|"Watermark Pod Autoscaler, shard exclusions [internal]"| n_husky_writers
```
