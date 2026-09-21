# DigitalOcean inventory

Official product directory: <https://docs.digitalocean.com/products/>. Ids are
`digitalocean-<product>`.

Status: `done` = component exists in `components/digitalocean/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Droplets | digitalocean-droplet | virtual-machine | done | https://docs.digitalocean.com/products/droplets/ |
| DigitalOcean Kubernetes | digitalocean-kubernetes | container-orchestrator | done | https://docs.digitalocean.com/products/kubernetes/ |

## Databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Managed Databases | digitalocean-managed-databases | sql-database | done | https://docs.digitalocean.com/products/databases/ |

## Networking

| resource | id | kind | status | source |
|---|---|---|---|---|
| DNS | digitalocean-dns | dns | done | https://docs.digitalocean.com/products/networking/dns/ |
| Cloud Firewalls | digitalocean-cloud-firewall | firewall | done | https://docs.digitalocean.com/products/networking/firewalls/ |
| Reserved IPs | digitalocean-reserved-ip | network-fabric | done | https://docs.digitalocean.com/products/networking/reserved-ips/ |
| Load Balancers | digitalocean-load-balancer | load-balancer | done | https://docs.digitalocean.com/products/networking/load-balancers/ |
| VPC | digitalocean-vpc | network-fabric | done | https://docs.digitalocean.com/products/networking/vpc/ |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Spaces Object Storage | digitalocean-spaces | object-store | done | https://docs.digitalocean.com/products/spaces/ |
| Volumes Block Storage | digitalocean-volumes | block-storage | done | https://docs.digitalocean.com/products/volumes/ |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Container service (generic) | — | — | skip: already catalogued as `container-service` under default | https://kubernetes.io/docs/concepts/workloads/ |
| Docker Engine | — | — | skip: host container runtime, the drawn node is the container service | https://docs.docker.com/engine/ |
| Droplet Console / SSH access | — | — | skip: Droplet icon variant for console/SSH access to a Droplet, an access method rather than a placeable resource. | https://docs.digitalocean.com/products/droplets/how-to/connect-with-console/ |
| Droplet snapshot | — | — | skip: Snapshots are a property of the Droplet, not a separate component. | https://docs.digitalocean.com/products/snapshots/ |
| Kubernetes node pool | — | — | skip: Node pool is a sizing property of the DigitalOcean Kubernetes cluster, not a separate node. | https://docs.digitalocean.com/products/kubernetes/concepts/node-pools/ |
| Kubernetes worker node | — | — | skip: Worker node is a member of the cluster's node pool, not a separately placed resource. | https://docs.digitalocean.com/products/kubernetes/concepts/node-pools/ |
| Managed Databases (primary with standby) | — | — | skip: Topology variant of the one Managed Databases component; standby count is a property, not a component. | https://docs.digitalocean.com/products/databases/ |
| Managed Databases (read-only replica) | — | — | skip: Read replica variant of the one Managed Databases component; replicas are a property, not a component. | https://docs.digitalocean.com/products/databases/ |
| Managed Databases (standby) | — | — | skip: Standby variant of the one Managed Databases component; failover standby is a property, not a component. | https://docs.digitalocean.com/products/databases/ |
| SSL certificates | — | — | skip: DigitalOcean has no standalone certificate product; uploaded and Let's Encrypt certificates are a property of the load balancer or app. | https://docs.digitalocean.com/products/networking/load-balancers/how-to/manage-ssl/ |
| Domain registration | — | — | skip: DigitalOcean is not a registrar; registration happens at a third-party registrar, so there is no DigitalOcean node to place. | https://docs.digitalocean.com/products/networking/dns/ |
| Internet gateway | — | — | skip: DigitalOcean has no internet gateway resource; public egress is implicit in the VPC and the Droplet's public interface. | https://docs.digitalocean.com/products/networking/vpc/ |
| Managed VPN | — | — | skip: DigitalOcean ships no managed VPN product; a VPN on DigitalOcean is self-hosted software on a Droplet. | https://docs.digitalocean.com/products/networking/ |
| Spaces folder | — | — | skip: Generic folder shape; a folder is a key prefix inside a Space, not a resource. | https://docs.digitalocean.com/products/spaces/ |
| Volume snapshot | — | — | skip: Snapshots are a property of the volume, not a separate component. | https://docs.digitalocean.com/products/snapshots/ |

---

## Coverage pass 2026-09-21

Re-diffed against the official product directory <https://docs.digitalocean.com/products/> and
the 70 resource pages of the DigitalOcean Terraform provider
(`docs/resources/` in digitalocean/terraform-provider-digitalocean). Managed Databases stays one
component with an `engine` property, so the Kafka, MongoDB, OpenSearch and Valkey engines are
mapping rows rather than new components.

| resource | id | kind | status | source |
|---|---|---|---|---|
| App Platform | digitalocean-app-platform | app-server | done | https://docs.digitalocean.com/products/app-platform/ |
| Functions | digitalocean-functions | worker | done | https://docs.digitalocean.com/products/functions/ |
| Container Registry | digitalocean-container-registry | container-registry | done | https://docs.digitalocean.com/products/container-registry/ |
| Inference (Gradient AI) | digitalocean-inference | ai-service | done | https://docs.digitalocean.com/products/inference/ |
| Spaces CDN | digitalocean-spaces-cdn | cdn | done | https://docs.digitalocean.com/products/spaces/how-to/enable-cdn/ |
| Network File Storage | digitalocean-nfs | file-storage | done | https://docs.digitalocean.com/products/nfs/ |
| Monitoring | digitalocean-monitoring | monitoring | done | https://docs.digitalocean.com/products/monitoring/ |
| Uptime | digitalocean-uptime | monitoring | done | https://docs.digitalocean.com/products/uptime/ |
| VPC NAT Gateway | digitalocean-vpc-nat-gateway | nat-gateway | done | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/vpc_nat_gateway |
| Bare Metal GPUs | digitalocean-bare-metal-gpu | virtual-machine | done | https://docs.digitalocean.com/products/bare-metal-gpus/ |
| DDoS Protection | digitalocean-ddos-protection | ddos-protection | done | https://docs.digitalocean.com/platform/ddos-protection/ |
| CSPM | digitalocean-cspm | policy-engine | done | https://docs.digitalocean.com/products/cspm/ |
| Vector Databases | digitalocean-vector-database | vector-database | done | https://docs.digitalocean.com/products/vector-databases/ |
| Paperspace | digitalocean-paperspace | ml-platform | done | https://docs.digitalocean.com/products/paperspace/ |
| SnapShooter | digitalocean-snapshooter | backup-service | done | https://docs.digitalocean.com/products/snapshooter/ |
| Droplet Autoscale Pool | digitalocean-droplet-autoscale | virtual-machine | done | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/droplet_autoscale |
| Partner Network Connect | digitalocean-partner-attachment | network-fabric | done | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/partner_network_connect |
| GPU Droplets | — | — | skip: GPU is a Droplet plan family (`plan: "gpu"` on digitalocean-droplet), not a separate resource. | https://docs.digitalocean.com/products/gpu-droplets/ |
| 1-Click Models | — | — | skip: Marketplace catalogue entry that installs a model onto a GPU Droplet; the Droplet is the node. | https://docs.digitalocean.com/products/marketplace/1-click-models/ |
| Cloudways | — | — | skip: managed-hosting brand with its own control panel; what it provisions is a Droplet running an application server. | https://docs.digitalocean.com/products/cloudways/ |
| Knowledge Bases | — | — | skip: indexed data source attached to a Gradient AI agent, stored in a vector database cluster. | https://docs.digitalocean.com/products/knowledge-bases/ |
| Backups | — | — | skip: per-resource backup setting on a Droplet or volume (`backups` on digitalocean-droplet), not a resource. | https://docs.digitalocean.com/products/backups/ |
| Marketplace | — | — | skip: catalogue of images and 1-click apps, not a runtime node. | https://docs.digitalocean.com/products/marketplace/ |
| Custom Images | — | — | skip: image artefact a Droplet boots from. | https://docs.digitalocean.com/products/custom-images/ |
| Projects | — | — | skip: control-panel grouping of resources for billing and organisation. | https://docs.digitalocean.com/products/projects/ |
| IPv6 | — | — | skip: addressing option on a Droplet's network interface. | https://docs.digitalocean.com/products/networking/ipv6/ |
| VPC peering | — | — | skip: link between two VPCs, a property of the VPC pair. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/vpc_peering |
| BYOIP prefix | — | — | skip: address range imported into the account, assigned to resources; not a node. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/byoip_prefix |
| Database connection pool | — | — | skip: PgBouncer endpoint on a managed PostgreSQL cluster, a setting of the cluster. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/database_connection_pool |
| Database firewall | — | — | skip: source allowlist on a managed database cluster, a setting of the cluster. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/database_firewall |
| Monitor alert / Uptime alert | — | — | skip: alert policy attached to Monitoring or an Uptime check. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/monitor_alert |
| Tags | — | — | skip: label applied to resources. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/tag |
| SSH keys | — | — | skip: credential injected into a Droplet at creation. | https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/resources/ssh_key |

### Already covered under another name

| resource | id | kind | status | source |
|---|---|---|---|---|
| Managed Kafka, Managed MongoDB, Managed OpenSearch, Managed Caching (Valkey) | digitalocean-managed-databases | sql-database | done | mapping: `engine` values of the one Managed Databases product |
| Gradient AI Platform / GenAI Platform | digitalocean-inference | ai-service | done | mapping: the platform's inference control plane, same product |
| Vector database on OpenSearch or PostgreSQL | digitalocean-vector-database | vector-database | done | mapping: `engine` values of the Vector Databases product |

## Counts

total 58, todo 0, done 27, skip 31. Plus 3 mapping rows under
"Already covered under another name", which point at rows already counted above.
