<div align="center">

# KubeDiorama 🌌
### *The Anti-Grafana — A Living 3D Kubernetes Visualizer & Chaos Simulator*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)](https://golang.org)
[![React Three Fiber](https://img.shields.io/badge/Three.js-React_Three_Fiber-black?logo=three.js)](https://github.com/pmndrs/react-three-fiber)
[![Helm Chart](https://img.shields.io/badge/Helm-v3-0F1689?logo=helm&logoColor=white)](https://helm.sh)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/kubediorama/kubediorama?style=social)](https://github.com/kubediorama/kubediorama)

<br/>

> **Stop reading dashboards. Start watching your cluster breathe.**
>
> KubeDiorama renders your Kubernetes cluster as a real-time, physics-based 3D city —
> glowing pods, luminescent network traffic beams, and gamified chaos engineering,
> all in a single `helm install`.

<br/>

<!-- 🚨 REPLACE WITH HERO GIF -->
*[Hero demo: A 3D isometric cyber-city of glowing pod towers, luminescent Bezier network beams, and a meteor strike triggering a live pod eviction cascade — all rendered at 60 FPS.]*

</div>

---

## 📖 Table of Contents

- [The Vision](#-the-vision-the-anti-grafana)
- [Features](#-features)
- [Quick Start — Helm](#-quick-start--60-seconds-to-wow-via-helm)
- [Local Development](#-local-development)
- [Architecture](#-architecture)
- [Visual Metaphor Legend](#-the-visual-metaphor-legend)
- [Chaos Spells](#-chaos-spells--the-grand-architect)
- [Configuration](#-configuration-helm-values)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🚀 The Vision: "The Anti-Grafana"

Dashboard fatigue is real. Hundreds of static 2D line graphs, alert storms, and overwhelming metric tables — traditional observability tools obscure the cluster, they don't reveal it.

**KubeDiorama is the opposite.** It renders your cluster as a living, breathing digital organism where:

- **CPU spikes** make pod towers grow taller in real-time.
- **OOMKills** trigger wireframe glitch shaders and physical jitter animations.
- **Network traffic** flows as luminescent Bezier particle trails between pods.
- **Chaos Engineering** is a point-and-click 3D experience — no YAML required.

Built for three kinds of builders:

| Audience | Why KubeDiorama |
|---|---|
| 🎓 **Cloud Students & Educators** | Demystify Kubernetes architecture with spatial 3D mental models |
| 📣 **Developer Advocates** | Deliver breathtaking, interactive cluster demos at conferences |
| 🧪 **SREs & Chaos Engineers** | Visually audit blast radius before and after chaos experiments |

---

## ✨ Features

| Feature | Status | Description |
|---|---|---|
| 🏛️ **Namespace Districts** | ✅ Live | Namespaces rendered as floating 3D slab platforms |
| 📦 **Live Pod Telemetry** | ✅ Live | CPU → tower height, Memory → glow intensity, animated per second |
| ⚡ **Network Particle Trails** | ✅ Live | Luminescent Bezier arcs tracing inter-pod traffic in real time |
| ☄️ **The Meteor** | ✅ Live | Click to delete a pod live from Kubernetes via the API |
| 🕳️ **The Black Hole** | ✅ Live | Apply a `NetworkPolicy` partition between namespaces |
| 🌊 **The Flood** | ✅ Live | Trigger a high-density DDoS traffic burst on a target pod |
| 📺 **Temporal DVR** | ✅ Live | Scrub through 10 minutes of cluster history with a timeline slider |
| ⚠️ **Glitch States** | ✅ Live | Physical jitter + wireframe shaders for `Error`/`OOMKilled` pods |
| 🔴 **Live/DVR Toggle** | ✅ Live | Seamlessly switch between live telemetry and historical replay |
| 🐝 **eBPF Tracing** | 🚧 Beta | Kernel-level TCP connection tracing mapped to Pod IPs |

---

## ⚡ Quick Start — 60 Seconds to Wow via Helm

The fastest way to run KubeDiorama against your existing Kubernetes cluster.

**Prerequisites:** `helm` v3+, `kubectl`, and a running Kubernetes cluster.

### 1. Install via Helm

```bash
# Add the KubeDiorama Helm repository
helm repo add kubediorama https://kubediorama.github.io/charts
helm repo update

# Install into a dedicated namespace (default: chaos spells ENABLED)
helm install kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --create-namespace
```

### 2. Port-Forward the 3D UI

```bash
kubectl port-forward -n kubediorama svc/kubediorama 8080:80
```

### 3. Open Your Browser

```
http://localhost:8080
```

**That's it.** Your cluster is now a living 3D city. 🌆

---

### Helm Install Variants

<details>
<summary><strong>🔒 Read-Only Mode (no chaos, safe for production)</strong></summary>

```bash
helm install kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --create-namespace \
  --set enableChaos=false
```

When `enableChaos: false`, the ClusterRole is rendered **without** `delete pods` or `networkpolicies` CRUD permissions. The daemon's chaos executor goroutines are also disabled via environment variable.

</details>

<details>
<summary><strong>🐝 eBPF Mode (kernel-level traffic tracing)</strong></summary>

```bash
# Fine-grained Linux capabilities (recommended — no full privileged mode)
helm install kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --create-namespace \
  --set ebpf.enabled=true \
  --set ebpf.privileged=false

# OR: Full privileged mode (dev/lab clusters only)
helm install kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --create-namespace \
  --set ebpf.enabled=true \
  --set ebpf.privileged=true
```

> ⚠️ eBPF tracing requires kernel 5.8+ and is **not supported** on GKE Autopilot, EKS Fargate, or AKS Virtual Nodes. Use the default mode (mock traffic simulator) on managed node pools.

</details>

<details>
<summary><strong>⚙️ Custom Resource Limits</strong></summary>

```bash
helm install kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --create-namespace \
  --set resources.requests.cpu=200m \
  --set resources.requests.memory=256Mi \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=512Mi
```

</details>

<details>
<summary><strong>🔄 Upgrade & Uninstall</strong></summary>

```bash
# Upgrade to a new chart version
helm upgrade kubediorama kubediorama/kubediorama \
  --namespace kubediorama \
  --reuse-values

# Uninstall and clean up all resources
helm uninstall kubediorama --namespace kubediorama
kubectl delete namespace kubediorama
```

</details>

---

## 💻 Local Development

Want to hack on KubeDiorama locally? The monorepo has two completely independent development environments.

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | UI development |
| Go | 1.21+ | Agent development |
| kubectl | Any | Cluster access |
| Minikube / Kind | Any | Local K8s cluster |

---

### 🎨 Frontend Only (No Kubernetes Required)

The React Three Fiber UI runs fully standalone with mock data — no Go agent, no cluster needed.

```bash
# Clone the repository
git clone https://github.com/kubediorama/kubediorama.git
cd kubediorama/ui

# Install dependencies
npm install --legacy-peer-deps

# Start the development server with mock WebSocket data
npm run dev
```

Open `http://localhost:5173` — the 3D engine will simulate live cluster events locally.

---

### ⚙️ Full Stack (Go Agent + UI)

Requires a running Kubernetes cluster (Minikube, Kind, k3d, or Docker Desktop).

**Terminal 1 — Start the Go Agent:**

```bash
cd agent

# Download dependencies
go mod tidy

# Build the binary
go build -o agent_bin main.go

# Run against your local ~/.kube/config
go run main.go
# Output: 🌐 KubeDiorama WebSocket Server running on ws://localhost:8080
```

**Terminal 2 — Start the UI:**

```bash
cd ui
npm install --legacy-peer-deps
npm run dev
# Open http://localhost:5173
```

The UI will connect to `ws://localhost:8080` and begin rendering your live cluster.

---

## 🏗️ Architecture

KubeDiorama is a lightweight monorepo splitting real-time cluster telemetry from GPU-accelerated 3D rendering:

```
kubediorama/
├── agent/                      # ⚙️  Go Backend Daemon
│   ├── main.go                 #    K8s Informer, WebSocket hub, DVR ring buffer,
│   │                           #    eBPF IP resolver, Chaos executors
│   ├── go.mod
│   └── go.sum
│
├── ui/                         # 🎨  React Three Fiber 3D Engine
│   └── src/
│       ├── App.tsx             #    3D Canvas, PodMesh, NamespaceDistrict, Scene
│       ├── DataParticle.tsx    #    Bezier particle trails + Black Hole shatter physics
│       ├── store.ts            #    Zustand state + WebSocket client + Chaos spell actions
│       ├── App.css             #    HUD, timeline scrubber, spells toolbar styling
│       └── main.tsx
│
├── charts/                     # 📦  Helm Chart
│   └── kubediorama/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── rbac.yaml       #    ServiceAccount, ClusterRole, ClusterRoleBinding
│           ├── deployment.yaml #    Go daemon pod with eBPF security context
│           ├── service.yaml    #    ClusterIP :80 → :8080
│           └── NOTES.txt
│
├── CONTRIBUTING.md
└── README.md
```

### Data Flow

```
Kubernetes API Server
        │
        │  client-go SharedInformer (watch all namespaces)
        ▼
  Go Agent Daemon (agent/main.go)
        │
        ├── RingBuffer (600 snapshots, 10-min DVR)
        ├── Metrics Poller (CPU/Memory simulation or metrics-server)
        ├── Traffic Simulator (mock) / eBPF TCP Tracer (kernel)
        └── Chaos Executors (Meteor | Black Hole | Flood)
        │
        │  WebSocket (ws://localhost:8080)
        │  JSON: { type: "pods" | "traffic" | "dvr_snapshot" }
        ▼
  React Three Fiber UI (ui/src/)
        │
        ├── Zustand Store (pods, trafficEvents, timeline, activeSpell)
        ├── 3D Scene: NamespaceDistrict slabs + PodMesh cubes
        ├── DataParticle: Bezier arcs + Black Hole shatter sparks
        └── HUD: DVR timeline scrubber + Chaos Spells toolbar
```

---

## 🗺️ The Visual Metaphor Legend

KubeDiorama translates Kubernetes API objects into intuitive 3D spatial metaphors:

| K8s Concept | 3D Metaphor | Visual Property |
|---|---|---|
| **Namespace** | Floating neon platform slab | Wireframe grid border |
| **Pod (Running)** | Glowing cyan box tower | Height = CPU, Glow = Memory |
| **Pod (Pending)** | Amber pulsing cube | Warm amber emissive glow |
| **Pod (Error/OOMKilled)** | Red wireframe glitch cube | Physical X/Z jitter shaking |
| **Network traffic (fast)** | Cyan Bezier particle beam | `#00f3ff`, high arc |
| **Network traffic (slow)** | Amber Bezier particle beam | `#ffb700`, high arc |
| **Black Hole partition** | Particle shatters at midpoint | Red spark explosion at `t=0.5` |
| **Pod deletion (Meteor)** | Scale-to-zero animation | Red flash + spring collapse |

---

## 🔮 Chaos Spells — The Grand Architect

Click a spell in the bottom toolbar, then click a target in the 3D viewport.

### ☄️ The Meteor
Calls `clientset.CoreV1().Pods().Delete()` against the clicked pod in real-time. Watch it physically collapse with a red spring animation before disappearing from the district.

```json
// WebSocket payload sent from UI → Go agent
{ "action": "delete_pod", "podName": "my-app-abc123", "namespace": "default" }
```

### 🕳️ The Black Hole
Dynamically creates a `networking.k8s.io/v1` `NetworkPolicy` dropping all ingress/egress between the clicked namespace and `kube-system`. Network particle beams will hit an invisible 3D wall at their Bezier midpoint and shatter into red sparks.

```json
{ "action": "black_hole", "sourceNamespace": "default", "destNamespace": "kube-system" }
```

### 🌊 The Flood
Spawns a high-frequency goroutine in the Go agent that emits 50+ traffic events per second targeting the clicked pod. Watch hundreds of particle beams converge on a single pod tower simultaneously.

```json
{ "action": "flood", "podName": "my-ingress-pod", "namespace": "default" }
```

---

## ⚙️ Configuration: Helm Values

The key levers in [`charts/kubediorama/values.yaml`](charts/kubediorama/values.yaml):

| Value | Default | Description |
|---|---|---|
| `image.tag` | `""` (chart appVersion) | KubeDiorama container image tag |
| `replicaCount` | `1` | Number of agent pods (DVR buffer is in-memory) |
| `enableChaos` | `true` | Enables Meteor, Black Hole, Flood + writes RBAC permissions |
| `ebpf.enabled` | `false` | Enables kernel-level TCP tracing (requires Linux 5.8+) |
| `ebpf.privileged` | `false` | Uses `privileged: true` instead of fine-grained capabilities |
| `service.type` | `ClusterIP` | Service type (`ClusterIP`, `LoadBalancer`, `NodePort`) |
| `service.port` | `80` | External service port |
| `resources.requests.cpu` | `100m` | CPU request |
| `resources.requests.memory` | `128Mi` | Memory request |
| `resources.limits.cpu` | `500m` | CPU limit |
| `resources.limits.memory` | `256Mi` | Memory limit |

Full reference: [`charts/kubediorama/values.yaml`](charts/kubediorama/values.yaml)

---

## 🤝 Contributing

Contributions are what make the open-source community thrive. KubeDiorama needs two distinct types of magic — and we welcome both:

| Path | Skills Needed | Area |
|---|---|---|
| 🎨 **The Creative Path** | Three.js, GLSL, React, Zustand | GPU shaders, 3D models, UI/UX |
| ⚙️ **The Architect Path** | Go, K8s APIs, eBPF, Helm | Informers, chaos executors, operator |

Read the full guide: **[CONTRIBUTING.md](CONTRIBUTING.md)**

**Quick start for contributors:**

```bash
# Fork and clone
git clone https://github.com/<your-username>/kubediorama.git

# Create a feature branch
git checkout -b feat/my-awesome-feature

# Make changes, then commit using Conventional Commits
git commit -m "feat(ui): add bloom post-processing effect to pod towers"

# Push and open a Pull Request
git push origin feat/my-awesome-feature
```

---

## 🗺️ Roadmap

- [ ] **Milestone 7**: GLTF 3D models for Deployments, StatefulSets, DaemonSets
- [ ] **Milestone 8**: Helm chart OCI registry publishing (`ghcr.io`)
- [ ] **Milestone 9**: Spatial audio — OOMKill rumble, meteor impact sound, traffic hum
- [ ] **Milestone 10**: Multi-cluster federation — render multiple clusters as connected city districts
- [ ] **Milestone 11**: Grafana data source plugin — overlay time-series data onto 3D pod towers
- [ ] **Milestone 12**: Kubernetes Operator for automatic KubeDiorama cluster-wide deployment

---

## 🔒 Security

The KubeDiorama Helm chart follows least-privilege RBAC:

- **Read-only by default**: The ClusterRole only grants `get`, `list`, `watch` on pods, nodes, namespaces, and events.
- **Chaos permissions are opt-in**: `delete pods` and `networkpolicies` CRUD verbs are **only included** when `enableChaos: true`.
- **eBPF capabilities are explicit**: No wildcard capabilities. Fine-grained `CAP_BPF`, `CAP_PERFMON`, `CAP_NET_ADMIN` only when `ebpf.enabled: true`.

To report a security vulnerability, please open a **private security advisory** on GitHub rather than a public issue.

---

## 📄 License

Distributed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

Built with ❤️ for Cloud-Native Engineers & Creative Technologists

⭐ **Star this repo** if KubeDiorama made your cluster beautiful!

[GitHub](https://github.com/kubediorama/kubediorama) · [Issues](https://github.com/kubediorama/kubediorama/issues) · [Contributing](CONTRIBUTING.md)

</div>
