# Kubernetes inventory

Official reference: the Kubernetes API concepts <https://kubernetes.io/docs/concepts/>. One row
per API resource a designer places as a node; configuration and policy objects (RBAC, quotas,
HPA, CRDs) are `skip`, and a Namespace is a boundary, not a node. Ids are `k8s-<resource>`.

Status: `done` = component exists in `components/k8s/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Workloads

| resource | id | kind | status | source |
|---|---|---|---|---|
| Pod | k8s-pod | app-server | done | https://kubernetes.io/docs/concepts/workloads/pods/ |
| ReplicaSet | k8s-replicaset | app-server | done | https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/ |
| Deployment | k8s-deployment | app-server | done | https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ |
| StatefulSet | k8s-statefulset | app-server | done | https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/ |
| DaemonSet | k8s-daemonset | app-server | done | https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/ |
| Job | k8s-job | worker | done | https://kubernetes.io/docs/concepts/workloads/controllers/job/ |
| CronJob | k8s-cronjob | worker | done | https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/ |

## Networking

| resource | id | kind | status | source |
|---|---|---|---|---|
| Service | k8s-service | load-balancer | done | https://kubernetes.io/docs/concepts/services-networking/service/ |
| Ingress | k8s-ingress | load-balancer | done | https://kubernetes.io/docs/concepts/services-networking/ingress/ |
| Endpoints | k8s-endpoints | coordination-service | done | https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/ |
| NetworkPolicy | k8s-network-policy | firewall | done | https://kubernetes.io/docs/concepts/services-networking/network-policies/ |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| PersistentVolume | k8s-persistent-volume | block-storage | done | https://kubernetes.io/docs/concepts/storage/persistent-volumes/ |
| PersistentVolumeClaim | k8s-persistent-volume-claim | block-storage | done | https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims |
| StorageClass | k8s-storage-class | block-storage | done | https://kubernetes.io/docs/concepts/storage/storage-classes/ |
| Volume | k8s-volume | block-storage | done | https://kubernetes.io/docs/concepts/storage/volumes/ |

## Configuration

| resource | id | kind | status | source |
|---|---|---|---|---|
| ConfigMap | k8s-config-map | feature-flag-service | done | https://kubernetes.io/docs/concepts/configuration/configmap/ |
| Secret | k8s-secret | key-management | done | https://kubernetes.io/docs/concepts/configuration/secret/ |

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| HorizontalPodAutoscaler | — | — | skip: configuration object, not a node - it is the autoscaling property of a workload | https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/ |
| LimitRange | — | — | skip: configuration object, not a node | https://kubernetes.io/docs/concepts/policy/limit-range/ |
| ResourceQuota | — | — | skip: configuration object, not a node | https://kubernetes.io/docs/concepts/policy/resource-quotas/ |
| kube-apiserver | — | — | skip: control-plane process inside the cluster; a designer places the cluster itself (default/kubernetes), never its internal processes | https://kubernetes.io/docs/concepts/architecture/#kube-apiserver |
| cloud-controller-manager | — | — | skip: control-plane process inside the cluster; implied by the container-orchestrator node, not drawn separately | https://kubernetes.io/docs/concepts/architecture/cloud-controller/ |
| kube-controller-manager | — | — | skip: control-plane process inside the cluster; implied by the container-orchestrator node, not drawn separately | https://kubernetes.io/docs/concepts/architecture/#kube-controller-manager |
| kube-proxy | — | — | skip: per-node cluster agent that implements Service routing; the Service is the node, kube-proxy is its mechanism | https://kubernetes.io/docs/reference/command-line-tools-reference/kube-proxy/ |
| kubelet | — | — | skip: per-node cluster agent; infrastructure of the orchestrator, not placed in an architecture design | https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/ |
| kube-scheduler | — | — | skip: control-plane process inside the cluster; implied by the container-orchestrator node, not drawn separately | https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/ |
| Helm | — | — | skip: package manager for Kubernetes manifests | https://helm.sh/docs/ |
| Krew | — | — | skip: plugin manager for the kubectl CLI, not a runtime node | https://krew.sigs.k8s.io/ |
| Kustomize | — | — | skip: manifest templating and packaging tool, not a runtime node | https://kustomize.io/ |
| Namespace | — | — | skip: boundary that contains other nodes - a group kind, not a component | https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/ |
| etcd | — | — | skip: already catalogued as `etcd` under default | https://etcd.io/docs/ |
| Control plane node | — | — | skip: control-plane host; the cluster is placed as one container-orchestrator node, its masters are not drawn | https://kubernetes.io/docs/concepts/architecture/ |
| Node | — | — | skip: worker host inside the cluster; capacity of the container-orchestrator, not a separately placed node | https://kubernetes.io/docs/concepts/architecture/nodes/ |
| CustomResourceDefinition | — | — | skip: configuration object, not a node - an API schema extension | https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/ |
| PodSecurityPolicy | — | — | skip: configuration object, not a node; also removed from Kubernetes in v1.25 (2022), superseded by Pod Security Admission | https://kubernetes.io/docs/concepts/security/pod-security-policy/ |
| ClusterRole | — | — | skip: RBAC configuration object, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/ |
| ClusterRoleBinding | — | — | skip: RBAC configuration object, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/ |
| Group | — | — | skip: RBAC subject, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/#referring-to-subjects |
| RoleBinding | — | — | skip: RBAC configuration object, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/ |
| Role | — | — | skip: RBAC configuration object, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/ |
| ServiceAccount | — | — | skip: RBAC subject - the identity attached to a workload, has no runtime of its own | https://kubernetes.io/docs/concepts/security/service-accounts/ |
| User | — | — | skip: RBAC subject, not a node | https://kubernetes.io/docs/reference/access-authn-authz/rbac/#referring-to-subjects |

---

## Coverage pass 2026-09-21

Re-diffed against the Kubernetes API reference
<https://kubernetes.io/docs/reference/kubernetes-api/> and the concepts documentation
<https://kubernetes.io/docs/concepts/>. This folder stays Kubernetes-native API objects:
ecosystem projects that merely run on a cluster (CoreDNS, Prometheus, Istio, cert-manager) are
`default` components, and CoreDNS is already catalogued there.

| resource | id | kind | status | source |
|---|---|---|---|---|
| Gateway (Gateway API) | k8s-gateway | load-balancer | done | https://kubernetes.io/docs/concepts/services-networking/gateway/ |
| ValidatingAdmissionPolicy | k8s-validating-admission-policy | policy-engine | done | https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/ |
| GatewayClass | — | — | skip: names the controller that fulfils Gateways of a class; a selector, not a node. | https://kubernetes.io/docs/concepts/services-networking/gateway/ |
| HTTPRoute / GRPCRoute | — | — | skip: routing rules attached to a Gateway listener; the Gateway is the node, the same call already recorded for Ingress path rules. | https://kubernetes.io/docs/concepts/services-networking/gateway/ |
| IngressClass | — | — | skip: names the controller that fulfils Ingresses of a class; a selector, not a node. | https://kubernetes.io/docs/concepts/services-networking/ingress/ |
| ReplicationController | — | — | skip: legacy workload controller superseded by Deployment and ReplicaSet, both catalogued. | https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/ |
| PodDisruptionBudget | — | — | skip: availability constraint attached to a workload, not a node. | https://kubernetes.io/docs/concepts/workloads/pods/disruptions/ |
| PriorityClass | — | — | skip: scheduling configuration object, not a node. | https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ |
| RuntimeClass | — | — | skip: container-runtime selector for a Pod, a configuration object. | https://kubernetes.io/docs/concepts/containers/runtime-class/ |
| VolumeSnapshot / VolumeSnapshotClass | — | — | skip: point-in-time copy of a PersistentVolumeClaim, a property of the claim. | https://kubernetes.io/docs/concepts/storage/volume-snapshots/ |
| CSIDriver / CSINode / VolumeAttachment | — | — | skip: CSI plumbing registered in the cluster; the StorageClass and the claim are the drawn nodes. | https://kubernetes.io/docs/concepts/storage/volumes/ |
| ResourceClaim / DeviceClass / ResourceSlice (dynamic resource allocation) | — | — | skip: device allocation request attached to a Pod, a property of the workload. | https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/ |
| ValidatingWebhookConfiguration / MutatingWebhookConfiguration | — | — | skip: registration pointing at an external webhook server; that server is the node. | https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ |
| MutatingAdmissionPolicy | — | — | skip: still beta; the stable in-process admission object is ValidatingAdmissionPolicy. | https://kubernetes.io/docs/reference/access-authn-authz/mutating-admission-policy/ |
| APIService (aggregation layer) | — | — | skip: registration pointing at an extension API server; that server is the node. | https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/ |
| Lease / Event / PodTemplate / Binding | — | — | skip: bookkeeping objects the control plane writes, not nodes. | https://kubernetes.io/docs/reference/kubernetes-api/ |
| CertificateSigningRequest / ClusterTrustBundle | — | — | skip: certificate-issuance objects handled by the control plane, not nodes. | https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/ |

### Already covered under another name

| resource | id | kind | status | source |
|---|---|---|---|---|
| EndpointSlice | k8s-endpoints | coordination-service | done | mapping: the scalable form of Endpoints, already the source cited on that row |
| Service type LoadBalancer / NodePort / ExternalName | k8s-service | load-balancer | done | mapping: `serviceType` values of the one Service object |

## Counts

total 59, todo 0, done 19, skip 40. Plus 2 mapping rows under
"Already covered under another name", which point at rows already counted above.
