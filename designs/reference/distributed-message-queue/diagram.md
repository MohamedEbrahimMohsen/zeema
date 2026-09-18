# distributed-message-queue

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_cluster["cluster (region)"]
    subgraph n_g_producers["producers (trust-zone)"]
      n_producer_app["Producer application<br/><i>container-service</i>"]
      n_producer_client["Producer client (buffer, partitioner, retries)<br/><i>sdk-client</i>"]
    end
    subgraph n_g_brokers["brokers (trust-zone)"]
      n_quota_enforcer["Broker quotas (byte rate, request rate)<br/><i>in-process-limiter</i>"]
      n_broker_cluster["Broker cluster: partitioned segment logs, leader and ISR<br/><i>kafka</i>"]
      n_segment_storage["Segment files on broker disks<br/><i>block-volume</i>"]
      n_offsets_topic["__consumer_offsets (state storage)<br/><i>kafka</i>"]
      n_txn_log_topic["Transaction log (internal topic)<br/><i>kafka</i>"]
      n_dead_letter_topic["Dead-letter topic (extension)<br/><i>kafka</i>"]
    end
    subgraph n_g_control_plane["control-plane (trust-zone)"]
      n_group_coordinator["Consumer group coordinator (broker role)<br/><i>container-service</i>"]
      n_transaction_coordinator["Transaction coordinator (broker role)<br/><i>container-service</i>"]
      n_coordination_service["Coordination service and metadata storage (ZooKeeper ensemble or KRaft quorum)<br/><i>zookeeper</i>"]
    end
    subgraph n_g_consumers["consumers (trust-zone)"]
      n_consumer_client["Consumer client (pull by offset, read_committed)<br/><i>sdk-client</i>"]
      n_consumer_app["Consumer application<br/><i>container-worker</i>"]
      n_streams_app["Stream processing application (exactly-once)<br/><i>kafka-streams</i>"]
      n_remote_store["Remote store updated by a side effect<br/><i>supplier-api</i>"]
    end
  end
  n_producer_app -->|"send record [in-process]"| n_producer_client
  n_producer_client -.->|"produce: keyed, batched, acks=all, producer id and sequence number [kafka, exactly-once]"| n_broker_cluster
  n_quota_enforcer -->|"throttle produce and fetch per (user, client-id) [kafka]"| n_broker_cluster
  n_broker_cluster -->|"append to the segment log, page cache [file]"| n_segment_storage
  n_broker_cluster -->|"cluster metadata, controller and partition leader election [zookeeper]"| n_coordination_service
  n_producer_client -->|"initTransactions, begin, commit [kafka]"| n_transaction_coordinator
  n_transaction_coordinator -.->|"transaction state [kafka, at-least-once]"| n_txn_log_topic
  n_transaction_coordinator -->|"write commit or abort markers into every touched partition [kafka]"| n_broker_cluster
  n_transaction_coordinator -->|"coordinator placement [zookeeper]"| n_coordination_service
  n_group_coordinator -->|"group membership [zookeeper]"| n_coordination_service
  n_consumer_client -.->|"join group, heartbeat, rebalance [kafka, at-least-once]"| n_group_coordinator
  n_group_coordinator -.->|"group state, compacted [kafka, at-least-once]"| n_offsets_topic
  n_consumer_client -->|"fetch from offset, read_committed [kafka]"| n_broker_cluster
  n_consumer_client -.->|"commit offset [kafka, at-least-once]"| n_offsets_topic
  n_consumer_client -->|"deliver records [in-process]"| n_consumer_app
  n_consumer_app -.->|"park messages that cannot be processed [kafka, at-least-once]"| n_dead_letter_topic
  n_broker_cluster -.->|"input topics, read_committed [kafka, exactly-once]"| n_streams_app
  n_streams_app -.->|"output topics, changelog and consumer offsets in one transaction [kafka, exactly-once]"| n_broker_cluster
  n_streams_app -.->|"side effect outside the transaction, so it is made idempotent [https, at-least-once]"| n_remote_store
  n_dead_letter_topic -.->|"replay after the defect is fixed [kafka, at-least-once]"| n_consumer_app
```
