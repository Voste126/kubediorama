import { create } from 'zustand';

// Data structure representing a Kubernetes Pod with real-time telemetry metrics
export interface Pod {
  name: string;
  namespace: string;
  status: string;
  cpu?: number;    // CPU usage percentage (0 - 100)
  memory?: number; // Memory usage percentage (0 - 100)
}

// Data structure representing a network traffic beam particle between two Pods
export interface TrafficEvent {
  id: string;
  sourcePod: string;
  destPod: string;
  speed: 'fast' | 'slow';
}

export type ChaosSpell = 'none' | 'meteor';

interface PodStore {
  pods: Pod[];
  trafficEvents: TrafficEvent[];
  isConnected: boolean;
  activeSpell: ChaosSpell;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setActiveSpell: (spell: ChaosSpell) => void;
  sendWSMessage: (message: object) => void;
  castMeteor: (podName: string, namespace: string) => void;
  removeTrafficEvent: (id: string) => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const usePodStore = create<PodStore>((set, get) => ({
  pods: [],
  trafficEvents: [],
  isConnected: false,
  activeSpell: 'none',

  setActiveSpell: (spell) => {
    console.log(`🔮 [KubeDiorama] Active Chaos Spell set to: ${spell}`);
    set({ activeSpell: spell });
  },

  sendWSMessage: (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(message);
      console.log('📤 [KubeDiorama] Sending WebSocket message to Go Agent:', payload);
      socket.send(payload);
    } else {
      console.warn('⚠️ [KubeDiorama] Cannot send message - WebSocket connection is not OPEN.');
    }
  },

  castMeteor: (podName, namespace) => {
    console.log(`☄️ [KubeDiorama] Casting Meteor on Pod '${podName}' in namespace '${namespace}'!`);
    get().sendWSMessage({
      action: 'delete_pod',
      podName,
      namespace,
    });
  },

  /**
   * Removes a completed traffic particle event after it traverses its 3D Bezier curve
   */
  removeTrafficEvent: (id) => {
    set((state) => ({
      trafficEvents: state.trafficEvents.filter((ev) => ev.id !== id),
    }));
  },

  connect: () => {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      return;
    }

    const wsUrl = 'ws://localhost:8080';
    console.log(`🔌 [KubeDiorama] Connecting to Go Agent at ${wsUrl}...`);

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ [KubeDiorama] Connected to Go Agent WebSocket server!');
      set({ isConnected: true });
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Handle typed message payloads
        if (payload && payload.type === 'pods' && Array.isArray(payload.pods)) {
          set({ pods: payload.pods });
        } else if (payload && payload.type === 'traffic') {
          const newTraffic: TrafficEvent = {
            id: `traffic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sourcePod: payload.sourcePod,
            destPod: payload.destPod,
            speed: payload.speed === 'slow' ? 'slow' : 'fast',
          };

          // Limit max active traffic particles to 12 to maintain 60 FPS performance
          set((state) => ({
            trafficEvents: [...state.trafficEvents.slice(-11), newTraffic],
          }));
        } else if (Array.isArray(payload)) {
          // Backward compatibility fallback for direct JSON array
          set({ pods: payload });
        }
      } catch (err) {
        console.error('❌ [KubeDiorama] Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.warn('⚠️ [KubeDiorama] WebSocket connection closed. Reconnecting in 3s...');
      set({ isConnected: false });

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          usePodStore.getState().connect();
        }, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ [KubeDiorama] WebSocket error:', error);
      socket?.close();
    };
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    set({ isConnected: false });
  },
}));
