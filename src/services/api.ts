import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.tezride.pk';
const BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
});

// ── Request interceptor: attach Bearer token ───────────────────────────────
api.interceptors.request.use(
    async (config) => {
        // console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('[API] Error reading token', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Track if we are already refreshing to prevent infinite loops ───────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else if (token) {
            resolve(token);
        }
    });
    failedQueue = [];
};

// ── Response interceptor: auto-refresh on 401 & Retry logic ──────────────────
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const { config, response } = error;
        const originalRequest = config;
        const status = response?.status;
        const url = config?.url;

        // ── 1. Handle Network Errors / Timeouts (Retry) ─────────────────────
        // Skip retry for critical auth endpoints or if it's a 400 (validation)
        const isAuthEndpoint = url?.includes('/api/Account/verify-otp') || url?.includes('/api/Account/send-otp') || url?.includes('/api/Account/refresh-token');
        
        if (!isAuthEndpoint && (!response || (status >= 500))) {
            originalRequest._retryCount = originalRequest._retryCount || 0;
            if (originalRequest._retryCount < 2) {
                originalRequest._retryCount++;
                const delay = originalRequest._retryCount * 1000;
                console.log(`[API] Retrying ${url} (Attempt ${originalRequest._retryCount}) in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return api(originalRequest);
            }
        }

        // ── 2. 401 handling: try refresh first, logout only if refresh fails ──
        if (status === 401 && !originalRequest._retry) {
            // Skip refresh if we're already on the refresh or auth endpoint
            if (url?.includes('/api/Account/refresh-token') || url?.includes('/api/Account/verify-otp')) {
                console.warn('[API] 401 on auth endpoint — logging out');
                await forceLogout();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Queue this request until refresh completes
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newToken = await performTokenRefresh();
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshErr: any) {
                processQueue(refreshErr, null);
                // If refresh fails, we've already handled logout in performTokenRefresh
                return Promise.reject(refreshErr);
            } finally {
                isRefreshing = false;
            }
        }

        let message = response?.data?.message || response?.data?.Message || error.message || 'Something went wrong';

        // Handle validation errors
        if (response?.data?.Errors && Array.isArray(response.data.Errors) && response.data.Errors.length > 0) {
            message = response.data.Errors.join('\n');
        } else if (response?.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            // Support both casing
            message = response.data.errors.join('\n');
        }

        error.message = message;

        if (status === 400) {
            console.error(`[API 400 Bad Request] ${url}:`, JSON.stringify(response?.data, null, 2));
        } else if (status === 403) {
            console.error(`[API 403 Forbidden] ${url}: This usually means the role is incorrect.`, JSON.stringify(response?.data, null, 2));
        } else if (status === 404) {
            // Silently handle 404 for missing APIs during development
            console.warn(`[API 404 Not Found] ${url}: Endpoint might be unavailable.`);
        } else {
            console.error(`[API Error] ${status || 'TIMEOUT'} ${url}:`, message);
        }

        return Promise.reject(error);
    }
);

/**
 * Safe API request wrapper to prevent crashes and handle missing endpoints.
 */
export async function safeRequest<T>(request: Promise<any>, fallbackValue: T): Promise<T> {
    try {
        const response = await request;
        return response.data?.data || response.data || fallbackValue;
    } catch (error: any) {
        // Silently catch and return fallback for production stability
        return fallbackValue;
    }
}

export async function performTokenRefresh(): Promise<string> {
    try {
        const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
        if (!storedRefreshToken) {
            console.warn('[API] No stored refresh token available');
            throw new Error('No stored refresh token');
        }

        console.log('[API] Attempting token refresh...');
        
        // Match OpenAPI spec: POST /api/Account/refresh-token?refreshToken=...
        const refreshResp = await axios.post(
            `${BASE_URL}/api/Account/refresh-token?refreshToken=${encodeURIComponent(storedRefreshToken)}`,
            {},
            { 
                timeout: 15000,
                headers: { 'Accept': 'application/json' }
            }
        );

        const apiResponse = refreshResp.data;
        const data = apiResponse?.data || apiResponse;
        
        const newToken: string = data?.jwToken || data?.token || data?.JWToken;
        const newRefreshToken: string = data?.refreshToken || data?.RefreshToken;

        if (!newToken) {
            console.error('[API] Refresh response missing token. Response:', JSON.stringify(apiResponse));
            throw new Error('Refresh response missing token');
        }

        // Atomic update of session
        const updates = [AsyncStorage.setItem('token', newToken)];
        if (newRefreshToken) {
            updates.push(AsyncStorage.setItem('refreshToken', newRefreshToken));
        }
        await Promise.all(updates);

        console.log('[API] Token refreshed successfully');
        return newToken;
    } catch (refreshErr: any) {
        const refreshStatus = refreshErr.response?.status;
        const errorData = refreshErr.response?.data;
        const errorMessage = errorData?.message || errorData?.Message || refreshErr.message;

        console.error(`[API] Token refresh failed: ${refreshStatus || 'NETWORK_ERROR'} - ${errorMessage}`);

        // Only logout if the server explicitly rejects the token (400 or 401)
        if (refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403) {
            console.warn(`[API] Session rejected by server — forcing logout`);
            await forceLogout();
        } else {
            console.warn(`[API] Transient error during refresh — preserving session state`);
        }
        throw refreshErr;
    }
}

export async function forceLogout(emit = true) {
    try {
        // Clear everything
        const keys = await AsyncStorage.getAllKeys();
        const keysToRemove = keys.filter(k => !k.includes('language') && !k.includes('i18next'));
        await AsyncStorage.multiRemove(keysToRemove);

        // Signal cleanup to context ONLY if not already in a signOut flow
        if (emit) {
            DeviceEventEmitter.emit('auth_logout');
        }

        console.log('[API] Logout cleanup complete');
    } catch (e) {
        console.error('[API] Logout error:', e);
    }
}

/**
 * Decodes the JWT payload and checks if the token is expired or expiring soon.
 */
export function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        let jsonPayload: string;
        if (typeof atob === 'function') {
            jsonPayload = atob(base64);
        } else {
            // Robust base64 decoder fallback for older/non-polyfilled environments
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            let buffer = 0;
            let bits = 0;
            let decoded = '';
            for (let i = 0; i < base64.length; i++) {
                const char = base64.charAt(i);
                const val = chars.indexOf(char);
                if (val >= 0) {
                    buffer = (buffer << 6) | val;
                    bits += 6;
                    if (bits >= 8) {
                        bits -= 8;
                        decoded += String.fromCharCode((buffer >> bits) & 0xff);
                    }
                }
            }
            jsonPayload = decoded;
        }

        const payload = JSON.parse(jsonPayload);
        if (!payload.exp) return true;

        const currentTime = Math.floor(Date.now() / 1000);
        // Expire 60s early as a safety buffer
        return payload.exp < (currentTime + 60);
    } catch (e) {
        console.error('[API] Error decoding/validating token:', e);
        return true;
    }
}

/**
 * Checks token validity. If expired, performs silent refresh.
 * Returns true if the token is valid or successfully refreshed (or preserved on offline network issues).
 * Returns false if the session is invalid/rejected by the server and logged out.
 */
export async function ensureValidToken(): Promise<boolean> {
    try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return false;

        if (isTokenExpired(token)) {
            console.log('[API] Startup check: Token expired or expiring soon, attempting silent refresh...');
            const newToken = await performTokenRefresh();
            return !!newToken;
        }

        console.log('[API] Startup check: Existing token is valid');
        return true;
    } catch (err: any) {
        // If performTokenRefresh fails, it handles forceLogout if it's a 400/401/403.
        // If it's a network/server issue, the session is preserved (keeps user logged in).
        const refreshStatus = err.response?.status;
        if (refreshStatus && (refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403)) {
            console.warn('[API] Startup check: Token refresh rejected by server. Access denied.');
            return false;
        }

        console.warn('[API] Startup check: Token validation/refresh failed (network or other issue). Preserving session.', err?.message || err);
        // If there's an existing token and it was a network issue, we return true to let them use the app cached state
        const token = await AsyncStorage.getItem('token');
        return !!token;
    }
}

export default api;

