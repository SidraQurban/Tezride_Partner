import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Alert,
    Animated,
    ActivityIndicator,
    PanResponder,
    Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import { MapPin, Navigation2 as Navigation, Clock, X, Star, User } from 'lucide-react-native';
import { useRide } from '../context/RideContext';
import { useLanguage } from '../context/LanguageContext';
import MapScreen from '../components/Map/MapScreen';
import { getFontFamily } from '../utils/layout';

const { width, height } = Dimensions.get('window');

const RideRequest = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { incomingRideRequest, acceptIncomingRide, rejectIncomingRide, isLoading } = useRide();
    const { isRTL } = useLanguage();

    const [timer, setTimer] = useState(30);
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Swipe to Accept state
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const [trackWidth, setTrackWidth] = useState(250);
    const THUMB_SIZE = 56;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx >= 0 && gestureState.dx <= trackWidth - THUMB_SIZE) {
                    swipeAnim.setValue(gestureState.dx);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx >= (trackWidth - THUMB_SIZE) * 0.6) {
                    Animated.spring(swipeAnim, { toValue: trackWidth - THUMB_SIZE, useNativeDriver: false }).start();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    handleAccept();
                } else {
                    Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: false }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (incomingRideRequest?.timeoutSec) {
            setTimer(incomingRideRequest.timeoutSec);
        }

        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 10 && prev > 1) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } else if (prev > 10) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }

                if (prev <= 1) {
                    clearInterval(interval);
                    if (navigation.canGoBack?.()) {
                        navigation.goBack();
                    } else {
                        navigation.navigate('MainTabs', { screen: 'DashboardTab' });
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [incomingRideRequest]);

    const handleAccept = async () => {
        try {
            await acceptIncomingRide(incomingRideRequest);
            // After showing interest, go back to dashboard/list so rider can see other requests
            // while waiting for customer confirmation.
            if (navigation.canGoBack?.()) {
                navigation.goBack();
            } else {
                navigation.navigate('MainTabs', { screen: 'DashboardTab' });
            }
        } catch (error) {
            // Error alert handled by context
        }
    };

    const handleDecline = async () => {
        try {
            await rejectIncomingRide(incomingRideRequest);
            if (navigation.canGoBack?.()) {
                navigation.goBack();
            } else {
                navigation.navigate('MainTabs', { screen: 'DashboardTab' });
            }
        } catch (error) {
            if (navigation.canGoBack?.()) {
                navigation.goBack();
            } else {
                navigation.navigate('MainTabs', { screen: 'DashboardTab' });
            }
        }
    };

    if (!incomingRideRequest) {
        return (
            <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.emptyText}>Processing Request...</Text>
            </View>
        );
    }

    const pickup = { latitude: incomingRideRequest.pickup.lat, longitude: incomingRideRequest.pickup.lon };
    const dropoff = { latitude: incomingRideRequest.dropoff.lat, longitude: incomingRideRequest.dropoff.lon };

    return (
        <View style={styles.container}>
            {/* Background Map Preview */}
            <View style={StyleSheet.absoluteFill}>
                <MapScreen
                    pickupLocation={pickup}
                    dropoffLocation={dropoff}
                    showUserLocation={true}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.mapOverlay} />
            </View>

            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                {/* Header with Timer */}
                <View style={[styles.header, { marginTop: insets.top + 20 }]}>
                    <View style={styles.timerContainer}>
                        <Clock color={COLORS.primary} size={22} />
                        <Text style={styles.timerText}>{timer}s</Text>
                    </View>
                    <View style={styles.rideIconRow}>
                        <Image source={require('../assets/superbike.png')} style={styles.rideIconImage} />
                        <Text style={[styles.title, { fontFamily: getFontFamily('bold', isRTL) }]}>
                            {incomingRideRequest.event === 'delivery_request'
                                ? 'New Delivery'
                                : `New ${String(incomingRideRequest.type || 'Bike').charAt(0).toUpperCase() + String(incomingRideRequest.type || 'Bike').slice(1).toLowerCase()} Ride`}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}>
                        <User size={14} color="#FFF" />
                        <Text style={{ fontSize: 13, color: '#FFF', marginLeft: 6, fontFamily: getFontFamily('semibold', isRTL) }}>
                            {incomingRideRequest.customerName || 'Customer'}
                        </Text>
                        <View style={{ width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 10 }} />
                        <Star size={14} color="#FBBF24" fill="#FBBF24" />
                        <Text style={{ fontSize: 13, color: '#FFF', marginLeft: 6, fontFamily: getFontFamily('semibold', isRTL) }}>
                            {incomingRideRequest.customerRating?.toFixed(1) || '5.0'}
                        </Text>
                    </View>
                </View>

                {/* Info Card */}
                <View style={[styles.card, { marginBottom: insets.bottom + 20 }]}>
                    <View style={[styles.locationBox, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={styles.dotLineColumn}>
                            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                            <View style={styles.verticalLine} />
                            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        </View>
                        <View style={styles.addressColumn}>
                            <View style={styles.addressItem}>
                                <Text style={styles.addressLabel}>PICKUP</Text>
                                <Text style={[styles.addressText, { fontFamily: getFontFamily('semibold', isRTL) }]} numberOfLines={1}>
                                    {incomingRideRequest.pickupAddress || 'Current Location'}
                                </Text>
                            </View>
                            <View style={styles.addressItem}>
                                <Text style={styles.addressLabel}>DROPOFF</Text>
                                <Text style={[styles.addressText, { fontFamily: getFontFamily('semibold', isRTL) }]} numberOfLines={1}>
                                    {incomingRideRequest.dropoffAddress || 'Destination'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={{ gap: 15 }}>
                        <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Distance</Text>
                                <Text style={styles.statValue}>{incomingRideRequest.distance || '—'}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Fare</Text>
                                <Text style={[styles.statValue, { color: COLORS.primary }]}>Rs {incomingRideRequest.fare || '—'}</Text>
                            </View>
                        </View>
                        <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Payment</Text>
                                <Text style={[styles.statValue, { color: COLORS.primary }]}>
                                    {String(incomingRideRequest.paymentMethod || '—').toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Profit</Text>
                                <Text style={[styles.statValue, { color: COLORS.success }]}>
                                    Rs {incomingRideRequest.fare ? (Number(incomingRideRequest.fare) * 0.8).toFixed(0) : '—'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={isLoading}>
                            <X color="#666" size={24} />
                        </TouchableOpacity>

                        <View
                            style={styles.swipeTrack}
                            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Text style={[styles.swipeText, { fontFamily: getFontFamily('bold', isRTL) }]}>
                                        SWIPE TO ACCEPT
                                    </Text>
                                    <Animated.View
                                        style={[
                                            styles.swipeThumb,
                                            { transform: [{ translateX: swipeAnim }] }
                                        ]}
                                        {...panResponder.panHandlers}
                                    >
                                        <Navigation color={COLORS.primary} size={24} style={{ transform: [{ rotate: '90deg' }] }} />
                                    </Animated.View>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    mapOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.4)' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
    emptyText: { marginTop: 20, fontSize: 16, color: '#666' },
    content: { flex: 1, justifyContent: 'space-between' },
    header: { alignItems: 'center' },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 25,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    timerText: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: COLORS.primary, marginLeft: 8 },
    title: { color: '#FFF', fontSize: 24, marginTop: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    card: {
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        borderRadius: 30,
        padding: 25,
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    locationBox: { gap: 15 },
    dotLineColumn: { alignItems: 'center', paddingVertical: 5 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    verticalLine: { width: 2, flex: 1, backgroundColor: '#EEE', marginVertical: 5 },
    addressColumn: { flex: 1, gap: 15 },
    addressItem: { gap: 4 },
    addressLabel: { fontSize: 10, color: '#999', fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    addressText: { fontSize: 16, color: '#111' },
    divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 20 },
    statsRow: { justifyContent: 'space-between' },
    statBox: { alignItems: 'center' },
    statLabel: { fontSize: 11, color: '#999', marginBottom: 5 },
    statValue: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#111' },
    actionRow: { marginTop: 25, gap: 15 },
    declineBtn: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EEE',
    },
    swipeTrack: {
        flex: 1,
        height: 60,
        backgroundColor: COLORS.primary,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    swipeText: {
        color: '#FFF',
        fontSize: 16,
        letterSpacing: 1,
        marginLeft: 20,
    },
    swipeThumb: {
        position: 'absolute',
        left: 2,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    rideIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 16,
    },
    rideIconImage: {
        width: 34,
        height: 34,
        resizeMode: 'contain',
    },
});

export default RideRequest;

