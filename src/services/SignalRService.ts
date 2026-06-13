import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { performTokenRefresh } from './api';

const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.tezride.pk';
const BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
const HUB_ENDPOINTS = {
    DRIVER: '/hubs/drivers',
    CUSTOMER: '/hubs/customers',
};

// ─── Reconnect intervals: 0, 1s, 2s, 5s, 10s, 30s ───────────────────────────────
const RECONNECT_DELAYS = [0, 1000, 2000, 5000, 10000, 30000];
const HEARTBEAT_INTERVAL_MS = 10_000; // 10s heartbeat
const MAX_RECONNECT_WAIT_MS = 30_000;

export type ConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting';
export type HubRole = 'DRIVER' | 'CUSTOMER';

interface HubConnectionInstance {
    connection: signalR.HubConnection | null;
    role: HubRole;
    stateListeners: Array<(state: ConnectionState) => void>;
    eventHandlers: Map<string, Set<(...args: any[]) => void>>;
    heartbeatTimer: ReturnType<typeof setInterval> | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    reconnectAttempts: number;
    isIntentionalDisconnect: boolean;
    pendingConnect: Promise<void> | null;
}

// Global instances for each role to prevent leaks and duplicate connections
const _instances: Record<HubRole, HubConnectionInstance> = {
    DRIVER: createInstance('DRIVER'),
    CUSTOMER: createInstance('CUSTOMER'),
};

let _appStateSubscription: any = null;

function createInstance(role: HubRole): HubConnectionInstance {
    return {
        connection: null,
        role,
        stateListeners: [],
        eventHandlers: new Map(),
        heartbeatTimer: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        isIntentionalDisconnect: false,
        pendingConnect: null,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notifyStateChange = (role: HubRole, state: ConnectionState) => {
    console.log(`[SignalR:${role}] State → ${state}`);
    _instances[role].stateListeners.forEach(fn => {
        try { fn(state); } catch (e) { /* ignore */ }
    });
};

const clearHeartbeat = (role: HubRole) => {
    const inst = _instances[role];
    if (inst.heartbeatTimer) {
        clearInterval(inst.heartbeatTimer);
        inst.heartbeatTimer = null;
    }
};

const clearReconnectTimer = (role: HubRole) => {
    const inst = _instances[role];
    if (inst.reconnectTimer) {
        clearTimeout(inst.reconnectTimer);
        inst.reconnectTimer = null;
    }
};

const startHeartbeat = (role: HubRole) => {
    const inst = _instances[role];
    clearHeartbeat(role);
    if (!inst.connection) return;

    inst.heartbeatTimer = setInterval(async () => {
        if (inst.connection?.state === signalR.HubConnectionState.Connected) {
            try {
                // Heartbeat to keep connection alive in background
                // SignalR client has built-in keep-alive via .withKeepAliveInterval()
                // No server-side KeepAlive method needed
            } catch (err) {
                // Log heartbeat errors for debugging but don't crash
                console.warn(`[SignalR:${role}] Heartbeat failed:`, (err as any)?.message || err);
            }
        }
    }, HEARTBEAT_INTERVAL_MS);
};

const scheduleReconnect = (role: HubRole) => {
    const inst = _instances[role];
    if (inst.isIntentionalDisconnect) return;
    clearReconnectTimer(role);

    const delay = inst.reconnectAttempts < RECONNECT_DELAYS.length
        ? RECONNECT_DELAYS[inst.reconnectAttempts]
        : MAX_RECONNECT_WAIT_MS;

    inst.reconnectAttempts++;
    console.log(`[SignalR:${role}] Reconnecting in ${delay}ms (attempt #${inst.reconnectAttempts})`);

    inst.reconnectTimer = setTimeout(async () => {
        if (inst.isIntentionalDisconnect) return;
        try {
            await SignalRService.connect(role);
        } catch {
            scheduleReconnect(role);
        }
    }, delay);
};

const buildConnection = async (role: HubRole): Promise<signalR.HubConnection> => {
    // We fetch the token here for the initial URL
    let token: string | null;
    try {
        token = await AsyncStorage.getItem('token');
    } catch (err) {
        console.error(`[SignalR:${role}] Failed to retrieve token from AsyncStorage:`, err);
        throw new Error('Failed to retrieve access token');
    }
    if (!token) throw new Error('No access token available');

    // SignalR's withUrl with accessTokenFactory automatically handles 
    // appending ?access_token=... for WebSockets. No need to append manually.
    const url = `${BASE_URL}${HUB_ENDPOINTS[role]}`;

    const conn = new signalR.HubConnectionBuilder()
        .withUrl(url, {
            accessTokenFactory: async () => (await AsyncStorage.getItem('token')) || '',
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
            skipNegotiation: false,
        })
        .withKeepAliveInterval(15_000)
        .withServerTimeout(60_000)
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // Re-register persistent handlers
    _instances[role].eventHandlers.forEach((handlers, event) => {
        handlers.forEach(handler => {
            conn.on(event, (...args: any[]) => {
                try { handler(...args); } catch (err) {
                    console.error(`[SignalR:${role}] Handler error for '${event}':`, err);
                }
            });
        });
    });

    return conn;
};

const handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'active') {
        // Force reconnect all active roles on resume if they got dropped
        for (const role of Object.keys(_instances) as HubRole[]) {
            const inst = _instances[role];
            if (inst.connection && inst.connection.state === signalR.HubConnectionState.Disconnected && !inst.isIntentionalDisconnect) {
                console.log(`[SignalR:${role}] Reconnecting after app active`);
                SignalRService.connect(role).catch(() => scheduleReconnect(role));
            }
        }
    }
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const SignalRService = {
    /**
     * Subscribe to state changes for a specific hub.
     */
    onStateChange(role: HubRole, fn: (state: ConnectionState) => void): () => void {
        _instances[role].stateListeners.push(fn);
        return () => {
            _instances[role].stateListeners = _instances[role].stateListeners.filter(l => l !== fn);
        };
    },

    async connect(role: HubRole = 'DRIVER'): Promise<void> {
        const inst = _instances[role];

        if (!_appStateSubscription) {
            _appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
        }

        if (inst.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        if (inst.pendingConnect) {
            return inst.pendingConnect;
        }

        inst.pendingConnect = (async () => {
            inst.isIntentionalDisconnect = false;
            clearReconnectTimer(role);

            try {
                notifyStateChange(role, 'Connecting');
                if (!inst.connection) {
                    inst.connection = await buildConnection(role);
                    
                    inst.connection.onreconnecting(() => notifyStateChange(role, 'Reconnecting'));
                    inst.connection.onreconnected(() => {
                        inst.reconnectAttempts = 0;
                        notifyStateChange(role, 'Connected');
                        startHeartbeat(role);
                    });
                    inst.connection.onclose((err) => {
                        notifyStateChange(role, 'Disconnected');
                        clearHeartbeat(role);
                        if (!inst.isIntentionalDisconnect) scheduleReconnect(role);
                    });
                }

                await inst.connection.start();
                if (inst.isIntentionalDisconnect) {
                    console.log(`[SignalR:${role}] Connection started but intentional disconnect was requested during start. Stopping.`);
                    try { await inst.connection.stop(); } catch {}
                    inst.connection = null;
                    notifyStateChange(role, 'Disconnected');
                    return;
                }
                inst.reconnectAttempts = 0;
                notifyStateChange(role, 'Connected');
                startHeartbeat(role);
            } catch (err: any) {
                notifyStateChange(role, 'Disconnected');
                console.error(`[SignalR:${role}] Connection failed:`, err?.message || err);
                
                if (err?.statusCode === 401 || err?.message?.includes('401')) {
                    console.warn(`[SignalR:${role}] 401 Unauthorized — Attempting silent token refresh`);
                    try {
                        await performTokenRefresh();
                        if (inst.connection) {
                            try { await inst.connection.stop(); } catch {}
                            inst.connection = null;
                        }
                        // Clear pendingConnect so the recursive call actually connects instead of deadlocking!
                        inst.pendingConnect = null;
                        return await this.connect(role);
                    } catch (refreshErr) {
                        console.error(`[SignalR:${role}] Token refresh failed during 401 handling:`, refreshErr);
                        throw refreshErr;
                    }
                }
                
                if (!inst.isIntentionalDisconnect && err?.message !== 'No access token available' && err?.message !== 'Failed to retrieve access token') {
                    scheduleReconnect(role);
                }
                throw err;
            } finally {
                inst.pendingConnect = null;
            }
        })();

        return inst.pendingConnect;
    },

    async disconnect(role: HubRole): Promise<void> {
        const inst = _instances[role];
        inst.isIntentionalDisconnect = true;
        clearHeartbeat(role);
        clearReconnectTimer(role);

        if (inst.connection) {
            try {
                // Remove all handlers from the underlying connection before stopping
                inst.eventHandlers.forEach((handlers, event) => {
                    handlers.forEach(h => inst.connection?.off(event, h));
                });
                await inst.connection.stop();
                console.log(`[SignalR:${role}] Disconnected intentionally`);
            } catch (err) {
                console.warn(`[SignalR:${role}] Stop error:`, err);
            }
            inst.connection = null;
            notifyStateChange(role, 'Disconnected');
        }

        // Cleanup AppState listener if no roles are active
        const hasActiveConnections = (Object.keys(_instances) as HubRole[]).some(
            r => _instances[r].connection !== null || _instances[r].pendingConnect !== null
        );
        if (!hasActiveConnections && _appStateSubscription) {
            _appStateSubscription.remove();
            _appStateSubscription = null;
        }
    },

    isConnected(role: HubRole): boolean {
        return _instances[role].connection?.state === signalR.HubConnectionState.Connected;
    },

    async invoke<T = void>(role: HubRole, method: string, ...args: any[]): Promise<T | null> {
        const inst = _instances[role];
        if (inst.connection?.state !== signalR.HubConnectionState.Connected) {
            console.warn(`[SignalR:${role}] Cannot invoke '${method}' — not connected`);
            return null;
        }
        try {
            // Add a timeout to invocation to prevent hanging the UI
            const invokePromise = inst.connection.invoke<T>(method, ...args);
            const timeoutPromise = new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error(`Invoke '${method}' timed out after 10s`)), 10000)
            );
            
            const result = await Promise.race([invokePromise, timeoutPromise]) as T;
            return result;
        } catch (err) {
            console.error(`[SignalR:${role}] invoke '${method}' failed:`, err);
            throw err;
        }
    },

    on(role: HubRole, event: string, handler: (...args: any[]) => void): () => void {
        const inst = _instances[role];
        if (!inst.eventHandlers.has(event)) {
            inst.eventHandlers.set(event, new Set());
        }

        if (inst.eventHandlers.get(event)!.has(handler)) {
            return () => this.off(role, event, handler);
        }

        inst.eventHandlers.get(event)!.add(handler);
        
        if (inst.connection) {
            inst.connection.on(event, handler);
        }

        return () => this.off(role, event, handler);
    },

    off(role: HubRole, event: string, handler: (...args: any[]) => void): void {
        const inst = _instances[role];
        const handlers = inst.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) inst.eventHandlers.delete(event);
        }
        inst.connection?.off(event, handler);
    },

    clearAllHandlers(role: HubRole): void {
        const inst = _instances[role];
        if (inst.connection) {
            inst.eventHandlers.forEach((handlers, event) => {
                handlers.forEach(h => inst.connection?.off(event, h));
            });
        }
        inst.eventHandlers.clear();
        inst.stateListeners = [];
    },
};

