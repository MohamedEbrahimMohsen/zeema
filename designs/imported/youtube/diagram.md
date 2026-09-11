# youtube

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_user["User<br/><i>user-device</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_api_servers["API servers<br/><i>container-service</i>"]
  n_metadata_cache["Metadata Cache<br/><i>cache-cluster</i>"]
  n_metadata_db["Metadata DB<br/><i>relational-database</i>"]
  n_original_storage["Original storage<br/><i>blob-store</i>"]
  n_transcoding_servers["Transcoding servers<br/><i>container-service</i>"]
  n_transcoded_storage["Transcoded storage<br/><i>blob-store</i>"]
  n_cdn["CDN<br/><i>content-delivery-network</i>"]
  n_completion_queue["Completion queue<br/><i>message-queue</i>"]
  n_completion_handler["Completion handler<br/><i>container-worker</i>"]
  n_preprocessor["Preprocessor<br/><i>container-service</i>"]
  n_dag_scheduler["DAG scheduler<br/><i>container-service</i>"]
  n_resource_manager["Resource manager<br/><i>container-service</i>"]
  n_task_workers["Task workers<br/><i>container-worker</i>"]
  n_temporary_storage["Temporary storage<br/><i>blob-store</i>"]
  n_encoded_video["Encoded video<br/><i>blob-store</i>"]
  n_user -->|"https"| n_original_storage
  n_original_storage -->|"https"| n_transcoding_servers
  n_transcoding_servers -->|"https"| n_transcoded_storage
  n_transcoding_servers -.->|"transcoding complete [amqp, at-least-once]"| n_completion_queue
  n_transcoded_storage -->|"https"| n_cdn
  n_completion_queue -.->|"amqp, at-least-once"| n_completion_handler
  n_completion_handler -->|"sql"| n_metadata_db
  n_completion_handler -->|"cache"| n_metadata_cache
  n_api_servers -->|"cache"| n_metadata_cache
  n_api_servers -->|"sql"| n_metadata_db
  n_api_servers -->|"https"| n_load_balancer
  n_load_balancer -->|"https"| n_user
  n_user -->|"Update metadata [https]"| n_load_balancer
  n_load_balancer -->|"https"| n_api_servers
  n_user -->|"streaming video [https]"| n_cdn
  n_preprocessor -->|"https"| n_dag_scheduler
  n_preprocessor -->|"https"| n_temporary_storage
  n_dag_scheduler -->|"https"| n_resource_manager
  n_resource_manager -->|"https"| n_task_workers
  n_task_workers -->|"https"| n_temporary_storage
  n_task_workers -->|"https"| n_encoded_video
```
