import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConnectionState, SignalRService } from '../services/SignalRService';
import { ridesService } from '../services/rides';
import { userService } from '../services/user';
import { Alert, DeviceEventEmitter, Platform } from 'react-native';
import OverlayService from '../native/OverlayService';
import api from '../services/api';
import { navigate, navigationRef } from '../services/NavigationService';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import {
    safeParseJson,
    sanitizeRideRecord,
    shouldRestoreRideNavigation,
} from '../utils/rideSafety';

import { BACKGROUND_LOCATION_TASK } from '../services/BackgroundTaskService';
import { RideNotificationBridge } from '../utils/RideNotificationBridge';

// Keep rider online even if backend sends balance-related offline status.
const FORCE_IGNORE_BALANCE_RESTRICTION = true;

export interface RideRequestPayload {
    event: string;
    rideId: string;
    pickup: { lat: number; lon: number };
    dropoff: { lat: number; lon: number };
    timeoutSec: number;
    type?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    timestamp?: number;
    fare?: number;
    distance?: number;
    duration?: number;
    customerRating?: number;
    customerName?: string;
    customerProfilePicUrl?: string;
    customerPhone?: string;
    paymentMethod?: string;
}

interface DriverProfile {
    vehicleType: string;
    gender: string;
    rating: number;
    driverName?: string;
    profilePicUrl?: string;
    vehiclePlateNumber?: string;
}

interface RideContextType {
    isOnline: boolean;
    isRestoreCompleted: boolean;
    isLoading: boolean;
    statusMessage: string;
    connectionState: ConnectionState;
    activeRide: any;
    rideRequests: any[];
    incomingRideRequest: RideRequestPayload | null;
    selectedRide: any;
    onlineState: 'idle' | 'connecting' | 'connected' | 'failed';
    showOverlayPermissionPrompt: boolean;
    setShowOverlayPermissionPrompt: (visible: boolean) => void;
    setIsOnline: (online: boolean) => void;
    setSelectedRide: (ride: any) => void;
    acceptIncomingRide: (ride?: any) => Promise<void>;
    rejectIncomingRide: (ride?: any) => Promise<void>;
    dismissIncomingRide: () => void;
    setActiveRide: (ride: any) => void;
    updateRideStatus: (status: string) => Promise<void>;
    completeRide: (distanceKm?: number, payFromWallet?: boolean) => Promise<any>;
    cancelRide: () => Promise<void>;
    interestedRideIds: Set<string>;
    hasRestoredSession: boolean;
    setHasRestoredSession: (restored: boolean) => void;
    driverLocation: { latitude: number; longitude: number } | null;
    driverHeading: number;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

const DEFAULT_PROFILE: DriverProfile = {
    vehicleType: 'bike',
    gender: 'male',
    rating: 4.5,
};

const getDriverProfile = async (): Promise<DriverProfile> => {
    try {
        const raw = await AsyncStorage.getItem('driverProfile');
        const parsed = safeParseJson<Partial<DriverProfile>>(raw);
        if (parsed) return { ...DEFAULT_PROFILE, ...parsed };
    } catch (_) { }
    return DEFAULT_PROFILE;
};

const getFastestLocation = async (): Promise<any> => {
    try {
        // 1. Try to get the last known location first (sub-millisecond lookups)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
            const ageMs = Date.now() - lastKnown.timestamp;
            // If the last known location is fresh (under 2 minutes / 120,000ms), use it immediately!
            if (ageMs < 120000) {
                console.log(`[RideContext:GPS] Using fresh last known location (age: ${Math.round(ageMs / 1000)}s)`);
                return lastKnown;
            }
            console.log(`[RideContext:GPS] Stale last known location found (age: ${Math.round(ageMs / 1000)}s), checking fresh...`);
        }
    } catch (e) {
        console.warn('[RideContext:GPS] Failed to retrieve last known location:', e);
    }

    // 2. Query a fresh location but set a tighter timeout of 5 seconds (raced)
    const gpsPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
    });

    const gpsTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS Fetch Timeout')), 5000)
    );

    try {
        const freshLoc = await Promise.race([gpsPromise, gpsTimeoutPromise]);
        console.log('[RideContext:GPS] Fresh GPS Location retrieved successfully');
        return freshLoc;
    } catch (err: any) {
        console.warn('[RideContext:GPS] Fresh GPS fetch failed or timed out:', err?.message || err);

        // 3. Robust fallback: Retrieve the last known location of ANY age as a fallback to ensure rider can go online
        try {
            const fallbackLoc = await Location.getLastKnownPositionAsync();
            if (fallbackLoc) {
                console.log(`[RideContext:GPS] Fallback: Using last known location (age: ${Math.round((Date.now() - fallbackLoc.timestamp) / 1000)}s)`);
                return fallbackLoc;
            }
        } catch (fallbackErr) {
            console.warn('[RideContext:GPS] Fallback retrieval failed:', fallbackErr);
        }

        throw err;
    }
};

const safeStringify = (val: any): string => {
    try { return JSON.stringify(val); } catch { return String(val); }
};

export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const { user, isLoading: isAuthLoading } = useAuth();
    const { showError } = useUI();
    const [isOnline, setIsOnlineState] = useState(false);
    const [isRestoreCompleted, setIsRestoreCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
    const [activeRide, setActiveRideState] = useState<any>(null);
    const [rideRequests, setRideRequests] = useState<any[]>([]);
    const [incomingRideRequest, setIncomingRideRequest] = useState<RideRequestPayload | null>(null);
    const [selectedRide, setSelectedRide] = useState<any>(null);
    const [onlineState, setOnlineState] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
    const [hasRestoredSession, setHasRestoredSession] = useState(false);
    const [showOverlayPermissionPrompt, setShowOverlayPermissionPrompt] = useState(false);
    const [interestedRideIds, setInterestedRideIds] = useState<Set<string>>(new Set());
    const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [driverHeading, setDriverHeading] = useState(0);

    const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const onlineSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const safetyFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRef = useRef(false);
    const profileRef = useRef<DriverProfile>(DEFAULT_PROFILE);
    const isOnlineRef = useRef(false);
    const isMountedRef = useRef(false);
    const rideRequestsRef = useRef<any[]>([]);
    const registeredEventsRef = useRef<Set<string>>(new Set());
    const activeRideRef = useRef<any>(null);
    const pendingRideActionRef = useRef<string | null>(null);
    const processedEventKeysRef = useRef<Map<string, number>>(new Map());
    const lastRideNavigationKeyRef = useRef<string | null>(null);
    const lastOnlineStatusEventRef = useRef<{ key: string; at: number } | null>(null);

    const activeRideKey = user?.id ? `activeRide_${user.id}` : null;
    const isBalanceRestrictionMessage = useCallback((message?: string) => {
        const normalized = String(message || '').toLowerCase();
        return /balance|insufficient|wallet|recharge|top ?up|low|blocked|block|hold|restriction|limit|payment|due|outstanding/.test(normalized);
    }, []);

    useEffect(() => {
        rideRequestsRef.current = rideRequests;
    }, [rideRequests]);

    useEffect(() => {
        activeRideRef.current = activeRide;
        if (!activeRide?.rideId || !shouldRestoreRideNavigation(activeRide)) {
            lastRideNavigationKeyRef.current = null;
        }
    }, [activeRide]);

    const clearCachedActiveRide = useCallback(async (reason: string, redirectToDashboard = false) => {
        console.warn(`[RideContext] Clearing active ride cache: ${reason}`);

        if (activeRideKey) {
            await AsyncStorage.removeItem(activeRideKey).catch(() => { });
        }

        if (isMountedRef.current) {
            setActiveRideState(null);
            setSelectedRide(null);
            setIncomingRideRequest(null);
        }

        activeRideRef.current = null;
        lastRideNavigationKeyRef.current = null;

        if (redirectToDashboard && navigationRef.isReady()) {
            try {
                navigate('MainTabs', { screen: 'DashboardTab' });
            } catch (err) {
                console.warn('[RideContext] Failed to redirect to dashboard after ride reset:', err);
            }
        }
    }, [activeRideKey]);

    const shouldProcessEvent = useCallback((event: string, rideId?: string) => {
        const key = `${event}:${rideId || 'global'}`;
        const now = Date.now();

        processedEventKeysRef.current.forEach((timestamp: number, storedKey: string) => {
            if (now - timestamp > 30000) {
                processedEventKeysRef.current.delete(storedKey);
            }
        });

        if (processedEventKeysRef.current.has(key)) {
            return false;
        }

        processedEventKeysRef.current.set(key, now);
        return true;
    }, []);

    const safelyNavigateToActiveRide = useCallback((ride: any) => {
        const safeRide = sanitizeRideRecord(ride);
        if (!safeRide || !shouldRestoreRideNavigation(safeRide) || !navigationRef.isReady()) {
            return;
        }

        const navigationKey = `${safeRide.rideId}:${safeRide.status}`;
        if (lastRideNavigationKeyRef.current === navigationKey) {
            return;
        }

        lastRideNavigationKeyRef.current = navigationKey;

        try {
            const currentRoute = navigationRef.getCurrentRoute?.();
            if (currentRoute?.name !== 'NavigationRide') {
                navigate('NavigationRide', { initialRide: safeRide });
            }
        } catch (err) {
            console.warn('[RideContext] Safe navigation to active ride failed:', err);
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        if (isAuthLoading) {
            return;
        }

        const loadActiveRide = async () => {
            if (activeRideKey) {
                try {
                    const [token, storedRide] = await Promise.all([
                        AsyncStorage.getItem('token'),
                        AsyncStorage.getItem(activeRideKey),
                    ]);

                    if (!storedRide || !isMountedRef.current) {
                        if (isMountedRef.current) setIsRestoreCompleted(true);
                        return;
                    }

                    if (!token) {
                        await clearCachedActiveRide('missing auth token during ride restore');
                        if (isMountedRef.current) setIsRestoreCompleted(true);
                        return;
                    }

                    const parsed = safeParseJson<any>(storedRide);
                    const safeRide = sanitizeRideRecord(parsed);

                    if (!safeRide) {
                        await clearCachedActiveRide('corrupted active ride payload', true);
                        if (isMountedRef.current) setIsRestoreCompleted(true);
                        return;
                    }

                    if (safeRide.driverId && safeRide.driverId !== user?.id) {
                        await clearCachedActiveRide('ride belongs to another driver');
                        if (isMountedRef.current) setIsRestoreCompleted(true);
                        return;
                    }

                    if (!isMountedRef.current) {
                        return;
                    }

                    setActiveRideState(safeRide);
                    activeRideRef.current = safeRide;
                    safelyNavigateToActiveRide(safeRide);
                } catch (e) {
                    await clearCachedActiveRide('active ride restore exception', true);
                } finally {
                    if (isMountedRef.current) {
                        setIsRestoreCompleted(true);
                    }
                }
            } else {
                if (isMountedRef.current) {
                    setIsRestoreCompleted(true);
                }
            }
        };

        loadActiveRide();

        const unsubState = SignalRService.onStateChange('DRIVER', (state) => {
            if (isMountedRef.current) setConnectionState(state);
        });

        const eventUnsubs = registerHubEvents();

        // Safety reset: ensure processing lock is cleared on mount
        isProcessingRef.current = false;

        // Listen for logout to clear ALL state
        const logoutSub = DeviceEventEmitter.addListener('auth_logout', () => {
            console.log('[RideContext] Logout event → Resetting all state');
            resetAllState();
        });

        return () => {
            isMountedRef.current = false;
            unsubState();
            eventUnsubs.forEach(unsub => unsub());
            logoutSub.remove();
            stopLocationUpdates();
            stopBackgroundLocationTracking();
        };
    }, [activeRideKey, user?.id, isAuthLoading]);

    const resetAllState = useCallback(() => {
        setIsOnlineState(false);
        isOnlineRef.current = false;
        setOnlineState('idle');
        setIsLoading(false);
        setStatusMessage('');
        setActiveRideState(null);
        setRideRequests([]);
        setIncomingRideRequest(null);
        setSelectedRide(null);
        isProcessingRef.current = false;
        pendingRideActionRef.current = null;
        lastRideNavigationKeyRef.current = null;
        setInterestedRideIds(new Set());
        stopLocationUpdates();
        stopBackgroundLocationTracking();
        setIsRestoreCompleted(false);
        // Clear safety fallback timer on reset
        if (safetyFallbackTimer.current) {
            clearTimeout(safetyFallbackTimer.current);
            safetyFallbackTimer.current = null;
        }
    }, []);

    /**
     * AUTO-RECOVERY ON RECONNECTION
     */
    useEffect(() => {
        if (connectionState === 'Connected' && isOnlineRef.current && user) {
            if (activeRideRef.current) {
                console.log('[RideContext] SignalR Reconnected, but driver has an active ride. Skipping GoOnline to preserve ride flow.');
                return;
            }
            console.log('[RideContext] SignalR Reconnected → Re-syncing Online status');
            const syncStatus = async () => {
                try {
                    const profile = await getDriverProfile();
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    await SignalRService.invoke('DRIVER', 'GoOnline', {
                        vehicleType: profile.vehicleType,
                        lat: loc.coords.latitude,
                        lon: loc.coords.longitude,
                        gender: profile.gender,
                        rating: profile.rating,
                        isActive: true,
                    });
                } catch (err) {
                    console.warn('[RideContext] Status re-sync failed:', err);
                }
            };
            syncStatus();
        }
    }, [connectionState, user]);

    /**
     * SYNC LOCATION TRACKING WITH ONLINE STATE
     */
    useEffect(() => {
        // Clear immediately when state changes
        stopLocationUpdates();
        if (Constants.appOwnership !== 'expo') {
            stopBackgroundLocationTracking();
        }

        if (isOnline && user) {
            startLocationUpdates(profileRef.current);
            if (Constants.appOwnership !== 'expo') {
                startBackgroundLocationTracking(profileRef.current);
            }
            // Try to start Android floating overlay when driver goes online
            (async () => {
                try {
                    // Check if we are in a standalone/bare build where native modules are available
                    const isStandalone = Constants.executionEnvironment !== 'storeClient';
                    if (Platform.OS === 'android' && isStandalone) {
                        const hasPerm = await OverlayService.hasOverlayPermission();
                        console.log('[RideContext] Online status changed. Overlay permission:', hasPerm);
                        if (hasPerm) {
                            // const isFemale = profileRef.current.gender === 'female';
                            // const overlayColor = isFemale ? '#E91E63' : '#FF991C';
                            // console.log('[RideContext] Starting overlay with color:', overlayColor);
                            // await OverlayService.startOverlay({ 
                            //     label: 'TezRide', 
                            //     icon: 'tezride_overlay_icon',
                            //     color: overlayColor
                            // });
                        } else {
                            setShowOverlayPermissionPrompt(true);
                        }
                    }
                } catch (err) {
                    console.warn('[RideContext] start overlay failed:', err);
                }
            })();
        }

        return () => {
            stopLocationUpdates();
            stopBackgroundLocationTracking();
        };
    }, [isOnline, user?.id]);

    // Stop overlay when going offline
    useEffect(() => {
        if (!isOnline) {
            (async () => {
                try {
                    const isStandalone = Constants.executionEnvironment !== 'storeClient';
                    if (Platform.OS === 'android' && isStandalone) {
                        await OverlayService.stopOverlay();
                    }
                } catch (err) {
                    console.warn('[RideContext] stop overlay failed:', err);
                }
            })();
        }
    }, [isOnline]);

    useEffect(() => {
        if (Constants.appOwnership === 'expo' || Platform.OS === 'web') return;
        const safeRide = sanitizeRideRecord(activeRide);
        if (!safeRide || !shouldRestoreRideNavigation(safeRide)) return;

        startBackgroundLocationTracking(profileRef.current, safeRide);
    }, [activeRide?.rideId, activeRide?.status]);

    useEffect(() => {
        if (!activeRideKey || !user) return;

        const safeRide = sanitizeRideRecord(activeRide);

        if (safeRide) {
            AsyncStorage.setItem(activeRideKey, safeStringify(safeRide)).catch(() => { });
        } else {
            AsyncStorage.removeItem(activeRideKey).catch(() => { });
        }
    }, [activeRide, activeRideKey, user]);

    const registerHubEvents = () => {
        const unsubs: Array<() => void> = [];

        const addSafeEvent = (event: string, handler: (...args: any[]) => void) => {
            if (registeredEventsRef.current.has(event)) return;
            const unsub = SignalRService.on('DRIVER', event, handler);
            unsubs.push(() => {
                unsub();
                registeredEventsRef.current.delete(event);
            });
            registeredEventsRef.current.add(event);
        };

        const handleRideRequest = async (payload: any) => {
            if (!isMountedRef.current) return;

            // Primary path: strict sanitizer
            let safePayload = sanitizeRideRecord({
                ...payload,
                status: 'accepted',
                event: 'ride_request',
            });

            // Fallback: if sanitizer rejects, build a minimal payload from raw fields
            if (!safePayload) {
                const rawRideId = payload?.rideId
                    ?? payload?.RideId
                    ?? payload?.id
                    ?? payload?.Id;
                const rawPickupLat = payload?.pickupLatitude
                    ?? payload?.PickupLatitude
                    ?? payload?.pickup?.lat
                    ?? payload?.Pickup?.lat;
                const rawPickupLon = payload?.pickupLongitude
                    ?? payload?.PickupLongitude
                    ?? payload?.pickup?.lon
                    ?? payload?.Pickup?.lon;
                const rawDropLat = payload?.dropoffLatitude
                    ?? payload?.DropoffLatitude
                    ?? payload?.dropoff?.lat
                    ?? payload?.Dropoff?.lat;
                const rawDropLon = payload?.dropoffLongitude
                    ?? payload?.DropoffLongitude
                    ?? payload?.dropoff?.lon
                    ?? payload?.Dropoff?.lon;

                if (rawRideId && rawPickupLat != null && rawPickupLon != null && rawDropLat != null && rawDropLon != null) {
                    safePayload = {
                        rideId: String(rawRideId),
                        status: 'accepted',
                        pickup: { lat: Number(rawPickupLat), lon: Number(rawPickupLon) },
                        dropoff: { lat: Number(rawDropLat), lon: Number(rawDropLon) },
                        timeoutSec: 30,
                        event: 'ride_request',
                        type: String(payload?.type || payload?.vehicleType || 'bike'),
                        fare: Number(payload?.fare ?? payload?.estimatedFare ?? 0),
                    } as any;
                }
            }

            const rideId = safePayload?.rideId;
            if (!safePayload || !rideId || rideRequestsRef.current.find((r: any) => r.rideId === rideId)) return;
            if (!shouldProcessEvent('ride_request', rideId)) return;

            const pickupLat = safePayload.pickup.lat;
            const pickupLon = safePayload.pickup.lon;
            const dropoffLat = safePayload.dropoff.lat;
            const dropoffLon = safePayload.dropoff.lon;

            // Default fallback is coordinate format
            let pickupAddress = `${pickupLat.toFixed(5)}, ${pickupLon.toFixed(5)}`;
            let dropoffAddress = `${dropoffLat.toFixed(5)}, ${dropoffLon.toFixed(5)}`;

            try {
                const pickupGeo = await Location.reverseGeocodeAsync({ latitude: pickupLat, longitude: pickupLon });
                if (pickupGeo && pickupGeo.length > 0) {
                    const first = pickupGeo[0];
                    const rawParts = [first.street, first.name, first.district, first.city]
                        .filter((p): p is string => !!p)
                        .map(p => p.trim());
                    // Normalize and dedupe parts (case-insensitive, trim) to avoid duplicates like "Karachi, Karachi"
                    const seen = new Set<string>();
                    const uniqueParts: string[] = [];
                    for (const part of rawParts) {
                        const norm = part.replace(/\s+/g, ' ').toLowerCase();
                        if (!seen.has(norm)) {
                            seen.add(norm);
                            uniqueParts.push(part);
                        }
                    }
                    pickupAddress = uniqueParts.length > 0 ? uniqueParts.join(', ') : `${pickupLat.toFixed(5)}, ${pickupLon.toFixed(5)}`;
                }
            } catch (e) {
                console.warn('Pickup reverse geocoding failed:', e);
            }

            try {
                const dropoffGeo = await Location.reverseGeocodeAsync({ latitude: dropoffLat, longitude: dropoffLon });
                if (dropoffGeo && dropoffGeo.length > 0) {
                    const first = dropoffGeo[0];
                    const rawParts = [first.street, first.name, first.district, first.city]
                        .filter((p): p is string => !!p)
                        .map(p => p.trim());
                    // Normalize and dedupe parts (case-insensitive, trim) to avoid duplicates like "Karachi, Karachi"
                    const seen = new Set<string>();
                    const uniqueParts: string[] = [];
                    for (const part of rawParts) {
                        const norm = part.replace(/\s+/g, ' ').toLowerCase();
                        if (!seen.has(norm)) {
                            seen.add(norm);
                            uniqueParts.push(part);
                        }
                    }
                    dropoffAddress = uniqueParts.length > 0 ? uniqueParts.join(', ') : `${dropoffLat.toFixed(5)}, ${dropoffLon.toFixed(5)}`;
                }
            } catch (e) {
                console.warn('Dropoff reverse geocoding failed:', e);
            }

            const mappedPayload: RideRequestPayload = {
                rideId, event: 'ride_request', timeoutSec: safePayload.timeoutSec,
                pickup: safePayload.pickup,
                dropoff: safePayload.dropoff,
                pickupAddress,
                dropoffAddress,
                timestamp: Date.now(),
                fare: safePayload.fare || 0,
                type: safePayload.type || 'bike',
                customerRating: safePayload.customerRating || 5.0,
                customerName: safePayload.customerName || 'Customer',
                customerProfilePicUrl: safePayload.customerProfilePicUrl,
                customerPhone: safePayload.customerPhone || payload?.customerPhone || payload?.CustomerPhone || null,
                paymentMethod: safePayload.paymentMethod || payload?.paymentMethod || payload?.PaymentMethod || '',
                distance: Number(payload?.distance ?? payload?.Distance ?? 0) || undefined,
                duration: Number(payload?.duration ?? payload?.Duration ?? 0) || undefined,
            };

            if (isMountedRef.current) {
                setRideRequests((prev: any[]) => [mappedPayload, ...prev]);
                // Only show modal for new non-interested requests
                if (!interestedRideIds.has(rideId)) {
                    setIncomingRideRequest(mappedPayload);
                }
            }

            setTimeout(() => {
                if (!isMountedRef.current) return;
                setRideRequests((prev: any[]) => prev.filter((r: any) => r.rideId !== rideId));
                setIncomingRideRequest((curr: RideRequestPayload | null) => curr?.rideId === rideId ? null : curr);
            }, (mappedPayload.timeoutSec + 2) * 1000);
        };
        addSafeEvent('ride_request', handleRideRequest);
        addSafeEvent('RideRequest', handleRideRequest);

        const handleRideConfirmed = (payload: any) => {
            if (!isMountedRef.current) return;
            const rideId = payload?.rideId || payload?.RideId || activeRideRef.current?.rideId;
            if (!rideId || !shouldProcessEvent('ride_confirmed', String(rideId))) {
                return;
            }

            // Look up existing request data (coords, address) if payload is just a shell
            const existingRequest = rideRequestsRef.current.find(r => String(r.rideId) === String(rideId));

            // Extract customer details from the enriched payload (new) or fall back to existing request
            const customerId = payload?.customerId || payload?.CustomerId || existingRequest?.customerId || '';
            const customerName = payload?.customerName || payload?.CustomerName || existingRequest?.customerName || 'Customer';
            const customerPhone = payload?.customerPhone || payload?.CustomerPhone || existingRequest?.customerPhone || null;
            const customerRating = payload?.customerRating ?? payload?.CustomerRating ?? existingRequest?.customerRating ?? 5.0;
            const customerProfilePicUrl = payload?.customerProfilePicUrl || payload?.CustomerProfilePicUrl || existingRequest?.customerProfilePicUrl || null;

            const confirmedRide = sanitizeRideRecord({
                ...existingRequest,
                ...payload,
                rideId,
                status: 'confirmed',
                customerId,
                customerName,
                customerPhone,
                customerRating,
                customerProfilePicUrl,
            });

            if (!confirmedRide) {
                console.warn('[RideContext] ride_confirmed: Sanitize failed despite record merge', { payload, existingRequest });
                clearCachedActiveRide('invalid ride_confirmed payload', true).catch(() => { });
                return;
            }

            setActiveRideState(confirmedRide);
            activeRideRef.current = confirmedRide;
            setIncomingRideRequest(null);

            // Immediately navigate to ensure the driver is locked into the navigation screen
            safelyNavigateToActiveRide(confirmedRide);
        };
        addSafeEvent('ride_confirmed', handleRideConfirmed);
        addSafeEvent('RideConfirmed', handleRideConfirmed);

        const handleRideTaken = (payload: any) => {
            if (!isMountedRef.current) return;
            const rideId = payload?.rideId || payload?.RideId;
            if (rideId && !shouldProcessEvent('ride_taken', String(rideId))) return;
            setRideRequests((prev: any[]) => prev.filter((r: any) => r.rideId !== rideId));
            setInterestedRideIds((prev: Set<string>) => {
                const next = new Set(prev);
                next.delete(rideId);
                return next;
            });
        };
        addSafeEvent('ride_taken', handleRideTaken);
        addSafeEvent('RideTaken', handleRideTaken);

        const handleCustomerDidNotSelect = (payload: any) => {
            if (!isMountedRef.current) return;
            const rideId = payload?.rideId || payload?.RideId;
            if (rideId && !shouldProcessEvent('customer_did_not_select', String(rideId))) return;
            setIncomingRideRequest(null);
            setActiveRideState((prev: any) => {
                if (prev?.status === 'accepted' || prev?.rideId === rideId) {
                    lastRideNavigationKeyRef.current = null;
                    activeRideRef.current = null;
                    if (activeRideKey) AsyncStorage.removeItem(activeRideKey).catch(() => { });
                    return null;
                }
                return prev;
            });
            setInterestedRideIds((prev: Set<string>) => {
                const next = new Set(prev);
                next.delete(rideId);
                return next;
            });
        };
        addSafeEvent('customer_did_not_select', handleCustomerDidNotSelect);
        addSafeEvent('CustomerDidNotSelect', handleCustomerDidNotSelect);

        const handleOnlineStatusChanged = (payload: any) => {
            if (!isMountedRef.current) return;

            const online = !!payload?.isOnline;
            const offlineReason = String(payload?.message || '');

            // Debounce identical spammy events (some servers emit this repeatedly)
            const eventKey = `${online}:${offlineReason}`;
            const now = Date.now();
            const last = lastOnlineStatusEventRef.current;
            if (last && last.key === eventKey && (now - last.at) < 2500) {
                return;
            }
            lastOnlineStatusEventRef.current = { key: eventKey, at: now };

            console.log(`[RideContext] onlinestatuschanged: ${online}`);

            // Clear safety fallback timer to prevent race condition
            if (safetyFallbackTimer.current) {
                clearTimeout(safetyFallbackTimer.current);
                safetyFallbackTimer.current = null;
            }
            if (!online && FORCE_IGNORE_BALANCE_RESTRICTION && isOnlineRef.current && isBalanceRestrictionMessage(offlineReason)) {
                // Ignore backend balance/offline push while user intentionally went online.
                return;
            }

            setIsOnlineState(online);
            isOnlineRef.current = online;
            setOnlineState(online ? 'connected' : 'idle');
            setIsLoading(false);
            isProcessingRef.current = false;

            if (onlineSafetyTimer.current) {
                clearTimeout(onlineSafetyTimer.current);
                onlineSafetyTimer.current = null;
            }

            if (online) {
                setStatusMessage(t('dashboard.onlineSuccess', 'You are now online'));
            } else {
                setStatusMessage(payload?.message || t('dashboard.offlineSuccess', 'You are now offline'));
            }

            setTimeout(() => {
                if (isMountedRef.current) setStatusMessage('');
            }, 5000);
        };
        addSafeEvent('onlinestatuschanged', handleOnlineStatusChanged);
        addSafeEvent('OnlineStatusChanged', handleOnlineStatusChanged);

        addSafeEvent('RestoreActiveRide', async (ride: any) => {
            if (!isMountedRef.current) return;
            console.log('[RideContext] Session Recovery: RestoreActiveRide received', ride?.rideId);

            const safeRide = sanitizeRideRecord(ride);
            if (!safeRide) return;

            if (isMountedRef.current) {
                setActiveRideState(safeRide);
                activeRideRef.current = safeRide;
                safelyNavigateToActiveRide(safeRide);

                // If we were trying to go online but were blocked, this confirms we ARE online (in a ride)
                setIsOnlineState(true);
                isOnlineRef.current = true;
                setOnlineState('connected');
                setIsLoading(false);
                isProcessingRef.current = false;
            }
        });

        return unsubs;
    };

    const goOffline = useCallback(async () => {
        try {
            isProcessingRef.current = true;
            setIsLoading(true);
            setStatusMessage(t('dashboard.goingOffline', 'Going offline...'));

            if (SignalRService.isConnected('DRIVER')) {
                await SignalRService.invoke('DRIVER', 'GoOffline', profileRef.current.vehicleType);
            }

            if (isMountedRef.current) {
                setIsOnlineState(false);
                isOnlineRef.current = false;
                setStatusMessage(t('dashboard.offlineSuccess', 'You are now offline'));
                setTimeout(() => setStatusMessage(''), 2000);
            }
        } catch (err: any) {
            console.warn('[RideContext] goOffline error:', err);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                isProcessingRef.current = false;
            }
        }
    }, [t]);

    const goOnline = useCallback(async (retryCount = 0) => {
        if (!isMountedRef.current || !user) return;

        // GATEKEEPING: Registration & Verification
        const vStatus = String(user.verificationStatus || '').toLowerCase();
        console.log('[RideContext] goOnline check - vStatus:', vStatus, 'isRegistered:', user.isRegistered);

        if (user.isRegistered === false) {
            showError(t('common.error'), t('dashboard.completeProfileMsg'));
            setIsLoading(false);
            isProcessingRef.current = false;
            return;
        }

        if (vStatus !== 'approved') {
            showError('Not Approved', 'Your account is under review. You can go online once admin approves your documents.');
            setIsLoading(false);
            isProcessingRef.current = false;
            return;
        }

        setOnlineState('connecting');
        onlineSafetyTimer.current = setTimeout(() => {
            if (isMountedRef.current && isOnlineRef.current === false) {
                console.warn('[RideContext] GoOnline overall timeout reached');
                setOnlineState('failed');
                setIsLoading(false);
                isProcessingRef.current = false;
                setStatusMessage('Connection timed out. Please try again.');
            }
        }, 20000); // 20s overall timeout

        const overallTimeout = onlineSafetyTimer.current;

        try {
            console.log(`[RideContext] Starting GoOnline flow (Attempt #${retryCount + 1})`);

            // STEP 1: GPS PERMISSION & FETCH
            setStatusMessage(t('dashboard.fetchingLocation', 'Fetching GPS location...'));

            // Check if services are enabled
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                throw new Error('Location services are disabled. Please enable GPS and try again.');
            }

            // Check permissions
            let { status: fgStatus } = await Location.getForegroundPermissionsAsync();
            if (fgStatus !== 'granted') {
                const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
                fgStatus = reqStatus;
            }

            if (fgStatus !== 'granted') {
                throw new Error('Location permission is required to go online. Please allow location access in settings.');
            }

            let loc: any;
            try {
                loc = await getFastestLocation();
                console.log('[RideContext] GPS Location retrieved successfully');
                
                if (isMountedRef.current) {
                    setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    if (loc.coords.heading !== null && loc.coords.heading !== undefined) {
                        setDriverHeading(loc.coords.heading);
                    }
                }
            } catch (err: any) {
                console.warn('[RideContext] GPS Fetch failed:', err);
                if (retryCount < 1) {
                    clearTimeout(overallTimeout);
                    // Clear safety fallback timer before retry
                    if (safetyFallbackTimer.current) {
                        clearTimeout(safetyFallbackTimer.current);
                        safetyFallbackTimer.current = null;
                    }
                    return goOnline(retryCount + 1);
                }
                throw new Error(t('dashboard.gpsError', 'Could not get GPS location. Check your settings.'));
            }

            // STEP 2: WEBSOCKET CONNECTION
            setStatusMessage(t('dashboard.connecting', 'Connecting to server...'));
            try {
                console.log('[RideContext] Connecting to SignalR DRIVER hub...');
                await SignalRService.connect('DRIVER');
            } catch (connErr) {
                console.warn('[RideContext] SignalR Connection failed');
                if (retryCount < 1) {
                    await new Promise(r => setTimeout(r, 1000));
                    clearTimeout(overallTimeout);
                    // Clear safety fallback timer before retry
                    if (safetyFallbackTimer.current) {
                        clearTimeout(safetyFallbackTimer.current);
                        safetyFallbackTimer.current = null;
                    }
                    return goOnline(retryCount + 1);
                }
                throw new Error(t('dashboard.connectionError', 'Server connection failed.'));
            }

            // STEP 3: INVOKE GO ONLINE
            setStatusMessage(t('dashboard.syncing', 'Syncing status...'));

            let driverName = '';
            let profilePicUrl = '';
            let vehiclePlateNumber = '';
            let gender = 'male';
            let vehicleType = 'bike';

            try {
                const res = await userService.getUserById(user.id);
                if (res.data && res.data.data) {
                    const d = res.data.data;
                    driverName = `${d.firstName} ${d.lastName || ''}`.trim();
                    profilePicUrl = d.profilePictureUrl || '';
                    vehiclePlateNumber = d.vehiclePlateNumber || '';
                    gender = d.gender || 'male';
                    vehicleType = d.vehicleType || 'bike';

                    // Save details in driverProfile in AsyncStorage so background tasks can also access it
                    const rawProfile = await AsyncStorage.getItem('driverProfile');
                    const profileObj = safeParseJson<Record<string, any>>(rawProfile, {}) || {};
                    await AsyncStorage.setItem('driverProfile', JSON.stringify({
                        ...profileObj,
                        driverName,
                        profilePicUrl,
                        vehiclePlateNumber,
                        gender,
                        vehicleType
                    }));
                }
            } catch (err) {
                console.warn('[RideContext] Failed to fetch full profile details, using defaults from storage:', err);
            }

            const profile = await getDriverProfile();
            // Critical: Override stored profile with freshly fetched API data so sub-services use correct metadata
            profile.gender = gender;
            profile.vehicleType = vehicleType;
            profile.driverName = driverName || profile.driverName;
            profile.profilePicUrl = profilePicUrl || profile.profilePicUrl;
            profile.vehiclePlateNumber = vehiclePlateNumber || profile.vehiclePlateNumber;

            profileRef.current = profile;

            console.log('[RideContext] Invoking GoOnline on hub...');
            await SignalRService.invoke('DRIVER', 'GoOnline', {
                vehicleType: vehicleType,
                lat: loc.coords.latitude,
                lon: loc.coords.longitude,
                gender: gender,
                rating: profile.rating,
                isActive: true,
                driverName: driverName || profile.driverName || user.name || '',
                profilePicUrl: profilePicUrl || profile.profilePicUrl || '',
                vehiclePlateNumber: vehiclePlateNumber || profile.vehiclePlateNumber || '',
            });

            // Mark online immediately after successful hub invocation.
            setIsOnlineState(true);
            isOnlineRef.current = true;
            setOnlineState('connected');
            setIsLoading(false);
            isProcessingRef.current = false;
            setStatusMessage(t('dashboard.onlineSuccess', 'You are now online'));

            console.log('[RideContext] GoOnline invoked successfully');

            // SAFETY FALLBACK: If OnlineStatusChanged doesn't arrive in 5s, force online state
            safetyFallbackTimer.current = setTimeout(() => {
                if (isMountedRef.current && isProcessingRef.current && isOnlineRef.current === false) {
                    console.warn('[RideContext] OnlineStatusChanged event did not arrive in 5s, forcing online state locally');
                    setIsOnlineState(true);
                    isOnlineRef.current = true;
                    setOnlineState('connected');
                    setIsLoading(false);
                    isProcessingRef.current = false;
                    setStatusMessage(t('dashboard.onlineSuccess', 'You are now online'));
                    clearTimeout(overallTimeout);
                    safetyFallbackTimer.current = null;

                    setTimeout(() => {
                        if (isMountedRef.current) setStatusMessage('');
                    }, 3000);
                }
            }, 5000);

        } catch (err: any) {
            clearTimeout(overallTimeout);
            // Clear safety fallback timer on error
            if (safetyFallbackTimer.current) {
                clearTimeout(safetyFallbackTimer.current);
                safetyFallbackTimer.current = null;
            }
            console.error('[RideContext] goOnline failed:', err.message);

            // Show alert for location related errors
            if (err.message?.includes('Location') || err.message?.includes('GPS')) {
                showError('Location Required', err.message);
            }

            setOnlineState('failed');
            setStatusMessage(err.message || 'Unable to go online right now. Please try again.');
            setIsOnlineState(false);
            isOnlineRef.current = false;
            setIsLoading(false);
            isProcessingRef.current = false;

            setTimeout(() => {
                if (isMountedRef.current) setStatusMessage('');
            }, 4000);
        }
    }, [t, user]);

    const setIsOnline = useCallback(async (online: boolean) => {
        console.log('[RideContext] setIsOnline request:', online, 'current processing:', isProcessingRef.current);
        if (isProcessingRef.current) {
            console.warn('[RideContext] Already processing a state change, ignoring request');
            return;
        }

        isProcessingRef.current = true;
        setIsLoading(true);

        try {
            if (online) {
                await goOnline();
            } else {
                await goOffline();
            }
        } catch (err) {
            console.error('[RideContext] setIsOnline error:', err);
            setStatusMessage(err instanceof Error ? err.message : 'Operation failed');
        } finally {
            // NOTE: We don't necessarily clear isProcessingRef here because goOnline 
            // might be waiting for a SignalR event. But we should clear it if goOnline 
            // returned without setting up an event listener fallback.
            // Actually, goOnline now has a safety timeout that clears it.
            setIsLoading(false);
        }
    }, [goOnline, goOffline]);

    const startBackgroundLocationTracking = async (profile: DriverProfile, rideOverride?: any) => {
        if (Constants.appOwnership === 'expo' || Platform.OS === 'web') return;
        try {
            const { status } = await Location.requestBackgroundPermissionsAsync();
            if (status !== 'granted') return;

            const rideInProgress = sanitizeRideRecord(rideOverride ?? activeRideRef.current);
            const isTripActive = !!rideInProgress && shouldRestoreRideNavigation(rideInProgress);

            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: isTripActive ? 8000 : 15000,
                distanceInterval: isTripActive ? 10 : 20,
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
                foregroundService: {
                    notificationTitle: isTripActive ? 'TezRide — Trip in Progress' : 'TezRide — Online',
                    notificationBody: isTripActive
                        ? 'Navigation active — tap to return to TezRide and continue the trip.'
                        : 'You are online and receiving ride requests. Tap to open TezRide.',
                    // Use gender-based theme color
                    notificationColor: profile.gender === 'female' ? '#E91E63' : '#FF991C',
                },
            });
        } catch (err) {
            console.error('[RideContext] Background location tracking error:', err);
        }
    };

    const stopBackgroundLocationTracking = async () => {
        if (Constants.appOwnership === 'expo' || Platform.OS === 'web') return;
        try {
            const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        } catch (err) {
            console.error('[RideContext] Stop background location tracking error:', err);
        }
    };

    const startLocationUpdates = (profile: DriverProfile) => {
        stopLocationUpdates();
        locationInterval.current = setInterval(async () => {
            if (!isOnlineRef.current || !SignalRService.isConnected('DRIVER')) return;
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                
                if (isMountedRef.current) {
                    setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    if (loc.coords.heading !== null && loc.coords.heading !== undefined) {
                        setDriverHeading(loc.coords.heading);
                    }
                }

                await SignalRService.invoke('DRIVER', 'UpdateLocation', {
                    vehicleType: profile.vehicleType,
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude,
                    gender: profile.gender,
                    rating: profile.rating,
                    isActive: true,
                    driverName: profile.driverName || '',
                    profilePicUrl: profile.profilePicUrl || '',
                    vehiclePlateNumber: profile.vehiclePlateNumber || '',
                });
            } catch (err: any) { }
        }, 12000); // Increased interval to 12s for performance
    };

    const stopLocationUpdates = () => {
        if (locationInterval.current) {
            clearInterval(locationInterval.current);
            locationInterval.current = null;
        }
    };

    const acceptIncomingRide = useCallback(async (rideToAccept?: any) => {
        const ride = sanitizeRideRecord(rideToAccept || incomingRideRequest);
        if (!ride || !isMountedRef.current) return;

        try {
            if (pendingRideActionRef.current === ride.rideId || isLoading) {
                return;
            }

            pendingRideActionRef.current = ride.rideId;
            setIsLoading(true);
            const rideId = ride.rideId;

            const [token, storedUser] = await Promise.all([
                AsyncStorage.getItem('token'),
                AsyncStorage.getItem('user'),
            ]);
            const userData = safeParseJson<any>(storedUser);
            const driverId = user?.id || userData?.id;

            if (!token) {
                throw new Error('Session expired. Please log in again.');
            }

            if (!driverId || !rideId) {
                throw new Error('Ride acceptance payload is incomplete.');
            }

            // Call the REST API directly to accept the ride request
            const response = await api.post('/api/rider/rides/action', { driverId, rideId, action: 'accepted' });
            if (response?.data && response.data.succeeded === false) {
                throw new Error(response.data.message || 'Ride acceptance was rejected by the server.');
            }

            const acceptedRide = sanitizeRideRecord({
                ...ride,
                driverId,
                status: 'accepted',
                acceptedAt: new Date().toISOString(),
            });

            if (!acceptedRide) {
                throw new Error('Ride data is invalid after acceptance.');
            }

            if (isMountedRef.current) {
                // DO NOT set activeRideState here to avoid blocking the rider
                // Instead, track interest and keep them in the request list
                setInterestedRideIds((prev: Set<string>) => new Set(prev).add(rideId));
                setIncomingRideRequest(null);

                // Keep it in rideRequests so it shows as "Interest Sent"
                setRideRequests((prev: any[]) => prev.map((r: any) =>
                    r.rideId === rideId ? { ...r, status: 'accepted' } : r
                ));
            }

        } catch (err: any) {
            console.error('[RideContext] acceptIncomingRide error:', err);
            Alert.alert(t('common.error'), err?.response?.data?.message || err?.message || t('ride.acceptError', 'Could not accept ride.'));
        } finally {
            pendingRideActionRef.current = null;
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [incomingRideRequest, isLoading, t, user?.id]);

    const rejectIncomingRide = useCallback(async (rideToReject?: any) => {
        const ride = sanitizeRideRecord(rideToReject || incomingRideRequest);
        if (!ride || !isMountedRef.current) return;
        try {
            if (pendingRideActionRef.current === ride.rideId || isLoading) {
                return;
            }

            pendingRideActionRef.current = ride.rideId;
            const rideId = ride.rideId;

            const storedUser = await AsyncStorage.getItem('user');
            const userData = safeParseJson<any>(storedUser);
            const driverId = user?.id || userData?.id;

            if (driverId) {
                // Call the REST API directly to reject the ride request
                await api.post('/api/rider/rides/action', { driverId, rideId, action: 'rejected' });
            }

            if (isMountedRef.current) {
                setIncomingRideRequest(null);
                setRideRequests((prev: any[]) => prev.filter((r: any) => r.rideId !== rideId));
                // Defensive cleanup: if somehow the rideId was in interestedRideIds, remove it
                setInterestedRideIds((prev: Set<string>) => {
                    const next = new Set(prev);
                    next.delete(rideId);
                    return next;
                });
            }
        } catch (err) {
            console.error('[RideContext] rejectIncomingRide error:', err);
        } finally {
            pendingRideActionRef.current = null;
        }
    }, [incomingRideRequest, isLoading, user?.id]);

    const dismissIncomingRide = useCallback(() => { setIncomingRideRequest(null); }, []);
    const setActiveRide = useCallback((ride: any) => { if (isMountedRef.current) setActiveRideState(ride); }, []);

    const updateRideStatus = useCallback(async (status: string) => {
        const safeRide = sanitizeRideRecord(activeRideRef.current);
        if (!safeRide || !isMountedRef.current) return;
        try {
            if (pendingRideActionRef.current === `${safeRide.rideId}:${status}` || isLoading) {
                return;
            }

            pendingRideActionRef.current = `${safeRide.rideId}:${status}`;
            setIsLoading(true);

            // Fetch fresh location for geofencing (500m constraint)
            let lat: number | undefined;
            let lon: number | undefined;
            try {
                const loc = await getFastestLocation();
                lat = loc.coords.latitude;
                lon = loc.coords.longitude;
            } catch (gpsError) {
                console.warn('[RideContext] GPS fetch failed for status update, proceeding without it:', gpsError);
            }

            const statusMap: Record<string, number> = { 'arrived': 2, 'started': 3, 'intransit': 3 };
            const numericStatus = statusMap[status.toLowerCase()] || 1;

            await ridesService.updateRideStatus(safeRide.rideId, numericStatus, lat, lon);

            if (isMountedRef.current) {
                const nextRide = sanitizeRideRecord({
                    ...safeRide,
                    status: status.toLowerCase(),
                    startedAt: status.toLowerCase() === 'started'
                        ? new Date().toISOString()
                        : safeRide.startedAt,
                }, safeRide);
                setActiveRideState(nextRide);
                activeRideRef.current = nextRide;
            }
        } catch (err: any) {
            console.error('[RideContext] Status update error:', err);
            const msg = err?.response?.data?.Message || err?.response?.data?.message || err?.message || t('ride.statusUpdateError', 'Failed to update status.');
            Alert.alert(t('common.error'), msg);
        } finally {
            pendingRideActionRef.current = null;
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [isLoading, t]);

    const completeRide = useCallback(async (distanceKm: number = 0, payFromWallet: boolean = false) => {
        const safeRide = sanitizeRideRecord(activeRideRef.current);
        if (!safeRide || !isMountedRef.current) return null;
        try {
            if (pendingRideActionRef.current === `${safeRide.rideId}:complete` || isLoading) {
                return null;
            }

            pendingRideActionRef.current = `${safeRide.rideId}:complete`;
            setIsLoading(true);
            const response = await api.post(`/api/rider/rides/${safeRide.rideId}/complete`, { distanceKm, payFromWallet });
            const data = response?.data?.data || response?.data || {};

            // Play completion sound
            RideNotificationBridge.handleEvent('ride_completed').catch(() => {});

            if (isMountedRef.current) {
                setActiveRideState(null);
                setSelectedRide(null);
                setIncomingRideRequest(null);
                if (activeRideKey) AsyncStorage.removeItem(activeRideKey).catch(() => { });
                activeRideRef.current = null;
                lastRideNavigationKeyRef.current = null;
            }

            return data;
        } catch (err: any) {
            const apiMsg = err?.response?.data?.message || err?.response?.data?.Message || err?.message || t('ride.completeError', 'Failed to complete ride.');
            throw new Error(apiMsg);
        } finally {
            pendingRideActionRef.current = null;
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [activeRideKey, isLoading, t]);

    const cancelRide = useCallback(async () => {
        const safeRide = sanitizeRideRecord(activeRideRef.current);
        if (!safeRide) return;

        try {
            setIsLoading(true);
            // Notify server first
            await api.post(`/api/rider/rides/${safeRide.rideId}/status`, { status: 6 }); // 6 = CanceledByDriver

            if (isMountedRef.current) {
                setActiveRideState(null);
                setSelectedRide(null);
                setIncomingRideRequest(null);
                if (activeRideKey) AsyncStorage.removeItem(activeRideKey).catch(() => { });
                activeRideRef.current = null;
                lastRideNavigationKeyRef.current = null;
                navigate('MainTabs', { screen: 'DashboardTab' });
            }
        } catch (err) {
            console.error('[RideContext] cancelRide error:', err);
            Alert.alert(t('common.error'), 'Failed to cancel the ride on server. Trying to clear local state anyway.');

            // Force clear locally even if API fails to prevent being "stuck" in UI
            if (isMountedRef.current) {
                setActiveRideState(null);
                activeRideRef.current = null;
                if (activeRideKey) AsyncStorage.removeItem(activeRideKey).catch(() => { });
                navigate('MainTabs', { screen: 'DashboardTab' });
            }
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [activeRideKey, t]);

    const contextValue = React.useMemo(() => ({
        isOnline, isRestoreCompleted, onlineState, isLoading, statusMessage, connectionState, activeRide, rideRequests, incomingRideRequest, selectedRide,
        showOverlayPermissionPrompt, setShowOverlayPermissionPrompt,
        setIsOnline, setSelectedRide, acceptIncomingRide, rejectIncomingRide, dismissIncomingRide, setActiveRide, updateRideStatus, completeRide, cancelRide,
        interestedRideIds, hasRestoredSession, setHasRestoredSession,
        driverLocation, driverHeading,
    }), [
        isOnline, isRestoreCompleted, onlineState, isLoading, statusMessage, connectionState, activeRide, rideRequests, incomingRideRequest, selectedRide,
        showOverlayPermissionPrompt, setShowOverlayPermissionPrompt,
        setIsOnline, setSelectedRide, acceptIncomingRide, rejectIncomingRide, dismissIncomingRide, setActiveRide, updateRideStatus, completeRide, cancelRide,
        interestedRideIds, hasRestoredSession, driverLocation, driverHeading
    ]);

    return (
        <RideContext.Provider value={contextValue}>
            {children}
        </RideContext.Provider>
    );
};

export const useRide = () => {
    const context = useContext(RideContext);
    if (!context) throw new Error('useRide must be used within a RideProvider');
    return context;
};
