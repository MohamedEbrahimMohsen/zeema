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

## Counts

total 25, todo 0, done 10, skip 15.
