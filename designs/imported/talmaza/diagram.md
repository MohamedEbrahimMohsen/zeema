# talmaza

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_applicant["Applicant<br/><i>user-device</i>"]
  n_visitor["Visitor<br/><i>user-device</i>"]
  subgraph n_g_cloudflare_edge["Cloudflare Edge (point-of-presence)"]
    n_ssl_tls_termination["SSL / TLS termination (Full strict)<br/><i>cloudflare-ssl-tls</i>"]
    n_cdn["CDN static cache<br/><i>cloudflare-cdn</i>"]
    n_waf["WAF OWASP rules<br/><i>cloudflare-waf</i>"]
    n_ddos_protection["DDoS protection<br/><i>cloudflare-ddos-protection</i>"]
    n_bot_detection["Bot detection<br/><i>cloudflare-bot-management</i>"]
    n_rate_limiting["Rate limiting<br/><i>cloudflare-rate-limiting</i>"]
    n_access["Access Zero Trust SSO (admin apps)<br/><i>cloudflare-access</i>"]
  end
  subgraph n_g_microsoft_azure["Microsoft Azure (region)"]
    subgraph n_g_vnet["VNet (vpc)"]
      n_nsg["NSG: deny ALL inbound no public IP · no public LB<br/><i>azure-network-security-group</i>"]
      n_key_vault_tunnel_token["Key Vault tunnel token<br/><i>azure-key-vault</i>"]
      n_entra_id["Entra ID<br/><i>azure-entra-id</i>"]
      n_managed_identity["Managed Identity<br/><i>azure-managed-identity</i>"]
      n_azure_monitor["Azure Monitor<br/><i>azure-monitor</i>"]
      n_log_analytics["Log Analytics<br/><i>azure-log-analytics</i>"]
      n_azure_alerts["Azure Alerts<br/><i>azure-monitor</i>"]
      n_communication_service["Communication Service<br/><i>azure-communication-services</i>"]
      n_blob_storage["Blob Storage<br/><i>azure-blob-storage</i>"]
      n_file_storage["File Storage<br/><i>azure-files</i>"]
      n_table_storage["Table Storage<br/><i>azure-table-storage</i>"]
      n_queue_storage["Queue Storage<br/><i>azure-queue-storage</i>"]
      n_azure_sql["Azure SQL<br/><i>azure-sql</i>"]
      n_redis["Redis<br/><i>azure-cache-for-redis</i>"]
      n_cosmosdb["CosmosDB<br/><i>azure-cosmos-db</i>"]
      n_key_vault_app_secrets["Key Vault App Secrets<br/><i>azure-key-vault</i>"]
      n_azure_ai_foundary["Azure AI Foundary<br/><i>azure-ai-foundry</i>"]
      n_ai_search["AI Search<br/><i>azure-ai-search</i>"]
      n_azure_openai["Azure OpenAI<br/><i>azure-openai</i>"]
      subgraph n_g_aks_cluster["AKS cluster (private API server) (system)"]
        subgraph n_g_ns_cloudflared["ns: cloudflared — Deployment, 2+ replicas (namespace)"]
          n_deployment["Deployment<br/><i>k8s-deployment</i>"]
          n_cloudflared["cloudflared<br/><i>cloudflare-tunnel</i>"]
          n_cloudflared_2["cloudflared<br/><i>cloudflare-tunnel</i>"]
        end
        subgraph n_g_ns_frontend["ns: frontend (namespace)"]
          n_service_clusterip["Service ClusterIP<br/><i>k8s-service</i>"]
          n_web_pod["web pod<br/><i>k8s-pod</i>"]
          n_web_pod_2["web pod<br/><i>k8s-pod</i>"]
        end
        subgraph n_g_ns_api["ns: api (namespace)"]
          n_service_clusterip_2["Service ClusterIP<br/><i>k8s-service</i>"]
          n_api_pod["api pod<br/><i>k8s-pod</i>"]
          n_api_pod_2["api pod<br/><i>k8s-pod</i>"]
        end
      end
    end
  end
  subgraph n_g_external_systems["External Systems (trust-zone)"]
  end
  n_applicant -->|"https"| n_waf
  n_visitor -->|"https"| n_rate_limiting
  n_cloudflared -->|"Cloudflare Tunnel [quic]"| n_ddos_protection
  n_ddos_protection -->|"Cloudflare Tunnel [quic]"| n_cloudflared
  n_cloudflared -->|"talmaza.com [http]"| n_web_pod
  n_cloudflared -->|"api.talmaza.com [http]"| n_api_pod
  n_cloudflared_2 -->|"Secret Store [https]"| n_key_vault_tunnel_token
  n_service_clusterip_2 -->|"https"| n_entra_id
  n_managed_identity -->|"https"| n_azure_alerts
  n_managed_identity -->|"smb"| n_file_storage
  n_managed_identity -->|"redis"| n_redis
  n_managed_identity -->|"https"| n_key_vault_app_secrets
  n_entra_id -->|"https"| n_azure_ai_foundary
  n_azure_ai_foundary -->|"https"| n_azure_monitor
  n_ai_search -->|"https"| n_blob_storage
  n_azure_openai -->|"sql"| n_azure_sql
  n_azure_openai -->|"https"| n_key_vault_app_secrets
```
