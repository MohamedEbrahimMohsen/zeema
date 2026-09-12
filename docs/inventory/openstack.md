# OpenStack inventory

Official project directory: <https://www.openstack.org/software/project-navigator/> and the
project docs <https://docs.openstack.org/>. One row per OpenStack project; retired projects are
`skip` with the retirement noted. Ids are `openstack-<project>`.

Status: `done` = component exists in `components/openstack/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Application Lifecycle

| resource | id | kind | status | source |
|---|---|---|---|---|
| Freezer | openstack-freezer | backup-service | done | https://docs.openstack.org/freezer/latest/ |
| Masakari | openstack-masakari | monitoring | done | https://docs.openstack.org/masakari/latest/ |

## Bare Metal

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cyborg | openstack-cyborg | coordination-service | done | https://docs.openstack.org/cyborg/latest/ |
| Ironic | openstack-ironic | virtual-machine | done | https://docs.openstack.org/ironic/latest/ |

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Zun | openstack-zun | container-orchestrator | done | https://docs.openstack.org/zun/latest/ |

## Monitoring

| resource | id | kind | status | source |
|---|---|---|---|---|
| Telemetry (Ceilometer) | openstack-telemetry | monitoring | done | https://docs.openstack.org/ceilometer/latest/ |

## Networking

| resource | id | kind | status | source |
|---|---|---|---|---|
| Designate | openstack-designate | dns | done | https://docs.openstack.org/designate/latest/ |
| Neutron | openstack-neutron | network-fabric | done | https://docs.openstack.org/neutron/latest/ |
| Octavia | openstack-octavia | load-balancer | done | https://docs.openstack.org/octavia/latest/ |

## NFV

| resource | id | kind | status | source |
|---|---|---|---|---|
| Tacker | openstack-tacker | ci-pipeline | done | https://docs.openstack.org/tacker/latest/ |

## Optimization

| resource | id | kind | status | source |
|---|---|---|---|---|
| Vitrage | openstack-vitrage | monitoring | done | https://docs.openstack.org/vitrage/latest/ |
| Watcher | openstack-watcher | monitoring | done | https://docs.openstack.org/watcher/latest/ |

## Orchestration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Blazar | openstack-blazar | coordination-service | done | https://docs.openstack.org/blazar/latest/ |
| Mistral | openstack-mistral | workflow-engine | done | https://docs.openstack.org/mistral/latest/ |
| Zaqar | openstack-zaqar | queue | done | https://docs.openstack.org/zaqar/latest/ |

## Shared Services

| resource | id | kind | status | source |
|---|---|---|---|---|
| Barbican | openstack-barbican | key-management | done | https://docs.openstack.org/barbican/latest/ |
| Glance | openstack-glance | artifact-repository | done | https://docs.openstack.org/glance/latest/ |
| Keystone | openstack-keystone | identity-provider | done | https://docs.openstack.org/keystone/latest/ |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cinder | openstack-cinder | block-storage | done | https://docs.openstack.org/cinder/latest/ |
| Manila | openstack-manila | file-storage | done | https://docs.openstack.org/manila/latest/ |

## Workload Provisioning

| resource | id | kind | status | source |
|---|---|---|---|---|
| Magnum | openstack-magnum | container-orchestrator | done | https://docs.openstack.org/magnum/latest/ |
| Trove | openstack-trove | sql-database | done | https://docs.openstack.org/trove/latest/ |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| EC2 API | — | — | skip: Retired OpenStack project (ec2-api retired 2024-05-10); an EC2-compatible API proxy in front of Nova, not a resource of its own. | https://opendev.org/openstack/ec2-api |
| Murano | — | — | skip: Retired OpenStack project (retired 2024-05-10); application catalogue, not a runtime node. | https://opendev.org/openstack/murano |
| Solum | — | — | skip: Retired OpenStack project (retired 2024-05-10). | https://opendev.org/openstack/solum |
| CloudKitty | — | — | skip: Rating, chargeback and billing service; billing/cost products are not placeable runtime nodes. | https://docs.openstack.org/cloudkitty/latest/ |
| OpenStack Nova | — | — | skip: already catalogued as `openstack-nova` under default | https://docs.openstack.org/nova/latest/ |
| Qinling | — | — | skip: Retired OpenStack project (retired 2020-11-27); function-as-a-service for OpenStack. | https://opendev.org/openstack/qinling |
| Kuryr | — | — | skip: Retired OpenStack project (retired 2024-10-17); container networking bridge to Neutron. | https://opendev.org/openstack/kuryr |
| Ansible AWX | — | — | skip: already catalogued as `awx` under default | https://ansible.readthedocs.io/projects/awx/en/latest/ |
| OpenStack Charms | — | — | skip: Juju charm deployment/packaging tooling, not a runtime node. | https://docs.openstack.org/charm-guide/latest/ |
| Chef Infra | — | — | skip: already catalogued as `chef` under default | https://docs.chef.io/ |
| Helm | — | — | skip: package manager for Kubernetes manifests | https://helm.sh/docs/ |
| Kolla / Kolla-Ansible | — | — | skip: Container image build and Ansible deployment tooling for OpenStack, not a runtime node. | https://docs.openstack.org/kolla-ansible/latest/ |
| TripleO | — | — | skip: Retired OpenStack project (retired 2024-01-09) and a deployment tool (OpenStack on OpenStack). | https://opendev.org/openstack/tripleo-common |
| Horizon | — | — | skip: The OpenStack web dashboard (operator console UI); dashboards and portals are not placeable runtime nodes. | https://docs.openstack.org/horizon/latest/ |
| Monasca | — | — | skip: Retired OpenStack project (retired 2025-08-11); monitoring-as-a-service. | https://opendev.org/openstack/monasca-api |
| Tricircle | — | — | skip: Retired OpenStack project (retired 2020-05-18); multi-region Neutron networking automation. | https://opendev.org/openstack/tricircle |
| Congress | — | — | skip: Retired OpenStack project (retired 2020-05-18); governance policy service. | https://opendev.org/openstack/congress |
| Rally | — | — | skip: Benchmarking and performance-testing tool run against a cloud, not a deployed runtime node. | https://docs.openstack.org/rally/latest/ |
| Heat | — | — | skip: Template orchestration service: deployment control plane, the same call already recorded for AWS CloudFormation and Azure Resource Manager. | https://docs.openstack.org/heat/latest/ |
| Senlin | — | — | skip: Retired OpenStack project (retired 2024-05-10); clustering and autoscaling service. | https://opendev.org/openstack/senlin |
| LOCI | — | — | skip: Build tooling that produces lightweight OpenStack container images; packaging, not a runtime node. | https://opendev.org/openstack/loci |
| Puppet Enterprise | — | — | skip: already catalogued as `puppet` under default | https://www.puppet.com/docs |
| RPM packages | — | — | skip: Package format / packaging artefact, not a node. | https://rpm.org/documentation.html |
| Karbor | — | — | skip: Retired OpenStack project (retired 2020-12-14); application data protection service. | https://opendev.org/openstack/karbor |
| Searchlight | — | — | skip: Retired OpenStack project (retired 2020-11-27); indexing and search over OpenStack resources. | https://opendev.org/openstack/searchlight |
| OpenStack Swift | — | — | skip: already catalogued as `swift` under default | https://docs.openstack.org/swift/latest/ |
| OpenStackClient | — | — | skip: Command-line client, not a runtime node. | https://docs.openstack.org/python-openstackclient/latest/ |
| Sahara | — | — | skip: Retired OpenStack project (retired 2024-05-10); Hadoop/Spark cluster provisioning. | https://opendev.org/openstack/sahara |

## Counts

total 50, todo 0, done 22, skip 28.
