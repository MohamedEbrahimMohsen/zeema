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

## Counts

total 12, todo 0, done 12, skip 0.
