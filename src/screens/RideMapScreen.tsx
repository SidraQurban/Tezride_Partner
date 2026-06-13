import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import {
    MapPin,
    ArrowLeft,
    Navigation as NavIcon,
    Clock,
    Hourglass,
    Star,
    CreditCard,
    Wallet,
    Banknote,
} from 'lucide-react-native';
import MapScreen from '../components/Map/MapScreen';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useRide } from '../context/RideContext';
import { getFontFamily } from '../utils/layout';

const { width, height } = Dimensions.get('window');

/** Normalize a coordinate object from {lat,lon} or {latitude,longitude} to {latitude, longitude} */
const normalizeCoord = (raw: any): { latitude: number; longitude: number } | null => {
    if (!raw) return null;
    const lat = raw.latitude ?? raw.lat;
    const lon = raw.longitude ?? raw.lon;
    if (lat == null || lon == null) return null;
    return { latitude: Number(lat), longitude: Number(lon) };
};

const paymentIcon = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('wallet'))  return <Wallet size={14} color="#6366F1" />;
    if (m.includes('digital')) return <CreditCard size={14} color="#10B981" />;
    return <Banknote size={14} color="#F59E0B" />;
};

const paymentColor = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('wallet'))  return '#6366F1';
    if (m.includes('digital')) return '#10B981';
    return '#F59E0B';
};

const RideMapScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage();
    const { acceptIncomingRide, rejectIncomingRide, activeRide } = useRide();
    const { theme } = useTheme();
    const mapRef = useRef<any>(null);
    const { ride } = route.params || {};

    const [accepting, setAccepting] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    // Normalize pickup/dropoff regardless of which field names are used
    const pickup  = normalizeCoord(ride?.pickupCoords  ?? ride?.pickup);
    const dropoff = normalizeCoord(ride?.dropoffCoords ?? ride?.dropoff ?? ride?.drop);

    const isAcceptedRide = activeRide?.status === 'accepted';

    // Navigate when ride is confirmed
    useEffect(() => {
        if (activeRide?.status === 'confirmed') {
            navigation.replace('NavigationRide');
        }
    }, [activeRide?.status, navigation]);

    const fitToMarkers = () => {
        if (mapRef.current && pickup && dropoff) {
            const bottomPad = Math.min(450, Math.round(height * 0.48));
            mapRef.current.fitToCoordinates([pickup, dropoff], {
                edgePadding: { top: 150, right: 60, bottom: bottomPad, left: 60 },
                animated: true,
            });
        }
    };

    const handleAccept = async () => {
        if (accepting || rejecting) return;
        try {
            setAccepting(true);
            await acceptIncomingRide(ride);
        } catch (err) {
            console.error('Accept ride error:', err);
        } finally {
            setAccepting(false);
        }
    };

    const handleReject = async () => {
        if (accepting || rejecting) return;
        try {
            setRejecting(true);
            await rejectIncomingRide(ride);
            if (navigation.canGoBack?.()) navigation.goBack();
        } catch (err) {
            console.error('Reject ride error:', err);
        } finally {
            setRejecting(false);
        }
    };

    if (!ride || !pickup || !dropoff) {
        return (
            <SafeAreaView style={styles.errorContainer}>
                <MapPin size={48} color={COLORS.error} />
                <Text style={[styles.errorText, { marginTop: 16 }]}>
                    {t('ride.invalidRideData', 'Invalid Ride Data')}
                </Text>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center', paddingHorizontal: 32 }}>
                    Missing pickup or dropoff coordinates.
                </Text>
                <TouchableOpacity
                    onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'DashboardTab' })}
                    style={[styles.backBtn, { backgroundColor: theme.primary }]}
                >
                    <Text style={styles.backBtnText}>{t('common.goBack', 'Go Back')}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ── ACCEPTED (waiting for customer selection) ──────────────────────────
    if (isAcceptedRide) {
        return (
            <View style={styles.container}>
                <MapScreen
                    pickupLocation={pickup}
                    dropoffLocation={dropoff}
                    rideStatus="waiting"
                    style={styles.map}
                />
                <View style={styles.darkOverlay} />
                <View style={styles.centeredCardContainer}>
                    <View style={styles.dialogCard}>
                        <View style={styles.hourglassCircle}>
                            <Hourglass color="#B45309" size={28} />
                        </View>
                        <Text style={[styles.dialogTitle, { fontFamily: getFontFamily('semibold', isRTL) }]}>
                            {t('ride.rideAccepted', 'Ride Accepted')}
                        </Text>
                        <Text style={[styles.dialogSubtitle, { fontFamily: getFontFamily('regular', isRTL) }]}>
                            {t('ride.waitingForCustomer', 'Customer is choosing a driver')}{'\n'}
                            {t('ride.pleasewait', 'Please wait...')}
                        </Text>
                        <View style={styles.waitingDotIndicator}>
                            <View style={styles.waitingDot} />
                            <View style={styles.waitingDot} />
                            <View style={styles.waitingDot} />
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    const pColor = paymentColor(ride?.paymentMethod || '');

    // ── MAIN MAP VIEW ──────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Back button */}
            <TouchableOpacity
                style={[styles.backButton, { left: isRTL ? undefined : 16, right: isRTL ? 16 : undefined }]}
                onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'DashboardTab' })}
            >
                <ArrowLeft color={COLORS.text} size={22} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
            </TouchableOpacity>

            {/* Map with pickup/dropoff markers */}
            <MapScreen
                pickupLocation={pickup}
                dropoffLocation={dropoff}
                rideStatus="arrived"
                style={styles.map}
            />

            {/* Bottom Card */}
            <View style={styles.bottomCard}>
                <View style={styles.dragHandle} />

                {/* ── Customer row ─────────────────────── */}
                <View style={[styles.customerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.customerName, { fontFamily: getFontFamily('bold', isRTL) }]}>
                            {ride?.customerName || 'Customer'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Star size={13} color="#F59E0B" fill="#F59E0B" />
                            <Text style={[styles.ratingText, { fontFamily: getFontFamily('medium', isRTL) }]}>
                                {' '}{ride?.customerRating?.toFixed(1) || '5.0'}
                            </Text>
                        </View>
                    </View>

                    {/* Fare */}
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.fareValue, { fontFamily: getFontFamily('bold', isRTL) }]}>
                            PKR {ride?.fare || '—'}
                        </Text>
                        <View style={[styles.paymentChip, { backgroundColor: pColor + '18' }]}>
                            {paymentIcon(ride?.paymentMethod || '')}
                            <Text style={[styles.paymentChipText, { color: pColor, fontFamily: getFontFamily('semibold', isRTL), marginLeft: 4 }]}>
                                {String(ride?.paymentMethod || 'Cash').toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Stats row: distance + duration ──── */}
                {(ride?.distance != null || ride?.duration != null) && (
                    <View style={styles.statsRow}>
                        {ride?.distance != null && (
                            <View style={styles.statItem}>
                                <MapPin size={13} color={COLORS.textSecondary} />
                                <Text style={[styles.statText, { fontFamily: getFontFamily('medium', isRTL) }]}>
                                    {' '}{parseFloat(ride.distance).toFixed(1)} km
                                </Text>
                            </View>
                        )}
                        {ride?.distance != null && ride?.duration != null && (
                            <View style={styles.statDivider} />
                        )}
                        {ride?.duration != null && (
                            <View style={styles.statItem}>
                                <Clock size={13} color={COLORS.textSecondary} />
                                <Text style={[styles.statText, { fontFamily: getFontFamily('medium', isRTL) }]}>
                                    {' '}{Math.round(ride.duration)} min
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.divider} />

                {/* ── Addresses ─────────────────────────── */}
                <View style={styles.addressSection}>
                    {/* Pickup */}
                    <View style={[styles.addressItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={styles.dotContainer}>
                            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                            <View style={styles.vLine} />
                        </View>
                        <View style={[styles.addressTextContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                            <Text style={[styles.addressLabel, { fontFamily: getFontFamily('medium', isRTL) }]}>
                                {t('ride.pickup', 'PICKUP')}
                            </Text>
                            <Text style={[styles.addressText, { fontFamily: getFontFamily('semibold', isRTL) }]} numberOfLines={2}>
                                {ride?.pickupAddress || `${pickup.latitude.toFixed(5)}, ${pickup.longitude.toFixed(5)}`}
                            </Text>
                        </View>
                    </View>

                    {/* Dropoff */}
                    <View style={[styles.addressItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={styles.dotContainer}>
                            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        </View>
                        <View style={[styles.addressTextContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                            <Text style={[styles.addressLabel, { fontFamily: getFontFamily('medium', isRTL) }]}>
                                {t('ride.dropoff', 'DROPOFF')}
                            </Text>
                            <Text style={[styles.addressText, { fontFamily: getFontFamily('semibold', isRTL) }]} numberOfLines={2}>
                                {ride?.dropoffAddress || `${dropoff.latitude.toFixed(5)}, ${dropoff.longitude.toFixed(5)}`}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Reject / Accept buttons ────────────── */}
                <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity
                        style={[styles.rejectBtn, { borderColor: theme.error || '#EF4444' }]}
                        onPress={handleReject}
                        disabled={accepting || rejecting}
                    >
                        {rejecting
                            ? <ActivityIndicator size="small" color={theme.error || '#EF4444'} />
                            : <Text style={[styles.rejectBtnText, { color: theme.error || '#EF4444', fontFamily: getFontFamily('bold', isRTL) }]}>
                                {t('ride.reject', 'Reject')}
                              </Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                        onPress={handleAccept}
                        disabled={accepting || rejecting}
                    >
                        {accepting
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <>
                                <NavIcon color="#FFF" size={18} style={{ marginRight: 8 }} />
                                <Text style={[styles.acceptBtnText, { fontFamily: getFontFamily('bold', isRTL) }]}>
                                    {t('ride.accept', 'Accept')}
                                </Text>
                              </>
                        }
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    map: { width, height: height * 0.62 },
    backButton: {
        position: 'absolute',
        top: 52,
        zIndex: 10,
        backgroundColor: COLORS.white,
        padding: 12,
        borderRadius: 14,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 28,
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    dragHandle: {
        width: 40, height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    customerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    customerName: { fontSize: 17, color: COLORS.text },
    ratingText: { fontSize: 13, color: COLORS.textSecondary },
    fareValue: { fontSize: 20, color: COLORS.text },
    paymentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginTop: 4,
    },
    paymentChipText: { fontSize: 11 },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginBottom: 12,
        justifyContent: 'center',
    },
    statItem: { flexDirection: 'row', alignItems: 'center' },
    statText: { fontSize: 13, color: COLORS.textSecondary },
    statDivider: { width: 1, height: 16, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
    addressSection: { marginBottom: 16 },
    addressItem: { alignItems: 'flex-start', marginBottom: 10 },
    dotContainer: { width: 20, alignItems: 'center', marginTop: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    vLine: { width: 2, height: 22, backgroundColor: '#D1D5DB', marginVertical: 4 },
    addressTextContainer: { flex: 1, marginHorizontal: 12 },
    addressLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    addressText: { fontSize: 14, color: COLORS.text },
    actionRow: { gap: 10 },
    rejectBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectBtnText: { fontSize: 15 },
    acceptBtn: {
        flex: 2,
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    acceptBtnText: { color: '#FFF', fontSize: 16 },
    // Error state
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
    errorText: { fontSize: 18, color: COLORS.error },
    backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    backBtnText: { color: '#FFF', fontSize: 15 },
    // Accepted overlay
    darkOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.45)' },
    centeredCardContainer: {
        ...(StyleSheet.absoluteFill as object),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    dialogCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: COLORS.white,
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 12,
    },
    hourglassCircle: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#FEF3C7', marginBottom: 20,
    },
    dialogTitle: { fontSize: 22, color: COLORS.text, marginBottom: 10, textAlign: 'center' },
    dialogSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
    waitingDotIndicator: { flexDirection: 'row', marginTop: 20, justifyContent: 'center' },
    waitingDot: {
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: '#F59E0B', marginHorizontal: 5, opacity: 0.75,
    },
});

export default RideMapScreen;
