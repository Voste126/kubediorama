package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

// PodInfo defines the light JSON structure broadcasted to 3D frontend clients.
type PodInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
}

// Hub manages active WebSocket connections and broadcasts cluster state updates.
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []PodInfo
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mutex      sync.RWMutex
	store      cache.Store
}

func newHub(store cache.Store) *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []PodInfo),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		store:      store,
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
			log.Println("New 3D UI Client connected. Sending initial cluster snapshot...")
			// Send immediate snapshot of current pods on connection
			h.sendSnapshot(client)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Println("Client disconnected.")
			}
			h.mutex.Unlock()

		case pods := <-h.broadcast:
			h.mutex.RLock()
			data, err := json.Marshal(pods)
			if err != nil {
				log.Printf("Error marshaling pods JSON: %v", err)
				h.mutex.RUnlock()
				continue
			}

			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, data)
				if err != nil {
					log.Printf("WebSocket write error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// sendSnapshot fetches all active pods from the Informer store and sends to a single client.
func (h *Hub) sendSnapshot(client *websocket.Conn) {
	pods := h.getCurrentPods()
	data, err := json.Marshal(pods)
	if err != nil {
		log.Printf("Error marshaling snapshot: %v", err)
		return
	}
	client.WriteMessage(websocket.TextMessage, data)
}

// getCurrentPods lists all items in the Informer cache and converts them into []PodInfo.
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

		// Determine readable status string
		status := string(pod.Status.Phase)
		if pod.DeletionTimestamp != nil {
			status = "Terminating"
		}

		podList = append(podList, PodInfo{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    status,
		})
	}
	return podList
}

// broadcastCurrentState triggers a broadcast of all active pods to all connected clients.
func (h *Hub) broadcastCurrentState() {
	pods := h.getCurrentPods()
	h.broadcast <- pods
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for local development between Vite frontend and Go backend
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	log.Println("⚡ Starting KubeDiorama Go Agent Backend...")

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

	// 2. Set up SharedInformerFactory targeting the 'default' namespace
	factory := informers.NewSharedInformerFactoryWithOptions(
		clientset,
		10*time.Second, // Resync period
		informers.WithNamespace("default"),
	)

	podInformer := factory.Core().V1().Pods().Informer()
	hub := newHub(podInformer.GetStore())

	go hub.run()

	// 3. Register Event Handlers for Pod Additions, Updates, and Deletions
	podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pod := obj.(*corev1.Pod)
			log.Printf("📦 [POD CREATED] Name: %s | Namespace: %s | Status: %s", pod.Name, pod.Namespace, pod.Status.Phase)
			hub.broadcastCurrentState()
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			newPod := newObj.(*corev1.Pod)
			log.Printf("🔄 [POD UPDATED] Name: %s | Status: %s", newPod.Name, newPod.Status.Phase)
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
			log.Printf("🗑️ [POD DELETED] Name: %s | Namespace: %s", pod.Name, pod.Namespace)
			hub.broadcastCurrentState()
		},
	})

	// 4. Start the Informer factory in a goroutine
	stopCh := make(chan struct{})
	defer close(stopCh)
	factory.Start(stopCh)

	// Wait for cache synchronization before serving HTTP requests
	log.Println("⏳ Waiting for Informer cache to synchronize...")
	if !cache.WaitForCacheSync(stopCh, podInformer.HasSynced) {
		log.Fatalf("Timed out waiting for Informer cache sync")
	}
	log.Println("🚀 Informer cache synchronized! Ready to stream Pod events.")

	// 5. Setup HTTP / WebSocket endpoint on port 8080
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		hub.register <- conn

		// Listen for client disconnect
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				hub.unregister <- conn
				break
			}
		}
	})

	port := "8080"
	log.Printf("🌐 KubeDiorama WebSocket Server running on ws://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("HTTP server error: %v", err)
	}
}
