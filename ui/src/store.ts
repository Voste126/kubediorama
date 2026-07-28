import { create } from 'zustand';

// Defines the data structure of a Kubernetes Pod broadcasted from the Go agent
export interface Pod {
  name: string;
  namespace: string;
  status: string;
}

interface PodStore {
  pods: Pod[];
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const usePodStore = create<PodStore>((set) => ({
  pods: [],
  isConnected: false,

  /**
   * Initializes WebSocket connection to the Go Agent backend (ws://localhost:8080).
   * Automatically parses incoming JSON pod updates and handles reconnects on disconnect.
   */
  connect: () => {
    // Avoid duplicate connections
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      return;
    }

    const wsUrl = 'ws://localhost:8080';
    console.log(`🔌 [KubeDiorama] Connecting to Go Agent WebSocket at ${wsUrl}...`);

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
        const data: Pod[] = JSON.parse(event.data);
        console.log('📦 [KubeDiorama] Received Pod cluster state update:', data);
        set({ pods: Array.isArray(data) ? data : [] });
      } catch (err) {
        console.error('❌ [KubeDiorama] Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.warn('⚠️ [KubeDiorama] WebSocket connection closed. Attempting reconnect in 3s...');
      set({ isConnected: false });

      // Attempt automatic reconnect every 3 seconds
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

  /**
   * Closes the active WebSocket connection.
   */
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
