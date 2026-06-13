import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ActivityIndicator,
    Platform,
    Text,
    Animated,
    Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { COLORS } from '../../utils/constants';
import { Navigation2 as Navigation } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import Constants from 'expo-constants';
import { fetchDirections } from '../../utils/mapUtils';
import { normalizeRideLocation } from '../../utils/rideSafety';

let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
let PROVIDER_GOOGLE: any = undefined;
let AnimatedRegion: any = null;

if (Platform.OS !== 'web') {
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
        Polyline = Maps.Polyline;
        PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
        AnimatedRegion = Maps.AnimatedRegion;
    } catch (e) { }
}

export interface LatLng {
    latitude: number;
    longitude: number;
}

export interface MapScreenProps {
    pickupLocation?: LatLng | null;
    dropoffLocation?: LatLng | null;
    driverLocation?: LatLng | null;
    driverHeading?: number;
    rideStatus?: 'waiting' | 'approaching' | 'arrived' | 'started' | 'completed';
    vehicleType?: string;
    initialRegion?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    showUserLocation?: boolean;
    style?: any;
    customerLocation?: LatLng | null;
    onRouteInfo?: (info: { activeDistanceText?: string; activeDurationText?: string }) => void;
}

const SILVER_MAP_STYLE = [
    { featureType: "administrative", elementType: "geometry.fill", stylers: [{ color: "#d6e2e6" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#cfd4d5" }] },
    { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#7492a8" }] },
    { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#dde2e3" }] },
    { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#dde2e3" }] },
    { featureType: "poi", elementType: "geometry.fill", stylers: [{ color: "#dde2e3" }] },
    { featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -100 }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a9de83" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#41626b" }] },
    { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#c1d1d6" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#a6b5bb" }] },
    { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#a6cbe3" }] },
];

// Orange for active (driver's current leg), matching Customer App primary Color
const ACTIVE_ROUTE_COLOR = '#FF5C00';
const FUTURE_ROUTE_COLOR = '#94A3B8';
const DRIVER_ANIM_DURATION = 700;

const toMapCoordinate = (value?: LatLng | null): LatLng | null => {
    const location = normalizeRideLocation(value);
    return location ? { latitude: location.lat, longitude: location.lon } : null;
};

// ─── Route Metadata type ─────────────────────────────────────────────────────

interface RouteInfo {
    activeDistanceText?: string;
    activeDurationText?: string;
}

// ─── Helper: compute degrees between two points for Haversine ────────────────

const computeRegion = (pickup: LatLng, destination: LatLng) => {
    const minLat = Math.min(pickup.latitude, destination.latitude);
    const maxLat = Math.max(pickup.latitude, destination.latitude);
    const minLon = Math.min(pickup.longitude, destination.longitude);
    const maxLon = Math.max(pickup.longitude, destination.longitude);

    const rawLatSpan = maxLat - minLat;
    const rawLonSpan = maxLon - minLon;
    const MIN_SPAN = 0.008;

    // 60% of map is visible (40% hidden by bottom sheet)
    const VISIBLE = 0.60;
    // Route fills 55% of the visible area → comfortable padding
    const FILL = 0.55;

    const latDelta = Math.max(rawLatSpan / (VISIBLE * FILL), MIN_SPAN * 3);
    const lonDelta = Math.max(rawLonSpan * 2.5, latDelta * 0.55, MIN_SPAN * 3);

    // Shift centre southward: shift = latDelta × (0.5 − VISIBLE/2)
    const shift = latDelta * (0.5 - VISIBLE / 2); // = latDelta × 0.20

    return {
        latitude: (minLat + maxLat) / 2 - shift,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
    };
};

function coordsKey(c: LatLng | null | undefined) {
    if (!c) return '';
    return `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
}

const MapScreen: React.FC<MapScreenProps> = React.memo(({
    pickupLocation,
    dropoffLocation,
    driverLocation,
    driverHeading = 0,
    rideStatus = 'approaching',
    vehicleType = 'bike',
    initialRegion,
    showUserLocation = false,
    style,
    customerLocation,
    onRouteInfo,
}) => {
    const mapRef = useRef<any>(null);
    const animatedDriverCoord = useRef<any>(null);

    // Separate route states
    const [routeToPickup, setRouteToPickup] = useState<LatLng[]>([]);
    const [routePickupToDropoff, setRoutePickupToDropoff] = useState<LatLng[]>([]);
    const [routeDriverToDropoff, setRouteDriverToDropoff] = useState<LatLng[]>([]);

    const [isFetching, setIsFetching] = useState(false);
    const googleApiKey = Constants.expoConfig?.extra?.googleMapsApiKey || '';

    const safePickup = useMemo(() => {
        const coord = toMapCoordinate(pickupLocation);
        console.log('[MapScreen] Computed safePickup:', coord, 'from input:', pickupLocation);
        return coord;
    }, [pickupLocation]);

    const safeDropoff = useMemo(() => {
        const coord = toMapCoordinate(dropoffLocation);
        console.log('[MapScreen] Computed safeDropoff:', coord, 'from input:', dropoffLocation);
        return coord;
    }, [dropoffLocation]);

    const safeDriver = useMemo(() => {
        const coord = toMapCoordinate(driverLocation);
        console.log('[MapScreen] Computed safeDriver:', coord, 'from input:', driverLocation);
        return coord;
    }, [driverLocation]);

    // Track marker renders to stop tracksViewChanges for perf
    const [shouldTrack, setShouldTrack] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setShouldTrack(false), 1500);
        return () => clearTimeout(t);
    }, []);

    // ── Animated driver coordinate ────────────────────────────────────────────
    useEffect(() => {
        if (AnimatedRegion && safeDriver && !animatedDriverCoord.current) {
            animatedDriverCoord.current = new AnimatedRegion({
                latitude: safeDriver.latitude,
                longitude: safeDriver.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0,
            });
        }
    }, [safeDriver]);

    useEffect(() => {
        if (safeDriver && animatedDriverCoord.current && Platform.OS !== 'web') {
            animatedDriverCoord.current.timing({
                ...safeDriver,
                latitudeDelta: 0,
                longitudeDelta: 0,
                duration: DRIVER_ANIM_DURATION,
                useNativeDriver: false,
            }).start();
        }
    }, [safeDriver]);

    // ── Route fetching ────────────────────────────────────────────────────────
    // We track keys to avoid redundant fetches
    const lastFetchKey = useRef('');

    useEffect(() => {
        // Build a key from inputs to avoid repeat fetches
        const currentKey = [
            rideStatus,
            coordsKey(safeDriver),
            coordsKey(safePickup),
            coordsKey(safeDropoff),
        ].join('|');

        // Check if this is the very first fetch for this component instance
        const isFirstFetch = lastFetchKey.current === '';

        // For the approaching/waiting phases, driver location changes frequently.
        // Only re-fetch if driver moved by >= 0.0003 degrees (~30m) to avoid hammering the API.
        if (!isFirstFetch && (rideStatus === 'approaching' || rideStatus === 'waiting')) {
            const prev = lastFetchKey.current;
            if (prev) {
                const [, prevDriverKey] = prev.split('|');
                const [dLat, dLon] = (coordsKey(safeDriver) || ',').split(',').map(Number);
                const [pLat, pLon] = (prevDriverKey || ',').split(',').map(Number);
                const moved = Math.abs(dLat - pLat) + Math.abs(dLon - pLon);
                if (moved < 0.0003 && prev.replace(/[^|]+\|/, '') === currentKey.replace(/[^|]+\|/, '')) {
                    return; // Not enough movement
                }
            }
        } else {
            if (!isFirstFetch && lastFetchKey.current === currentKey) return;
        }

        lastFetchKey.current = currentKey;

        if (!safePickup || !safeDropoff) {
            setRouteToPickup([]);
            setRoutePickupToDropoff([]);
            setRouteDriverToDropoff([]);
            return;
        }

        let cancelled = false;

        // Use a shorter delay for the very first fetch to show markers immediately
        const fetchDelay = isFirstFetch ? 50 : 300;

        const timer = setTimeout(async () => {
            setIsFetching(true);
            const routeInfo: RouteInfo = {};

            try {
                // Always fetch the full pickup → dropoff route (for the trip overview)
                const fullTrip = await fetchDirections(safePickup, safeDropoff, googleApiKey);
                if (!cancelled) {
                    setRoutePickupToDropoff(fullTrip.coords?.length > 1 ? fullTrip.coords : [safePickup, safeDropoff]);
                }

                if (rideStatus === 'approaching' || rideStatus === 'waiting') {
                    // Active leg: driver → pickup
                    if (safeDriver) {
                        const leg = await fetchDirections(safeDriver, safePickup, googleApiKey);
                        if (!cancelled) {
                            setRouteToPickup(leg.coords?.length > 1 ? leg.coords : [safeDriver, safePickup]);
                            setRouteDriverToDropoff([]);
                            routeInfo.activeDistanceText = leg.distance;
                            routeInfo.activeDurationText = leg.duration;
                        }
                    } else {
                        if (!cancelled) {
                            setRouteToPickup([]);
                            setRouteDriverToDropoff([]);
                        }
                    }
                } else if (rideStatus === 'arrived') {
                    // No active navigation leg; driver is at pickup
                    if (!cancelled) {
                        setRouteToPickup([]);
                        setRouteDriverToDropoff([]);
                        routeInfo.activeDistanceText = fullTrip.distance;
                        routeInfo.activeDurationText = fullTrip.duration;
                    }
                } else if (rideStatus === 'started') {
                    // Active leg: driver → dropoff (passenger is in vehicle)
                    if (safeDriver) {
                        const leg = await fetchDirections(safeDriver, safeDropoff, googleApiKey);
                        if (!cancelled) {
                            setRouteDriverToDropoff(leg.coords?.length > 1 ? leg.coords : [safeDriver, safeDropoff]);
                            setRouteToPickup([]);
                            routeInfo.activeDistanceText = leg.distance;
                            routeInfo.activeDurationText = leg.duration;
                        }
                    } else {
                        if (!cancelled) {
                            setRouteDriverToDropoff([]);
                            setRouteToPickup([]);
                        }
                    }
                } else {
                    // completed or other
                    if (!cancelled) {
                        setRouteToPickup([]);
                        setRouteDriverToDropoff([]);
                    }
                }

                if (!cancelled && onRouteInfo) {
                    onRouteInfo(routeInfo);
                }
            } catch {
                // Graceful fallback
                if (!cancelled) {
                    if (safeDriver && safePickup) setRouteToPickup([safeDriver, safePickup]);
                    if (safePickup && safeDropoff) setRoutePickupToDropoff([safePickup, safeDropoff]);
                }
            } finally {
                if (!cancelled) setIsFetching(false);
            }
        }, fetchDelay);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        googleApiKey,
        rideStatus,
        safePickup?.latitude,
        safePickup?.longitude,
        safeDropoff?.latitude,
        safeDropoff?.longitude,
        safeDriver?.latitude,
        safeDriver?.longitude,
    ]);

    // ── Map auto-fit ──────────────────────────────────────────────────────────
    // Re-fit whenever the status changes or when the relevant coords change
    const lastFitKey = useRef('');

    useEffect(() => {
        if (!mapRef.current) return;

        let coordsToFit: LatLng[] = [];

        if (rideStatus === 'approaching' || rideStatus === 'waiting') {
            // Show driver + pickup + dropoff to give full context
            coordsToFit = [safeDriver, safePickup, safeDropoff].filter(Boolean) as LatLng[];
        } else if (rideStatus === 'arrived') {
            // Driver is at pickup, show pickup + dropoff for trip preview
            coordsToFit = [safePickup, safeDropoff].filter(Boolean) as LatLng[];
        } else if (rideStatus === 'started') {
            // Show driver + dropoff
            coordsToFit = [safeDriver, safeDropoff].filter(Boolean) as LatLng[];
        } else {
            // Completed — show full journey overview
            coordsToFit = [safeDriver, safePickup, safeDropoff].filter(Boolean) as LatLng[];
        }

        if (coordsToFit.length < 2) return;

        const fitKey = [
            rideStatus,
            ...coordsToFit.map(c => `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)}`),
        ].join('|');

        if (lastFitKey.current === fitKey) return;
        lastFitKey.current = fitKey;

        // Small delay to ensure map is ready
        const t = setTimeout(() => {
            if (rideStatus === 'approaching' || rideStatus === 'waiting') {
                if (safeDriver && safePickup) {
                    const region = computeRegion(safeDriver, safePickup);
                    mapRef.current?.animateToRegion(region, 700);
                }
            } else if (rideStatus === 'arrived' || rideStatus === 'started') {
                if (safePickup && safeDropoff) {
                    const region = computeRegion(safePickup, safeDropoff);
                    mapRef.current?.animateToRegion(region, 700);
                }
            } else {
                mapRef.current?.fitToCoordinates(coordsToFit, {
                    edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
                    animated: true,
                });
            }
        }, 400);

        return () => clearTimeout(t);
    }, [
        rideStatus,
        safeDriver?.latitude,
        safeDriver?.longitude,
        safePickup?.latitude,
        safePickup?.longitude,
        safeDropoff?.latitude,
        safeDropoff?.longitude,
    ]);

    // ── Web placeholder ───────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, style]}>
                <View style={styles.webPlaceholder}>
                    <Text style={styles.webPlaceholderText}>Map view available on mobile devices</Text>
                </View>
            </View>
        );
    }

    // ── Determine which polylines to draw ─────────────────────────────────────
    const isApproaching = rideStatus === 'approaching' || rideStatus === 'waiting';
    const isStarted = rideStatus === 'started';

    return (
        <View style={[styles.container, style]}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={SILVER_MAP_STYLE}
                showsUserLocation={showUserLocation}
                rotateEnabled={false}
                moveOnMarkerPress={false}
                toolbarEnabled={false}
                mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                initialRegion={
                    initialRegion ||
                    (safeDriver
                        ? { ...safeDriver, latitudeDelta: 0.04, longitudeDelta: 0.04 }
                        : safePickup
                            ? { ...safePickup, latitudeDelta: 0.06, longitudeDelta: 0.06 }
                            : undefined)
                }
            >
                {/* Pickup marker */}
                {safePickup && rideStatus !== 'completed' && (
                    <Marker
                        identifier="pickup-marker"
                        coordinate={{ latitude: safePickup.latitude, longitude: safePickup.longitude }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={5}
                    >
                        <View style={markerStyles.markerWrap}>
                            <View style={[markerStyles.iconCircle, { backgroundColor: COLORS.primary }]}>
                                <Ionicons name="person" size={18} color="#FFF" />
                            </View>
                            <View style={[markerStyles.markerTip, { borderTopColor: COLORS.primary }]} />
                        </View>
                    </Marker>
                )}

                {/* Dropoff marker */}
                {safeDropoff && (
                    <Marker
                        identifier="dropoff-marker"
                        coordinate={{ latitude: safeDropoff.latitude, longitude: safeDropoff.longitude }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={5}
                    >
                        <View style={markerStyles.markerWrap}>
                            <View style={[markerStyles.iconCircle, { backgroundColor: "#FF3B30" }]}>
                                <Ionicons name="flag" size={18} color="#FFF" />
                            </View>
                            <View style={[markerStyles.markerTip, { borderTopColor: "#FF3B30" }]} />
                        </View>
                    </Marker>
                )}

                {/* Full trip route (pickup → dropoff) */}
                {routePickupToDropoff.length > 1 && (
                    <Polyline
                        coordinates={routePickupToDropoff}
                        strokeColor={
                            rideStatus === 'arrived'
                                ? ACTIVE_ROUTE_COLOR          // highlight full trip on arrived
                                : FUTURE_ROUTE_COLOR          // dimmed preview when not in trip
                        }
                        strokeWidth={
                            rideStatus === 'arrived' ? 5 : 3.5
                        }
                        lineDashPattern={
                            isApproaching ? [14, 9] : undefined // dashed only when approaching
                        }
                        lineJoin="round"
                        lineCap="round"
                        geodesic
                        zIndex={1}
                    />
                )}

                {/* Active leg: driver → pickup (approaching) */}
                {isApproaching && routeToPickup.length > 1 && (
                    <Polyline
                        coordinates={routeToPickup}
                        strokeColor={ACTIVE_ROUTE_COLOR}
                        strokeWidth={6}
                        lineJoin="round"
                        lineCap="round"
                        geodesic
                        zIndex={3}
                    />
                )}

                {/* Active leg: driver → dropoff (in trip) */}
                {isStarted && routeDriverToDropoff.length > 1 && (
                    <Polyline
                        coordinates={routeDriverToDropoff}
                        strokeColor={ACTIVE_ROUTE_COLOR}
                        strokeWidth={6}
                        lineJoin="round"
                        lineCap="round"
                        geodesic
                        zIndex={3}
                    />
                )}

                {/* Driver Marker (animated) — matches Customer App implementation */}
                {safeDriver && animatedDriverCoord.current && (
                    <Marker.Animated
                        coordinate={animatedDriverCoord.current}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={[markerStyles.driverBubble, { transform: [{ rotate: `${driverHeading || 0}deg` }] }]}>
                            <Image 
                                source={
                                    vehicleType === 'bike'
                                        ? require('../../assets/bike_logo.png')
                                        : vehicleType === 'rickshaw' || vehicleType === 'auto'
                                            ? require('../../assets/rickshaw_logo.png')
                                            : require('../../assets/car_logo.png')
                                } 
                                style={{ width: 26, height: 26, resizeMode: 'contain' }} 
                            />
                        </View>
                    </Marker.Animated>
                )}

                {/* Customer Real-Time Marker (only when approaching/arrived/waiting - hidden when ride starts) */}
                {customerLocation && rideStatus !== 'started' && rideStatus !== 'completed' && (
                    <Marker
                        identifier="customer-pulse"
                        coordinate={toMapCoordinate(customerLocation)!}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={10}
                    >
                        <View style={markerStyles.customerPulseWrap}>
                            <View style={markerStyles.userMarkerPulse} />
                            <View style={markerStyles.userMarker} />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* Subtle loading indicator for route fetching */}
            {isFetching && (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color={ACTIVE_ROUTE_COLOR} />
                </View>
            )}
        </View>
    );
});

export default MapScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    map: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    loaderContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(255,255,255,0.92)',
        padding: 7,
        borderRadius: 20,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    webPlaceholder: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: '#F1F5F9',
    },
    webPlaceholderText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: 'bold' as const,
    },
});

const markerStyles = StyleSheet.create({
    markerWrap: { alignItems: 'center' },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    markerTip: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 9,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -1,
    },
    driverBubble: {
        backgroundColor: '#FFF',
        padding: 5,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: ACTIVE_ROUTE_COLOR,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    customerPulseWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarker: {
        backgroundColor: ACTIVE_ROUTE_COLOR,
        padding: 5,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#FFF',
        elevation: 4,
    },
    userMarkerPulse: {
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: ACTIVE_ROUTE_COLOR,
        opacity: 0.15,
    },
});
