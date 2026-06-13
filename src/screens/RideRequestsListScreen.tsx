import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Animated,
    ScrollView,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import {
    Bike,
    Clock,
    Wifi,
    WifiOff,
    Navigation,
    Star,
    MapPin,
    ChevronRight,
    CheckCircle,
    XCircle,
} from 'lucide-react-native';
import Header from '../components/Header';
import { useRide } from '../context/RideContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getFontFamily } from '../utils/layout';

const { width } = Dimensions.get('window');

// Animated pulse dot for "waiting" state
const PulseDot = ({ color }: { color: string }) => {
    const anim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: color,
                transform: [{ scale: anim }],
                opacity: 0.9,
            }}
        />
    );
};

// ── Individual Ride Request Card ──────────────────────────────────────────────
const RideCard = ({
    ride,
    navigation,
    onAccept,
    onReject,
    acceptingId,
    rejectingId,
    theme,
    isRTL,
    stats,
}: any) => {
    const { t } = useTranslation();

    const paymentColor =
        ride.paymentMethod === 'Digital Payment' || ride.paymentMethod === 'digital_payment'
            ? '#10B981'
            : ride.paymentMethod === 'Wallet'
            ? '#6366F1'
            : '#F59E0B';

    return (
        <TouchableOpacity
            style={[styles.requestCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            onPress={() => navigation.navigate('RideMapScreen', { ride })}
            activeOpacity={0.85}
        >
            {/* ── Top Row: Customer + Fare ───────────────── */}
            <View style={[styles.requestHeader, { flexDirection: 'row' }]}>
                <View style={styles.requestCustomerInfo}>
                    <Text
                        style={[styles.requestCustomerName, { fontFamily: getFontFamily('bold', isRTL), color: theme.text }]}
                    >
                        {ride.customerName || 'Customer'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={[styles.requestRating, { color: theme.textSecondary, marginLeft: 4, fontFamily: getFontFamily('medium', isRTL) }]}>
                            {ride.customerRating?.toFixed(1) || '5.0'}
                        </Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.requestFare, { fontFamily: getFontFamily('bold', isRTL), color: theme.text }]}>
                        {ride.fare ? `PKR ${ride.fare}` : t('ride.calculatingFare', 'Calculating...')}
                    </Text>
                    <View style={[styles.paymentBadge, { backgroundColor: paymentColor + '18' }]}>
                        <Text style={[styles.paymentBadgeText, { color: paymentColor, fontFamily: getFontFamily('semibold', isRTL) }]}>
                            {String(ride.paymentMethod || 'Cash').toUpperCase()}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.requestDivider} />

            {/* ── Locations ──────────────────────────────── */}
            <View style={styles.requestLocations}>
                <View style={[styles.requestLocationRow, { flexDirection: 'row' }]}>
                    <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                    <Text
                        style={[styles.requestLocationText, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL) }]}
                        numberOfLines={1}
                    >
                        {ride.pickupAddress || 'Pickup Location'}
                    </Text>
                </View>
                <View style={styles.location线} />
                <View style={[styles.requestLocationRow, { flexDirection: 'row', marginTop: 4 }]}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                    <Text
                        style={[styles.requestLocationText, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL) }]}
                        numberOfLines={1}
                    >
                        {ride.dropoffAddress || 'Dropoff Location'}
                    </Text>
                </View>
            </View>

            {/* ── Meta: Distance + Duration ──────────────── */}
            <View style={[styles.requestMeta, { flexDirection: 'row' }]}>
                <Clock size={14} color={theme.textSecondary} />
                <Text style={[styles.requestMetaText, { color: theme.textSecondary, marginLeft: 6, fontFamily: getFontFamily('medium', isRTL) }]}>
                    {ride.distance ? `${ride.distance.toFixed(1)} km` : '—'} •{' '}
                    {ride.duration ? `${ride.duration} min` : '—'}
                </Text>
            </View>

            {/* ── Accept / Reject Buttons ─────────────────── */}
            <View style={[styles.requestActions, { flexDirection: 'row' }]}>
                <TouchableOpacity
                    style={[styles.requestButton, styles.rejectButton, { borderColor: theme.error }]}
                    onPress={() => onReject(ride)}
                    disabled={!!acceptingId || !!rejectingId}
                >
                    {rejectingId === ride.rideId ? (
                        <ActivityIndicator size="small" color={theme.error} />
                    ) : (
                        <Text style={[styles.requestButtonText, { color: theme.error, fontFamily: getFontFamily('bold', isRTL) }]}>
                            {t('ride.reject', 'Reject')}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton, { backgroundColor: theme.primary }]}
                    onPress={() => onAccept(ride)}
                    disabled={!!acceptingId || !!rejectingId}
                >
                    {acceptingId === ride.rideId ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={[styles.requestButtonText, { color: '#FFF', fontFamily: getFontFamily('bold', isRTL) }]}>
                            {t('ride.accept', 'Accept')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const RideRequestsListScreen = ({ navigation }: any) => {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const {
        isOnline,
        isLoading,
        connectionState,
        incomingRideRequest,
        activeRide,
        rideRequests,
        acceptIncomingRide,
        rejectIncomingRide,
    } = useRide();
    const { isRTL: contextRTL } = useLanguage();
    const isRTL = contextRTL || i18n.language === 'ur';

    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const isConnected = connectionState === 'Connected';
    const isReconnecting = connectionState === 'Reconnecting';

    const handleAcceptRide = async (ride: any) => {
        try {
            setAcceptingId(ride.rideId);
            await acceptIncomingRide(ride);
        } catch (e) {
            console.warn('[RideRequestsList] Accept failed:', e);
        } finally {
            setAcceptingId(null);
        }
    };

    const handleRejectRide = async (ride: any) => {
        try {
            setRejectingId(ride.rideId);
            await rejectIncomingRide(ride);
        } catch (e) {
            console.warn('[RideRequestsList] Reject failed:', e);
        } finally {
            setRejectingId(null);
        }
    };

    // ── OFFLINE ────────────────────────────────────────────────────────────
    if (!isOnline) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={t('dashboard.myRides')} showBack={true} />
                <View style={styles.centerContent}>
                    <WifiOff size={72} color={COLORS.textSecondary} opacity={0.3} />
                    <Text style={[styles.bigLabel, { fontFamily: getFontFamily('semibold', isRTL) }]}>
                        {t('dashboard.offline')}
                    </Text>
                    <Text style={[styles.subLabel, { fontFamily: getFontFamily('regular', isRTL) }]}>
                        {t('ride.goOnlineFirst')}
                    </Text>
                    <TouchableOpacity
                        style={[styles.goHomeBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'DashboardTab' })}
                    >
                        <Text style={[styles.goHomeBtnText, { fontFamily: getFontFamily('semibold', isRTL) }]}>
                            {t('common.goBack')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ── CONNECTING / LOADING ───────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={t('dashboard.myRides')} showBack={true} />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.subLabel, { marginTop: 20, fontFamily: getFontFamily('regular', isRTL) }]}>
                        {t('common.loading')}
                    </Text>
                </View>
            </View>
        );
    }

    // ── ACTIVE CONFIRMED RIDE ──────────────────────────────────────────────
    if (activeRide && (activeRide.status === 'confirmed' || activeRide.status === 'approaching' || activeRide.status === 'arrived' || activeRide.status === 'in_progress')) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={t('dashboard.myRides')} showBack={true} />
                <View style={styles.centerContent}>
                    <View style={styles.confirmedCard}>
                        <View style={styles.confirmedIconRing}>
                            <Navigation color={COLORS.white} size={32} />
                        </View>
                        <Text style={[styles.bigLabel, { color: COLORS.success, fontFamily: getFontFamily('bold', isRTL) }]}>
                            {t('ride.rideConfirmed')}
                        </Text>
                        <Text style={[styles.subLabel, { fontFamily: getFontFamily('regular', isRTL) }]}>
                            {activeRide.customerName || 'Customer'}
                        </Text>
                        <TouchableOpacity
                            style={[styles.navBtn, { backgroundColor: COLORS.success }]}
                            onPress={() => navigation.navigate('NavigationRide')}
                        >
                            <Navigation color={COLORS.white} size={20} />
                            <Text style={[styles.navBtnText, { fontFamily: getFontFamily('semibold', isRTL) }]}>
                                {t('ride.navigation')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // ── ACCEPTED — WAITING FOR CUSTOMER SELECTION ──────────────────────────
    if (activeRide && activeRide.status === 'accepted') {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={t('dashboard.myRides')} showBack={true} />
                <View style={styles.centerContent}>
                    <View style={styles.waitingCard}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.bigLabel, { marginTop: 20, fontFamily: getFontFamily('semibold', isRTL) }]}>
                            {t('ride.waitingForSelection')}
                        </Text>
                        <Text style={[styles.subLabel, { fontFamily: getFontFamily('regular', isRTL) }]}>
                            {t('ride.waitingForCustomer')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    // ── MAIN: INCOMING RIDE REQUESTS LIST ─────────────────────────────────
    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background || '#F8F9FA' }]}>
            <Header title={t('dashboard.myRides')} showBack={true} />

            {/* Connection status bar */}
            <View
                style={[
                    styles.statusBar,
                    {
                        backgroundColor: isConnected ? '#ECFDF5' : isReconnecting ? '#FFFBEB' : '#FEF2F2',
                        borderColor: isConnected ? COLORS.success : isReconnecting ? '#F59E0B' : '#EF4444',
                    },
                ]}
            >
                {isConnected
                    ? <Wifi size={14} color={COLORS.success} />
                    : <WifiOff size={14} color={isReconnecting ? '#F59E0B' : '#EF4444'} />}
                <Text
                    style={[
                        styles.statusBarText,
                        {
                            color: isConnected ? COLORS.success : isReconnecting ? '#F59E0B' : '#EF4444',
                            fontFamily: getFontFamily('semibold', isRTL),
                        },
                    ]}
                >
                    {isConnected
                        ? t('dashboard.connected')
                        : isReconnecting
                        ? t('dashboard.reconnecting')
                        : t('dashboard.disconnected')}
                </Text>
                {rideRequests.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.countBadgeText}>{rideRequests.length}</Text>
                    </View>
                )}
            </View>

            {/* ── RIDES LIST ─────────────────────────────── */}
            {rideRequests.length > 0 ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: getFontFamily('bold', isRTL), marginBottom: 12 }]}>
                        {t('dashboard.incomingRequests', 'Incoming Ride Requests')} ({rideRequests.length})
                    </Text>

                    {rideRequests.map((ride: any) => (
                        <RideCard
                            key={ride.rideId}
                            ride={ride}
                            navigation={navigation}
                            onAccept={handleAcceptRide}
                            onReject={handleRejectRide}
                            acceptingId={acceptingId}
                            rejectingId={rejectingId}
                            theme={theme}
                            isRTL={isRTL}
                        />
                    ))}
                </ScrollView>
            ) : (
                /* ── EMPTY: Waiting for rides ────────────── */
                <View style={styles.centerContent}>
                    <View style={styles.waitingRing}>
                        <PulseDot color={theme.primary} />
                        <View style={[styles.waitingRingOuter, { borderColor: theme.primary }]} />
                    </View>

                    <View style={[styles.bikeIconBg, { backgroundColor: `${theme.primary}15` }]}>
                        <Bike size={48} color={theme.primary} />
                    </View>

                    <Text style={[styles.bigLabel, { fontFamily: getFontFamily('bold', isRTL) }]}>
                        {t('dashboard.online')}
                    </Text>
                    <Text style={[styles.subLabel, { fontFamily: getFontFamily('regular', isRTL), textAlign: 'center' }]}>
                        {t('ride.waitingOnline')}
                    </Text>

                    {incomingRideRequest && (
                        <View style={[styles.incomingPill, { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }]}>
                            <Clock size={14} color={theme.primary} />
                            <Text style={[styles.incomingPillText, { fontFamily: getFontFamily('semibold', isRTL), color: theme.primary }]}>
                                {t('ride.newRideRequest')}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    statusBarText: {
        fontSize: 13,
        flex: 1,
    },
    countBadge: {
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    countBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 16,
    },
    // ── Ride request card ──
    requestCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    requestHeader: {
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    requestCustomerInfo: {
        flex: 1,
    },
    requestCustomerName: {
        fontSize: 16,
    },
    requestRating: {
        fontSize: 13,
    },
    requestFare: {
        fontSize: 18,
    },
    paymentBadge: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    paymentBadgeText: {
        fontSize: 11,
    },
    requestDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 10,
    },
    requestLocations: {
        marginBottom: 8,
    },
    requestLocationRow: {
        alignItems: 'center',
        gap: 8,
    },
    location线: {
        width: 1,
        height: 6,
        backgroundColor: '#D1D5DB',
        marginLeft: 5,
        marginVertical: 2,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 4,
    },
    requestLocationText: {
        fontSize: 13,
        flex: 1,
    },
    requestMeta: {
        alignItems: 'center',
        marginBottom: 12,
        gap: 4,
    },
    requestMetaText: {
        fontSize: 13,
    },
    requestActions: {
        gap: 10,
    },
    requestButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectButton: {
        borderWidth: 1.5,
        backgroundColor: 'transparent',
    },
    acceptButton: {
        elevation: 3,
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    requestButtonText: {
        fontSize: 15,
    },
    // ── Waiting state ──
    waitingRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    waitingRingOuter: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        opacity: 0.2,
    },
    bikeIconBg: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    bigLabel: {
        fontSize: 22,
        color: COLORS.text,
        marginBottom: 10,
        textAlign: 'center',
    },
    subLabel: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    incomingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    incomingPillText: {
        fontSize: 13,
    },
    // ── Active ride states ──
    confirmedCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 15,
        width: width - 48,
    },
    confirmedIconRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.success,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    waitingCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        width: width - 48,
    },
    navBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 16,
        marginTop: 20,
        elevation: 4,
        shadowColor: COLORS.success,
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    navBtnText: {
        color: COLORS.white,
        fontSize: 16,
    },
    goHomeBtn: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        elevation: 4,
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    goHomeBtnText: {
        color: COLORS.white,
        fontSize: 16,
    },
});

export default RideRequestsListScreen;
