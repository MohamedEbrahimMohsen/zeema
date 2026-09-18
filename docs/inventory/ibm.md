# IBM Cloud inventory

Official product directory: the IBM Cloud catalog <https://cloud.ibm.com/catalog> and the IBM Cloud
docs <https://cloud.ibm.com/docs>. Families follow the mingrammer `ibm` section modules, which
mirror IBM's own architecture-icon groupings. Ids are `ibm-<product>`.

Status: `done` = component exists in `components/ibm/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Applications

| resource | id | kind | status | source |
|---|---|---|---|---|
| Watson Speech to Text | ibm-watson-speech-to-text | ai-service | done | https://cloud.ibm.com/docs/speech-to-text |

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Bare Metal Servers | ibm-bare-metal-server | virtual-machine | done | https://cloud.ibm.com/docs/bare-metal |
| Virtual Servers for VPC | ibm-virtual-server | virtual-machine | done | https://cloud.ibm.com/docs/vpc?topic=vpc-about-advanced-virtual-servers |
| IBM Power Virtual Server | ibm-power-virtual-server | virtual-machine | done | https://cloud.ibm.com/docs/power-iaas |

## General

| resource | id | kind | status | source |
|---|---|---|---|---|
| IBM Cloudant | ibm-cloudant | nosql-database | done | https://cloud.ibm.com/docs/Cloudant |
| IBM Cloud Kubernetes Service | ibm-kubernetes-service | container-orchestrator | done | https://cloud.ibm.com/docs/containers |
| IBM Cloud IAM | ibm-iam | identity-provider | done | https://cloud.ibm.com/docs/account?topic=account-iamoverview |
| IBM Cloud Monitoring | ibm-cloud-monitoring | monitoring | done | https://cloud.ibm.com/docs/monitoring |
| IBM Cloud Object Storage | ibm-cloud-object-storage | object-store | done | https://cloud.ibm.com/docs/cloud-object-storage |
| Watson Text to Speech | ibm-watson-text-to-speech | ai-service | done | https://cloud.ibm.com/docs/text-to-speech |

## Network

| resource | id | kind | status | source |
|---|---|---|---|---|
| Direct Link | ibm-direct-link | network-fabric | done | https://cloud.ibm.com/docs/dl |
| Hardware Firewall | ibm-firewall | firewall | done (end of marketing 17 December 2025, end of support 31 December 2026; still placeable until then) | https://cloud.ibm.com/docs/hardware-firewall-shared?topic=hardware-firewall-shared-about-hardware-firewall-shared |
| Floating IP | ibm-floating-ip | network-fabric | done | https://cloud.ibm.com/docs/vpc?topic=vpc-fip-about |
| Internet Services | ibm-internet-services | cdn | done | https://cloud.ibm.com/docs/cis?topic=cis-getting-started |
| Load Balancer for VPC | ibm-load-balancer | load-balancer | done | https://cloud.ibm.com/docs/vpc?topic=vpc-load-balancers |
| Public Gateway | ibm-public-gateway | nat-gateway | done | https://cloud.ibm.com/docs/vpc?topic=vpc-about-public-gateways |
| Subnet | ibm-subnet | network-fabric | done | https://cloud.ibm.com/docs/vpc?topic=vpc-about-subnets-vpc |
| Transit Gateway | ibm-transit-gateway | network-fabric | done | https://cloud.ibm.com/docs/transit-gateway |
| Virtual Private Cloud | ibm-vpc | network-fabric | done | https://cloud.ibm.com/docs/vpc?topic=vpc-about-vpc |
| VPN for VPC | ibm-vpn-gateway | vpn-gateway | done | https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Block Storage for VPC | ibm-block-storage | block-storage | done | https://cloud.ibm.com/docs/vpc?topic=vpc-block-storage-about |
| Object Storage | — | — | skip: same product as IBM Cloud Object Storage, already written as ibm-cloud-object-storage | https://cloud.ibm.com/docs/cloud-object-storage |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Analytics | — | — | skip: Capability/section icon for the analytics group in IBM's icon set, not a product or a placeable node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Data integration | — | — | skip: Generic data-integration capability label; the placed node is the ETL product (Airbyte, Fivetran, NiFi). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Data repositories | — | — | skip: Collective label for 'the data stores' in a reference architecture, not a single node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Device analytics | — | — | skip: Generic IoT-analytics capability label, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Streaming computing | — | — | skip: Generic stream-processing capability label; the placed node is the engine (Flink, Spark Streaming). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Actionable insight | — | — | skip: Conceptual outcome label from IBM's cognitive reference architecture, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Annotate | — | — | skip: Data-annotation activity icon in the model-training flow, not a deployable node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| API developer portal | — | — | skip: Developer portal of an API management product, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| API polyglot runtimes | — | — | skip: Label for 'the runtimes behind the API' — language runtimes, drawn as the app-server they run. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| App server | — | — | skip: already catalogued as `container-service` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Application logic | — | — | skip: Business logic inside an application, not a separately placed node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Enterprise applications | — | — | skip: Collective label for existing enterprise systems outside the design, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Index | — | — | skip: Generic index label; the placed node is the search engine that holds the index. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| IoT application | — | — | skip: Generic 'an application, for IoT' label; drawn as the app-server node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Microservice | — | — | skip: already catalogued as `container-service` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Mobile app | — | — | skip: already catalogued as `mobile-app` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Ontology | — | — | skip: Knowledge-model artifact in a cognitive architecture, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Open source tools | — | — | skip: Section icon for a group of tools, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Runtime services | — | — | skip: Section icon for the runtime layer of IBM's reference architecture, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| SaaS applications | — | — | skip: Collective label for third-party SaaS the design consumes, not a single product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Service broker | — | — | skip: Open Service Broker API implementation of a PaaS catalogue: a provisioning interface, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Watson Visual Recognition | — | — | skip: IBM Watson Visual Recognition was withdrawn: no new instances from 7 January 2021, existing instances deleted 1 December 2021. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Visualization | — | — | skip: Generic charting/dashboard capability label; the placed node is the BI product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Blockchain developer | — | — | skip: Person/role icon, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Blockchain | — | — | skip: Section icon for the blockchain group; the placed node is the ledger platform (hyperledger-fabric). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Certificate authority | — | — | skip: Fabric CA, the membership component inside a Hyperledger Fabric network, not a separately placed node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Client application | — | — | skip: Generic 'client application' label; the placed node is the concrete client (web-browser, mobile-app, sdk-client). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Communication | — | — | skip: Relationship icon for communication between parties, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Consensus | — | — | skip: Consensus mechanism of a blockchain network: a property of the ledger, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Event listener | — | — | skip: Application code subscribing to chaincode events, part of the client application. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Event | — | — | skip: A message on the wire, not a placeable node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Existing enterprise systems | — | — | skip: Collective label for systems of record outside the design, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Key management | — | — | skip: Generic key-management capability label; the placed node is the KMS or vault product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Ledger | — | — | skip: The ledger is the state held inside a blockchain network, drawn as the network node, not a separate one. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Membership services provider API | — | — | skip: Fabric MSP definition: configuration of a network's identities, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Membership | — | — | skip: Fabric membership concept, configuration rather than a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Message bus | — | — | skip: already catalogued as `message-queue` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Node | — | — | skip: A peer of the blockchain network; the network itself is the placed node (hyperledger-fabric). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Services | — | — | skip: Section icon for 'the services', not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Smart contract | — | — | skip: Chaincode deployed into a blockchain network: code on the ledger node, not a separate node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Transaction manager | — | — | skip: Conceptual transaction-coordination label, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Wallet | — | — | skip: Fabric wallet: a credential store inside the client SDK, not a deployed node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Image service | — | — | skip: OS image catalogue an instance boots from: a property of the instance, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Key | — | — | skip: SSH key used to provision an instance, a property of the instance rather than a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Caches | — | — | skip: already catalogued as `cache-cluster` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cloud | — | — | skip: Cloud boundary icon: a group, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Conversation trained and deployed | — | — | skip: State of a Watson Assistant conversation model in the training flow, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Data services | — | — | skip: Section icon for the data services group, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Data sources | — | — | skip: Collective label for upstream sources, not a single node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Device identity service | — | — | skip: Device-identity capability built into an IoT platform, not a separate node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Device registry | — | — | skip: Device registry inside an IoT hub, a feature of the hub rather than a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Enterprise data | — | — | skip: Collective label for data held in existing enterprise systems, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Enterprise user directory | — | — | skip: Generic corporate directory label; the placed node is the directory product (active-directory, openldap). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| File repository | — | — | skip: already catalogued as `file-store` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Ground truth | — | — | skip: Labelled training data used to train a model, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Model | — | — | skip: A trained model artifact; the placed node is the serving runtime that hosts it. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| TMS data interface | — | — | skip: Industry-specific (transportation management system) interface label from an IBM reference architecture, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Artifact management | — | — | skip: Generic artifact-management capability label; the placed node is the repository product (Nexus, Artifactory). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Build and test | — | — | skip: already catalogued as `automation-pipeline` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Code editor | — | — | skip: IDE / code editor, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Collaborative development | — | — | skip: Source-control and collaboration tooling label; the placed node is the SCM product (GitHub, GitLab). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Configuration management | — | — | skip: Generic configuration-management capability; the placed node is the tool (Ansible, Chef, Puppet). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Continuous deploy | — | — | skip: Deploy stage of a delivery pipeline, covered by the BuildTest node (automation-pipeline). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Continuous testing | — | — | skip: Test stage of a delivery pipeline, covered by the BuildTest node (automation-pipeline). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| DevOps | — | — | skip: Section icon for the DevOps group, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Provision | — | — | skip: Infrastructure-provisioning stage of a pipeline, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Release management | — | — | skip: Release process icon, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cloud messaging | — | — | skip: already catalogued as `message-queue` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cloud services | — | — | skip: Section icon for 'services in the cloud', not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cognitive services | — | — | skip: Section icon for the Watson services group, not a single product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Data security | — | — | skip: Section icon for the data-security capability, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Enterprise | — | — | skip: Boundary icon for the enterprise / on-premises estate: a group, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Governance, risk and compliance | — | — | skip: Section icon for the GRC capability, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| IBM Cloud | — | — | skip: Logo / boundary icon for the IBM public cloud itself, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Identity provider | — | — | skip: Generic identity-provider label; the placed node is the IdP product (keycloak, okta, active-directory). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Infrastructure security | — | — | skip: Section icon for the infrastructure-security capability, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Internet | — | — | skip: The internet boundary in a diagram, not a placeable node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| IoT cloud | — | — | skip: Section icon for an IoT platform; IBM's own Watson IoT Platform was withdrawn (end of support 1 December 2023). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Microservices application | — | — | skip: already catalogued as `container-service` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Microservices mesh | — | — | skip: Generic service-mesh label; the placed node is the mesh product (istio, linkerd, kuma). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Monitoring and logging | — | — | skip: already catalogued as `observability-stack` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Offline capabilities | — | — | skip: Offline support is a property of a client (offlineCapable on the client kind), not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Peer cloud | — | — | skip: Boundary icon for another cloud in the diagram, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Watson Retrieve and Rank | — | — | skip: IBM Watson Retrieve and Rank was retired on 3 October 2018 and replaced by Watson Discovery. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Scalable | — | — | skip: Attribute icon marking a component as scalable, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Service discovery and configuration | — | — | skip: Generic service-discovery and configuration label; the placed node is the registry product (consul, eureka, etcd). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Transformation and connectivity | — | — | skip: Generic integration / ESB capability label; the placed node is the integration product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Channels | — | — | skip: Generic architecture symbol for delivery channels, not an IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Dashboard | — | — | skip: Dashboard/console icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Diagnostics | — | — | skip: Generic architecture symbol, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Edge Services | — | — | skip: Category symbol for the edge tier of an IBM reference architecture. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Enterprise Messaging | — | — | skip: Generic architecture symbol; a concrete broker is its own component. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Event Feed | — | — | skip: Generic architecture symbol for a feed of events, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Infrastructure Services | — | — | skip: Category symbol for the infrastructure tier of a reference architecture. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Interservice Communication | — | — | skip: Generic architecture symbol for calls between services, drawn as edges. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Load Balancing and Routing | — | — | skip: Generic architecture symbol; the IBM product is Load Balancer for VPC (ibm-load-balancer). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Mobile Backend | — | — | skip: Generic architecture symbol for a backend tier serving mobile apps. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Mobile Provider Network | — | — | skip: Generic symbol for a carrier network outside the design, not a placeable service. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Monitoring | — | — | skip: Generic category symbol, not the named IBM Cloud Monitoring service. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Peer Services | — | — | skip: Generic architecture symbol for peer environments, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Alert Notification | — | — | skip: IBM Alert Notification was withdrawn from the IBM Cloud catalog (announcement ZP19-0029, 2019). | https://diagrams.mingrammer.com/docs/nodes/ibm |
| API Management | — | — | skip: Generic category symbol; the IBM product is API Connect, which is not this node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cloud Management | — | — | skip: Category symbol for the management tier of a reference architecture. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Cluster Management | — | — | skip: Generic management symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Content Management | — | — | skip: Generic management symbol, not an IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Device Management | — | — | skip: Generic management symbol; IoT device management is part of an iot-hub component. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Information Governance | — | — | skip: Generic governance symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| IT Service Management | — | — | skip: ITSM process symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Management | — | — | skip: Section/category icon. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Monitoring and Metrics | — | — | skip: Generic category symbol, not a named product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Process Management | — | — | skip: Generic management symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Provider Cloud Portal Service | — | — | skip: Portal/console icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Push Notifications | — | — | skip: IBM Cloud Push Notifications was removed from the catalog 2021-07-30 and reached end of support 2022-06-15. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Service Management Tools | — | — | skip: Tooling/menu symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Bridge | — | — | skip: Generic network symbol for a layer-2 bridge, not an IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Gateway | — | — | skip: Generic gateway symbol; IBM's concrete gateways are ibm-public-gateway and ibm-transit-gateway. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Load Balancer Listener | — | — | skip: A listener is configuration of a load balancer, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Load Balancer Pool | — | — | skip: A back-end pool is configuration of a load balancer, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Region | — | — | skip: Location boundary, a group kind rather than a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Router | — | — | skip: Generic network symbol; IBM Cloud exposes no customer-placed router resource. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Rules | — | — | skip: Security group / ACL rules are configuration objects, not nodes. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| VPN Connection | — | — | skip: A connection on a VPN gateway, drawn as an edge, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| VPN Policy | — | — | skip: IKE/IPsec policy is configuration of a VPN gateway, not a node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| API Security | — | — | skip: Generic security category symbol, not a product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Blockchain Security Service | — | — | skip: Generic architecture symbol, not a named IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Firewall | — | — | skip: Duplicate of network/Firewall, added as ibm-firewall. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Identity and Access Management | — | — | skip: already catalogued as `ibm-iam` under ? | https://cloud.ibm.com/docs/account?topic=account-iamoverview |
| Physical Security | — | — | skip: Data-centre physical security concept, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Security Monitoring and Intelligence | — | — | skip: Generic security category symbol, not a named product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Security Services | — | — | skip: Category symbol for the security tier of a reference architecture. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Trusted Computing | — | — | skip: Generic concept symbol, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| VPN | — | — | skip: Duplicate of network/VpnGateway, added as ibm-vpn-gateway. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Communities | — | — | skip: Social collaboration concept icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| File Sync | — | — | skip: Collaboration feature concept, not an IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Live Collaboration | — | — | skip: Collaboration concept icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Messaging | — | — | skip: Social messaging concept icon, not an IBM Cloud product. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Networking | — | — | skip: Social networking concept icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Web browser | — | — | skip: already catalogued as `web-browser` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| User device | — | — | skip: already catalogued as `user-device` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Integrated Digital Experiences | — | — | skip: Generic experience-tier concept icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| Physical Entity | — | — | skip: Generic symbol for a real-world object, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |
| IoT device | — | — | skip: already catalogued as `iot-device` under default | https://diagrams.mingrammer.com/docs/nodes/ibm |
| User | — | — | skip: People/actor icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/ibm |

## Counts

total 165, todo 0, done 21, skip 144.
