# AWS inventory

Official product directory: <https://aws.amazon.com/products/> and the AWS documentation
service index <https://docs.aws.amazon.com/general/latest/gr/aws-service-information.html>.
Lifecycle states (maintenance, sunset, full shutdown) are taken from
<https://docs.aws.amazon.com/general/latest/gr/service-lifecycle.html>. Families below use
AWS's own directory headings. One row per resource a designer places; composite services are
split into their placeable sub-resources.

Status: `done` = component exists in `components/aws/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design. Services in maintenance mode or announced sunset stay `todo` until their end-of-support date has passed; the component header records the date.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon EC2 instance | aws-ec2 | virtual-machine | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html |
| Amazon EC2 Spot Instances | aws-ec2-spot | virtual-machine | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html |
| Amazon EC2 Dedicated Hosts | aws-ec2-dedicated-host | virtual-machine | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/dedicated-hosts-overview.html |
| Amazon EC2 Auto Scaling group | aws-ec2-auto-scaling | virtual-machine | done | https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html |
| AWS Nitro Enclaves | aws-nitro-enclave | virtual-machine | done | https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html |
| Amazon Lightsail instance | aws-lightsail | virtual-machine | done | https://docs.aws.amazon.com/lightsail/latest/userguide/what-is-amazon-lightsail.html |
| Amazon Elastic VMware Service (EVS) | aws-evs | virtual-machine | done | https://docs.aws.amazon.com/evs/latest/userguide/what-is-evs.html |
| AWS Lambda function | lambda | app-server | done | https://docs.aws.amazon.com/lambda/latest/dg/welcome.html |
| Lambda@Edge | aws-lambda-edge | app-server | done | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge.html |
| CloudFront Functions | aws-cloudfront-functions | app-server | done | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html |
| AWS Elastic Beanstalk environment | aws-elastic-beanstalk | app-server | done | https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html |
| AWS Batch | aws-batch | worker | done | https://docs.aws.amazon.com/batch/latest/userguide/what-is-batch.html |
| AWS Parallel Computing Service (PCS) | aws-pcs | big-data-cluster | done | https://docs.aws.amazon.com/pcs/latest/userguide/what-is-pcs.html |
| EC2 Image Builder | aws-ec2-image-builder | ci-pipeline | done | https://docs.aws.amazon.com/imagebuilder/latest/userguide/what-is-image-builder.html |
| EC2 Instance Connect Endpoint | aws-ec2-instance-connect-endpoint | bastion-host | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-using-eice.html |
| AWS Outposts rack | aws-outposts | edge-appliance | done | https://docs.aws.amazon.com/outposts/latest/userguide/what-is-outposts.html |
| AWS Serverless Application Repository | aws-serverless-application-repository | artifact-repository | done | https://docs.aws.amazon.com/serverlessrepo/latest/devguide/what-is-serverlessrepo.html |
| AWS App Runner | aws-app-runner | app-server | done (maintenance since 31 March 2026, closed to new customers; still placeable until end of support) | https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html |
| AWS Local Zones | — | — | skip: infrastructure location, resources are placed in it not drawn as it | https://docs.aws.amazon.com/local-zones/latest/ug/what-is-aws-local-zones.html |
| AWS Wavelength Zones | — | — | skip: infrastructure location, not a resource | https://docs.aws.amazon.com/wavelength/latest/developerguide/what-is-wavelength.html |
| AWS Auto Scaling / Application Auto Scaling | — | — | skip: scaling policy attached to other resources | https://docs.aws.amazon.com/autoscaling/application/userguide/what-is-application-auto-scaling.html |
| Amazon Machine Image (AMI) / launch template | — | — | skip: machine image and configuration artifacts | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html |
| EC2 placement groups / capacity reservations | — | — | skip: placement and purchasing constructs | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html |
| AWS Nitro System | — | — | skip: hypervisor platform, not a resource | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html |

## Containers

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon ECS cluster | aws-ecs | container-orchestrator | done | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html |
| AWS Fargate | aws-fargate | app-server | done | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html |
| Amazon EKS cluster | aws-eks | container-orchestrator | done | https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html |
| Amazon EKS Anywhere | aws-eks-anywhere | edge-appliance | done | https://anywhere.eks.amazonaws.com/docs/overview/ |
| Red Hat OpenShift Service on AWS (ROSA) | aws-rosa | container-orchestrator | done | https://docs.aws.amazon.com/ROSA/latest/userguide/what-is-rosa.html |
| Amazon ECR private registry | aws-ecr | container-registry | done | https://docs.aws.amazon.com/AmazonECR/latest/userguide/encryption-at-rest.html |
| Amazon ECR Public | aws-ecr-public | container-registry | done | https://docs.aws.amazon.com/AmazonECR/latest/public/what-is-ecr.html |
| AWS App Mesh | aws-app-mesh | service-mesh | done | https://docs.aws.amazon.com/app-mesh/latest/userguide/what-is-app-mesh.html |
| AWS Proton | aws-proton | ci-pipeline | done (sunset, closed to new customers 7 October 2025, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/proton/latest/userguide/proton-end-of-support.html |
| AWS Copilot CLI | — | — | skip: command line tool | https://aws.github.io/copilot-cli/ |
| Amazon EKS Distro | — | — | skip: Kubernetes distribution, not a hosted resource | https://distro.eks.amazonaws.com/ |
| Amazon ECS Service Connect | — | — | skip: service discovery feature of an ECS service | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-connect.html |
| AWS App2Container | — | — | skip: migration tooling | https://docs.aws.amazon.com/app2container/latest/UserGuide/what-is-a2c.html |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon S3 bucket | s3 | object-store | done | https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html |
| Amazon S3 Glacier (archive storage classes) | aws-s3-glacier | object-store | done | https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html |
| Amazon S3 Express One Zone (directory bucket) | aws-s3-express-one-zone | object-store | done | https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-express-one-zone.html |
| Amazon S3 Tables (table bucket) | aws-s3-tables | object-store | done | https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-tables.html |
| Amazon S3 Vectors (vector bucket) | aws-s3-vectors | vector-database | done | https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html |
| Amazon EBS volume | aws-ebs | block-storage | done | https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html |
| EC2 instance store | aws-instance-store | block-storage | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/InstanceStorage.html |
| Amazon EFS file system | aws-efs | file-storage | done | https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html |
| Amazon FSx for Windows File Server | aws-fsx-windows | file-storage | done | https://docs.aws.amazon.com/fsx/latest/WindowsGuide/what-is.html |
| Amazon FSx for Lustre | aws-fsx-lustre | file-storage | done | https://docs.aws.amazon.com/fsx/latest/LustreGuide/what-is.html |
| Amazon FSx for NetApp ONTAP | aws-fsx-ontap | file-storage | done | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/what-is-fsx-ontap.html |
| Amazon FSx for OpenZFS | aws-fsx-openzfs | file-storage | done | https://docs.aws.amazon.com/fsx/latest/OpenZFSGuide/what-is-fsx.html |
| Amazon File Cache | aws-file-cache | file-storage | done | https://docs.aws.amazon.com/fsx/latest/FileCacheGuide/what-is.html |
| AWS Storage Gateway | aws-storage-gateway | edge-appliance | done | https://docs.aws.amazon.com/storagegateway/latest/userguide/WhatIsStorageGateway.html |
| AWS Backup vault | aws-backup | backup-service | done | https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html |
| Amazon Data Lifecycle Manager | aws-data-lifecycle-manager | backup-service | done | https://docs.aws.amazon.com/ebs/latest/userguide/snapshot-lifecycle.html |
| AWS Elastic Disaster Recovery | aws-drs | backup-service | done | https://docs.aws.amazon.com/drs/latest/userguide/what-is-drs.html |
| AWS DataSync | aws-datasync | worker | done | https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html |
| AWS Snow Family (Snowball Edge, Snowcone) | — | — | skip: physical offline transfer appliance; Snowball Edge full shutdown 12 November 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS Snowmobile | — | — | skip: full shutdown 14 March 2024 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon FSx File Gateway | aws-fsx-file-gateway | edge-appliance | done (maintenance since 28 October 2024, use FSx for Windows File Server; still placeable until end of support) | https://docs.aws.amazon.com/filegateway/latest/filefsxw/what-is-file-fsxw.html |
| Amazon S3 Object Lambda | aws-s3-object-lambda | app-server | done (maintenance since 7 November 2025; still placeable until end of support) | https://docs.aws.amazon.com/AmazonS3/latest/userguide/transforming-objects.html |
| Amazon S3 Select / Glacier Select | — | — | skip: maintenance since 25 July 2024, query feature not a node | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |
| S3 access points / Multi-Region Access Points | — | — | skip: access endpoints on an existing bucket | https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html |
| Amazon S3 storage classes and lifecycle rules | — | — | skip: configuration of a bucket, not separate nodes | https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html |
| Recycle Bin | — | — | skip: snapshot retention feature | https://docs.aws.amazon.com/ebs/latest/userguide/recycle-bin.html |

## Databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon RDS DB instance | aws-rds | sql-database | done | https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html |
| Amazon RDS Custom | aws-rds-custom | sql-database | done | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/custom-reqs-limits.html |
| Amazon Aurora cluster | aurora | sql-database | done | https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html |
| Amazon Aurora DSQL | aws-aurora-dsql | sql-database | done | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/data-encryption.html |
| Oracle Database@AWS | aws-oracle-database | sql-database | done | https://docs.aws.amazon.com/odb/latest/UserGuide/what-is-odb.html |
| RDS Proxy | rds-proxy | database-proxy | done | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html |
| Amazon DynamoDB table | dynamodb | nosql-database | done | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html |
| DynamoDB Accelerator (DAX) | aws-dax | cache | done | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.concepts.html |
| Amazon DocumentDB cluster | aws-documentdb | nosql-database | done | https://docs.aws.amazon.com/documentdb/latest/developerguide/encryption-at-rest.html |
| Amazon Keyspaces (for Apache Cassandra) | aws-keyspaces | nosql-database | done | https://docs.aws.amazon.com/keyspaces/latest/devguide/how-it-works.html |
| Amazon ElastiCache | aws-elasticache | cache | done | https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/at-rest-encryption.html |
| Amazon MemoryDB | aws-memorydb | cache | done | https://docs.aws.amazon.com/memorydb/latest/APIReference/API_CreateCluster.html |
| Amazon Neptune cluster | neptune | graph-database | done | https://docs.aws.amazon.com/neptune/latest/userguide/intro.html |
| Amazon Neptune Analytics | aws-neptune-analytics | graph-database | done | https://docs.aws.amazon.com/neptune-analytics/latest/apiref/API_CreateGraph.html |
| Amazon Timestream for InfluxDB | aws-timestream-influxdb | timeseries-database | done | https://docs.aws.amazon.com/ts-influxdb/latest/ts-influxdb-api/API_CreateDbInstance.html |
| Amazon Redshift cluster | redshift | data-warehouse | done | https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html |
| Amazon QLDB ledger | qldb | ledger | done | https://docs.aws.amazon.com/qldb/latest/developerguide/what-is.html |
| AWS Database Migration Service | aws-dms | change-data-capture | done | https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html |
| Amazon Timestream for LiveAnalytics | aws-timestream-liveanalytics | timeseries-database | done (maintenance since 20 June 2025, use Timestream for InfluxDB; still placeable until end of support) | https://docs.aws.amazon.com/timestream/latest/developerguide/what-is-timestream.html |
| Amazon SimpleDB | — | — | skip: legacy service, not offered to new customers | https://docs.aws.amazon.com/AmazonSimpleDB/latest/DeveloperGuide/Welcome.html |
| Aurora Serverless v2 / Redshift Serverless / DynamoDB on-demand | — | — | skip: capacity modes of the parent cluster | https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html |
| Aurora Global Database / RDS Multi-AZ | — | — | skip: replication topology configuration of the cluster | https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html |
| DMS Schema Conversion / Fleet Advisor | — | — | skip: assessment tooling; Fleet Advisor full shutdown 20 May 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

Amazon RDS is one row: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server and Db2 are an engine
property of the instance, not separate nodes. The same holds for ElastiCache (Valkey, Redis
OSS, Memcached) and Amazon MQ (ActiveMQ, RabbitMQ).

## Networking A — VPC and connectivity

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon VPC | aws-vpc | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html |
| VPC subnet | aws-subnet | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html |
| Internet gateway | aws-internet-gateway | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html |
| NAT gateway | aws-nat-gateway | nat-gateway | done | https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html |
| Security group | aws-security-group | firewall | done | https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html |
| Network ACL | aws-network-acl | firewall | done | https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html |
| Elastic network interface | aws-elastic-network-interface | network-fabric | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html |
| Elastic IP address | aws-elastic-ip | network-fabric | done | https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html |
| VPC peering connection | aws-vpc-peering | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html |
| AWS PrivateLink VPC endpoint | aws-vpc-endpoint | private-link | done | https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-aws-services.html |
| PrivateLink endpoint service | aws-privatelink-service | private-link | done | https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html |
| AWS Transit Gateway | aws-transit-gateway | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html |
| AWS Cloud WAN core network | aws-cloud-wan | network-fabric | done | https://docs.aws.amazon.com/network-manager/latest/cloudwan/what-is-cloudwan.html |
| AWS Direct Connect | aws-direct-connect | network-fabric | done | https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html |
| Direct Connect gateway | aws-direct-connect-gateway | network-fabric | done | https://docs.aws.amazon.com/directconnect/latest/UserGuide/direct-connect-gateways-intro.html |
| AWS Site-to-Site VPN | aws-site-to-site-vpn | vpn-gateway | done | https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html |
| AWS Client VPN | aws-client-vpn | vpn-gateway | done | https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/what-is.html |
| Amazon VPC IP Address Manager (IPAM) | aws-vpc-ipam | network-fabric | done | https://docs.aws.amazon.com/vpc/latest/ipam/what-it-is-ipam.html |
| Amazon VPC Lattice service network | aws-vpc-lattice | service-mesh | done | https://docs.aws.amazon.com/vpc-lattice/latest/ug/what-is-vpc-lattice.html |
| AWS Cloud Map | aws-cloud-map | coordination-service | done | https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html |
| AWS Verified Access | aws-verified-access | bastion-host | done | https://docs.aws.amazon.com/verified-access/latest/ug/what-is-verified-access.html |
| Global Networks for Transit Gateways (Network Manager) | — | — | skip: management and visualization view over existing gateways | https://docs.aws.amazon.com/network-manager/latest/tgwnm/what-are-global-networks.html |
| VPC route tables / prefix lists | — | — | skip: routing configuration of a VPC | https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html |
| VPC Reachability Analyzer / Network Access Analyzer | — | — | skip: analysis tooling over an existing VPC | https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html |
| AWS Private 5G | — | — | skip: full shutdown 20 May 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## Networking B — delivery, edge and network security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Application Load Balancer | alb | load-balancer | done | https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html |
| Network Load Balancer | nlb | load-balancer | done | https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html |
| Gateway Load Balancer | aws-gwlb | load-balancer | done | https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html |
| Classic Load Balancer | aws-classic-load-balancer | load-balancer | done | https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/introduction.html |
| Amazon CloudFront distribution | cloudfront | cdn | done | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html |
| AWS Global Accelerator | aws-global-accelerator | load-balancer | done | https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html |
| Amazon Route 53 hosted zone | route53 | dns | done | https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html |
| Route 53 Resolver endpoint | aws-route53-resolver | dns | done | https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html |
| Route 53 Resolver DNS Firewall | aws-route53-dns-firewall | firewall | done | https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-dns-firewall.html |
| Amazon Application Recovery Controller (ARC) | aws-application-recovery-controller | dns | done | https://docs.aws.amazon.com/r53recovery/latest/dg/what-is-route53-recovery.html |
| Amazon API Gateway (REST / HTTP API) | aws-api-gateway | api-gateway | done | https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html |
| Amazon API Gateway WebSocket API | aws-api-gateway-websocket | realtime-gateway | done | https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html |
| AWS Network Firewall | aws-network-firewall | firewall | done | https://docs.aws.amazon.com/network-firewall/latest/developerguide/what-is-aws-network-firewall.html |
| AWS WAF web ACL | aws-waf | waf | done | https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html |
| AWS Shield / Shield Advanced | aws-shield | ddos-protection | done | https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html |
| AWS WAF Classic | aws-waf-classic | waf | done (sunset, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/waf/latest/developerguide/classic-waf-chapter.html |
| AWS Firewall Manager | — | — | skip: policy manager over WAF, Shield and Network Firewall instances | https://docs.aws.amazon.com/waf/latest/developerguide/fms-chapter.html |
| Elastic Load Balancing (umbrella) | — | — | skip: brand covering ALB, NLB, GWLB and CLB | https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html |
| Route 53 Profiles | — | — | skip: configuration sharing construct for resolver rules | https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/profiles.html |
| CloudFront Origin Access Control / key groups | — | — | skip: configuration of a distribution | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html |

## Security A — identity and key management

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS Identity and Access Management (IAM) | aws-iam | identity-provider | done | https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html |
| AWS IAM Identity Center | aws-iam-identity-center | identity-provider | done | https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-mfa.html |
| IAM Roles Anywhere | aws-iam-roles-anywhere | identity-provider | done | https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html |
| Amazon Cognito user pool | aws-cognito | identity-provider | done | https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html |
| Amazon Cognito identity pool | aws-cognito-identity-pool | identity-provider | done | https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html |
| AWS Directory Service (Managed Microsoft AD, AD Connector) | aws-directory-service | identity-provider | done | https://docs.aws.amazon.com/directoryservice/latest/admin-guide/directory_microsoft_ad.html |
| AWS Key Management Service | aws-kms | key-management | done | https://docs.aws.amazon.com/kms/latest/developerguide/overview.html |
| AWS CloudHSM cluster | cloudhsm | key-management | done | https://docs.aws.amazon.com/cloudhsm/latest/userguide/introduction.html |
| AWS Secrets Manager | aws-secrets-manager | key-management | done | https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html |
| AWS Certificate Manager | aws-acm | key-management | done | https://docs.aws.amazon.com/acm/latest/userguide/acm-concepts.html |
| AWS Private Certificate Authority | aws-private-ca | key-management | done | https://docs.aws.amazon.com/privateca/latest/APIReference/API_CreateCertificateAuthority.html |
| AWS Signer | aws-signer | key-management | done | https://docs.aws.amazon.com/signer/latest/api/API_PutSigningProfile.html |
| AWS Payment Cryptography | aws-payment-cryptography | key-management | done | https://docs.aws.amazon.com/payment-cryptography/latest/userguide/data-protection.html |
| AWS Security Token Service (STS) | — | — | skip: credential API of IAM | https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html |
| Amazon Cloud Directory | aws-cloud-directory | graph-database | done (maintenance since 7 October 2025; end of support 24 July 2027) | https://docs.aws.amazon.com/clouddirectory/latest/developerguide/what_is_cloud_directory.html |
| AWS Directory Service Simple AD | aws-simple-ad | identity-provider | done (maintenance since 30 June 2026; no end-of-support date announced) | https://docs.aws.amazon.com/directoryservice/latest/admin-guide/directory_simple_ad.html |
| Amazon Cognito Sync | aws-cognito-sync | nosql-database | done (maintenance since 30 June 2026; no end-of-support date announced) | https://docs.aws.amazon.com/cognito/latest/developerguide/synchronizing-data.html |
| AWS Sign-In | — | — | skip: console sign-in endpoint | https://docs.aws.amazon.com/signin/latest/userguide/what-is-sign-in.html |

## Security B — threat detection, governance and compliance

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon GuardDuty | aws-guardduty | monitoring | done | https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html |
| Amazon Inspector | aws-inspector | monitoring | done | https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html |
| Amazon Macie | aws-macie | monitoring | done | https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html |
| Amazon Detective | aws-detective | monitoring | done | https://docs.aws.amazon.com/detective/latest/userguide/what-is-detective.html |
| AWS Security Hub CSPM | aws-security-hub | monitoring | done | https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html |
| Amazon Security Lake | aws-security-lake | object-store | done | https://docs.aws.amazon.com/security-lake/latest/userguide/what-is-security-lake.html |
| AWS Security Incident Response | aws-security-incident-response | monitoring | done | https://docs.aws.amazon.com/security-ir/latest/userguide/what-is.html |
| Amazon Verified Permissions | aws-verified-permissions | policy-engine | done | https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html |
| AWS Resource Access Manager | aws-ram | policy-engine | done | https://docs.aws.amazon.com/ram/latest/userguide/what-is.html |
| IAM Access Analyzer | aws-iam-access-analyzer | policy-engine | done | https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html |
| AWS Audit Manager | aws-audit-manager | monitoring | done (maintenance mode from 30 April 2026, closed to new accounts and Regions; existing deployments continue) | https://docs.aws.amazon.com/audit-manager/latest/userguide/audit-manager-availability-change.html |
| AWS Artifact | — | — | skip: compliance report portal | https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html |
| Amazon Inspector Classic | — | — | skip: full shutdown 20 May 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS Control Catalog | — | — | skip: reference catalog of governance controls | https://docs.aws.amazon.com/controlcatalog/latest/APIReference/Welcome.html |

## Analytics A — query, processing and governance

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon Athena workgroup | aws-athena | data-warehouse | done | https://docs.aws.amazon.com/athena/latest/ug/what-is.html |
| Amazon EMR cluster | aws-emr | big-data-cluster | done | https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-ha.html |
| Amazon EMR Serverless | aws-emr-serverless | big-data-cluster | done | https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/app-behavior.html |
| AWS Glue job | glue-job | worker | done | https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html |
| AWS Glue Data Catalog | aws-glue-data-catalog | data-catalog | done | https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html |
| AWS Glue crawler | aws-glue-crawler | worker | done | https://docs.aws.amazon.com/glue/latest/dg/crawler-configuration.html |
| AWS Glue Schema Registry | glue-schema-registry | schema-registry | done | https://docs.aws.amazon.com/glue/latest/dg/schema-registry.html |
| AWS Glue DataBrew | aws-databrew | worker | done | https://docs.aws.amazon.com/databrew/latest/dg/jobs.recipe.html |
| AWS Lake Formation | aws-lake-formation | policy-engine | done | https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html |
| Amazon DataZone | aws-datazone | data-catalog | done | https://docs.aws.amazon.com/datazone/latest/userguide/create-domain.html |
| Amazon QuickSight (Amazon Quick Suite) | aws-quicksight | bi-service | done | https://docs.aws.amazon.com/quicksight/latest/user/spice.html |
| Amazon OpenSearch Service domain | aws-opensearch | search-index | done | https://docs.aws.amazon.com/opensearch-service/latest/developerguide/managedomains-multiaz.html |
| Amazon OpenSearch Ingestion pipeline | aws-opensearch-ingestion | stream-processor | done | https://docs.aws.amazon.com/opensearch-service/latest/developerguide/creating-pipeline.html |
| Amazon Managed Workflows for Apache Airflow | aws-mwaa | workflow-engine | done | https://docs.aws.amazon.com/mwaa/latest/userguide/environment-class.html |
| AWS Clean Rooms collaboration | aws-clean-rooms | big-data-cluster | done | https://docs.aws.amazon.com/clean-rooms/latest/userguide/what-is.html |
| AWS Clean Rooms ML | aws-clean-rooms-ml | ml-platform | done | https://docs.aws.amazon.com/clean-rooms/latest/userguide/machine-learning.html |
| AWS Data Exchange | aws-data-exchange | third-party-api | done | https://docs.aws.amazon.com/data-exchange/latest/userguide/what-is.html |
| AWS Entity Resolution | aws-entity-resolution | worker | done | https://docs.aws.amazon.com/entityresolution/latest/userguide/what-is-service.html |
| Amazon FinSpace | aws-finspace | timeseries-database | done (sunset, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/finspace/latest/userguide/finspace-what-is.html |
| AWS Data Pipeline | — | — | skip: legacy orchestration, closed to new customers; use Step Functions or Glue | https://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/what-is-datapipeline.html |
| Amazon CloudSearch | aws-cloudsearch | search-index | done (maintenance since 25 July 2024, use OpenSearch Service; still placeable until end of support) | https://docs.aws.amazon.com/cloudsearch/latest/developerguide/concepts-scaling.html |
| AWS Glue Ray jobs | aws-glue-ray-job | worker | done (maintenance since 31 March 2026; still placeable until end of support) | https://docs.aws.amazon.com/glue/latest/dg/author-job-ray.html |
| Governed Tables in AWS Lake Formation | — | — | skip: full shutdown 31 December 2024 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon OpenSearch Serverless | — | — | skip: capacity mode of OpenSearch Service | https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html |
| Amazon EMR on EKS | — | — | skip: deployment option of EMR onto an existing EKS cluster | https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/emr-eks.html |

## Analytics B — streaming

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon Kinesis Data Streams | kinesis | stream | done | https://docs.aws.amazon.com/streams/latest/dev/introduction.html |
| Amazon Data Firehose | aws-firehose | stream-processor | done | https://docs.aws.amazon.com/firehose/latest/dev/create-configure-backup.html |
| Amazon Kinesis Video Streams | aws-kinesis-video-streams | stream | done | https://docs.aws.amazon.com/kinesisvideostreams/latest/dg/API_CreateStream.html |
| Amazon Managed Service for Apache Flink | aws-managed-flink | stream-processor | done | https://docs.aws.amazon.com/managed-flink/latest/java/how-fault.html |
| Amazon MSK cluster | aws-msk | stream | done | https://docs.aws.amazon.com/msk/latest/developerguide/msk-default-configuration.html |
| Amazon MSK Connect connector | aws-msk-connect | worker | done | https://docs.aws.amazon.com/MSKC/latest/mskc/API_CreateConnector.html |
| Amazon Kinesis Data Analytics for SQL | — | — | skip: full shutdown 27 January 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon MSK Serverless | — | — | skip: capacity mode of an MSK cluster | https://docs.aws.amazon.com/msk/latest/developerguide/serverless.html |

## Application integration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon SQS queue | sqs | queue | done | https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html |
| Amazon SNS topic | sns | pubsub-topic | done | https://docs.aws.amazon.com/sns/latest/dg/welcome.html |
| Amazon EventBridge event bus | aws-eventbridge | pubsub-topic | done | https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html |
| Amazon EventBridge Pipes | aws-eventbridge-pipes | stream-processor | done | https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html |
| Amazon EventBridge Scheduler | aws-eventbridge-scheduler | worker | done | https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html |
| Amazon EventBridge Schema Registry | aws-eventbridge-schemas | schema-registry | done | https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema-registry.html |
| AWS Step Functions state machine | aws-step-functions | workflow-engine | done | https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html |
| Amazon Simple Workflow Service (SWF) | aws-swf | workflow-engine | done | https://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-welcome.html |
| Amazon MQ broker | aws-mq | queue | done | https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/welcome.html |
| AWS AppSync GraphQL API | aws-appsync | api-gateway | done | https://docs.aws.amazon.com/appsync/latest/devguide/what-is-appsync.html |
| AWS AppSync Events API | aws-appsync-events | realtime-gateway | done | https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html |
| Amazon AppFlow flow | aws-appflow | worker | done | https://docs.aws.amazon.com/appflow/latest/userguide/what-is-appflow.html |
| AWS B2B Data Interchange | aws-b2b-data-interchange | worker | done | https://docs.aws.amazon.com/b2bi/latest/userguide/what-is-b2bi.html |
| AWS AppFabric | aws-appfabric | third-party-api | done | https://docs.aws.amazon.com/appfabric/latest/adminguide/what-is-appfabric.html |
| Amazon SES | aws-ses | notification-service | done | https://docs.aws.amazon.com/ses/latest/dg/Welcome.html |
| AWS End User Messaging (SMS, push, social) | aws-end-user-messaging | notification-service | done | https://docs.aws.amazon.com/sms-voice/latest/userguide/what-is-service.html |
| Amazon Pinpoint | aws-pinpoint | notification-service | done | https://docs.aws.amazon.com/pinpoint/latest/userguide/welcome.html |
| AWS User Notifications | aws-user-notifications | notification-service | done | https://docs.aws.amazon.com/notifications/latest/userguide/what-is-service.html |
| Amazon CloudWatch Events | — | — | skip: prior name of EventBridge, same resource | https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html |
| SNS Message Data Protection | — | — | skip: maintenance since 31 March 2026, feature of a topic | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |

Amazon Pinpoint is retained as a component although it is in sunset with end of support on
30 October 2026; new designs should use AWS End User Messaging.

## AI and machine learning A — platforms and foundation models

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon SageMaker AI (domain / studio) | aws-sagemaker | ml-platform | done | https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateDomain.html |
| Amazon SageMaker AI training job | aws-sagemaker-training-job | worker | done | https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateTrainingJob.html |
| Amazon SageMaker AI endpoint | sagemaker-endpoint | ml-inference | done | https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html |
| Amazon SageMaker Feature Store | aws-sagemaker-feature-store | ml-platform | done | https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateFeatureGroup.html |
| Amazon SageMaker Model Registry | aws-sagemaker-model-registry | artifact-repository | done | https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateModelPackage.html |
| Amazon Bedrock | aws-bedrock | ai-service | done | https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html |
| Amazon Bedrock AgentCore | aws-bedrock-agentcore | ai-service | done | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html |
| Amazon Bedrock Knowledge Bases | aws-bedrock-knowledge-base | search-index | done | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking-parsing.html |
| Amazon Bedrock Guardrails | aws-bedrock-guardrails | ai-service | done | https://docs.aws.amazon.com/bedrock/latest/APIReference/API_CreateGuardrail.html |
| AWS HealthOmics | aws-healthomics | object-store | done | https://docs.aws.amazon.com/omics/latest/dev/create-sequence-store.html |
| Amazon SageMaker Unified Studio | — | — | skip: unified console over SageMaker AI, DataZone, Athena and EMR | https://docs.aws.amazon.com/sagemaker-unified-studio/latest/userguide/what-is-sagemaker-unified-studio.html |
| Amazon Nova / Titan models | — | — | skip: model families served through Amazon Bedrock | https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html |
| Amazon Q Developer | — | — | skip: coding assistant, not a node | https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html |
| Amazon Q Business | aws-q-business | ai-service | done (maintenance since 30 June 2026; still placeable until end of support) | https://docs.aws.amazon.com/amazonq/latest/qbusiness-ug/what-is.html |
| Amazon CodeWhisperer | — | — | skip: renamed Amazon Q Developer | https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html |
| Amazon Machine Learning (classic) | — | — | skip: retired predecessor of SageMaker | https://docs.aws.amazon.com/machine-learning/latest/dg/what-is-amazon-machine-learning.html |
| Amazon Augmented AI (A2I) | aws-augmented-ai | workflow-engine | done (maintenance since 30 June 2026; still placeable until end of support) | https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_HumanLoopConfig.html |
| Amazon SageMaker Ground Truth / Clarify / Debugger / Model Monitor | — | — | skip: maintenance since 30 June 2026, SageMaker features not nodes | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |
| Amazon Mechanical Turk | — | — | skip: human workforce marketplace, sunset 30 September 2026 | https://docs.aws.amazon.com/general/latest/gr/sunset_services.html |
| AWS Transform | — | — | skip: agentic modernization tooling | https://docs.aws.amazon.com/transform/latest/userguide/what-is.html |
| AWS DeepRacer | — | — | skip: training and education service | https://docs.aws.amazon.com/deepracer/latest/developerguide/what-is-deepracer.html |
| AWS DeepComposer / DeepLens | — | — | skip: full shutdown 2024-2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## AI and machine learning B — applied AI services

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon Comprehend | aws-comprehend | ai-service | done | https://docs.aws.amazon.com/comprehend/latest/dg/guidelines-and-limits.html |
| Amazon Comprehend Medical | aws-comprehend-medical | ai-service | done | https://docs.aws.amazon.com/comprehend-medical/latest/dev/comprehendmedical-quotas.html |
| Amazon Rekognition | aws-rekognition | ai-service | done | https://docs.aws.amazon.com/rekognition/latest/dg/limits.html |
| Amazon Textract | aws-textract | ai-service | done | https://docs.aws.amazon.com/textract/latest/dg/limits-document.html |
| Amazon Transcribe | aws-transcribe | ai-service | done | https://docs.aws.amazon.com/general/latest/gr/transcribe.html |
| Amazon Polly | aws-polly | ai-service | done | https://docs.aws.amazon.com/polly/latest/dg/limits.html |
| Amazon Translate | aws-translate | ai-service | done | https://docs.aws.amazon.com/translate/latest/dg/what-is-limits.html |
| Amazon Lex bot | aws-lex | ai-service | done | https://docs.aws.amazon.com/lexv2/latest/dg/quotas.html |
| Amazon Personalize | aws-personalize | ai-service | done | https://docs.aws.amazon.com/personalize/latest/dg/limits.html |
| Amazon HealthLake (FHIR data store) | aws-healthlake | nosql-database | done | https://docs.aws.amazon.com/healthlake/latest/devguide/what-is-amazon-health-lake.html |
| AWS HealthImaging | aws-healthimaging | object-store | done | https://docs.aws.amazon.com/healthimaging/latest/devguide/data-encryption.html |
| AWS HealthScribe | aws-healthscribe | ai-service | done | https://docs.aws.amazon.com/general/latest/gr/transcribe.html |
| Amazon Kendra | aws-kendra | search-index | done (maintenance since 30 June 2026; still placeable until end of support) | https://docs.aws.amazon.com/kendra/latest/dg/quotas.html |
| Amazon Forecast | aws-forecast | ai-service | done (maintenance since 29 July 2024, use SageMaker Canvas; still placeable until end of support) | https://docs.aws.amazon.com/forecast/latest/dg/limits.html |
| Amazon Fraud Detector | aws-fraud-detector | ai-service | done (sunset, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/frauddetector/latest/ug/limits.html |
| Amazon Lookout for Equipment | aws-lookout-for-equipment | ai-service | done (sunset, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/lookout-for-equipment/latest/ug/what-is.html |
| Amazon Lookout for Vision | — | — | skip: full shutdown 31 October 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Lookout for Metrics | — | — | skip: full shutdown 10 October 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS Panorama | — | — | skip: full shutdown 20 May 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Monitron | aws-monitron | iot-hub | done (maintenance since 31 October 2024; still placeable until end of support) | https://docs.aws.amazon.com/Monitron/latest/user-guide/monitron-components.html |
| Amazon Transcribe Medical / Call Analytics | — | — | skip: capabilities of Amazon Transcribe | https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html |
| Amazon Comprehend Topic Modeling / Event Detection | — | — | skip: maintenance since 31 March 2026, features of Comprehend | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |

## Management A — observability

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon CloudWatch | cloudwatch | monitoring | done | https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html |
| Amazon CloudWatch Logs | aws-cloudwatch-logs | monitoring | done | https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html |
| CloudWatch Synthetics canary | aws-cloudwatch-synthetics | monitoring | done | https://docs.aws.amazon.com/AmazonSynthetics/latest/APIReference/API_CreateCanary.html |
| CloudWatch RUM | aws-cloudwatch-rum | monitoring | done | https://docs.aws.amazon.com/cloudwatchrum/latest/APIReference/API_AppMonitorConfiguration.html |
| CloudWatch Application Signals | aws-cloudwatch-application-signals | monitoring | done | https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Monitoring-Sections.html |
| CloudWatch Internet Monitor | aws-cloudwatch-internet-monitor | monitoring | done | https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-IM-get-started.html |
| CloudWatch Network Monitor | aws-cloudwatch-network-monitor | monitoring | done | https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/nw-monitor-how-it-works.html |
| AWS X-Ray | aws-xray | monitoring | done | https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html |
| AWS CloudTrail trail | aws-cloudtrail | monitoring | done | https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-a-trail-using-the-console-first-time.html |
| Amazon Managed Grafana workspace | aws-managed-grafana | monitoring | done | https://docs.aws.amazon.com/grafana/latest/APIReference/API_CreateWorkspace.html |
| Amazon Managed Service for Prometheus | aws-managed-prometheus | monitoring | done | https://docs.aws.amazon.com/prometheus/latest/userguide/what-is-Amazon-Managed-Service-Prometheus.html |
| Amazon DevOps Guru | aws-devops-guru | monitoring | done | https://docs.aws.amazon.com/devops-guru/latest/userguide/update-settings.html |
| Amazon CloudWatch investigations (AI Operations) | aws-aiops | monitoring | done | https://docs.aws.amazon.com/cloudwatchinvestigations/latest/APIReference/API_CreateInvestigationGroup.html |
| AWS Resilience Hub | aws-resilience-hub | monitoring | done | https://docs.aws.amazon.com/resilience-hub/latest/APIReference/API_CreateApp.html |
| AWS Compute Optimizer | aws-compute-optimizer | monitoring | done | https://docs.aws.amazon.com/compute-optimizer/latest/ug/what-is-compute-optimizer.html |
| AWS Trusted Advisor | aws-trusted-advisor | monitoring | done | https://docs.aws.amazon.com/awssupport/latest/user/trusted-advisor.html |
| AWS Chatbot (Amazon Q Developer in chat applications) | aws-chatbot | notification-service | done | https://docs.aws.amazon.com/chatbot/latest/adminguide/what-is.html |
| AWS Health | — | — | skip: platform status dashboard | https://docs.aws.amazon.com/health/latest/ug/what-is-aws-health.html |
| AWS CloudTrail Lake | aws-cloudtrail-lake | monitoring | done (maintenance since 31 March 2026; closed to new customers 31 May 2026) | https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake-manage-costs.html |
| Amazon CloudWatch Evidently | — | — | skip: full shutdown 17 October 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## Management B — governance, accounts and operations

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS Config | aws-config | policy-engine | done | https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html |
| AWS Systems Manager | aws-systems-manager | worker | done | https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html |
| Systems Manager Parameter Store | aws-ssm-parameter-store | key-management | done | https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html |
| Systems Manager Session Manager | aws-ssm-session-manager | bastion-host | done | https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html |
| AWS AppConfig | aws-appconfig | feature-flag-service | done | https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html |
| AWS Organizations | aws-organizations | policy-engine | done | https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html |
| AWS Control Tower | aws-control-tower | policy-engine | done | https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html |
| AWS Service Catalog | aws-service-catalog | artifact-repository | done | https://docs.aws.amazon.com/servicecatalog/latest/adminguide/introduction.html |
| AWS License Manager | aws-license-manager | policy-engine | done | https://docs.aws.amazon.com/license-manager/latest/userguide/license-manager.html |
| AWS Fault Injection Service | aws-fis | worker | done | https://docs.aws.amazon.com/fis/latest/userguide/what-is.html |
| AWS CloudFormation | — | — | skip: deployment control plane | https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html |
| AWS Cloud Development Kit (CDK) / SAM | — | — | skip: developer tooling over CloudFormation | https://docs.aws.amazon.com/cdk/v2/guide/home.html |
| AWS Cloud Control API | — | — | skip: uniform resource API layer | https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/what-is-cloudcontrolapi.html |
| AWS Well-Architected Tool | — | — | skip: architecture review tooling | https://docs.aws.amazon.com/wellarchitected/latest/userguide/intro.html |
| AWS Launch Wizard | — | — | skip: guided deployment tooling | https://docs.aws.amazon.com/launchwizard/latest/userguide/what-is-launch-wizard.html |
| AWS Resource Explorer / Resource Groups and Tagging | — | — | skip: inventory and tagging tooling | https://docs.aws.amazon.com/resource-explorer/latest/userguide/welcome.html |
| AWS Service Quotas | — | — | skip: quota management tooling | https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html |
| Systems Manager Quick Setup | — | — | skip: configuration wizard | https://docs.aws.amazon.com/systems-manager/latest/userguide/quick-setup.html |
| Systems Manager Incident Manager / Change Manager | aws-ssm-incident-and-change-manager | workflow-engine | done | https://docs.aws.amazon.com/systems-manager/latest/userguide/change-manager.html |
| AWS Systems Manager for SAP | — | — | skip: management add-on for SAP workloads | https://docs.aws.amazon.com/ssm-sap/latest/userguide/what-is-ssm-for-sap.html |
| AWS Management Console / CloudShell | — | — | skip: portal and CLI environment | https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html |
| AWS Billing, Cost Explorer, Budgets, Billing Conductor | — | — | skip: billing and cost management | https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-what-is.html |
| AWS Marketplace | — | — | skip: software marketplace | https://docs.aws.amazon.com/marketplace/latest/buyerguide/what-is-marketplace.html |
| AWS Support / AWS Managed Services / re:Post Private | — | — | skip: support offerings | https://docs.aws.amazon.com/awssupport/latest/user/getting-started.html |
| AWS MCP Server | — | — | skip: developer tooling | https://docs.aws.amazon.com/general/latest/gr/aws-mcp.html |

## Developer tools

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS CodeCommit repository | aws-codecommit | artifact-repository | done | https://docs.aws.amazon.com/codecommit/latest/userguide/welcome.html |
| AWS CodeBuild project | aws-codebuild | ci-pipeline | done | https://docs.aws.amazon.com/codebuild/latest/APIReference/API_CreateProject.html |
| AWS CodeDeploy | aws-codedeploy | ci-pipeline | done | https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html |
| AWS CodePipeline | aws-codepipeline | ci-pipeline | done | https://docs.aws.amazon.com/codepipeline/latest/userguide/concepts.html |
| AWS CodeArtifact repository | aws-codeartifact | artifact-repository | done | https://docs.aws.amazon.com/codeartifact/latest/ug/welcome.html |
| Amazon CodeGuru Profiler | aws-codeguru-profiler | monitoring | done | https://docs.aws.amazon.com/codeguru/latest/profiler-ug/what-is-codeguru-profiler.html |
| AWS Device Farm | aws-device-farm | client | done | https://docs.aws.amazon.com/devicefarm/latest/developerguide/welcome.html |
| AWS App Studio | aws-app-studio | app-server | done | https://aws.amazon.com/appstudio/faqs/ |
| Amazon CodeCatalyst | aws-codecatalyst | ci-pipeline | done (maintenance since 7 November 2025; still placeable until end of support) | https://docs.aws.amazon.com/codecatalyst/latest/userguide/welcome.html |
| Amazon CodeGuru Reviewer | aws-codeguru-reviewer | policy-engine | done (maintenance since 7 October 2025; still placeable until end of support) | https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/welcome.html |
| Amazon CodeGuru Security | — | — | skip: static analysis tooling in the pipeline, not a node | https://docs.aws.amazon.com/codeguru/latest/security-ug/what-is-codeguru-security.html |
| AWS Cloud9 | aws-cloud9 | virtual-desktop | done (maintenance since 25 July 2024, IDE environment; still placeable until end of support) | https://docs.aws.amazon.com/cloud9/latest/user-guide/create-environment-main.html |
| AWS CodeStar | — | — | skip: full shutdown 25 July 2024 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS CodeConnections / CodeStar Notifications | — | — | skip: connection and notification configuration for pipelines | https://docs.aws.amazon.com/dtconsole/latest/userguide/welcome-connections.html |
| AWS Infrastructure Composer / Application Composer | — | — | skip: visual design tooling | https://docs.aws.amazon.com/infrastructure-composer/latest/dg/what-is-composer.html |
| AWS Toolkits and SDKs | — | — | skip: developer tooling | https://docs.aws.amazon.com/sdkref/latest/guide/overview.html |
| AWS BugBust | — | — | skip: full shutdown 13 August 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## Front-end web and mobile

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS Amplify Hosting | aws-amplify-hosting | cdn | done | https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html |
| Amazon Location Service | aws-location-service | third-party-api | done | https://docs.aws.amazon.com/location/latest/developerguide/what-is.html |
| AWS Amplify libraries and CLI | — | — | skip: client libraries and tooling | https://docs.amplify.aws/ |

## Media services

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS Elemental MediaConvert | aws-mediaconvert | media-transcoder | done | https://docs.aws.amazon.com/mediaconvert/latest/ug/working-with-queues.html |
| AWS Elemental MediaLive | aws-medialive | media-transcoder | done | https://docs.aws.amazon.com/medialive/latest/ug/channel-class.html |
| AWS Elemental MediaPackage | aws-mediapackage | media-router | done | https://docs.aws.amazon.com/mediapackage/latest/ug/what-is-features.html |
| AWS Elemental MediaTailor | aws-mediatailor | media-router | done | https://docs.aws.amazon.com/mediatailor/latest/ug/what-is.html |
| AWS Elemental MediaConnect | aws-mediaconnect | media-router | done | https://docs.aws.amazon.com/mediaconnect/latest/ug/source-failover.html |
| AWS Elemental Inference | aws-elemental-inference | ai-service | done | https://docs.aws.amazon.com/general/latest/gr/elemental-inference.html |
| Amazon Interactive Video Service (IVS) | aws-ivs | media-router | done | https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/what-is.html |
| AWS Deadline Cloud | aws-deadline-cloud | worker | done | https://docs.aws.amazon.com/deadline-cloud/latest/userguide/concepts-terminology.html |
| Amazon GameLift Servers fleet | aws-gamelift | app-server | done | https://docs.aws.amazon.com/gamelift/latest/apireference/API_CreateFleet.html |
| Amazon GameLift FlexMatch | aws-gamelift-flexmatch | matching-engine | done | https://docs.aws.amazon.com/gamelift/latest/apireference/API_CreateMatchmakingConfiguration.html |
| Amazon GameLift Streams | aws-gamelift-streams | virtual-desktop | done | https://docs.aws.amazon.com/gameliftstreams/latest/apireference/API_CreateStreamGroup.html |
| AWS Elemental MediaStore | — | — | skip: full shutdown 12 November 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Elastic Transcoder | — | — | skip: full shutdown 13 November 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Nimble Studio | — | — | skip: full shutdown 30 June 2024 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS Thinkbox Deadline 10 | aws-thinkbox-deadline | worker | done (maintenance since 7 November 2025, on-premises software; no end-of-support date published) | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |
| AWS Elemental on-premises appliances (Live, Server, Conductor) | — | — | skip: physical hardware products | https://docs.aws.amazon.com/elemental-onprem/ |
| Amazon Lumberyard / Amazon Sumerian | — | — | skip: full shutdown 2021-2023 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## Internet of Things

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS IoT Core | aws-iot-core | iot-hub | done | https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html |
| AWS IoT Device Management | aws-iot-device-management | iot-hub | done | https://docs.aws.amazon.com/iot/latest/developerguide/managing-index.html |
| AWS IoT Device Defender | aws-iot-device-defender | monitoring | done | https://docs.aws.amazon.com/iot-device-defender/latest/devguide/what-is-device-defender.html |
| AWS IoT Greengrass V2 core device | aws-iot-greengrass | edge-appliance | done | https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-data-streams.html |
| AWS IoT SiteWise | aws-iot-sitewise | iot-hub | done | https://docs.aws.amazon.com/iot-sitewise/latest/userguide/manage-data-storage.html |
| AWS IoT TwinMaker | aws-iot-twinmaker | graph-database | done | https://docs.aws.amazon.com/iot-twinmaker/latest/guide/what-is-twinmaker.html |
| AWS IoT Wireless (LoRaWAN) | aws-iot-wireless | iot-hub | done | https://docs.aws.amazon.com/iot-wireless/latest/developerguide/what-is-iot-lorawan.html |
| AWS IoT Greengrass V1 | aws-iot-greengrass-v1 | edge-appliance | done (sunset, end of support 7 October 2026; still placeable until end of support) | https://docs.aws.amazon.com/greengrass/v1/developerguide/what-is-gg.html |
| AWS IoT FleetWise | aws-iot-fleetwise | iot-hub | done (maintenance since 31 March 2026; still placeable until end of support) | https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/what-is-iotfleetwise.html |
| AWS IoT Analytics | — | — | skip: full shutdown 15 December 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS IoT Events | — | — | skip: full shutdown 20 May 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS IoT Things Graph / IoT 1-Click / IoT RoboRunner | — | — | skip: full shutdown 2022-2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Fleet Hub for AWS IoT Device Management | — | — | skip: full shutdown 18 October 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS IoT ExpressLink | — | — | skip: hardware connectivity module | https://docs.aws.amazon.com/iot-expresslink/latest/programmersguide/elpg.html |
| FreeRTOS | — | — | skip: device operating system | https://docs.aws.amazon.com/freertos/latest/userguide/what-is-freertos.html |
| AWS RoboMaker | — | — | skip: full shutdown 10 September 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

## End-user computing and business applications

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon WorkSpaces (Personal) | aws-workspaces | virtual-desktop | done | https://docs.aws.amazon.com/workspaces/latest/adminguide/amazon-workspaces.html |
| Amazon WorkSpaces Applications (AppStream 2.0) | aws-appstream | virtual-desktop | done | https://docs.aws.amazon.com/appstream2/latest/developerguide/what-is-appstream.html |
| Amazon WorkSpaces Secure Browser | aws-workspaces-secure-browser | virtual-desktop | done | https://docs.aws.amazon.com/workspaces-web/latest/adminguide/getting-started.html |
| Amazon Connect | aws-connect | contact-center | done | https://docs.aws.amazon.com/connect/latest/adminguide/amazon-connect-instances.html |
| Amazon Chime SDK | aws-chime-sdk | media-router | done | https://docs.aws.amazon.com/chime-sdk/latest/dg/meetings-sdk.html |
| AWS Wickr | aws-wickr | notification-service | done | https://docs.aws.amazon.com/wickr/latest/adminguide/what-is-wickr.html |
| AWS Supply Chain | aws-supply-chain | third-party-api | done | https://docs.aws.amazon.com/connect-decisions/legacy/userguide/what-is-service.html |
| Amazon WorkDocs | — | — | skip: full shutdown 25 April 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon WorkMail | aws-workmail | notification-service | done (sunset, end of support 31 March 2027; still placeable until end of support) | https://docs.aws.amazon.com/workmail/latest/adminguide/what_is.html |
| Amazon Chime (application) | — | — | skip: superseded by the Amazon Chime SDK | https://docs.aws.amazon.com/chime-sdk/latest/dg/what-is-chime-sdk.html |
| Amazon WorkSpaces Pools | aws-workspaces-pools | virtual-desktop | done (sunset, end of support 31 December 2027 per the WorkSpaces admin guide; still placeable until end of support) | https://docs.aws.amazon.com/workspaces/latest/adminguide/managing-stacks-fleets.html |
| Amazon WorkSpaces Thin Client | aws-workspaces-thin-client | client | done (sunset, end of support 31 March 2027; endpoint hardware; still placeable until end of support) | https://docs.aws.amazon.com/workspaces-thin-client/latest/ag/architecture.html |
| Amazon WorkLink / WorkSpaces Application Manager | — | — | skip: full shutdown 2021-2023 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Connect Voice ID | — | — | skip: full shutdown 20 May 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| Amazon Connect Cases / Customer Profiles / Contact Lens | — | — | skip: capabilities of an Amazon Connect instance | https://docs.aws.amazon.com/connect/latest/adminguide/what-is-amazon-connect.html |
| Amazon Honeycode | — | — | skip: retired no-code application builder | https://docs.aws.amazon.com/honeycode/latest/UserGuide/what-is-honeycode.html |

## Migration and transfer

| resource | id | kind | status | source |
|---|---|---|---|---|
| AWS Application Migration Service (MGN) | aws-mgn | worker | done | https://docs.aws.amazon.com/mgn/latest/ug/what-is-application-migration-service.html |
| AWS Transfer Family server | aws-transfer-family | app-server | done | https://docs.aws.amazon.com/transfer/latest/userguide/create-server-sftp.html |
| AWS Migration Hub | aws-migration-hub | monitoring | done (maintenance since 7 November 2025, migration tracking tooling; still placeable until end of support) | https://docs.aws.amazon.com/migrationhub/latest/ug/whatishub.html |
| AWS Application Discovery Service | aws-application-discovery-service | data-catalog | done (maintenance since 7 October 2025, assessment tooling; still placeable until end of support) | https://docs.aws.amazon.com/application-discovery/latest/userguide/what-is-appdiscovery.html |
| AWS Mainframe Modernization | — | — | skip: managed and self-managed runtimes both in maintenance (7 November 2025, 30 June 2026) | https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html |
| AWS Migration Hub Refactor Spaces | — | — | skip: provisions API Gateway, NLB and VPC resources already covered here | https://docs.aws.amazon.com/migrationhub-refactor-spaces/latest/userguide/what-is-mhub-refactor-spaces.html |
| Migration Hub Orchestrator / Strategy Recommendations | — | — | skip: migration planning tooling | https://docs.aws.amazon.com/migrationhub-orchestrator/latest/userguide/what-is-migrationhub-orchestrator.html |
| AWS Server Migration Service | — | — | skip: full shutdown 1 April 2023 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS .NET Modernization Tools / Porting Assistant | aws-porting-assistant-for-net | ci-pipeline | skip: developer workstation tool, not a node | https://docs.aws.amazon.com/portingassistant/latest/userguide/what-is-porting-assistant.html |

## Specialized — blockchain, quantum, satellite, telco

| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon Managed Blockchain network | aws-managed-blockchain | ledger | done | https://docs.aws.amazon.com/managed-blockchain/latest/managementguide/what-is-managed-blockchain.html |
| Amazon Braket | aws-braket | third-party-api | done | https://docs.aws.amazon.com/braket/latest/developerguide/what-is-braket.html |
| AWS Ground Station | aws-ground-station | third-party-api | done | https://docs.aws.amazon.com/ground-station/latest/APIReference/Welcome.html |
| AWS Telco Network Builder (TNB) | aws-tnb | ci-pipeline | done | https://docs.aws.amazon.com/tnb/latest/ug/what-is-tnb.html |
| Amazon Managed Blockchain Ethereum node | — | — | skip: retired node type of Managed Blockchain | https://docs.aws.amazon.com/managed-blockchain/latest/ethereum-dev/what-is-ethereum.html |
| AWS SimSpace Weaver | — | — | skip: full shutdown 31 March 2026 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS NICE EnginFrame | — | — | skip: full shutdown 25 September 2025 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS Mobile Hub | — | — | skip: full shutdown 31 October 2021 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS OpsWorks (Stacks, Chef Automate, Puppet Enterprise) | — | — | skip: full shutdown 1 May 2024 | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |
| AWS IQ | — | — | skip: full shutdown 20 May 2026, expert marketplace | https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html |

---

## Kind proposals

| NEW id | why no existing kind fits |
|---|---|
| vector-database | A vector store holds embeddings with a fixed dimension count, a distance metric (cosine, euclidean, dot product), an index type and a filterable metadata schema. `search-index` models lexical documents with analyzers and relevance tuning; a rule that checks embedding dimension against the model producing them, or that a vector index is co-located with the model endpoint, has nothing to read on `search-index`. Used by Amazon S3 Vectors. |
| media-transcoder | An encoder or transcoder has an input source, an output bitrate ladder with per-rendition codecs and resolutions, a job queue with reserved or on-demand pricing, and a channel state (running/idle) for live encoders. `media-router` carries a transport path and `worker` carries a generic job; neither can express renditions or codecs, which are exactly what a delivery rule needs (for example: every ABR ladder must have a sub-1 Mbps rendition, or every live channel must have a redundant pipeline). Used by AWS Elemental MediaConvert and MediaLive. |
| contact-center | A contact center has inbound and outbound phone numbers, contact flows, agent queues with concurrency limits, recording and transcript retention, and a routing profile per agent group. `notification-service` sends one-way messages and has no queue, agent or recording property; `media-router` carries streams but no routing rules or agent capacity. A rule that checks call recording retention against a compliance policy, or that an emergency-calling number is configured, needs a kind that holds these. Used by Amazon Connect. |

## Counts

total 393, todo 0, done 285, skip 108.
