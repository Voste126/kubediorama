# Contributing to KubeDiorama 🌌 (ChaosWeaver)

Thank you for your interest in contributing to **KubeDiorama**! Together, we are building **"The Anti-Grafana"**—a plug-and-play 3D visual engine and chaos simulator that transforms Kubernetes clusters into living, breathing digital organisms.

To bring this vision to life, KubeDiorama bridges two distinct worlds: **Cloud-Native Infrastructure & eBPF Kernel Tracing** and **Creative 3D WebGL / GPU Graphics**. Whether you are a hardcore Kubernetes engineer or a creative 3D web developer, there is a place for you here.

---

## 🗺️ Choose Your Path

KubeDiorama is organized as a lightweight monorepo with two isolated development environments:

```
kubediorama/
├── agent/    <-- ⚙️ The Architect Path (Go, client-go, eBPF, K8s APIs)
└── ui/       <-- 🎨 The Creative Path (Vite, React 19, Three.js, R3F, Zustand)
```

---

### 🎨 The Creative Path (Frontend 3D Developers)

You don't need a live Kubernetes cluster or any Go knowledge to contribute to the 3D rendering engine!

The frontend includes a mock data mode that generates synthetic cluster events, metrics fluctuations, and network traffic beams locally in your browser.

#### Setup Instructions:

```bash
# 1. Navigate to the UI directory
cd ui

# 2. Install 3D rendering and state management packages
npm install --legacy-peer-deps

# 3. Launch Vite in mock data mode (No Go agent required!)
npm run dev -- --mock
```

Open `http://localhost:5173` to start hacking on the 3D Canvas!

#### We Need Help With:
- 🌌 **GPU Shaders**: GLSL custom shaders for glowing neon materials, bloom post-processing, and particle shockwaves.
- 📐 **3D Models & Assets**: Low-poly GLTF 3D models for custom resource types (Deployments, StatefulSets, Ingress Routers).
- ⚡ **Zustand & WebGL Optimizations**: Three.js `InstancedMesh` performance tuning for handling 10,000+ simultaneous particle light trails at 60 FPS.
- 🎛️ **HUD UI/UX**: Futuristic glassmorphism overlays, telemetry charts, and spatial audio feedback.

---

### ⚙️ The Architect Path (Backend Cloud Engineers)

If you love Kubernetes APIs, eBPF kernel tracing, and high-concurrency Go daemons, this is your path!

#### Prerequisites:
- **Go 1.21+**
- **Local Kubernetes Cluster**: Minikube, Kind, k3d, or Docker Desktop Kubernetes.
- `kubectl` configured and connected to your cluster (`~/.kube/config`).

#### Setup Instructions:

```bash
# 1. Navigate to the Go Agent directory
cd agent

# 2. Download and verify module dependencies
go mod tidy

# 3. Build the Go daemon binary
go build -o agent_bin main.go

# 4. Run the Go agent locally against your ~/.kube/config
go run main.go
```

The Go agent will connect to your local cluster context and host a WebSocket server at `ws://localhost:8080`.

#### We Need Help With:
- 🐝 **eBPF Kernel Tracing**: Kernel socket observation using `cilium/ebpf` to map raw TCP connections back to Pod IPs.
- 📡 **Informer Caching**: Efficient `client-go` `SharedInformerFactory` event streams across namespaces.
- ☄️ **Chaos Executors**: Expanding Chaos Spells (e.g. node eviction, CPU stress injectors, gravitational black holes).
- 📦 **Helm Charts & Operator**: Packaging KubeDiorama for zero-config production Kubernetes deployments.

---

## 📜 Code Standards & Pull Request Protocol

To ensure KubeDiorama remains high-performing, zero-config, and reliable, all Pull Requests must adhere to the following logic protocol:

### 1. Maintain Zero-Config Magic 🧙‍♂️
- Every feature must work out-of-the-box with **zero required configuration** for the user.
- If a K8s component (like `metrics-server` or eBPF headers) is missing, gracefully degrade to fallback mode without crashing.

### 2. Conventional Commits 🎯
Use clean, descriptive commit messages adhering to [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(ui): add glowing bloom shader to OOMKilled pods
feat(agent): implement eBPF TCP socket tracer for pod traffic
fix(ui): resolve camera clipping issue on narrow screens
fix(agent): fix pod deletion tombstone decoding error
docs(readme): add architecture diagram for DVR ring buffer
```

### 3. Exhaustive PR Descriptions & Visual Proof 📷
Every Pull Request **MUST** include visual or log empirical proof:
- **UI PRs**: Attach a screenshot, screen recording, or GIF demonstrating the 3D visual change.
- **Backend PRs**: Include clean terminal log output or unit test run results demonstrating success.

---

## 🐛 Submitting Issues & Feature Requests

Before creating a new issue, please:
1. Search existing [GitHub Issues](https://github.com/kubediorama/kubediorama/issues) to prevent duplicate reports.
2. Clearly state your OS, Go version, Node version, and Kubernetes environment (e.g. Minikube v1.32, Kind, EKS).
3. Provide step-by-step reproduction steps for bug reports.

---

<div align="center">
  <sub>Built with ❤️ for Cloud Engineers & Creative Technologists. Apache 2.0 Licensed.</sub>
</div>
