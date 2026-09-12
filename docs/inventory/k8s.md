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

## Counts

total 42, todo 0, done 17, skip 25.
