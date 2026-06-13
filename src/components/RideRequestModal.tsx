import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    ActivityIndicator,
    Vibration,
    Alert,
} from 'react-native';
import { Clock, Navigation2 as Navigation, X, Star, User } from 'lucide-react-native';
import { useRide } from '../context/RideContext';
import { COLORS } from '../utils/constants';
import { useTranslation } from 'react-i18next';

interface Props {
    /** Navigate to NavigationRide after accepting */
    onAccepted?: () => void;
}

const RideRequestModal: React.FC<Props> = ({ onAccepted }) => {
    const { t } = useTranslation();
    const { incomingRideRequest, acceptIncomingRide, rejectIncomingRide, isLoading } = useRide();

    const [timeLeft, setTimeLeft] = useState(0);
    const [accepting, setAccepting] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    const slideAnim = useRef(new Animated.Value(300)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const visible = incomingRideRequest !== null;

    // ── Animate in/out ──────────────────────────────────────────────────────
    useEffect(() => {
        if (visible && incomingRideRequest) {
            setTimeLeft(incomingRideRequest.timeoutSec ?? 15);
            setAccepting(false);
            setRejecting(false);

            // Slide up
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 60,
                friction: 10,
            }).start();

            // Pulse the timer ring
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();

            // Vibrate to alert driver
            Vibration.vibrate([0, 400, 200, 400]);
        } else {
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 250,
                useNativeDriver: true,
            }).start();
            pulseAnim.stopAnimation();
            Vibration.cancel();
        }
    }, [visible]);

    // ── Countdown ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!visible) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    // Auto-reject when timer expires
                    rejectIncomingRide();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [visible]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleAccept = async () => {
        if (accepting || rejecting) return;
        setAccepting(true);
        try {
            await acceptIncomingRide();
            // Closing is handled implicitly by setIncomingRideRequest(null) in RideContext
            onAccepted?.();
        } catch (err: any) {
            console.error('[RideRequestModal] Accept error:', err);
            const errorMsg = err?.response?.data?.message || err?.message || 'Failed to accept ride.';
            Alert.alert(t('common.error', 'Error'), errorMsg);
        } finally {
            setAccepting(false);
        }
    };

    const handleReject = async () => {
        if (accepting || rejecting) return;
        setRejecting(true);
        try {
            await rejectIncomingRide();
        } finally {
            setRejecting(false);
        }
    };

    if (!incomingRideRequest) return null;

    const { pickup, dropoff, timeoutSec } = incomingRideRequest;
    const progress = timeLeft / (timeoutSec ?? 15);
    const timerColor = timeLeft > 5 ? COLORS.primary : '#EF4444';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleReject}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.card,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.dragHandle} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{t('ride.newRideRequest')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <User size={14} color="#6B7280" />
                                <Text style={{ fontSize: 13, color: '#4B5563', marginLeft: 4, fontFamily: 'Poppins_600SemiBold' }}>
                                    {incomingRideRequest.customerName || 'Customer'}
                                </Text>
                                <View style={{ width: 1, height: 12, backgroundColor: '#E5E7EB', marginHorizontal: 8 }} />
                                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                <Text style={{ fontSize: 13, color: '#4B5563', marginLeft: 4, fontFamily: 'Poppins_600SemiBold' }}>
                                    {incomingRideRequest.customerRating?.toFixed(1) || '5.0'}
                                </Text>
                                <View style={{ width: 1, height: 12, backgroundColor: '#E5E7EB', marginHorizontal: 8 }} />
                                <Text style={{ fontSize: 14, color: COLORS.primary, fontFamily: 'Poppins_700Bold' }}>
                                    {incomingRideRequest.fare ? `PKR ${incomingRideRequest.fare}` : t('ride.calculatingFare', 'Calculating...')}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Navigation size={12} color="#6B7280" />
                                <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4, fontFamily: 'Poppins_500Medium' }}>
                                    {incomingRideRequest.distance ? `${incomingRideRequest.distance.toFixed(1)} km` : '—'} • {incomingRideRequest.duration ? `${incomingRideRequest.duration} mins` : '—'}
                                </Text>
                            </View>
                        </View>

                        {/* Timer ring */}
                        <Animated.View
                            style={[
                                styles.timerRing,
                                {
                                    borderColor: timerColor,
                                    transform: [{ scale: pulseAnim }],
                                },
                            ]}
                        >
                            <Clock color={timerColor} size={16} />
                            <Text style={[styles.timerText, { color: timerColor }]}>
                                {timeLeft}s
                            </Text>
                        </Animated.View>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress * 100}%`, backgroundColor: timerColor },
                            ]}
                        />
                    </View>

                    {/* Route info */}
                    <View style={styles.routeContainer}>
                        {/* Pickup */}
                        <View style={styles.locationRow}>
                            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                            <View style={styles.locationTextContainer}>
                                <Text style={styles.locationLabel}>{t('ride.pickup').toUpperCase()}</Text>
                                <Text style={styles.locationValue} numberOfLines={1}>
                                    {incomingRideRequest.pickupAddress || (pickup
                                        ? `${pickup.lat.toFixed(4)}, ${pickup.lon.toFixed(4)}`
                                        : '—')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.routeLine} />

                        {/* Dropoff */}
                        <View style={styles.locationRow}>
                            <View style={[styles.dot, { backgroundColor: COLORS.secondary ?? '#FF5A5F' }]} />
                            <View style={styles.locationTextContainer}>
                                <Text style={styles.locationLabel}>{t('ride.dropoff').toUpperCase()}</Text>
                                <Text style={styles.locationValue} numberOfLines={1}>
                                    {incomingRideRequest.dropoffAddress || (dropoff
                                        ? `${dropoff.lat.toFixed(4)}, ${dropoff.lon.toFixed(4)}`
                                        : '—')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={handleReject}
                            disabled={accepting || rejecting}
                        >
                            {rejecting ? (
                                <ActivityIndicator color="#6B7280" size="small" />
                            ) : (
                                <>
                                    <X color="#6B7280" size={20} />
                                    <Text style={styles.rejectText}>{t('ride.decline')}</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.acceptBtn, accepting && { opacity: 0.8 }]}
                            onPress={handleAccept}
                            disabled={accepting || rejecting}
                        >
                            {accepting || isLoading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Navigation color="#FFFFFF" size={20} />
                                    <Text style={styles.acceptText}>{t('ride.accept')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        elevation: 30,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 20,
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1A1A1A',
        flex: 1,
    },
    timerRing: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 4,
    },
    timerText: {
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
        marginLeft: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 2,
        marginBottom: 24,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    routeContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 14,
        marginRight: 12,
    },
    routeLine: {
        width: 2,
        height: 20,
        backgroundColor: '#E5E7EB',
        marginLeft: 5,
        marginVertical: 4,
    },
    locationTextContainer: {
        flex: 1,
        paddingVertical: 8,
    },
    locationLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'Poppins_600SemiBold',
        letterSpacing: 1,
        marginBottom: 2,
    },
    locationValue: {
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
        color: '#1A1A1A',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    rejectBtn: {
        flex: 1,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        gap: 8,
    },
    rejectText: {
        fontFamily: 'Poppins_600SemiBold',
        color: '#6B7280',
        fontSize: 15,
    },
    acceptBtn: {
        flex: 2,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        gap: 8,
        elevation: 6,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    acceptText: {
        fontFamily: 'Poppins_600SemiBold',
        color: '#FFFFFF',
        fontSize: 16,
    },
});

export default RideRequestModal;
