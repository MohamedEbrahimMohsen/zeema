# distributed-email

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["Web client<br/><i>web-browser</i>"]
  n_mail_client["IMAP / JMAP client<br/><i>mobile-app</i>"]
  subgraph n_g_site_a["Primary site (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_load_balancer["load-balancer<br/><i>load-balancer-tier</i>"]
      n_imap_proxy["nginx IMAP / POP / SMTP frontend proxy<br/><i>nginx</i>"]
      n_inbound_smtp_server["Incoming mail servers<br/><i>container-service</i>"]
      n_realtime_server["Real-time servers<br/><i>websocket-gateway</i>"]
    end
    subgraph n_g_core["core (trust-zone)"]
      n_web_server["Web servers<br/><i>container-service</i>"]
      n_mail_processing_worker["Mail processing workers<br/><i>container-worker</i>"]
      n_smtp_outbound_worker["SMTP outgoing workers<br/><i>container-worker</i>"]
      n_replication_verifier["Weekly replication verification<br/><i>cron-job</i>"]
      n_spam_virus_check["Spam and virus check<br/><i>tensorflow-serving</i>"]
      n_incoming_queue["Incoming email queue<br/><i>message-queue</i>"]
      n_outgoing_queue["Outgoing email queue<br/><i>message-queue</i>"]
      n_user_store_db["Central user-to-store database<br/><i>mysql</i>"]
      n_metadata_db["Metadata database<br/><i>cassandra</i>"]
      n_mail_store_master["Mail store, master Cyrus slot<br/><i>vm-service</i>"]
      n_attachment_store["Attachment store<br/><i>blob-store</i>"]
      n_inbox_cache["Distributed cache<br/><i>redis</i>"]
      n_search_index["Search store<br/><i>elasticsearch</i>"]
    end
  end
  subgraph n_g_site_b["Replica site (region)"]
    n_mail_store_replica["Mail store, replica Cyrus slots<br/><i>vm-service</i>"]
  end
  subgraph n_g_internet["Public internet, untrusted SMTP peers (trust-zone)"]
    n_mx_dns["DNS: MX, SPF and DKIM records<br/><i>dns-resolver</i>"]
    n_remote_mx["Recipient mail exchanger<br/><i>smtp-relay</i>"]
  end
  n_web_client -->|"compose, read, folder ops [https]"| n_load_balancer
  n_mail_client -->|"IMAP / JMAP session [imap]"| n_load_balancer
  n_load_balancer -->|"http"| n_web_server
  n_load_balancer -->|"imap"| n_imap_proxy
  n_imap_proxy -->|"which slot is this user's master [mysql]"| n_user_store_db
  n_imap_proxy -->|"proxy the session to the master slot [imap]"| n_mail_store_master
  n_web_server -->|"folder listing, read status [cql]"| n_metadata_db
  n_web_server -->|"inbox pages [redis]"| n_inbox_cache
  n_web_server -->|"upload, signed reads [https]"| n_attachment_store
  n_web_server -->|"per-user full-text query [http]"| n_search_index
  n_web_server -.->|"send [amqp, at-least-once]"| n_outgoing_queue
  n_outgoing_queue -.->|"consume for delivery [amqp, at-least-once]"| n_smtp_outbound_worker
  n_smtp_outbound_worker -->|"outbound spam and virus scan [grpc]"| n_spam_virus_check
  n_smtp_outbound_worker -->|"MX lookup [dns]"| n_mx_dns
  n_smtp_outbound_worker -->|"deliver; defer and retry on transient, bounce on permanent [smtp-tls]"| n_remote_mx
  n_remote_mx -->|"inbound mail, SPF / DKIM / DMARC validated [smtp-tls]"| n_inbound_smtp_server
  n_inbound_smtp_server -.->|"accept and park [amqp, at-least-once]"| n_incoming_queue
  n_incoming_queue -.->|"consume for processing [amqp, at-least-once]"| n_mail_processing_worker
  n_mail_processing_worker -->|"inbound classification, thousands of signals per message [grpc]"| n_spam_virus_check
  n_mail_processing_worker -->|"which store holds the recipient [mysql]"| n_user_store_db
  n_mail_processing_worker -->|"write metadata, denormalised per folder [cql]"| n_metadata_db
  n_mail_processing_worker -->|"attachment blob, referenced by metadata [https]"| n_attachment_store
  n_mail_processing_worker -->|"deliver into the Cyrus mailbox [lmtp]"| n_mail_store_master
  n_mail_processing_worker -.->|"index asynchronously [http, at-least-once]"| n_search_index
  n_mail_processing_worker -.->|"new mail event [grpc, at-least-once]"| n_realtime_server
  n_realtime_server -.->|"push to online clients [websocket, at-most-once]"| n_web_client
  n_mail_store_master -.->|"sync_client replication log; failover under 10s, up to 30s [cyrus-sync, at-least-once]"| n_mail_store_replica
  n_replication_verifier -->|"weekly folder comparison [imap]"| n_mail_store_master
  n_replication_verifier -->|"weekly folder comparison [imap]"| n_mail_store_replica
```
