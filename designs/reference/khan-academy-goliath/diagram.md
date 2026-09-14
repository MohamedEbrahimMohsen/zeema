# khan-academy-goliath

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_browser_client["Learner browser (React SPA)<br/><i>web-browser</i>"]
  n_youtube["YouTube<br/><i>supplier-api</i>"]
  n_video_fallback_store["Amazon S3 (video fallback origin, served through Fastly)<br/><i>s3</i>"]
  subgraph n_g_fastly_edge_network["Fastly edge (point-of-presence)"]
    n_fastly_edge["Fastly<br/><i>fastly</i>"]
  end
  subgraph n_g_google_cloud["Google Cloud (system)"]
    subgraph n_g_app_engine["Google App Engine (trust-zone)"]
      n_react_ssr["React server-side rendering<br/><i>container-service</i>"]
      n_graphql_gateway["graphql-gateway (Apollo Federation)<br/><i>envoy-gateway</i>"]
      n_python_monolith["webapp (Python 2 monolith, ~1.04M lines)<br/><i>google-app-engine-standard</i>"]
      n_go_services["Go services (~40, gqlgen)<br/><i>google-app-engine-standard</i>"]
      n_content_service["content service (Go)<br/><i>google-app-engine-standard</i>"]
      n_migration_config["@migrate state: manual / side-by-side / canary / migrated<br/><i>unleash</i>"]
      n_publish_job["content publish (frozen models, last_published_commit SHA)<br/><i>container-worker</i>"]
    end
    subgraph n_g_gcp_data["Datastore and Memcache (trust-zone)"]
      n_datastore["Google Cloud Datastore (user, progress, content entities)<br/><i>nosql-store</i>"]
      n_content_revisions["VideoRevision / ArticleRevision entities (Datastore)<br/><i>nosql-store</i>"]
      n_shared_memcache["Google Cloud Memcache (queries, preferences, sessions)<br/><i>memcached</i>"]
      n_content_memcache["content store: (content version, content id) -&gt; content item<br/><i>memcached</i>"]
    end
    subgraph n_g_analytics["Analytics platform (GKE, per-pipeline service accounts) (trust-zone)"]
      n_exercise_feed_topic["exercise feed topic<br/><i>google-pubsub</i>"]
      n_exercise_feed_service["exercise-feed service (App Engine flexible, push subscription)<br/><i>container-worker</i>"]
      n_bigquery["BigQuery<br/><i>bigquery</i>"]
      n_dataflow["Cloud Dataflow pipelines<br/><i>google-dataflow</i>"]
      n_khanflow["Khanflow (Airflow 2.0 on GKE)<br/><i>airflow</i>"]
      n_analytics_jobs["pipeline tasks (KhanflowPythonOperator)<br/><i>container-worker</i>"]
      n_user_key_store["per-user encryption key table (deleting the key erases the user)<br/><i>hashicorp-vault</i>"]
    end
  end
  n_browser_client -->|"first point of contact for all requests [https]"| n_fastly_edge
  n_fastly_edge -->|"miss: server-rendered page [https]"| n_react_ssr
  n_fastly_edge -->|"miss: GraphQL query [https]"| n_graphql_gateway
  n_fastly_edge -->|"video fallback where YouTube is blocked [https]"| n_video_fallback_store
  n_browser_client -->|"lesson video playback [https]"| n_youtube
  n_react_ssr -->|"page data during render [graphql]"| n_graphql_gateway
  n_graphql_gateway -->|"per-field @migrate state and canary percentage [http]"| n_migration_config
  n_graphql_gateway -->|"fields still on Python; side-by-side returns this result [graphql]"| n_python_monolith
  n_graphql_gateway -->|"query plan fan-out; canary share of users [graphql]"| n_go_services
  n_graphql_gateway -->|"content fields [graphql]"| n_content_service
  n_go_services -->|"300+ cross-service request shapes (genqlient) [graphql]"| n_content_service
  n_python_monolith -->|"datastore-rpc"| n_datastore
  n_go_services -->|"ported models; contention warnings ~100/hr to near zero [datastore-rpc]"| n_datastore
  n_python_monolith -->|"common queries, user preferences, session data [memcached]"| n_shared_memcache
  n_go_services -->|"memcached"| n_shared_memcache
  n_content_service -->|"items by (version, id), batched with get_many_by_key() [memcached]"| n_content_memcache
  n_content_service -->|"editing head on miss [datastore-rpc]"| n_content_revisions
  n_publish_job -->|"read latest revisions [datastore-rpc]"| n_content_revisions
  n_publish_job -->|"publish by SHA: whole site updated in ~1 second [memcached]"| n_content_memcache
  n_python_monolith -.->|"exercise attempt events [pubsub, at-least-once]"| n_exercise_feed_topic
  n_go_services -.->|"exercise attempt events [pubsub, at-least-once]"| n_exercise_feed_topic
  n_exercise_feed_topic -.->|"push subscription, HMAC digest validated [https, at-least-once]"| n_exercise_feed_service
  n_exercise_feed_service -.->|"insert; creates the destination table if missing [bigquery]"| n_bigquery
  n_dataflow -.->|"managed pipelines into the warehouse [bigquery]"| n_bigquery
  n_khanflow -.->|"orchestrated pipeline runs [gcp-api]"| n_dataflow
  n_khanflow -.->|"KhanflowBigQueryOperator tasks [bigquery]"| n_bigquery
  n_khanflow -.->|"DAG tasks, one service account per pipeline [gcp-api]"| n_analytics_jobs
  n_analytics_jobs -->|"read encrypted personal data [bigquery]"| n_bigquery
  n_analytics_jobs -->|"per-user key lookup [https]"| n_user_key_store
```
