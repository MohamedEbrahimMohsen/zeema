# discord-messages

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_desktop_client["Discord desktop app<br/><i>desktop-app</i>"]
  n_web_client["Discord web app<br/><i>web-browser</i>"]
  n_mobile_client["Discord mobile app<br/><i>mobile-app</i>"]
  subgraph n_g_gateway["gateway (system)"]
    n_session_gateway["Session processes<br/><i>websocket-gateway</i>"]
    n_session_limiter["Semaphore<br/><i>in-process-limiter</i>"]
    n_guild_process["Guild processes<br/><i>erlang-node</i>"]
    n_guild_registry["Guild registry<br/><i>apache-helix</i>"]
    n_presence_service["Presence<br/><i>erlang-node</i>"]
  end
  subgraph n_g_api["api (system)"]
    n_api_monolith["API monolith<br/><i>container-service</i>"]
    n_snowflake_generator["Snowflake ids<br/><i>snowflake-id</i>"]
  end
  subgraph n_g_data_services["data-services (system)"]
    n_data_services["Data services<br/><i>container-service</i>"]
  end
  subgraph n_g_storage["storage (system)"]
    n_message_store["ScyllaDB<br/><i>scylladb</i>"]
    n_legacy_message_store["Cassandra<br/><i>cassandra</i>"]
  end
  subgraph n_g_migration["migration (system)"]
    n_migrator["Migrator<br/><i>container-worker</i>"]
  end
  n_desktop_client -.->|"persistent WebSocket [wss, at-most-once]"| n_session_gateway
  n_web_client -.->|"persistent WebSocket [wss, at-most-once]"| n_session_gateway
  n_mobile_client -.->|"persistent WebSocket [wss, at-most-once]"| n_session_gateway
  n_desktop_client -->|"send message [https]"| n_api_monolith
  n_web_client -->|"send message [https]"| n_api_monolith
  n_mobile_client -->|"send message [https]"| n_api_monolith
  n_session_gateway -->|"admission control on reconnect [in-process]"| n_session_limiter
  n_session_limiter -->|"guild node lookup [erlang]"| n_guild_registry
  n_session_gateway -.->|"subscribe to guild [erlang, at-most-once]"| n_guild_process
  n_guild_process -.->|"fan-out via Manifold [erlang, at-most-once]"| n_session_gateway
  n_guild_process -.->|"ring membership [erlang, at-most-once]"| n_guild_registry
  n_session_gateway -.->|"presence change [erlang, at-most-once]"| n_presence_service
  n_presence_service -.->|"presence updates [erlang, at-most-once]"| n_guild_process
  n_api_monolith -->|"message id [in-process]"| n_snowflake_generator
  n_api_monolith -->|"consistent-hash routed by channel_id [grpc]"| n_data_services
  n_data_services -->|"coalesced reads and writes [cql]"| n_message_store
  n_data_services -->|"coalesced reads during migration [cql]"| n_legacy_message_store
  n_migrator -->|"read token ranges [cql]"| n_legacy_message_store
  n_migrator -->|"write up to 3.2M messages/sec [cql]"| n_message_store
```
