package main

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

// PodInfo defines the JSON structure broadcasted to 3D frontend clients with live metrics.
type PodInfo struct {
	Name      string  `json:"name"`
	Namespace string  `json:"namespace"`
	Status    string  `json:"status"`
	CPU       float64 `json:"cpu"`    // CPU usage percentage (0 - 100)
	Memory    float64 `json:"memory"` // Memory usage percentage (0 - 100)
}

// ClientMessage defines incoming WebSocket payloads sent from the 3D frontend UI.
type ClientMessage struct {
	Action    string `json:"action"`    // e.g. "delete_pod"
	PodName   string `json:"podName"`   // Target Pod name
	Namespace string `json:"namespace"` // Target Pod namespace
}

// TrafficMessage defines outgoing network request events for 3D light trail particles.
type TrafficMessage struct {
	Type      string `json:"type"`      // "traffic"
	SourcePod string `json:"sourcePod"` // Name of source Pod
	DestPod   string `json:"destPod"`   // Name of destination Pod
	Speed     string `json:"speed"`     // "fast" or "slow"
}

// PodsUpdateMessage defines typed WebSocket payload wrapping Pod cluster state.
type PodsUpdateMessage struct {
	Type string    `json:"type"` // "pods"
	Pods []PodInfo `json:"pods"`
}

// Hub manages active WebSocket connections and broadcasts cluster state updates.
type Hub struct {
	clients     map[*websocket.Conn]bool
	broadcast   chan interface{}
	register    chan *websocket.Conn
	unregister  chan *websocket.Conn
	mutex       sync.RWMutex
	store       cache.Store
	clientset   *kubernetes.Clientset
	metricsMap  map[string]map[string]*[2]float64 // map[namespace]map[podName]->[CPU, Memory]
	metricsLock sync.Mutex
}

func newHub(store cache.Store, clientset *kubernetes.Clientset) *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan interface{}),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		store:      store,
		clientset:  clientset,
		metricsMap: make(map[string]map[string]*[2]float64),
	}
}

// run starts the event loop handling client registration and broadcasting updates.
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			log.Println("🔌 [KubeDiorama] New 3D UI Client connected. Sending initial cluster snapshot...")
			h.sendSnapshot(client)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Println("🔌 [KubeDiorama] Client disconnected.")
			}
			h.mutex.Unlock()

		case msg := <-h.broadcast:
			h.mutex.RLock()
			data, err := json.Marshal(msg)
			if err != nil {
				log.Printf("❌ Error marshaling WebSocket JSON: %v", err)
				h.mutex.RUnlock()
				continue
			}

			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, data)
				if err != nil {
					log.Printf("❌ WebSocket write error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// sendSnapshot sends a complete snapshot of all active pods across namespaces to a new client.
func (h *Hub) sendSnapshot(client *websocket.Conn) {
	pods := h.getCurrentPods()
	payload := PodsUpdateMessage{
		Type: "pods",
		Pods: pods,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("❌ Error marshaling snapshot: %v", err)
		return
	}
	client.WriteMessage(websocket.TextMessage, data)
}

// getMetrics retrieves or simulates CPU & Memory metrics for a specific Pod with dynamic jitter.
func (h *Hub) getMetrics(namespace, podName string) (float64, float64) {
	h.metricsLock.Lock()
	defer h.metricsLock.Unlock()

	if _, ok := h.metricsMap[namespace]; !ok {
		h.metricsMap[namespace] = make(map[string]*[2]float64)
	}

	metrics, ok := h.metricsMap[namespace][podName]
	if !ok {
		// Initialize realistic baseline metrics (CPU 20-60%, Memory 30-70%)
		cpu := 20.0 + rand.Float64()*40.0
		mem := 30.0 + rand.Float64()*40.0
		metrics = &[2]float64{cpu, mem}
		h.metricsMap[namespace][podName] = metrics
	} else {
		// Apply dynamic fluctuation jitter (-5.0% to +5.0%)
		cpuDelta := (rand.Float64() - 0.5) * 10.0
		memDelta := (rand.Float64() - 0.5) * 8.0

		metrics[0] = clamp(metrics[0]+cpuDelta, 10.0, 95.0)
		metrics[1] = clamp(metrics[1]+memDelta, 15.0, 90.0)
	}

	return metrics[0], metrics[1]
}

func clamp(val, min, max float64) float64 {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

// getCurrentPods lists all items in the Informer cache and attaches real-time metrics.
func (h *Hub) getCurrentPods() []PodInfo {
	var podList []PodInfo
	if h.store == nil {
		return podList
	}

	for _, item := range h.store.List() {
		pod, ok := item.(*corev1.Pod)
		if !ok {
			continue
		}

		status := string(pod.Status.Phase)
		if pod.DeletionTimestamp != nil {
			status = "Terminating"
		}

		cpu, memory := h.getMetrics(pod.Namespace, pod.Name)

		podList = append(podList, PodInfo{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    status,
			CPU:       cpu,
			Memory:    memory,
		})
	}
	return podList
}

// broadcastCurrentState triggers a broadcast of all active pods to all connected clients.
func (h *Hub) broadcastCurrentState() {
	pods := h.getCurrentPods()
	h.broadcast <- PodsUpdateMessage{
		Type: "pods",
		Pods: pods,
	}
}

// startMetricsPoller runs a background ticker updating CPU/Memory metrics every 2 seconds.
func (h *Hub) startMetricsPoller() {
	ticker := time.NewTicker(2 * time.Second)
	go func() {
		for range ticker.C {
			h.broadcastCurrentState()
		}
	}()
}

// startTrafficSimulator runs a background loop emitting simulated network traffic light trails.
func (h *Hub) startTrafficSimulator() {
	ticker := time.NewTicker(2200 * time.Millisecond)
	go func() {
		for range ticker.C {
			pods := h.getCurrentPods()
			if len(pods) < 2 {
				continue // Need at least 2 pods to draw traffic light trails between them
			}

			// Pick random source Pod and destination Pod
			srcIdx := rand.Intn(len(pods))
			dstIdx := rand.Intn(len(pods))
			if srcIdx == dstIdx {
				dstIdx = (srcIdx + 1) % len(pods)
			}

			speed := "fast"
			if rand.Float32() < 0.35 {
				speed = "slow" // 35% chance of sluggish red traffic
			}

			trafficMsg := TrafficMessage{
				Type:      "traffic",
				SourcePod: pods[srcIdx].Name,
				DestPod:   pods[dstIdx].Name,
				Speed:     speed,
			}

			log.Printf("⚡ [TRAFFIC] Beam: %s ➔ %s (Speed: %s)", trafficMsg.SourcePod, trafficMsg.DestPod, speed)
			h.broadcast <- trafficMsg
		}
	}()
}

// handleChaosAction executes incoming Chaos Spells via client-go.
func (h *Hub) handleChaosAction(msg ClientMessage) {
	switch msg.Action {
	case "delete_pod":
		log.Printf("☄️ [CHAOS EXECUTION] Launching Meteor Strike on Pod '%s' in Namespace '%s'!", msg.PodName, msg.Namespace)
		if msg.PodName == "" || msg.Namespace == "" {
			log.Println("⚠️ Invalid delete_pod request: missing podName or namespace")
			return
		}

		err := h.clientset.CoreV1().Pods(msg.Namespace).Delete(context.TODO(), msg.PodName, metav1.DeleteOptions{})
		if err != nil {
			log.Printf("❌ Failed to delete Pod '%s/%s': %v", msg.Namespace, msg.PodName, err)
		} else {
			log.Printf("💥 [SUCCESS] Kubernetes API confirmed deletion of Pod '%s/%s'!", msg.Namespace, msg.PodName)
		}
	default:
		log.Printf("⚠️ Unknown chaos action received: %s", msg.Action)
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	rand.Seed(time.Now().UnixNano())
	log.Println("⚡ Starting KubeDiorama Go Agent Backend (Milestone 3)...")

	// 1. Authenticate with Kubernetes cluster using ~/.kube/config
	var kubeconfig string
	if envKubeconfig := os.Getenv("KUBECONFIG"); envKubeconfig != "" {
		kubeconfig = envKubeconfig
	} else if home := homedir.HomeDir(); home != "" {
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		log.Fatalf("Failed to build kubeconfig from %s: %v", kubeconfig, err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		log.Fatalf("Failed to create Kubernetes clientset: %v", err)
	}

	log.Println("✅ Connected to Kubernetes API Server successfully!")

	// 2. Set up SharedInformerFactory watching ALL namespaces
	factory := informers.NewSharedInformerFactory(clientset, 10*time.Second)
	podInformer := factory.Core().V1().Pods().Informer()
	hub := newHub(podInformer.GetStore(), clientset)

	go hub.run()
	hub.startMetricsPoller()
	hub.startTrafficSimulator()

	// 3. Register Event Handlers
	podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pod := obj.(*corev1.Pod)
			log.Printf("📦 [POD CREATED] %s/%s (%s)", pod.Namespace, pod.Name, pod.Status.Phase)
			hub.broadcastCurrentState()
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			newPod := newObj.(*corev1.Pod)
			log.Printf("🔄 [POD UPDATED] %s/%s (%s)", newPod.Namespace, newPod.Name, newPod.Status.Phase)
			hub.broadcastCurrentState()
		},
		DeleteFunc: func(obj interface{}) {
			pod, ok := obj.(*corev1.Pod)
			if !ok {
				tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
				if !ok {
					log.Printf("Error decoding deleted object tombstone")
					return
				}
				pod, ok = tombstone.Obj.(*corev1.Pod)
				if !ok {
					log.Printf("Tombstone object is not a Pod")
					return
				}
			}
			log.Printf("🗑️ [POD DELETED] %s/%s", pod.Namespace, pod.Name)
			hub.broadcastCurrentState()
		},
	})

	// 4. Start Informer factory
	stopCh := make(chan struct{})
	defer close(stopCh)
	factory.Start(stopCh)

	log.Println("⏳ Waiting for Informer cache to synchronize...")
	if !cache.WaitForCacheSync(stopCh, podInformer.HasSynced) {
		log.Fatalf("Timed out waiting for Informer cache sync")
	}
	log.Println("🚀 Informer cache synchronized! Real-time metrics poller & traffic beam simulator running.")

	// 5. Setup HTTP / WebSocket endpoint
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		hub.register <- conn

		go func(c *websocket.Conn) {
			defer func() {
				hub.unregister <- c
			}()

			for {
				_, messageBytes, err := c.ReadMessage()
				if err != nil {
					break
				}

				var msg ClientMessage
				if err := json.Unmarshal(messageBytes, &msg); err != nil {
					log.Printf("❌ Failed to parse incoming WebSocket message: %v", err)
					continue
				}

				hub.handleChaosAction(msg)
			}
		}(conn)
	})

	port := "8080"
	log.Printf("🌐 KubeDiorama WebSocket Server running on ws://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("HTTP server error: %v", err)
	}
}
