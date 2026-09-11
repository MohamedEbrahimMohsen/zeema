# key-value-store

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_client["Client<br/><i>sdk-client</i>"]
  subgraph n_g_hash_ring["hash-ring (system)"]
    n_n6["n6<br/><i>nosql-store</i>"]
    n_n0["n0<br/><i>nosql-store</i>"]
    n_n1["n1<br/><i>nosql-store</i>"]
    n_n2["n2<br/><i>nosql-store</i>"]
    n_n3["n3<br/><i>nosql-store</i>"]
    n_n4["n4<br/><i>nosql-store</i>"]
    n_n5["n5<br/><i>nosql-store</i>"]
    n_n7["n7<br/><i>nosql-store</i>"]
  end
  n_client -->|"read/write [kv]"| n_n6
  n_n6 -->|"response [kv]"| n_client
  n_n6 -->|"kv"| n_n0
  n_n0 -->|"kv"| n_n6
  n_n6 -->|"kv"| n_n1
  n_n1 -->|"kv"| n_n6
  n_n6 -->|"kv"| n_n2
  n_n2 -->|"kv"| n_n6
```
