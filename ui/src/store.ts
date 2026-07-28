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
  blocked?: boolean; // True if traffic is blocked by a Black Hole NetworkPolicy
}

export type ChaosSpell = 'none' | 'meteor' | 'black_hole' | 'flood';

export interface TimelineBounds {
  min: number;
  max: number;
  current: number;
}

interface PodStore {
  pods: Pod[];
  trafficEvents: TrafficEvent[];
  isConnected: boolean;
  isLive: boolean;
  activeSpell: ChaosSpell;
  timeline: TimelineBounds;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setActiveSpell: (spell: ChaosSpell) => void;
  sendWSMessage: (message: object) => void;
  castMeteor: (podName: string, namespace: string) => void;
  castBlackHole: (sourceNs: string, destNs: string) => void;
  castFlood: (targetPod: string, namespace: string) => void;
  removeTrafficEvent: (id: string) => void;
  scrubTo: (timestamp: number) => void;
  resumeLive: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const now = Math.floor(Date.now() / 1000);

export const usePodStore = create<PodStore>((set, get) => ({
  pods: [],
  trafficEvents: [],
  isConnected: false,
  isLive: true,
  activeSpell: 'none',
  timeline: {
    min: now - 600,
    max: now,
    current: now,
  },

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

  castBlackHole: (sourceNs, destNs) => {
    console.log(`🕳️ [KubeDiorama] Casting Black Hole partition between '${sourceNs}' and '${destNs}'!`);
    get().sendWSMessage({
      action: 'black_hole',
      sourceNamespace: sourceNs,
      destNamespace: destNs,
    });
  },

  castFlood: (targetPod, namespace) => {
    console.log(`🌊 [KubeDiorama] Casting Traffic Flood on Pod '${targetPod}' in namespace '${namespace}'!`);
    get().sendWSMessage({
      action: 'flood',
      podName: targetPod,
      namespace,
    });
  },

  removeTrafficEvent: (id) => {
    set((state) => ({
      trafficEvents: state.trafficEvents.filter((ev) => ev.id !== id),
    }));
  },

  scrubTo: (timestamp) => {
    console.log(`⏳ [KubeDiorama DVR] Scrubbing back to timestamp: ${timestamp}`);
    set((state) => ({
      isLive: false,
      timeline: { ...state.timeline, current: timestamp },
    }));
    get().sendWSMessage({
      action: 'scrub',
      timestamp,
    });
  },

  resumeLive: () => {
    console.log('🔴 [KubeDiorama Live] Resuming live telemetry stream...');
    set({ isLive: true });
    get().sendWSMessage({
      action: 'resume',
    });
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

        if (payload && payload.type === 'pods' && Array.isArray(payload.pods)) {
          if (get().isLive) {
            const curTs = Math.floor(Date.now() / 1000);
            set((state) => ({
              pods: payload.pods,
              timeline: {
                min: state.timeline.min === 0 ? curTs - 600 : Math.min(state.timeline.min, curTs - 600),
                max: curTs,
                current: curTs,
              },
            }));
          }
        } else if (payload && payload.type === 'dvr_snapshot' && Array.isArray(payload.pods)) {
          set({
            pods: payload.pods,
            timeline: {
              min: payload.minTimestamp || get().timeline.min,
              max: payload.maxTimestamp || get().timeline.max,
              current: payload.timestamp || get().timeline.current,
            },
          });
        } else if (payload && payload.type === 'timeline_info') {
          set((state) => ({
            timeline: {
              min: payload.minTimestamp,
              max: payload.maxTimestamp,
              current: state.isLive ? payload.currentTimestamp : state.timeline.current,
            },
          }));
        } else if (payload && payload.type === 'traffic') {
          if (get().isLive) {
            const newTraffic: TrafficEvent = {
              id: `traffic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              sourcePod: payload.sourcePod,
              destPod: payload.destPod,
              speed: payload.speed === 'slow' ? 'slow' : 'fast',
              blocked: payload.blocked === true,
            };

            // Maintain active particle buffer up to 40 max for GPU instancing
            set((state) => ({
              trafficEvents: [...state.trafficEvents.slice(-39), newTraffic],
            }));
          }
        } else if (Array.isArray(payload)) {
          if (get().isLive) {
            set({ pods: payload });
          }
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
