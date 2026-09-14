# whatsapp-messaging

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_whatsapp_client["Mobile client<br/><i>mobile-app</i>"]
  n_signal_client["Signal client<br/><i>mobile-app</i>"]
  n_apns["apns<br/><i>apns</i>"]
  n_fcm["fcm<br/><i>fcm</i>"]
  subgraph n_g_dc_primary["SoftLayer datacenter (region)"]
    subgraph n_g_chat_tier["chat-tier (trust-zone)"]
      n_connection_balancer["connection-balancer<br/><i>load-balancer-tier</i>"]
      n_chat_server["Chat server (Erlang)<br/><i>websocket-gateway</i>"]
      n_offline_cache["Offline write-back cache<br/><i>cache-cluster</i>"]
      n_offline_store["Offline message store<br/><i>message-queue</i>"]
    end
    subgraph n_g_service_tier["service-tier (trust-zone)"]
      n_mnesia["Mnesia<br/><i>nosql-store</i>"]
      n_account_service["Account<br/><i>erlang-node</i>"]
      n_profile_service["Profile<br/><i>erlang-node</i>"]
      n_group_service["Group<br/><i>erlang-node</i>"]
      n_presence_service["Presence<br/><i>erlang-node</i>"]
      n_push_service["Push<br/><i>erlang-node</i>"]
    end
    subgraph n_g_media_tier["media-tier (trust-zone)"]
      n_mms_server["Multimedia server<br/><i>erlang-node</i>"]
      n_media_store["media-store<br/><i>blob-store</i>"]
    end
  end
  subgraph n_g_signal_cds["Signal contact discovery (system)"]
    n_cds_frontend["Contact discovery host (untrusted)<br/><i>container-service</i>"]
    n_registered_users["Registered users set (plain RAM)<br/><i>nosql-store</i>"]
    subgraph n_g_sgx_enclave["Intel SGX enclave (trust-zone)"]
      n_contact_matcher["Enclave matcher<br/><i>vm-service</i>"]
    end
  end
  n_whatsapp_client -->|"connect, jittered reconnect [tcp]"| n_connection_balancer
  n_connection_balancer -->|"place connection on a chat node [tcp]"| n_chat_server
  n_whatsapp_client -.->|"send message on the persistent connection [funxmpp, at-least-once]"| n_chat_server
  n_chat_server -.->|"deliver to a connected device [funxmpp, at-least-once]"| n_whatsapp_client
  n_chat_server -.->|"wandist: route to the recipient's connection node [wandist, at-least-once]"| n_chat_server
  n_chat_server -->|"write-back cache, 98% hit rate [erlang]"| n_offline_cache
  n_offline_cache -.->|"write behind to the mailbox [erlang, at-least-once]"| n_offline_store
  n_offline_store -.->|"drain on reconnect [erlang, at-least-once]"| n_chat_server
  n_offline_store -.->|"recipient offline, wake the device [erlang, at-most-once]"| n_push_service
  n_push_service -.->|"push to iOS [https, at-most-once]"| n_apns
  n_push_service -.->|"push to Android [https, at-most-once]"| n_fcm
  n_chat_server -.->|"cast, never a blocking call [erlang-cast, at-most-once]"| n_account_service
  n_chat_server -.->|"cast [erlang-cast, at-most-once]"| n_profile_service
  n_chat_server -.->|"cast, group fan-out [erlang-cast, at-most-once]"| n_group_service
  n_chat_server -.->|"cast, online and last-seen [erlang-cast, at-most-once]"| n_presence_service
  n_chat_server -->|"session lookup, async_dirty [mnesia]"| n_mnesia
  n_account_service -->|"async_dirty [mnesia]"| n_mnesia
  n_profile_service -->|"async_dirty [mnesia]"| n_mnesia
  n_group_service -->|"async_dirty [mnesia]"| n_mnesia
  n_presence_service -->|"async_dirty [mnesia]"| n_mnesia
  n_whatsapp_client -->|"upload media, get URL [https]"| n_mms_server
  n_mms_server -->|"store blob [https]"| n_media_store
  n_whatsapp_client -->|"download by URL [https]"| n_media_store
  n_signal_client -->|"attested TLS, encrypted contacts in [https]"| n_cds_frontend
  n_cds_frontend -->|"relay the attested session into the enclave [sgx-ecall]"| n_contact_matcher
  n_contact_matcher -->|"oblivious linear scan over every registered user [memory]"| n_registered_users
```
