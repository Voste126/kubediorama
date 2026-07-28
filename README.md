# KubeDiorama 🌌 (ChaosWeaver)

> **The Living Kubernetes Visualizer & Chaos Simulator.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![React Three Fiber](https://img.shields.io/badge/3D-React_Three_Fiber-black?logo=three.js)](https://github.com/pmndrs/react-three-fiber)
[![Go Agent](https://img.shields.io/badge/Backend-Go_1.22+-00ADD8?logo=go)](https://golang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](http://makeapullrequest.com)

<!-- 🚨 REPLACE THIS WITH YOUR HERO GIF 🚨 -->
> **Hero Demo**: *A 3D isometric futuristic cyber-city representing a live Kubernetes cluster. A glowing meteor strikes a worker node district, triggering real-time pod evictions, cascading red glitch smoke, and light trails re-routing dynamically.*

---

## 🚀 The Pitch: The "Anti-Grafana"

Dashboard fatigue is real. Traditional monitoring tools swamp developers in hundreds of static, 2D line charts and overwhelming metric alerts. **KubeDiorama (ChaosWeaver)** is **"The Anti-Grafana"**—a plug-and-play visual engine that abandons static graphs in favor of a 3D, physics-based, isometric visual environment.

KubeDiorama treats your Kubernetes cluster as a living, breathing digital organism. Built specifically for:
- 🎓 **Cloud Students & Educators**: Demystify complex Kubernetes architecture with real-time visual mental models.
- 📣 **Developer Advocates**: Present stunning, interactive cluster demos that captivate audiences at keynotes.
- 🎨 **Creative Engineers**: Turn cloud infrastructure into a canvas of interactive glowing digital physics.

---

## ⚡ The "Time to Wow" (< 60 Seconds)

Zero-configuration magic. Deploy KubeDiorama directly into your cluster with Helm and start watching your pods glow in 3D in under a minute.

```bash
# 1. Add and install via Helm
helm install my-diorama kubediorama/kubediorama -n kubediorama --create-namespace

# 2. Port-forward the 3D UI to your local browser
kubectl port-forward svc/kubediorama-ui 8080:80 -n kubediorama
```

Open `http://localhost:8080` in your browser and behold your cluster in 3D space!

---

## 🗺️ The Visual Metaphor Legend

KubeDiorama translates complex Kubernetes API metrics into intuitive 3D spatial elements:

- 🏗️ **Namespaces = Floating Districts**: Isolated floating landmasses or platform sectors floating in cyber-space.
- 📦 **Pods = Glowing Cores**: Cybernetic digital cubes or reactors.
  - **Height** = CPU Consumption (Taller cubes consume more CPU).
  - **Glow Intensity & Color** = Memory Usage & Status (Neon Cyan = Healthy, Amber = Pending, Red = Error/Terminating).
- ⚡ **Data Flow = Light Trails**: Particle beam streams flowing between pods and services.
  - 🟦 **Blue Trails** = High-throughput, low-latency traffic.
  - 🟥 **Red Trails** = High latency or network bottle-necking.
- 💥 **Errors = Glitches & Smoke**: 500-level HTTP error spikes or OOMKills emit dark smoke plumes and digital glitch artifacts.

---

## 🔮 Core Features

### ☄️ The Grand Chaos Architect
Gamified Chaos Engineering at your fingertips. Safely simulate infrastructure stress tests directly from the 3D viewport:
- **The Meteor**: Click to launch a meteor onto a worker node, triggering instant node failure and pod eviction cascading.
- **The Black Hole**: Drag a gravitational well between namespaces to simulate network partitions and packet drops.
- **The Flood**: Trigger a high-volume particle beam swarm to test DDoS mitigation and horizontal pod autoscaling (HPA).

### ⏳ The Temporal DVR
Scrub through time like a video scrubber.
- Replay the past **48 hours** of cluster state in fast-forward or slow-motion 3D.
- Trace cascading failures back to the exact pod, deployment, or event that triggered an outage.

---

## 🏗️ Architecture & Repository Structure

KubeDiorama is built as a lightweight, high-performance monorepo splitting real-time cluster telemetry from GPU-accelerated 3D client rendering:

| Module | Role | Tech Stack | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1: Daemon Agent** | Backend Agent | Go, `client-go`, eBPF, Gorilla WebSockets | Watches K8s API & kernel network events, streams JSON telemetry via WebSocket on port `8080`. |
| **Phase 2: Visual Engine** | 3D Frontend UI | Vite, React 19, React Three Fiber, Three.js, Zustand | Renders 60 FPS 3D isometric city scene with glowing meshes, particle trails, and interactive HUD. |

```
kubediorama/
├── agent/                      # Go Backend Daemon Agent
│   ├── main.go                 # K8s Informer watcher & WebSocket hub
│   ├── go.mod                  # Go module definition
│   └── go.sum                  # Dependencies lockfile
├── ui/                         # React Three Fiber 3D Frontend Engine
│   ├── public/                 # Static visual assets
│   ├── src/
│   │   ├── App.tsx             # 3D Canvas, lighting, & PodMesh components
│   │   ├── App.css             # HUD styling & dark theme overlays
│   │   ├── store.ts            # Zustand state manager & WebSocket client
│   │   ├── index.css           # Global viewport styles
│   │   └── main.tsx            # React application entry point
│   ├── package.json            # UI dependencies (three, r3f, zustand)
│   ├── tsconfig.json           # TypeScript configuration
│   └── vite.config.ts          # Vite build config
├── LICENSE                     # Apache 2.0 License
└── README.md                   # Project storefront documentation
```

---

## 🤝 Contributing (Choose Your Path)

We welcome contributions from both infrastructure builders and creative technologists! Pick the path that matches your superpower:

### 🎨 The Creative Path (Frontend 3D Developers)
Work on shaders, Three.js geometries, camera animations, and post-processing effects.
- **No live Kubernetes cluster required!** Run the UI in standalone mode with mock data generators.
- Navigate to `ui/`: `cd ui && npm install && npm run dev`.
- Focus area: Shaders in `ui/src/App.tsx`, post-processing glow, sound effects, and UI HUD enhancements.

### 🏛️ The Architect Path (Backend & Cloud Engineers)
Extend cluster monitoring capabilities, eBPF telemetry, and chaos engineering triggers.
- Hack on the Go agent in `agent/`: `cd agent && go run main.go`.
- Focus area: `client-go` Informer pipelines, eBPF kernel network tracking, Helm chart optimization, and Chaos Mesh API integrations.

---

<div align="center">
  <sub>Built with ❤️ for the Cloud-Native Community. Licensed under Apache 2.0.</sub>
</div>
