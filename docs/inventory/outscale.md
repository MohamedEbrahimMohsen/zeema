# Outscale inventory

Official product directory: <https://docs.outscale.com/> (3DS OUTSCALE). Ids are
`outscale-<product>`.

Status: `done` = component exists in `components/outscale/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Virtual Machines (VMs) | outscale-vm | virtual-machine | done | https://docs.outscale.com/en/userguide/About-VMs.html |
| DirectLink | outscale-directlink | network-fabric | done | https://docs.outscale.com/en/userguide/About-DirectLink.html |

## Network

| resource | id | kind | status | source |
|---|---|---|---|---|
| Client Gateway | outscale-client-gateway | vpn-gateway | done | https://docs.outscale.com/en/userguide/About-Client-Gateways.html |
| Internet Service | outscale-internet-service | network-fabric | done | https://docs.outscale.com/en/userguide/About-Internet-Services.html |
| Load Balancer Unit (LBU) | outscale-lbu | load-balancer | done | https://docs.outscale.com/en/userguide/About-Load-Balancers.html |
| NAT Service | outscale-nat-service | nat-gateway | done | https://docs.outscale.com/en/userguide/About-NAT-Services.html |
| Net | outscale-net | network-fabric | done | https://docs.outscale.com/en/userguide/About-Nets.html |
| Virtual Gateway | outscale-virtual-gateway | vpn-gateway | done | https://docs.outscale.com/en/userguide/About-Virtual-Gateways.html |

## Security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Security Group | outscale-security-group | firewall | done | https://docs.outscale.com/en/userguide/About-Security-Groups.html |
| Elastic Identity Management (EIM) | outscale-eim | identity-provider | done | https://docs.outscale.com/en/userguide/About-IAM.html |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| OUTSCALE Object Storage (OOS) | outscale-oos | object-store | done | https://docs.outscale.com/en/userguide/About-OOS.html |
| Block Storage Unit (BSU) | outscale-bsu | block-storage | done | https://docs.outscale.com/en/userguide/About-Volumes.html |

---

## Coverage pass 2026-09-21

Re-diffed against the OUTSCALE user guide <https://docs.outscale.com/en/userguide/Home.html> and
the 56 resource pages of the OUTSCALE Terraform provider (`docs/resources/` in
outscale/terraform-provider-outscale).

| resource | id | kind | status | source |
|---|---|---|---|---|
| OKS (Kubernetes as a Service) | outscale-oks | container-orchestrator | done | https://docs.outscale.com/en/userguide/About-OKS.html |
| Net access point | outscale-net-access-point | private-link | done | https://docs.outscale.com/en/userguide/About-Net-Access-Points.html |
| Public IP | outscale-public-ip | network-fabric | done | https://docs.outscale.com/en/userguide/About-Public-IPs.html |
| Flexible GPU (fGPU) | — | — | skip: GPU device allocated to the account and attached to or detached from a VM; the placed node is the VM it accelerates. | https://docs.outscale.com/en/userguide/About-Flexible-GPUs.html |
| OMI (OUTSCALE machine image) | — | — | skip: image artefact a VM boots from. | https://docs.outscale.com/en/userguide/About-OMIs.html |
| Snapshot | — | — | skip: point-in-time copy of a volume, a property of the volume. | https://docs.outscale.com/en/userguide/About-Snapshots.html |
| Subnet | — | — | skip: subdivision of a Net; a boundary, not a component. | https://docs.outscale.com/en/userguide/About-Subnets.html |
| Route table / route | — | — | skip: routing configuration of a Net. | https://docs.outscale.com/en/userguide/About-Route-Tables.html |
| Net peering | — | — | skip: link between two Nets, a property of the Net pair. | https://docs.outscale.com/en/userguide/About-Net-Peerings.html |
| Network interface (NIC / FNI) | — | — | skip: network interface of a VM. | https://docs.outscale.com/en/userguide/About-FNIs.html |
| VPN connection | — | — | skip: IPsec tunnel between a virtual gateway and a client gateway, both already catalogued. | https://docs.outscale.com/en/userguide/About-VPN-Connections.html |
| Server certificate | — | — | skip: certificate stored for a load balancer listener, a setting of the LBU. | https://docs.outscale.com/en/userguide/About-Server-Certificates.html |
| API access rule / API access policy / CA | — | — | skip: access control over the API surface itself, not a resource in a traffic path. | https://docs.outscale.com/en/userguide/About-API-Access-Rules.html |
| Keypair | — | — | skip: SSH credential injected into a VM at creation. | https://docs.outscale.com/en/userguide/About-Keypairs.html |
| DHCP options set | — | — | skip: address configuration attached to a Net. | https://docs.outscale.com/en/userguide/About-DHCP-Options.html |
| Cockpit | — | — | skip: the OUTSCALE web console; operator consoles are not placeable runtime nodes. | https://docs.outscale.com/en/userguide/About-Cockpit.html |
| OSC CLI and SDKs | — | — | skip: client tooling, not a runtime node. | https://docs.outscale.com/en/userguide/Cloud-Tools.html |
| OUTSCALE Marketplace | — | — | skip: third-party image and application catalogue. | https://docs.outscale.com/en/userguide/About-the-OUTSCALE-Marketplace.html |

## Counts

total 30, todo 0, done 15, skip 15.
