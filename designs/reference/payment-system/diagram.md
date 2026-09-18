# payment-system

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_checkout_client["checkout-client<br/><i>web-browser</i>"]
  n_settlement_bank["settlement-bank<br/><i>bank-api</i>"]
  subgraph n_g_eu_west_1["eu-west-1 (region)"]
    subgraph n_g_payments_vpc["payments-vpc (vpc)"]
      n_api["api<br/><i>aws-api-gateway</i>"]
      n_payment_service["payment-service<br/><i>container-service</i>"]
      n_payments_db["payments-db<br/><i>postgres</i>"]
      n_payment_workflow["payment-workflow<br/><i>temporal</i>"]
      n_payment_executor["payment-executor<br/><i>container-service</i>"]
      n_psp_webhook["psp-webhook<br/><i>webhook-receiver</i>"]
      n_wallet_db["wallet-db<br/><i>dynamodb</i>"]
      n_ledger["ledger<br/><i>double-entry-ledger</i>"]
      n_payment_events["payment-events<br/><i>kafka</i>"]
      n_retry_queue["retry-queue<br/><i>sqs</i>"]
      n_reconciliation_job["reconciliation-job<br/><i>cron-job</i>"]
      n_kms["kms<br/><i>aws-kms</i>"]
    end
    subgraph n_g_pci_scope["pci-scope (trust-zone)"]
      n_psp["psp<br/><i>stripe</i>"]
    end
  end
  n_checkout_client -->|"Idempotency-Key header [https]"| n_api
  n_checkout_client -->|"hosted page, card data never touches the platform [https]"| n_psp
  n_api -->|"http"| n_payment_service
  n_payment_service -->|"payment_event, payment_order, unique idempotency key [postgres]"| n_payments_db
  n_payment_service -.->|"start payment workflow [grpc, at-least-once]"| n_payment_workflow
  n_payment_workflow -.->|"pre-rpc, rpc, post-rpc activities [grpc, at-least-once]"| n_payment_executor
  n_payment_executor -->|"charge with nonce and token [https]"| n_psp
  n_payment_executor -->|"order status [postgres]"| n_payments_db
  n_payment_executor -->|"seller balance [dynamodb]"| n_wallet_db
  n_payment_executor -->|"double-entry posting [grpc]"| n_ledger
  n_payment_executor -.->|"immutable payment events [kafka, at-least-once]"| n_payment_events
  n_payment_executor -.->|"transient PSP failure [sqs, at-least-once]"| n_retry_queue
  n_retry_queue -.->|"re-execute after backoff [sqs, at-least-once]"| n_payment_executor
  n_psp -.->|"signed status callback, retried by PSP [https, at-least-once]"| n_psp_webhook
  n_psp_webhook -->|"update order status [postgres]"| n_payments_db
  n_reconciliation_job -->|"nightly settlement files [sftp]"| n_settlement_bank
  n_reconciliation_job -->|"compare settlement to ledger [grpc]"| n_ledger
  n_payment_executor -->|"decrypt PSP credentials [https]"| n_kms
```
