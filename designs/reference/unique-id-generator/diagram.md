# unique-id-generator

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_internal["internal (trust-zone)"]
    n_worker_id_registry["Worker-id assignment<br/><i>zookeeper</i>"]
    n_entity_store["Entity store keyed by id<br/><i>cassandra</i>"]
    subgraph n_g_dc_a["dc-a (region)"]
      n_app_tier_a["Client services (datacenter A)<br/><i>container-service</i>"]
      n_id_generator_a["Snowflake (datacenter A)<br/><i>snowflake-id</i>"]
    end
    subgraph n_g_dc_b["dc-b (region)"]
      n_app_tier_b["Client services (datacenter B)<br/><i>container-service</i>"]
      n_id_generator_b["Snowflake (datacenter B)<br/><i>snowflake-id</i>"]
    end
  end
  n_app_tier_a -->|"next id, 2 ms [thrift]"| n_id_generator_a
  n_app_tier_b -->|"next id, 2 ms [thrift]"| n_id_generator_b
  n_id_generator_a -->|"datacenter and machine id at startup [zookeeper]"| n_worker_id_registry
  n_id_generator_b -->|"datacenter and machine id at startup [zookeeper]"| n_worker_id_registry
  n_app_tier_a -->|"write row keyed by the id [cql]"| n_entity_store
  n_app_tier_b -->|"write row keyed by the id [cql]"| n_entity_store
```
