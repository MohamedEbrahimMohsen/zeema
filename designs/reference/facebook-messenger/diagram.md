# facebook-messenger

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_user_devices["User devices (plaintext and keys) (trust-zone)"]
    n_messenger_app["Messenger app (iOS / Android / web)<br/><i>mobile-app</i>"]
    n_recipient_device["Recipient devices<br/><i>user-device</i>"]
  end
  subgraph n_g_meta_transport["Meta transport (TLS, QUIC, Noise Pipes) (trust-zone)"]
    n_mqtt_gateway["MQTT connection<br/><i>websocket-gateway</i>"]
    n_server_broker["Server Broker<br/><i>container-service</i>"]
  end
  subgraph n_g_meta_backend["Meta backend (untrusted for E2EE content) (trust-zone)"]
    n_chat_pipeline["Chat pipeline<br/><i>container-service</i>"]
    n_user_index_service["User index service<br/><i>container-service</i>"]
    n_franking_service["Franking service<br/><i>container-service</i>"]
    n_prekey_server["Prekey / device key server<br/><i>container-service</i>"]
    n_backup_key_vault["Backup Key Vault<br/><i>container-service</i>"]
    n_iris["Iris<br/><i>message-queue</i>"]
    n_iris_backing_store["Iris backing store (MySQL on flash)<br/><i>mysql</i>"]
    n_hbase_store["Traditional storage tier (HBase)<br/><i>hbase</i>"]
    n_message_store["MyRocks message store<br/><i>mysql</i>"]
    n_labyrinth_mailbox["Labyrinth mailbox<br/><i>relational-database</i>"]
    n_labyrinth_metastore["Labyrinth mailbox metastore<br/><i>relational-database</i>"]
    n_attachment_blob_store["Encrypted attachment blob store<br/><i>blob-store</i>"]
    n_akd["Auditable Key Directory (AKD)<br/><i>nosql-store</i>"]
    subgraph n_g_messenger_cell["Cell (a subset of users) (cell)"]
      n_application_server["Application servers (cell)<br/><i>vm-service</i>"]
      n_zookeeper["ZooKeeper (shard map and discovery)<br/><i>zookeeper</i>"]
      n_metadata_store["Per-cell metadata store (HBase)<br/><i>hbase</i>"]
      n_unread_count_cache["Memcache unread counts<br/><i>memcached</i>"]
    end
  end
  subgraph n_g_third_parties["Third parties (trust-zone)"]
    n_cloudflare_auditor["Cloudflare key transparency auditor<br/><i>supplier-api</i>"]
    n_cloud_drive_escrow["iCloud Drive / Google Drive escrow<br/><i>supplier-api</i>"]
  end
  n_messenger_app -.->|"persistent low-power push channel [mqtt, at-least-once]"| n_mqtt_gateway
  n_mqtt_gateway -.->|"route through the chat pipeline [rpc, at-least-once]"| n_chat_pipeline
  n_messenger_app -->|"universal gateway to all server features [thrift]"| n_server_broker
  n_chat_pipeline -->|"enqueue once, totally ordered per user [rpc]"| n_iris
  n_iris -->|"queue persisted to MySQL on flash [mysql]"| n_iris_backing_store
  n_iris -.->|"app pointer: push delta, advance only on successful send [rpc, at-least-once]"| n_mqtt_gateway
  n_mqtt_gateway -.->|"push-based snapshot + delta [mqtt, at-least-once]"| n_messenger_app
  n_iris -.->|"storage pointer, 2010-2018: stays put through a disk outage [hbase, at-least-once]"| n_hbase_store
  n_iris -.->|"storage pointer, 2018+; also the buffer for hot-account migration [mysql, at-least-once]"| n_message_store
  n_messenger_app -->|"delta request by sequence number, re-snapshot when out of sync [thrift]"| n_iris
  n_messenger_app -->|"the only user-facing interface to the messages service [thrift]"| n_application_server
  n_application_server -->|"older history and full inbox snapshots [mysql]"| n_message_store
  n_application_server -->|"accounts not yet migrated [hbase]"| n_hbase_store
  n_application_server -->|"per-cell metadata and message index [hbase]"| n_metadata_store
  n_application_server -->|"shard ownership on the ring of virtual positions [zookeeper]"| n_zookeeper
  n_application_server -.->|"unread-count invalidation [memcached, at-most-once]"| n_unread_count_cache
  n_application_server -->|"social graph lookups [thrift]"| n_user_index_service
  n_mqtt_gateway -->|"which cell and application server owns this user [rpc]"| n_zookeeper
  n_hbase_store -.->|"migration state machine: not-migrated to done, responses compared [mysql, at-least-once]"| n_message_store
  n_messenger_app -->|"upload identity + signed + one-time prekeys, fetch recipient bundles [https]"| n_prekey_server
  n_messenger_app -.->|"client fan-out: one ciphertext per recipient device [mqtt, at-least-once]"| n_chat_pipeline
  n_chat_pipeline -.->|"push; a device that cannot decrypt sends a retry receipt, honoured 30 days [mqtt, at-least-once]"| n_recipient_device
  n_chat_pipeline -.->|"sender side backfill: device-list hash mismatch, refresh and resend [mqtt, at-least-once]"| n_messenger_app
  n_messenger_app -.->|"upload AES-CBC attachment, unlinked from the account [https, at-least-once]"| n_attachment_blob_store
  n_recipient_device -->|"download, verify SHA-256 and HMAC before decrypting [https]"| n_attachment_blob_store
  n_messenger_app -.->|"upload ciphertext under the current epoch key [https, at-least-once]"| n_labyrinth_mailbox
  n_recipient_device -->|"restore history by thread and timestamp range on a new device [https]"| n_labyrinth_mailbox
  n_messenger_app -->|"register device keys, open epoch, add or revoke a device [https]"| n_labyrinth_metastore
  n_messenger_app -->|"PIN authentication, 10 guesses, returns the recovery code [https]"| n_backup_key_vault
  n_messenger_app -.->|"recovery code in an app-specific hidden folder, inaccessible to Meta [https, at-least-once]"| n_cloud_drive_escrow
  n_messenger_app -->|"contact device key lookup and audit proof verification [https]"| n_akd
  n_akd -.->|"append-only log publication, roughly 2 minute epochs [https, at-least-once]"| n_cloudflare_auditor
  n_messenger_app -.->|"franking tag with each encrypted message [https, at-least-once]"| n_franking_service
  n_recipient_device -->|"abuse report: plaintext, T_F, R_F validated with the Meta key [https]"| n_franking_service
```
