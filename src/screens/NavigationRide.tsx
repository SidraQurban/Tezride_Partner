import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Linking,
    Dimensions,
    ActivityIndicator,
    Animated,
    Image,
    StatusBar,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import {
    Phone,
    MessageSquare,
    Navigation2 as NavIcon,
    CheckCircle,
    XCircle,
    MapPin,
    Navigation2,
    Star,
    AlertTriangle,
    Clock,
    Flag,
    ShieldAlert,
    ChevronLeft,
    Bell
} from 'lucide-react-native';
import { View as MotiView } from 'moti';
import { useRide } from '../context/RideContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { getFontFamily, getFontSize } from '../utils/layout';
import MapScreen from '../components/Map/MapScreen';
import { SignalRService } from '../services/SignalRService';
import { sanitizeRideRecord, safeParseJson } from '../utils/rideSafety';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { promptExternalNavigation } from '../utils/externalMaps';
import { usersService } from '../services/users';

const { height } = Dimensions.get('window');

type UIStatus = 'waiting' | 'approaching' | 'arrived' | 'started' | 'completed';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const earthRadiusKm = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return earthRadiusKm * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

const NavigationRide = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { 
        activeRide, updateRideStatus, completeRide, cancelRide, isLoading, isRestoreCompleted,
        driverLocation: contextLocation, driverHeading: contextHeading 
    } = useRide();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();
    const { showError } = useUI();
    const actionColor = theme.primary;

    // Custom flow states for high fidelity UI
    const [isNavigatingMode] = useState(false);
    const [showCustomerNotResponding, setShowCustomerNotResponding] = useState(false);
    const [showCancelledView, setShowCancelledView] = useState(false);

    const handleDial = (phone: string | undefined) => {
        if (!phone) return;
        let dialNum = phone;
        if (dialNum.startsWith('92')) {
            dialNum = '0' + dialNum.substring(2);
        }
        Linking.openURL(`tel:${dialNum}`).catch(() => { });
    };

    // Live route info from MapScreen
    const [routeInfo, setRouteInfo] = useState<{ activeDistanceText?: string; activeDurationText?: string }>({});
    const routeInfoRef = useRef(routeInfo);

    const handleRouteInfo = useCallback((info: { activeDistanceText?: string; activeDurationText?: string }) => {
        if (!info.activeDistanceText && !info.activeDurationText) return;
        
        setRouteInfo(prev => {
            const next = {
                activeDistanceText: info.activeDistanceText ?? prev.activeDistanceText,
                activeDurationText: info.activeDurationText ?? prev.activeDurationText,
            };
            routeInfoRef.current = next;
            
            // Cache for background task
            AsyncStorage.setItem('lastRouteInfo', JSON.stringify({
                distance: next.activeDistanceText,
                duration: next.activeDurationText,
                updatedAt: Date.now()
            })).catch(() => {});
            
            return next;
        });
    }, []);

    const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(contextLocation);
    const [driverHeading, setDriverHeading] = useState(contextHeading || 0);
    const driverHeadingRef = useRef(contextHeading || 0);
    // Tracks last GPS sample for speed calculation: (m/s) = haversine_dist / elapsed_seconds
    const prevLocationRef = useRef<{ lat: number; lon: number; timestamp: number } | null>(null);
    const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    const [summaryData, setSummaryData] = useState<{
        rideId: string;
        customerId: string;
        finalFare: number;
        estimatedFare: number;
        pickupAddress: string;
        dropoffAddress: string;
        distance: number;
        duration: number;
        currency: string;
        commission: number;
        netEarnings: number;
        paymentMethod: string;
    } | null>(null);

    const [isCompletingDirectly, setIsCompletingDirectly] = useState(false);
    const [isRecoveringMissingRide, setIsRecoveringMissingRide] = useState(false);
    const [rating, setRating] = useState(5);
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const isMountedRef = useRef(true);
    const activeRideRef = useRef<any>(null);
    const slideAnim = useRef(new Animated.Value(height * 0.4)).current;
    const [isBottomSheetCollapsed, setIsBottomSheetCollapsed] = useState(false);
    const panY = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5 || gestureState.dy < -5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    // Dragged down enough, collapse
                    Animated.timing(panY, {
                        toValue: height * 0.5,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        setIsBottomSheetCollapsed(true);
                        panY.setValue(0);
                    });
                } else {
                    // Not dragged enough, snap back
                    Animated.spring(panY, {
                        toValue: 0,
                        tension: 60,
                        friction: 12,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // Use navigation params for the very first render to avoid race conditions with context state
    const initialRideParam = route?.params?.initialRide;
    const safeRide = React.useMemo(() => {
        const fromContext = sanitizeRideRecord(activeRide);
        if (fromContext) return fromContext;

        // Fallback to params if context is not yet updated
        if (initialRideParam) {
            return sanitizeRideRecord(initialRideParam);
        }
        return null;
    }, [activeRide, initialRideParam]);

    const getUIStatus = useCallback((): UIStatus => {
        if (!safeRide) return 'completed';
        switch (safeRide.status) {
            case 'accepted': return 'waiting';
            case 'confirmed': return 'approaching';
            case 'arrived': return 'arrived';
            case 'started': return 'started';
            case 'completed': return 'completed';
            default: return 'approaching';
        }
    }, [safeRide]);

    const uiStatus = getUIStatus() as UIStatus;

    const pickupCoords = useMemo(() => {
        if (!safeRide) return null;
        return { latitude: safeRide.pickup.lat, longitude: safeRide.pickup.lon };
    }, [safeRide?.pickup?.lat, safeRide?.pickup?.lon]);

    const dropoffCoords = useMemo(() => {
        if (!safeRide) return null;
        return { latitude: safeRide.dropoff.lat, longitude: safeRide.dropoff.lon };
    }, [safeRide?.dropoff?.lat, safeRide?.dropoff?.lon]);
    // Derive the vehicle type from the ride payload so the map can show the correct icon
    const safeVehicleType = (safeRide?.type || 'bike').toLowerCase();
    const isActionBusy = isLoading || isCompletingDirectly;

    useEffect(() => {
        activeRideRef.current = safeRide;
    }, [safeRide]);

    useEffect(() => {
        if (!isRestoreCompleted) {
            setIsRecoveringMissingRide(true);
            return;
        }

        if (safeRide || summaryData || showCancelledView) {
            setIsRecoveringMissingRide(false);
            return;
        }

        setIsRecoveringMissingRide(true);
        const timer = setTimeout(() => {
            if (!navigation.isFocused?.() && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                navigation.goBack();
                return;
            }

            // Safety redirect
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { screen: 'DashboardTab' } }],
            });
        }, 1500);

        return () => clearTimeout(timer);
    }, [navigation, safeRide, summaryData, isRestoreCompleted, showCancelledView]);

    useEffect(() => {
        isMountedRef.current = true;
        Animated.spring(slideAnim, {
            toValue: isBottomSheetCollapsed ? height * 0.7 : 0,
            tension: 60,
            friction: 12,
            useNativeDriver: true
        }).start();
        return () => { isMountedRef.current = false; };
    }, [isBottomSheetCollapsed]);

    useEffect(() => {
        let subscription: any;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                // Immediate fetch to avoid stale markers on first render
                const fastLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (isMountedRef.current) {
                    setDriverLocation({ latitude: fastLoc.coords.latitude, longitude: fastLoc.coords.longitude });
                }

                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
                    (loc: Location.LocationObject) => {
                        if (isMountedRef.current) {
                            setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                            if (loc.coords.heading !== null && loc.coords.heading !== undefined) {
                                setDriverHeading(loc.coords.heading);
                                driverHeadingRef.current = loc.coords.heading;
                            }

                                    if (activeRideRef.current && activeRideRef.current.status !== 'completed') {
                                        AsyncStorage.getItem('driverProfile').then(async (raw: string | null) => {
                                            const profile = safeParseJson<any>(raw, {});

                                            // Calculate speed from consecutive GPS points
                                            let speedMetersPerSecond: number | undefined;
                                            const prevLoc = prevLocationRef.current;
                                            const nowMs = Date.now();
                                            if (prevLoc) {
                                                const dtSec = (nowMs - prevLoc.timestamp) / 1000;
                                                if (dtSec > 0) {
                                                    const dLat = (loc.coords.latitude - prevLoc.lat) * Math.PI / 180;
                                                    const dLon = (loc.coords.longitude - prevLoc.lon) * Math.PI / 180;
                                                    const a = Math.sin(dLat/2)**2 + Math.cos(prevLoc.lat * Math.PI/180) * Math.cos(loc.coords.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
                                                    const distM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                                    speedMetersPerSecond = distM / dtSec;
                                                }
                                            }
                                            prevLocationRef.current = { lat: loc.coords.latitude, lon: loc.coords.longitude, timestamp: nowMs };

                                            SignalRService.invoke('DRIVER', 'UpdateLocation', {
                                                vehicleType: profile?.vehicleType || 'bike',
                                                lat: loc.coords.latitude,
                                                lon: loc.coords.longitude,
                                                heading: driverHeadingRef.current,
                                                speedMetersPerSecond,  // server uses this for ETA calculation
                                                gender: profile?.gender || 'male',
                                                rating: profile?.rating || 4.5,
                                                isActive: true,
                                                driverName: profile?.driverName || '',
                                                profilePicUrl: profile?.profilePicUrl || '',
                                                vehiclePlateNumber: profile?.vehiclePlateNumber || '',
                                            }).catch(err => console.warn('Failed to update location:', err));
                                        }).catch(() => {
                                            SignalRService.invoke('DRIVER', 'UpdateLocation', {
                                                lat: loc.coords.latitude,
                                                lon: loc.coords.longitude,
                                                heading: driverHeadingRef.current,
                                            }).catch(err => console.warn('Failed to update location fallback:', err));
                                        });
                                    }
        }
    }
);
            } catch (err) {
                console.warn('[NavigationRide] Location watch setup failed:', err);
            }
        })();
        return () => subscription?.remove();
    }, []);

    // ── SignalR Customer Location Listener ──────────────────────────────────
    useEffect(() => {
        const handler = (payload: any) => {
            const lat = payload.lat ?? payload.Lat;
            const lon = payload.lon ?? payload.Lon;
            
            // Only care about customer location if we are approaching/arrived
            if (lat && lon && uiStatus !== 'started' && uiStatus !== 'completed') {
                setCustomerLocation({
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lon)
                });
            }
        };

        SignalRService.on('DRIVER', 'customer_location_changed', handler);
        
        return () => {
            SignalRService.off('DRIVER', 'customer_location_changed', handler);
        };
    }, [uiStatus]);

    // ── Server-computed ETA/Distance (ride_progress) ────────────────────────
    useEffect(() => {
        const progressHandler = (payload: any) => {
            const remainingMeters = payload.RemainingDistanceMeters ?? payload.remainingDistanceMeters;
            const etaSec = payload.EtaSeconds ?? payload.etaSeconds;

            if (remainingMeters !== undefined && remainingMeters !== null) {
                const km = remainingMeters / 1000;
                const distText = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(remainingMeters)} m`;
                const durText = etaSec > 0 ? `${Math.ceil(etaSec / 60)} min` : null;
                // Push server values into the existing routeInfo state used by the map
                setRouteInfo((prev: any) => ({
                    ...prev,
                    activeDistanceText: distText,
                    activeDurationText: durText,
                }));
            }
        };

        SignalRService.on('DRIVER', 'ride_progress', progressHandler);
        return () => SignalRService.off('DRIVER', 'ride_progress', progressHandler);
    }, []);

    // Clear customer location when ride starts
    useEffect(() => {
        if (uiStatus === 'started') {
            setCustomerLocation(null);
        }
    }, [uiStatus]);

    const handleAction = async () => {
        if (isActionBusy || !safeRide || isActionLoading) return;
        setIsActionLoading(true);
        try {
            if (uiStatus === 'approaching') {
                await updateRideStatus('arrived');
            } else if (uiStatus === 'arrived') {
                setShowCustomerNotResponding(false);
                await updateRideStatus('started');
            } else if (uiStatus === 'started') {
                const isWallet = safeRide.paymentMethod?.toLowerCase() === 'wallet';
                await processCompletion(isWallet);
            }
        } catch (err: any) {
            setIsCompletingDirectly(false);
            const msg = err?.message || 'Failed to update trip. Please try again.';
            showError('Error', msg);
        } finally {
            setIsActionLoading(false);
        }
    };

    const processCompletion = async (payFromWallet: boolean) => {
        setIsCompletingDirectly(true);
        try {
            if (!safeRide) return;
            
            const tripDistanceKm = pickupCoords && dropoffCoords
                ? Math.max(0.1, Number(haversineKm(pickupCoords, dropoffCoords).toFixed(2)))
                : Math.max(0.1, Number(safeRide.distance || 1));

            const response = await completeRide(tripDistanceKm, payFromWallet);
            if (!response) {
                throw new Error('Ride completion failed.');
            }

            const finalFare = response.finalFare ?? response.FinalFare ?? safeRide.fare ?? 0;
            const currency = response.currency ?? response.Currency ?? 'PKR';

            let durationMinutes = 3;
            if (safeRide.startedAt) {
                const diffMs = Date.now() - new Date(safeRide.startedAt).getTime();
                durationMinutes = Math.max(1, Math.round(diffMs / 60000));
            }

            setSummaryData({
                rideId: safeRide.rideId,
                customerId: safeRide.customerId || '',
                finalFare: Number(finalFare),
                estimatedFare: Number(safeRide.fare || 0),
                pickupAddress: safeRide.pickupAddress || 'Pickup Point',
                dropoffAddress: safeRide.dropoffAddress || 'Dropoff Destination',
                distance: response.distanceKm || tripDistanceKm,
                duration: response.durationMinutes || durationMinutes,
                currency: currency,
                commission: response.commission || (Number(finalFare) * 0.2),
                netEarnings: response.netEarnings || (Number(finalFare) * 0.8),
                paymentMethod: safeRide.paymentMethod || ''
            });

            setIsCompletingDirectly(false);
        } catch (err: any) {
            setIsCompletingDirectly(false);
            const msg = err?.message || 'Failed to complete trip. Please try again.';
            Alert.alert('Error', msg);
        }
    };

    const handleFinishFlow = async () => {
        if (!summaryData) return;

        setIsSubmittingRating(true);
        try {
            await usersService.submitRating({
                rideId: summaryData.rideId,
                targetUserId: summaryData.customerId,
                rating: rating,
                comment: "Ride completed successfully"
            });

            setSummaryData(null);
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { screen: 'DashboardTab' } }],
            });
        } catch (err: any) {
            console.warn("Rating submission failed", err);
            Alert.alert(
                "Rating Failed",
                "We couldn't save your rating, but your trip has been marked as completed.",
                [{
                    text: "OK", onPress: () => {
                        setSummaryData(null);
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainTabs', params: { screen: 'DashboardTab' } }],
                        });
                    }
                }]
            );
        } finally {
            setIsSubmittingRating(false);
        }
    };

    const handleCancel = () => {
        if (isActionBusy) return;
        Alert.alert(t('common.cancel'), 'Are you sure you want to cancel this trip?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
                    try {
                        await cancelRide();
                        setShowCancelledView(true);
                    } catch (e) {
                        setShowCancelledView(true);
                    }
                }
            }
        ]);
    };

    const openNavigation = () => {
        const dest = (uiStatus === 'approaching' || uiStatus === 'waiting' || uiStatus === 'arrived')
            ? pickupCoords
            : dropoffCoords;
        if (!dest) return;

        const label = (uiStatus === 'started' ? safeRide?.dropoffAddress : safeRide?.pickupAddress) || 'Destination';
        promptExternalNavigation(
            { latitude: dest.latitude, longitude: dest.longitude, label },
            isRTL
        );
    };

    // State 11: Ride Cancelled View
    if (showCancelledView) {
        return (
            <View style={styles.cancelledContainer}>
                <StatusBar barStyle="dark-content" />
                <MapScreen
                    pickupLocation={pickupCoords}
                    dropoffLocation={dropoffCoords}
                    driverLocation={driverLocation}
                    driverHeading={driverHeading}
                    customerLocation={customerLocation}
                    rideStatus="completed"
                    vehicleType={safeVehicleType}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.darkOverlay} />

                <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={styles.dialogCard}
                >
                    <View style={styles.cancelIconCircle}>
                        <XCircle color="#EF4444" size={40} />
                    </View>
                    <Text style={styles.dialogTitle}>Ride Cancelled</Text>
                    <Text style={styles.dialogSubtitle}>Cancelled by customer</Text>
                    <Text style={styles.dialogInfoText}>You will be back online{"\n"}in a few minutes</Text>

                    <TouchableOpacity
                        style={[styles.orangeButton, { backgroundColor: actionColor, shadowColor: actionColor }]}
                        onPress={() => {
                            setShowCancelledView(false);
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'MainTabs', params: { screen: 'DashboardTab' } }],
                            });
                        }}
                    >
                        <Text style={styles.orangeButtonText}>Back Online</Text>
                    </TouchableOpacity>
                </MotiView>
            </View>
        );
    }

    // State 9: Ride Completed Summary View
    if (summaryData) {
        return (
            <SafeAreaView style={[styles.summaryOverlay, { backgroundColor: '#F6F8FF' }]}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.confettiContainer}>
                    {/* Decorative Confetti Shapes */}
                    <MotiView from={{ translateY: -20, opacity: 0 }} animate={{ translateY: 200, opacity: 0.8 }} transition={{ loop: true, duration: 2500 }} style={[styles.confettiParticle, { left: '10%', backgroundColor: '#FF991C' }]} />
                    <MotiView from={{ translateY: -30, opacity: 0 }} animate={{ translateY: 220, opacity: 0.8 }} transition={{ loop: true, duration: 2800, delay: 300 }} style={[styles.confettiParticle, { left: '30%', backgroundColor: '#10B981', borderRadius: 0 }]} />
                    <MotiView from={{ translateY: -15, opacity: 0 }} animate={{ translateY: 180, opacity: 0.8 }} transition={{ loop: true, duration: 2200, delay: 100 }} style={[styles.confettiParticle, { left: '60%', backgroundColor: '#3B82F6' }]} />
                    <MotiView from={{ translateY: -25, opacity: 0 }} animate={{ translateY: 210, opacity: 0.8 }} transition={{ loop: true, duration: 2600, delay: 500 }} style={[styles.confettiParticle, { left: '80%', backgroundColor: '#F43F5E' }]} />
                </View>

                <View style={styles.summaryInnerContent}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring' }}
                        style={styles.greenCheckWrapper}
                    >
                        <CheckCircle color="#10B981" size={44} />
                    </MotiView>

                    <Text style={styles.rideCompletedTitle}>Ride Completed</Text>
                    <Text style={styles.rideCompletedSubtitle}>Great job!</Text>

                    <View style={styles.fareEarnedCard}>
                        <Text style={styles.fareEarnedLabel}>Fare Earned</Text>
                        <Text style={styles.fareEarnedValue}>Rs. {Math.round(summaryData.finalFare)}</Text>

                        <View style={styles.fareDetailsGrid}>
                            <View style={styles.detailGridItem}>
                                <Text style={styles.detailGridValue}>{summaryData.distance.toFixed(1)} km</Text>
                                <Text style={styles.detailGridLabel}>Distance</Text>
                            </View>
                            <View style={styles.detailGridDivider} />
                            <View style={styles.detailGridItem}>
                                <Text style={styles.detailGridValue}>{summaryData.duration} min</Text>
                                <Text style={styles.detailGridLabel}>Duration</Text>
                            </View>
                        </View>

                        <View style={styles.paymentMethodRow}>
                            <Text style={styles.paymentLabel}>Payment</Text>
                            <View style={styles.paymentBadge}>
                                <Text style={styles.paymentBadgeText}>{summaryData.paymentMethod.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Rating Section */}
                    <View style={styles.premiumRatingSection}>
                        <Text style={styles.premiumRatingTitle}>Rate Customer</Text>
                        <View style={styles.premiumStarsContainer}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                                    <Star
                                        size={36}
                                        color={s <= rating ? "#FBBF24" : "#E5E7EB"}
                                        fill={s <= rating ? "#FBBF24" : "transparent"}
                                        style={{ marginHorizontal: 6 }}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.orangeButton, { marginTop: 'auto' }, isSubmittingRating && { opacity: 0.7 }]}
                        onPress={handleFinishFlow}
                        disabled={isSubmittingRating}
                    >
                        {isSubmittingRating ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.orangeButtonText}>Back to Dashboard</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!safeRide) {
        return (
            <SafeAreaView style={[styles.recoveryContainer, { backgroundColor: theme.background }]}>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.recoveryText, { color: theme.textSecondary, fontFamily: getFontFamily('medium', isRTL) }]}>
                        {isRecoveringMissingRide
                            ? (isRTL ? 'ٹرپ بحال کیا جا رہا ہے...' : 'Restoring ride session...')
                            : (isRTL ? 'ڈیش بورڈ پر واپس جا رہے ہیں...' : 'Returning to dashboard...')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // State 3: Ride Accepted View
    if (uiStatus === 'waiting') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <MapScreen
                    pickupLocation={pickupCoords}
                    dropoffLocation={dropoffCoords}
                    driverLocation={driverLocation}
                    driverHeading={driverHeading}
                    customerLocation={customerLocation}
                    rideStatus={uiStatus}
                    vehicleType={safeVehicleType}
                    onRouteInfo={handleRouteInfo}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.darkOverlay} />

                <View style={styles.centeredCardContainer}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={styles.dialogCard}
                    >
                        <View style={styles.hourglassCircle}>
                            <Clock color="#F59E0B" size={32} />
                        </View>
                        <Text style={styles.dialogTitle}>Ride Accepted</Text>
                        <Text style={styles.dialogSubtitle}>Customer is choosing a driver{"\n"}Please wait...</Text>

                        <View style={styles.waitingDotIndicator}>
                            <MotiView from={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ loop: true, duration: 600, delay: 0 }} style={styles.waitingDot} />
                            <MotiView from={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ loop: true, duration: 600, delay: 200 }} style={styles.waitingDot} />
                            <MotiView from={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ loop: true, duration: 600, delay: 400 }} style={styles.waitingDot} />
                        </View>
                    </MotiView>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* State 5: Top Navigation Banner (Only in approaching navigation mode) */}
            {uiStatus === 'approaching' && isNavigatingMode && (
                <MotiView
                    entering={{ translateY: -100 }}
                    style={[styles.navigationTopBanner, { paddingTop: insets.top + 8 }]}
                >
                    <View style={styles.navigationTopBannerContent}>
                        <View style={styles.greenNavigationCircle}>
                            <Navigation2 color="#FFF" size={16} style={{ transform: [{ rotate: '45deg' }] }} />
                        </View>
                        <Text style={styles.navigationTopBannerText}>Head towards pickup</Text>
                    </View>
                </MotiView>
            )}


            {/* Map Component */}
            <MapScreen
                pickupLocation={pickupCoords}
                dropoffLocation={dropoffCoords}
                driverLocation={driverLocation}
                driverHeading={driverHeading}
                customerLocation={customerLocation}
                rideStatus={uiStatus}
                vehicleType={safeVehicleType}
                onRouteInfo={handleRouteInfo}
                style={StyleSheet.absoluteFill}
            />

            {/* State 6: Arrived Centered Popup */}
            {uiStatus === 'arrived' && (
                <View style={styles.centeredCardContainer} pointerEvents="box-none">
                    {showCustomerNotResponding ? (
                        /* State 10: Customer not responding dialog */
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={styles.dialogCard}
                        >
                            <View style={[styles.hourglassCircle, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <AlertTriangle color="#F59E0B" size={32} />
                            </View>
                            <Text style={styles.dialogTitle}>Customer not responding</Text>
                            <Text style={styles.dialogSubtitle}>What would you like to do?</Text>

                            <TouchableOpacity
                                style={styles.outlineBlackButton}
                                onPress={() => handleDial(safeRide.customerPhone)}
                            >
                                <Phone color="#101828" size={18} style={{ marginRight: 8 }} />
                                <Text style={styles.outlineBlackButtonText}>Call Customer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.outlineRedButton}
                                onPress={handleCancel}
                            >
                                <Text style={styles.outlineRedButtonText}>Cancel Ride</Text>
                            </TouchableOpacity>
                        </MotiView>
                    ) : (
                        /* State 6 card details */
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={styles.arrivedDialogCard}
                        >
                            <View style={styles.arrivedIllustrationContainer}>
                                <View style={styles.scooterIconBackground}>
                                    <Image
                                        source={require('../assets/superbike.png')}
                                        style={styles.arrivedScooterImage}
                                    />
                                    <View style={styles.scooterPinBadge}>
                                        <MapPin color="#FFF" size={10} fill="#FFF" />
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.arrivedDialogTitle}>You have arrived</Text>
                            <Text style={styles.arrivedDialogSubtitle}>Waiting for customer</Text>

                            <TouchableOpacity
                                style={styles.notRespondingLink}
                                onPress={() => setShowCustomerNotResponding(true)}
                            >
                                <Text style={styles.notRespondingLinkText}>Customer not responding?</Text>
                            </TouchableOpacity>

                            <View style={styles.arrivedActionsRow}>
                                <TouchableOpacity
                                    style={styles.arrivedActionOutlineBtn}
                                    onPress={() => Linking.openURL(`tel:${safeRide.customerPhone}`).catch(() => { })}
                                >
                                    <Phone color={actionColor} size={16} />
                                    <Text style={[styles.arrivedActionOutlineText, { color: actionColor }]}>Call Customer</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.arrivedActionOutlineBtn}
                                    onPress={() => navigation.navigate('Chat', {
                                        rideId: safeRide.rideId,
                                        customerName: safeRide.customerName,
                                        profilePicUrl: safeRide.customerProfilePicUrl,
                                        phoneNumber: safeRide.customerPhone
                                    })}
                                >
                                    <MessageSquare color={actionColor} size={16} />
                                    <Text style={[styles.arrivedActionOutlineText, { color: actionColor }]}>Chat</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity 
                                style={[styles.orangeButton, { backgroundColor: actionColor, shadowColor: actionColor }]} 
                                onPress={handleAction}
                                disabled={isActionLoading}
                            >
                                {isActionLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.orangeButtonText}>Start Ride</Text>
                                )}
                            </TouchableOpacity>
                        </MotiView>
                    )}
                </View>
            )}

            {/* Collapsed bottom sheet reopen button */}
            {isBottomSheetCollapsed && (
                <TouchableOpacity
                    style={styles.reopenBottomSheetBtn}
                    onPress={() => setIsBottomSheetCollapsed(false)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-up" size={24} color="#666" />
                </TouchableOpacity>
            )}

            {/* Floating Top Header (Classic styling for states other than accepted/arrived/cancelled) */}
            {(!isNavigatingMode || uiStatus !== 'approaching') && uiStatus !== 'arrived' && (
                <View style={[styles.headerOverlay, { paddingTop: insets.top + 8, flexDirection: 'row' }]}>
                    <TouchableOpacity 
                        style={[styles.backPillBtn, { backgroundColor: theme.primary + '15' }]} 
                        onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'DashboardTab' })}
                    >
                        <ChevronLeft color={theme.primary} size={22} style={{ transform: [{ scaleX: 1 }] }} />
                    </TouchableOpacity>
                    <View style={{ width: 44 }} />
                </View>
            )}

            {/* Bottom Sheet Component */}
            {uiStatus !== 'arrived' && (
                <Animated.View
                    style={[
                        styles.premiumBottomSheet,
                        {
                            paddingBottom: insets.bottom + 16,
                            transform: [{ translateY: Animated.add(slideAnim, panY) }],
                            backgroundColor: '#FFFFFF',
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity 
                        style={styles.bottomSheetDragHandle} 
                        onPress={() => setIsBottomSheetCollapsed(!isBottomSheetCollapsed)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.dragHandleBar} />
                        <Ionicons 
                            name={isBottomSheetCollapsed ? "chevron-up" : "chevron-down"} 
                            size={20} 
                            color="#999" 
                            style={{ marginTop: 4 }}
                        />
                    </TouchableOpacity>

                    {/* STATE 4: Customer Assigned Info */}
                    {uiStatus === 'approaching' && !isNavigatingMode && (
                        <View style={styles.contentWrap}>
                            <View style={styles.customerAssignedHeader}>
                                <Text style={[styles.customerAssignedTitle, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(13, isRTL) }]}>{t('ride.customerAssigned', 'Customer Assigned')}</Text>
                            </View>

                            <View style={[styles.customerProfileRow, { flexDirection: 'row', alignItems: 'center' }]}>
                                <View style={styles.premiumAvatarWrapper}>
                                    {safeRide.customerProfilePicUrl ? (
                                        <Image source={{ uri: safeRide.customerProfilePicUrl }} style={styles.premiumAvatar} />
                                    ) : (
                                        <View style={styles.premiumAvatarFallback}>
                                            <Text style={styles.avatarEmoji}>👤</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.premiumCustomerDetails}>
                                    <Text style={[styles.premiumCustomerName, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(18, isRTL), textAlign: 'left' }]}>{safeRide.customerName || 'Customer'}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Star color="#FBBF24" size={14} fill="#FBBF24" />
                                        <Text style={[styles.premiumRatingText, { fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(13, isRTL) }]}> {safeRide.customerRating?.toFixed(1) || '4.7'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.horizontalDivider} />

                            <View style={[styles.pickupEtaRow, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                                <View style={styles.pickupLocationInfo}>
                                    <Text style={[styles.pickupLabel, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(11, isRTL) }]}>{t('ride.pickup', 'Pickup')}</Text>
                                    <Text style={[styles.pickupAddressValue, { fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(15, isRTL) }]} numberOfLines={1}>{safeRide.pickupAddress || 'Lucky One Mall'}</Text>
                                </View>
                                <View style={styles.etaInfo}>
                                    <Text style={[styles.pickupLabel, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(11, isRTL) }]}>{t('ride.paymentMethod', 'Payment')}</Text>
                                    <Text style={[styles.etaValue, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(16, isRTL), color: safeRide.paymentMethod === 'Digital Payment' ? '#10B981' : '#FF991C' }]}>
                                        {safeRide.paymentMethod === 'Digital Payment' 
                                            ? t('payments.digital_payment', 'Digital') 
                                            : (safeRide.paymentMethod || t('payments.cash', 'Cash'))}
                                    </Text>
                                </View>
                            </View>

                            {/* ── Live ETA / Distance Row ─────────────── */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: getFontFamily('semibold', isRTL), marginBottom: 2 }}>Distance</Text>
                                    <Text style={{ fontSize: 16, fontFamily: getFontFamily('bold', isRTL), color: '#111827' }}>
                                        {routeInfo.activeDistanceText || '—'}
                                    </Text>
                                </View>
                                <View style={{ width: 1, height: 28, backgroundColor: '#E5E7EB' }} />
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: getFontFamily('semibold', isRTL), marginBottom: 2 }}>ETA</Text>
                                    <Text style={{ fontSize: 16, fontFamily: getFontFamily('bold', isRTL), color: '#111827' }}>
                                        {routeInfo.activeDurationText || (routeInfo.activeDistanceText ? '...' : 'Calculating')}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.buttonsActionGrid, { flexDirection: 'row', gap: 10 }]}>
                                <TouchableOpacity
                                    style={styles.gridActionBtnOutline}
                                    onPress={() => handleDial(safeRide.customerPhone)}
                                >
                                    <Phone color="#101828" size={18} />
                                    <Text style={[styles.gridActionBtnText, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(14, isRTL) }]}>{t('common.call', 'Call')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.gridActionBtnOutline}
                                    onPress={() => navigation.navigate('Chat', {
                                        rideId: safeRide.rideId,
                                        customerName: safeRide.customerName,
                                        profilePicUrl: safeRide.customerProfilePicUrl,
                                        phoneNumber: safeRide.customerPhone
                                    })}
                                >
                                    <MessageSquare color="#101828" size={18} />
                                    <Text style={[styles.gridActionBtnText, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(14, isRTL) }]}>{t('common.chat', 'Chat')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.gridActionBtnOutline}
                                    onPress={openNavigation}
                                >
                                    <NavIcon color="#101828" size={18} />
                                    <Text style={[styles.gridActionBtnText, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(14, isRTL) }]}>{t('ride.navigate', 'Navigate')}</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={[styles.orangeButton, { backgroundColor: actionColor, shadowColor: actionColor }]} onPress={handleAction}>
                                <Text style={[styles.orangeButtonText, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(16, isRTL) }]}>{t('ride.arrivedAtPickup', 'Arrived at Pickup')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.outlineRedButton} onPress={handleCancel}>
                                <Text style={[styles.outlineRedButtonText, { fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(16, isRTL) }]}>{t('ride.cancelRide', 'Cancel Ride')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STATE 5: Heading to Pickup Navigation Sheet */}
                    {uiStatus === 'approaching' && isNavigatingMode && (
                        <View style={styles.contentWrap}>
                            <View style={styles.pickupNavigationInfoRow}>
                                <View style={styles.greenDotIndicator} />
                                <View style={styles.pickupNavigationTextGroup}>
                                    <Text style={styles.pickupLabel}>PICKUP</Text>
                                    <Text style={styles.pickupAddressValue} numberOfLines={1}>{safeRide.pickupAddress || 'Lucky One Mall'}</Text>
                                </View>
                            </View>

                            <View style={styles.navigationStatsGrid}>
                                <View style={styles.navStatItem}>
                                    <Text style={styles.navStatValue}>{routeInfo.activeDistanceText || '—'}</Text>
                                    <Text style={styles.navStatLabel}>Distance</Text>
                                </View>
                                <View style={styles.navStatDivider} />
                                <View style={styles.navStatItem}>
                                    <Text style={styles.navStatValue}>{routeInfo.activeDurationText || '—'}</Text>
                                    <Text style={styles.navStatLabel}>ETA</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.orangeButton, { backgroundColor: actionColor, shadowColor: actionColor }]} 
                                onPress={handleAction}
                                disabled={isActionLoading}
                            >
                                {isActionLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.orangeButtonText}>Arrived at Pickup</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {uiStatus === 'started' && (
                        <View style={styles.contentWrap}>
                            <View style={styles.transitHeaderRow}>
                                <View style={styles.transitTextGroup}>
                                    <Text style={styles.transitStatusTitle}>Trip In Progress</Text>
                                    <View style={styles.destinationReachedBanner}>
                                        <View style={styles.reachedIconCircle}>
                                            <Flag color={actionColor} size={16} />
                                        </View>
                                        <Text style={styles.transitDropoffAddress} numberOfLines={1}>{safeRide.dropoffAddress || 'Destination'}</Text>
                                    </View>
                                    <Text style={styles.transitStatsSubtext}>
                                        {routeInfo.activeDistanceText && routeInfo.activeDurationText
                                            ? `${routeInfo.activeDistanceText} • ${routeInfo.activeDurationText}`
                                            : (routeInfo.activeDistanceText || routeInfo.activeDurationText || 'Calculating...')}
                                    </Text>
                                </View>

                                <View style={styles.transitContactActions}>
                                    <TouchableOpacity
                                        style={styles.transitContactCircle}
                                        onPress={() => handleDial(safeRide.customerPhone)}
                                    >
                                        <Phone color="#101828" size={16} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.transitContactCircle}
                                        onPress={() => navigation.navigate('Chat', {
                                            rideId: safeRide.rideId,
                                            customerName: safeRide.customerName,
                                            profilePicUrl: safeRide.customerProfilePicUrl,
                                            phoneNumber: safeRide.customerPhone
                                        })}
                                    >
                                        <MessageSquare color="#101828" size={16} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.transitContactCircle}
                                        onPress={openNavigation}
                                    >
                                        <NavIcon color="#101828" size={16} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[
                                    styles.orangeButton, 
                                    { 
                                        backgroundColor: actionColor, 
                                        shadowColor: actionColor 
                                    }
                                ]} 
                                onPress={handleAction}
                                disabled={isActionLoading}
                            >
                                {isActionLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.orangeButtonText}>
                                        Complete Ride
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.outlineRedButton, { marginTop: 12 }]} onPress={handleCancel}>
                                <Text style={styles.outlineRedButtonText}>Cancel Ride</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    recoveryContainer: { flex: 1, justifyContent: 'center', padding: 24 },
    loaderWrap: { alignItems: 'center', gap: 14 },
    recoveryText: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    darkOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(15,23,42,0.5)' },

    // Header floating overlay
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    backPillBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    headerNotificationBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },

    // Dialog Cards
    centeredCardContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        zIndex: 20,
    },
    dialogCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
    },
    hourglassCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(245,158,11,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    hourglassCircleInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(245,158,11,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    dialogTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 8,
        textAlign: 'center',
    },
    dialogSubtitle: {
        fontSize: 14,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    dialogInfoText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },

    // State 3 specific
    waitingDotIndicator: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
        marginBottom: 8,
    },
    waitingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F59E0B',
    },

    // Arrived Popup
    arrivedDialogCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
    },
    arrivedIllustrationContainer: {
        marginBottom: 16,
        alignItems: 'center',
    },
    scooterIconBackground: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#FFF2E0',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    arrivedScooterImage: {
        width: 48,
        height: 48,
        tintColor: '#FF991C',
    },
    scooterPinBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    arrivedDialogTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 4,
        textAlign: 'center',
    },
    arrivedDialogSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
        textAlign: 'center',
    },
    notRespondingLink: {
        marginBottom: 20,
    },
    notRespondingLinkText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    arrivedActionsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        marginBottom: 16,
    },
    arrivedActionOutlineBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#FFEED4',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFBF5',
    },
    arrivedActionOutlineText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FF991C',
    },

    // State 11 Cancelled Card Specific
    cancelledContainer: { flex: 1 },
    cancelIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },

    // Buttons
    orangeButton: {
        width: '100%',
        height: 56,
        borderRadius: 20,
        backgroundColor: '#FF991C',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#FF991C',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    orangeButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    outlineBlackButton: {
        width: '100%',
        flexDirection: 'row',
        height: 52,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    outlineBlackButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#101828',
    },
    outlineRedButton: {
        width: '100%',
        height: 52,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#FCA5A5',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF8F8',
        marginTop: 12,
    },
    outlineRedButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },

    // State 5 Navigation Banner
    navigationTopBanner: {
        position: 'absolute',
        left: 20,
        right: 20,
        zIndex: 10,
    },
    navigationTopBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    greenNavigationCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    navigationTopBannerText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // State 7 SOS Button
    sosFloatingHeader: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
    },
    sosButtonCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#EF4444',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    sosButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },

    // Bottom Sheet Styling
    premiumBottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 12,
        elevation: 24,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -8 },
    },
    contentWrap: {
        width: '100%',
    },

    // State 4 layout details
    customerAssignedHeader: {
        marginBottom: 16,
    },
    customerAssignedTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    customerProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    premiumAvatarWrapper: {
        position: 'relative',
        marginRight: 14,
    },
    premiumAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    premiumAvatarFallback: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFF2E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: { fontSize: 22 },
    premiumCustomerDetails: {
        flex: 1,
    },
    premiumCustomerName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 2,
    },
    premiumCustomerRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    premiumRatingText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },
    horizontalDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
    },
    pickupEtaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    pickupLocationInfo: {
        flex: 1,
        marginRight: 20,
    },
    pickupLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    pickupAddressValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#101828',
    },
    etaInfo: {
        alignItems: 'flex-end',
    },
    etaValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF991C',
    },
    buttonsActionGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    gridActionBtnOutline: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
    },
    gridActionBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#101828',
    },

    // State 5 specific
    pickupNavigationInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    greenDotIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        marginRight: 10,
    },
    pickupNavigationTextGroup: {
        flex: 1,
    },
    navigationStatsGrid: {
        flexDirection: 'row',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        borderRadius: 20,
        paddingVertical: 14,
        marginBottom: 20,
    },
    navStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    navStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 2,
    },
    navStatLabel: {
        fontSize: 12,
        color: '#64748B',
    },
    navStatDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
    },

    // State 7 Transit sheet specific
    transitHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    transitTextGroup: {
        flex: 1,
        marginRight: 20,
    },
    transitStatusTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    transitDropoffAddress: {
        fontSize: 18,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 2,
    },
    transitStatsSubtext: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    transitContactActions: {
        flexDirection: 'row',
        gap: 10,
    },
    transitContactCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    redEmergencyButton: {
        flexDirection: 'row',
        width: '100%',
        height: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFBFB',
        marginTop: 12,
    },
    redEmergencyButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },

    // State 8 Destination reached
    destinationReachedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    reachedIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF2E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    destinationReachedTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#101828',
    },
    reachedStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        borderRadius: 22,
        padding: 16,
        marginBottom: 20,
    },
    reachedStatColumn: {
        alignItems: 'center',
        flex: 1,
    },
    reachedStatLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    reachedStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#101828',
    },

    // State 9 Ride Completed overlay & details
    summaryOverlay: {
        flex: 1,
    },
    summaryInnerContent: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
    },
    confettiContainer: {
        ...(StyleSheet.absoluteFill as object),
        overflow: 'hidden',
        pointerEvents: 'none',
    },
    confettiParticle: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    greenCheckWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EBFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 40,
    },
    rideCompletedTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#101828',
        marginBottom: 4,
    },
    rideCompletedSubtitle: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
        marginBottom: 24,
    },
    fareEarnedCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        marginBottom: 24,
    },
    fareEarnedLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    fareEarnedValue: {
        fontSize: 36,
        fontWeight: '800',
        color: '#10B981',
        marginBottom: 20,
    },
    fareDetailsGrid: {
        flexDirection: 'row',
        borderTopWidth: 1.5,
        borderBottomWidth: 1.5,
        borderColor: '#F1F5F9',
        width: '100%',
        paddingVertical: 14,
        marginBottom: 16,
    },
    detailGridItem: {
        flex: 1,
        alignItems: 'center',
    },
    detailGridValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 2,
    },
    detailGridLabel: {
        fontSize: 12,
        color: '#64748B',
    },
    detailGridDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
    },
    paymentMethodRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
    },
    paymentLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    paymentBadge: {
        backgroundColor: '#FFF2E0',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    paymentBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FF991C',
    },
    premiumRatingSection: {
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    premiumRatingTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#101828',
        marginBottom: 12,
    },
    premiumStarsContainer: {
        flexDirection: 'row',
    },
    hourglassWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFF9EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    acceptedCard: {
        alignItems: 'center',
    },
    acceptedTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#101828',
        marginBottom: 6,
    },
    acceptedSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    loadingDotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF991C',
    },
    bottomSheetDragHandle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    dragHandleBar: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
    },
    reopenBottomSheetBtn: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    enhancedTransitContactCircle: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        minWidth: 70,
        gap: 4,
    },
    transitContactLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
});

export default NavigationRide;
