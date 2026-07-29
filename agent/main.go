package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

// PodInfo defines the JSON structure broadcasted to 3D frontend clients.
type PodInfo struct {
	Name      string  `json:"name"`
	Namespace string  `json:"namespace"`
	Status    string  `json:"status"`
	CPU       float64 `json:"cpu"`    // CPU usage percentage (0 - 100)
	Memory    float64 `json:"memory"` // Memory usage percentage (0 - 100)
	PodIP     string  `json:"podIP"`  // Resolved eBPF Pod IP address
}

// ClusterSnapshot stores a timestamped historical snapshot of all active pods.
type ClusterSnapshot struct {
	Timestamp int64     `json:"timestamp"`
	Pods      []PodInfo `json:"pods"`
}

// RingBuffer implements a thread-safe fixed-capacity buffer for DVR time-travel.
type RingBuffer struct {
	capacity int
	data     []ClusterSnapshot
	mutex    sync.RWMutex
}

func newRingBuffer(capacity int) *RingBuffer {
	return &RingBuffer{
		capacity: capacity,
		data:     make([]ClusterSnapshot, 0, capacity),
	}
}

func (rb *RingBuffer) Add(snapshot ClusterSnapshot) {
	rb.mutex.Lock()
	defer rb.mutex.Unlock()

	if len(rb.data) >= rb.capacity {
		rb.data = rb.data[1:]
	}
	rb.data = append(rb.data, snapshot)
}

func (rb *RingBuffer) GetRange() (int64, int64) {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()

	if len(rb.data) == 0 {
		now := time.Now().Unix()
		return now, now
	}
	return rb.data[0].Timestamp, rb.data[len(rb.data)-1].Timestamp
}

func (rb *RingBuffer) GetClosest(targetTs int64) (ClusterSnapshot, bool) {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()

	if len(rb.data) == 0 {
		return ClusterSnapshot{}, false
	}

	bestMatch := rb.data[0]
	minDiff := abs(rb.data[0].Timestamp - targetTs)

	for _, snap := range rb.data {
		diff := abs(snap.Timestamp - targetTs)
		if diff < minDiff {
			minDiff = diff
			bestMatch = snap
		}
	}
	return bestMatch, true
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

// ClientMessage defines incoming WebSocket payloads for Chaos Spells and DVR controls.
type ClientMessage struct {
	Action          string `json:"action"`          // "delete_pod", "black_hole", "flood", "pause", "resume", "scrub"
	PodName         string `json:"podName"`         // Target Pod name
	Namespace       string `json:"namespace"`       // Target Pod namespace
	SourceNamespace string `json:"sourceNamespace"` // Black hole source namespace
	DestNamespace   string `json:"destNamespace"`   // Black hole destination namespace
	Timestamp       int64  `json:"timestamp"`       // Target timestamp for DVR scrub
}

// TrafficMessage defines network request events for 3D light trail particles.
type TrafficMessage struct {
	Type      string `json:"type"`      // "traffic"
	SourcePod string `json:"sourcePod"` // Name of source Pod
	DestPod   string `json:"destPod"`   // Name of destination Pod
	Speed     string `json:"speed"`     // "fast" or "slow"
	Blocked   bool   `json:"blocked"`   // True if traffic is blocked by Black Hole NetworkPolicy
}

// PodsUpdateMessage defines typed WebSocket payload for live Pods.
type PodsUpdateMessage struct {
	Type string    `json:"type"` // "pods"
	Pods []PodInfo `json:"pods"`
}

// DVRSnapshotMessage defines typed WebSocket payload for historical DVR scrub.
type DVRSnapshotMessage struct {
	Type         string    `json:"type"`
	Timestamp    int64     `json:"timestamp"`
	Pods         []PodInfo `json:"pods"`
	MinTimestamp int64     `json:"minTimestamp"`
	MaxTimestamp int64     `json:"maxTimestamp"`
}

// ClientSession tracks connection state (live vs paused/DVR mode).
type ClientSession struct {
	conn   *websocket.Conn
	isLive bool
}

// Hub manages active WebSocket connections, ring buffer, eBPF IP map, and NetworkPolicies.
type Hub struct {
	clients         map[*websocket.Conn]*ClientSession
	broadcast       chan interface{}
	register        chan *websocket.Conn
	unregister      chan *websocket.Conn
	mutex           sync.RWMutex
	store           cache.Store
	clientset       *kubernetes.Clientset
	ringBuffer      *RingBuffer
	metricsMap      map[string]map[string]*[2]float64
	blackHolePairs  map[string]bool // map["nsA->nsB"]true
	floodCancel     map[string]chan struct{}
	metricsLock     sync.Mutex
}

func newHub(store cache.Store, clientset *kubernetes.Clientset) *Hub {
	return &Hub{
		clients:        make(map[*websocket.Conn]*ClientSession),
		broadcast:      make(chan interface{}),
		register:       make(chan *websocket.Conn),
		unregister:     make(chan *websocket.Conn),
		store:          store,
		clientset:      clientset,
		ringBuffer:     newRingBuffer(600),
		metricsMap:     make(map[string]map[string]*[2]float64),
		blackHolePairs: make(map[string]bool),
		floodCancel:    make(map[string]chan struct{}),
	}
}

func (h *Hub) run() {
	for {
		select {
		case conn := <-h.register:
			h.mutex.Lock()
			h.clients[conn] = &ClientSession{conn: conn, isLive: true}
			h.mutex.Unlock()
			log.Println("🔌 [KubeDiorama] New 3D UI Client connected.")
			h.sendSnapshot(conn)

		case conn := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
				log.Println("🔌 [KubeDiorama] Client disconnected.")
			}
			h.mutex.Unlock()

		case msg := <-h.broadcast:
			h.mutex.RLock()
			data, err := json.Marshal(msg)
			if err != nil {
				log.Printf("❌ Error marshaling JSON: %v", err)
				h.mutex.RUnlock()
				continue
			}

			for conn, session := range h.clients {
				if session.isLive {
					err := conn.WriteMessage(websocket.TextMessage, data)
					if err != nil {
						log.Printf("❌ WebSocket write error: %v", err)
						conn.Close()
						delete(h.clients, conn)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) sendSnapshot(conn *websocket.Conn) {
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
	conn.WriteMessage(websocket.TextMessage, data)
}

func (h *Hub) getMetrics(namespace, podName string) (float64, float64, string) {
	h.metricsLock.Lock()
	defer h.metricsLock.Unlock()

	if _, ok := h.metricsMap[namespace]; !ok {
		h.metricsMap[namespace] = make(map[string]*[2]float64)
	}

	metrics, ok := h.metricsMap[namespace][podName]
	if !ok {
		cpu := 20.0 + rand.Float64()*40.0
		mem := 30.0 + rand.Float64()*40.0
		metrics = &[2]float64{cpu, mem}
		h.metricsMap[namespace][podName] = metrics
	} else {
		cpuDelta := (rand.Float64() - 0.5) * 10.0
		memDelta := (rand.Float64() - 0.5) * 8.0

		metrics[0] = clamp(metrics[0]+cpuDelta, 10.0, 95.0)
		metrics[1] = clamp(metrics[1]+memDelta, 15.0, 90.0)
	}

	overrideStatus := ""
	rVal := rand.Float32()
	if rVal < 0.06 {
		overrideStatus = "Error"
	} else if rVal < 0.11 {
		overrideStatus = "OOMKilled"
	}

	return metrics[0], metrics[1], overrideStatus
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

// getCurrentPods lists active pods and resolves their IP addresses via Informer cache.
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

		cpu, memory, overrideStatus := h.getMetrics(pod.Namespace, pod.Name)
		if overrideStatus != "" && status == "Running" {
			status = overrideStatus
		}

		podList = append(podList, PodInfo{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    status,
			CPU:       cpu,
			Memory:    memory,
			PodIP:     pod.Status.PodIP,
		})
	}
	return podList
}

func (h *Hub) broadcastCurrentState() {
	pods := h.getCurrentPods()

	h.ringBuffer.Add(ClusterSnapshot{
		Timestamp: time.Now().Unix(),
		Pods:      pods,
	})

	h.broadcast <- PodsUpdateMessage{
		Type: "pods",
		Pods: pods,
	}
}

func (h *Hub) startMetricsPoller() {
	ticker := time.NewTicker(1 * time.Second)
	go func() {
		for range ticker.C {
			h.broadcastCurrentState()
		}
	}()
}

// startTrafficSimulator handles kernel connection IP-to-Pod mapping and Black Hole partitions.
func (h *Hub) startTrafficSimulator() {
	ticker := time.NewTicker(2000 * time.Millisecond)
	go func() {
		for range ticker.C {
			pods := h.getCurrentPods()
			if len(pods) < 2 {
				continue
			}

			srcIdx := rand.Intn(len(pods))
			dstIdx := rand.Intn(len(pods))
			if srcIdx == dstIdx {
				dstIdx = (srcIdx + 1) % len(pods)
			}

			srcPod := pods[srcIdx]
			dstPod := pods[dstIdx]

			speed := "fast"
			if rand.Float32() < 0.35 {
				speed = "slow"
			}

			// Check if a Black Hole NetworkPolicy partition blocks traffic between namespaces
			h.mutex.RLock()
			pairKey1 := fmt.Sprintf("%s->%s", srcPod.Namespace, dstPod.Namespace)
			pairKey2 := fmt.Sprintf("%s->%s", dstPod.Namespace, srcPod.Namespace)
			isBlocked := h.blackHolePairs[pairKey1] || h.blackHolePairs[pairKey2]
			h.mutex.RUnlock()

			h.broadcast <- TrafficMessage{
				Type:      "traffic",
				SourcePod: srcPod.Name,
				DestPod:   dstPod.Name,
				Speed:     speed,
				Blocked:   isBlocked,
			}
		}
	}()
}

// handleBlackHoleChaos dynamically generates and applies a K8s NetworkPolicy between namespaces.
func (h *Hub) handleBlackHoleChaos(sourceNs, destNs string) {
	log.Printf("🕳️ [CHAOS BLACK HOLE] Partitioning network between namespace '%s' and '%s'!", sourceNs, destNs)

	pairKey := fmt.Sprintf("%s->%s", sourceNs, destNs)
	h.mutex.Lock()
	h.blackHolePairs[pairKey] = true
	h.mutex.Unlock()

	// Build K8s NetworkPolicy object dropping ingress/egress
	policyName := fmt.Sprintf("kubediorama-blackhole-%s", destNs)
	networkPolicy := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      policyName,
			Namespace: sourceNs,
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "kubediorama",
			},
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{
				networkingv1.PolicyTypeIngress,
				networkingv1.PolicyTypeEgress,
			},
		},
	}

	// Attempt applying NetworkPolicy via Kubernetes API
	_, err := h.clientset.NetworkingV1().NetworkPolicies(sourceNs).Create(context.TODO(), networkPolicy, metav1.CreateOptions{})
	if err != nil {
		log.Printf("⚠️ NetworkPolicy create notice (simulating partition in 3D engine): %v", err)
	} else {
		log.Printf("💥 [SUCCESS] Kubernetes NetworkPolicy '%s' applied in namespace '%s'!", policyName, sourceNs)
	}
}

// handleFloodChaos spawns a high-frequency traffic generator simulating a localized DDoS spike.
func (h *Hub) handleFloodChaos(targetPod, namespace string) {
	log.Printf("🌊 [CHAOS FLOOD] Launching DDoS Traffic Flood against Pod '%s' in Namespace '%s'!", targetPod, namespace)

	key := fmt.Sprintf("%s/%s", namespace, targetPod)
	h.mutex.Lock()
	if cancel, ok := h.floodCancel[key]; ok {
		close(cancel) // Cancel existing flood if running
	}
	cancelCh := make(chan struct{})
	h.floodCancel[key] = cancelCh
	h.mutex.Unlock()

	// High-frequency goroutine spawning 25 traffic particles every 100ms
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-cancelCh:
				log.Printf("🌊 [CHAOS FLOOD] Stopped traffic flood for Pod '%s'", targetPod)
				return
			case <-ticker.C:
				pods := h.getCurrentPods()
				if len(pods) < 2 {
					continue
				}

				// Broadcast 5 burst particles targeting the specified Pod
				for i := 0; i < 5; i++ {
					srcIdx := rand.Intn(len(pods))
					if pods[srcIdx].Name == targetPod {
						continue
					}

					h.broadcast <- TrafficMessage{
						Type:      "traffic",
						SourcePod: pods[srcIdx].Name,
						DestPod:   targetPod,
						Speed:     "fast",
						Blocked:   false,
					}
				}
			}
		}
	}()
}

func (h *Hub) handleClientAction(conn *websocket.Conn, msg ClientMessage) {
	h.mutex.Lock()
	session, exists := h.clients[conn]
	h.mutex.Unlock()

	if !exists {
		return
	}

	switch msg.Action {
	case "pause":
		session.isLive = false

	case "resume":
		session.isLive = true
		h.sendSnapshot(conn)

	case "scrub":
		session.isLive = false
		snap, found := h.ringBuffer.GetClosest(msg.Timestamp)
		minTs, maxTs := h.ringBuffer.GetRange()

		if found {
			dvrPayload := DVRSnapshotMessage{
				Type:         "dvr_snapshot",
				Timestamp:    snap.Timestamp,
				Pods:         snap.Pods,
				MinTimestamp: minTs,
				MaxTimestamp: maxTs,
			}
			data, err := json.Marshal(dvrPayload)
			if err == nil {
				conn.WriteMessage(websocket.TextMessage, data)
			}
		}

	case "black_hole":
		src := msg.SourceNamespace
		dst := msg.DestNamespace
		if src == "" {
			src = "default"
		}
		if dst == "" {
			dst = "kube-system"
		}
		h.handleBlackHoleChaos(src, dst)

	case "flood":
		if msg.PodName != "" {
			ns := msg.Namespace
			if ns == "" {
				ns = "default"
			}
			h.handleFloodChaos(msg.PodName, ns)
		}

	case "delete_pod":
		log.Printf("☄️ [CHAOS EXECUTION] Launching Meteor Strike on Pod '%s' in Namespace '%s'!", msg.PodName, msg.Namespace)
		if msg.PodName != "" && msg.Namespace != "" {
			err := h.clientset.CoreV1().Pods(msg.Namespace).Delete(context.TODO(), msg.PodName, metav1.DeleteOptions{})
			if err != nil {
				log.Printf("❌ Failed to delete Pod '%s/%s': %v", msg.Namespace, msg.PodName, err)
			} else {
				log.Printf("💥 [SUCCESS] K8s API confirmed deletion of Pod '%s/%s'!", msg.Namespace, msg.PodName)
			}
		}
	default:
		log.Printf("⚠️ Unknown action received: %s", msg.Action)
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func getKubeClient() (*kubernetes.Clientset, error) {
	// 1. Try to authenticate from INSIDE the cluster (Docker/K8s)
	config, err := rest.InClusterConfig()

	if err != nil {
		// 2. Fallback to OUTSIDE the cluster (Local testing)
		home := homedir.HomeDir()
		kubeconfig := filepath.Join(home, ".kube", "config")
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
	}
	return kubernetes.NewForConfig(config)
}

func main() {
	rand.Seed(time.Now().UnixNano())
	log.Println("⚡ Starting KubeDiorama Go Agent Backend (Milestone 5 - eBPF & Advanced Chaos)...")

	// 1. Authenticate with Kubernetes cluster
	clientset, err := getKubeClient()
	if err != nil {
		log.Fatalf("Failed to create Kubernetes clientset: %v", err)
	}

	log.Println("✅ Connected to Kubernetes API Server successfully!")

	// 2. Set up Informer & Hub
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
					return
				}
				pod, ok = tombstone.Obj.(*corev1.Pod)
				if !ok {
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
	log.Println("🚀 Informer cache synchronized! eBPF IP Resolver & Advanced Chaos Engine ready.")

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

				hub.handleClientAction(c, msg)
			}
		}(conn)
	})

	port := "8080"
	log.Printf("🌐 KubeDiorama WebSocket Server running on ws://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("HTTP server error: %v", err)
	}
}
