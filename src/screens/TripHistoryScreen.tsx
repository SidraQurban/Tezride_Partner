import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '../utils/constants';
import {
    MapPin,
    Clock,
    CheckCircle,
    XCircle,
    WifiOff,
    RefreshCw,
    ChevronRight,
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import { useRide } from '../context/RideContext';
import { getFontFamily, getFontSize } from '../utils/layout';
import { ridesService } from '../services/rides';
import { sanitizeRideRecord, sanitizeHistoryItem, HistoryTripItem } from '../utils/rideSafety';
import {
    enrichHistoryTrips,
    buildFareLookupFromTransactions,
    looksLikeCoordinates,
} from '../utils/tripHistoryEnrichment';
import { responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

type TripItem = HistoryTripItem;

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    completed: { color: COLORS.success, label: 'Completed', icon: CheckCircle },
    cancelled: { color: '#EF4444', label: 'Cancelled', icon: XCircle },
    'cancelled by customer': { color: '#EF4444', label: 'Canceled by Customer', icon: XCircle },
    'cancelled by you': { color: '#EF4444', label: 'Canceled by You', icon: XCircle },
    started: { color: COLORS.primary, label: 'In Progress', icon: Clock },
    arrived: { color: COLORS.primary, label: 'Arrived', icon: Clock },
    accepted: { color: COLORS.primary, label: 'Accepted', icon: Clock },
};

const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
};

const formatLocationLabel = (address?: string, coords?: { lat: number; lon: number }): string => {
    // Prioritize actual address text if it exists and doesn't look like coordinates
    if (address && !looksLikeCoordinates(address)) {
        return address;
    }
    // If address looks like coordinates, try to show a more readable format
    if (address && looksLikeCoordinates(address)) {
        const parts = address.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lon = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lon)) {
                return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        }
        return address;
    }
    // Fallback to coordinates if no address
    if (coords) {
        return `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
    }
    return '—';
};

const formatFareLabel = (fare: number | undefined, currency: string): string => {
    if (fare != null && fare > 0) {
        return `${currency} ${Math.round(fare).toLocaleString()}`;
    }
    return '—';
};

const formatRideDuration = (item: any): string => {
    // Try to get duration from various possible fields
    const duration = item.duration || item.rideDuration || item.tripDuration;
    if (duration && typeof duration === 'number') {
        if (duration < 60) {
            return `${Math.round(duration)} min`;
        }
        const hours = Math.floor(duration / 60);
        const mins = Math.round(duration % 60);
        if (hours > 0 && mins > 0) {
            return `${hours}h ${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
    }

    // Calculate from start and end times if available
    if (item.startedAt && item.completedAt) {
        const start = new Date(item.startedAt).getTime();
        const end = new Date(item.completedAt).getTime();
        const diffMinutes = Math.round((end - start) / 60000);
        if (diffMinutes > 0) {
            if (diffMinutes < 60) {
                return `${diffMinutes} min`;
            }
            const hours = Math.floor(diffMinutes / 60);
            const mins = diffMinutes % 60;
            if (hours > 0 && mins > 0) {
                return `${hours}h ${mins}m`;
            } else if (hours > 0) {
                return `${hours}h`;
            }
        }
    }

    return '—';
};

// ── Payment method color ────────────────────────────────────────────────────
const paymentColor = (method?: string) => {
    if (!method) return '#9CA3AF';
    const low = method.toLowerCase();
    if (low.includes('wallet')) return '#8B5CF6';
    if (low.includes('digital')) return '#10B981';
    return '#F59E0B'; // cash
};

// ── Memoized Trip Card ──────────────────────────────────────────────────────
const TripCard = React.memo(({ item, isRTL, t, isFemale, onPress, onViewMap }: any) => {
    const rid = item.rideId || item.id;
    const cfg = statusConfig[item.status] || { color: '#9CA3AF', label: item.status, icon: Clock };
    const primaryColor = isFemale ? '#FF69B4' : COLORS.primary;
    if (isFemale && ['started', 'arrived', 'accepted'].includes(item.status)) {
        cfg.color = primaryColor;
    }
    const StatusIcon = cfg.icon;

    // Extract addresses from various possible fields
    const pickupAddress = item.pickupAddress ||
        (item.pickup && typeof item.pickup === 'object' ? item.pickup.address : null) ||
        (item.pickup && typeof item.pickup === 'object' ? item.pickup.Address : null);
    const dropoffAddress = item.dropoffAddress ||
        (item.dropoff && typeof item.dropoff === 'object' ? item.dropoff.address : null) ||
        (item.dropoff && typeof item.dropoff === 'object' ? item.dropoff.Address : null);

    const pickupText = formatLocationLabel(pickupAddress, item.pickup);
    const dropoffText = formatLocationLabel(dropoffAddress, item.dropoff);

    // Check if we have coordinates to show the map button
    const hasCoords = !!(
        item.pickup?.lat && item.pickup?.lon &&
        item.dropoff?.lat && item.dropoff?.lon
    );

    const pmColor = paymentColor(item.paymentMethod);
    const pmLabel = item.paymentMethod || 'Cash';

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            {/* Header */}
            <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                <View style={[styles.bikeBadge, { backgroundColor: primaryColor + '18' }]}>
                    <Image source={require('../assets/superbike.png')} style={{ width: 26, height: 26, tintColor: primaryColor }} />
                </View>
                <View style={[styles.headerInfo, { alignItems: 'flex-start' }]}>
                    <Text style={[styles.rideId, { textAlign: 'left', fontSize: getFontSize(12, isRTL) }]}>#{(rid || '').toString().slice(0, 8)}</Text>
                    <Text style={[styles.fare, { textAlign: 'left', fontSize: getFontSize(18, isRTL) }]}>
                        {formatFareLabel(item.fare, t('common.currency', 'PKR'))}
                    </Text>
                </View>
                <View style={styles.rightColumn}>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
                        <StatusIcon color={cfg.color} size={13} />
                        <Text style={[styles.statusText, { color: cfg.color, fontSize: getFontSize(11, isRTL) }]}>{cfg.label}</Text>
                    </View>
                    {/* Payment Method Badge */}
                    <View style={[styles.paymentBadge, { backgroundColor: pmColor + '18', borderColor: pmColor + '40' }]}>
                        <Text style={[styles.paymentBadgeText, { color: pmColor }]}>{pmLabel.toUpperCase()}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.divider} />

            {/* Route */}
            <View style={styles.routeContainer}>
                <View style={[styles.locRow, { flexDirection: 'row' }]}>
                    <View style={[styles.dot, { backgroundColor: COLORS.success, marginRight: 10 }]} />
                    <View style={[styles.locTextWrap, { alignItems: 'flex-start' }]}>
                        <Text style={[styles.locLabel, { textAlign: 'left', fontSize: getFontSize(10, isRTL) }]}>PICKUP</Text>
                        <Text style={[styles.locText, { textAlign: 'left', fontSize: getFontSize(13, isRTL) }]} numberOfLines={1}>{pickupText}</Text>
                    </View>
                </View>
                <View style={[styles.routeLine, { alignSelf: 'flex-start', marginLeft: 5 }]} />
                <View style={[styles.locRow, { flexDirection: 'row' }]}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444', marginRight: 10 }]} />
                    <View style={[styles.locTextWrap, { alignItems: 'flex-start' }]}>
                        <Text style={[styles.locLabel, { textAlign: 'left', fontSize: getFontSize(10, isRTL) }]}>DROPOFF</Text>
                        <Text style={[styles.locText, { textAlign: 'left', fontSize: getFontSize(13, isRTL) }]} numberOfLines={1}>{dropoffText}</Text>
                    </View>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                {item.distance ? (
                    <View style={styles.statChip}>
                        <MapPin size={12} color={primaryColor} />
                        <Text style={[styles.statChipText, { color: primaryColor }]}>{item.distance.toFixed(1)} km</Text>
                    </View>
                ) : null}
                {item.duration ? (
                    <View style={styles.statChip}>
                        <Clock size={12} color={COLORS.textSecondary} />
                        <Text style={[styles.statChipText, { color: COLORS.textSecondary }]}>{formatRideDuration(item)}</Text>
                    </View>
                ) : null}
                {hasCoords && (
                    <TouchableOpacity
                        style={[styles.mapBtn, { borderColor: primaryColor, backgroundColor: primaryColor + '12' }]}
                        onPress={onViewMap}
                        activeOpacity={0.75}
                    >
                        <MapPin size={12} color={primaryColor} />
                        <Text style={[styles.mapBtnText, { color: primaryColor }]}>View Map</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Footer */}
            <View style={[styles.cardFooter, { flexDirection: 'row' }]}>
                <View style={[styles.footerLeft, { flexDirection: 'row' }]}>
                    <Clock color={COLORS.textSecondary} size={13} />
                    <Text style={[styles.dateText, { fontSize: getFontSize(12, isRTL) }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <ChevronRight color={COLORS.textSecondary} size={16} />
            </View>
        </TouchableOpacity>
    );
});

// ── Screen ──────────────────────────────────────────────────────────────────
const TripHistoryScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { isFemale } = useTheme();
    const { activeRide } = useRide();
    const safeActiveRide = React.useMemo(() => sanitizeRideRecord(activeRide), [activeRide]);

    const [trips, setTrips] = useState<TripItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [pageIndex, setPageIndex] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchHistory = useCallback(async (page = 1, isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else if (page > 1) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError('');

        try {
            // We fetch history directly as it now contains finalCost.
            const historyResponse = await ridesService.getRiderHistory({ pageIndex: page, pageSize: 15 });

            const historyResult = historyResponse.data;
            const payload = historyResult?.data ?? historyResult ?? [];
            const list = Array.isArray(payload) ? payload : (payload?.items ?? payload?.rides ?? []);

            // Pagination metadata from shared PagedResponse
            const hasNext = historyResult?.hasNextPage ?? false;
            setHasNextPage(hasNext);
            setPageIndex(page);

            const fetchedTrips = list.map((entry: any) => sanitizeHistoryItem(entry));
            const cleanTrips = fetchedTrips.filter((t: any) => t != null) as TripItem[];

            if (page === 1) {
                setTrips(cleanTrips);
            } else {
                setTrips(prev => [...prev, ...cleanTrips]);
            }

            // Perform background geocoding/enrichment asynchronously so results appear instantly
            const tripRawPairs = cleanTrips.map((trip, idx) => {
                const rawEntry = list.find((e: any) => String(e.rideId ?? e.id) === String(trip.rideId ?? trip.id)) || list[idx];
                return { trip, raw: rawEntry };
            });

            enrichHistoryTrips(tripRawPairs).then(enriched => {
                setTrips(prev => {
                    return prev.map(existingTrip => {
                        const matchingEnriched = enriched.find(et => String(et.rideId ?? et.id) === String(existingTrip.rideId ?? existingTrip.id));
                        if (matchingEnriched) {
                            // Ensure we use the enriched addresses
                            return {
                                ...existingTrip,
                                ...matchingEnriched,
                                pickupAddress: matchingEnriched.pickupAddress || existingTrip.pickupAddress,
                                dropoffAddress: matchingEnriched.dropoffAddress || existingTrip.dropoffAddress
                            };
                        }
                        return existingTrip;
                    });
                });
            }).catch(err => {
                console.warn('[TripHistory] Background enrichment failed:', err);
            });
        } catch (err: any) {
            console.warn('[TripHistory] API failed:', err?.message);
            if (err?.response?.status !== 404) {
                setError('Could not load trip history.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [t]);

    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasNextPage) {
            fetchHistory(pageIndex + 1);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const renderTripCard = useCallback(({ item }: { item: TripItem }) => (
        <TripCard
            item={item}
            isRTL={isRTL}
            t={t}
            isFemale={isFemale}
            onPress={() => navigation.navigate('TripHistoryDetail', { trip: item })}
            onViewMap={() => navigation.navigate('TripHistoryDetail', { trip: item, autoOpenMap: true })}
        />
    ), [isRTL, t, isFemale, navigation]);

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Image source={require('../assets/superbike.png')} style={{ width: 72, height: 72, tintColor: COLORS.border, opacity: 0.3 }} />
            <Text style={[styles.emptyTitle, { fontFamily: getFontFamily('semibold', isRTL) }]}>
                No Trips Yet
            </Text>
            <Text style={[styles.emptySubtitle, { fontFamily: getFontFamily('regular', isRTL), textAlign: 'center' }]}>
                {error || 'Complete your first ride to see it here!'}
            </Text>
            {error ? (
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchHistory()}>
                    <RefreshCw color={COLORS.white} size={16} />
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('navigation.trips', 'My Trips')} showBack={true} />
            <View style={{ paddingHorizontal: responsiveWidth(5), marginTop: responsiveHeight(1) }}>
                <Text style={{ fontSize: getFontSize(16, isRTL), fontFamily: getFontFamily('semibold', isRTL) }}>
                    My Trips
                </Text>
            </View>
            {/* Active ride banner */}
            {safeActiveRide && (
                <TouchableOpacity
                    style={styles.activeRideBanner}
                    onPress={() => navigation.navigate('NavigationRide')}
                >
                    <View style={styles.activePulse} />
                    <Text style={styles.activeRideText}>Ride in progress — tap to continue</Text>
                    <ChevronRight color={COLORS.primary} size={16} />
                </TouchableOpacity>
            )}

            {loading ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={isFemale ? '#FF69B4' : COLORS.primary} />
                    <Text style={styles.loadingText}>Loading trips and locations...</Text>
                </View>
            ) : (
                <FlatList
                    data={trips}
                    renderItem={renderTripCard}
                    keyExtractor={(item) => (item.rideId || item.id || Math.random().toString())}
                    contentContainerStyle={[
                        styles.listContent,
                        trips.length === 0 && { flex: 1 },
                        { paddingBottom: insets.bottom + 90 },
                    ]}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchHistory(1, true)}
                            tintColor={COLORS.primary}
                            colors={[COLORS.primary]}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => (
                        loadingMore ? <ActivityIndicator size="small" color={isFemale ? '#FF69B4' : COLORS.primary} style={{ marginVertical: 20 }} /> : null
                    )}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={Platform.OS === 'android'}
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    listContent: { padding: 16 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    cardHeader: { alignItems: 'center', marginBottom: 14 },
    bikeBadge: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: { flex: 1, marginHorizontal: 12 },
    rightColumn: { alignItems: 'flex-end', gap: 6 },
    rideId: { fontSize: 12, color: COLORS.textSecondary, fontFamily: 'Poppins_400Regular' },
    fare: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: COLORS.text, marginTop: 2 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
    },
    paymentBadgeText: { fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },
    routeContainer: { marginBottom: 12 },
    locRow: { alignItems: 'center' },
    dot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
    routeLine: {
        width: 2,
        height: 14,
        backgroundColor: '#E5E7EB',
        marginLeft: 4,
        marginVertical: 3,
    },
    locTextWrap: { flex: 1 },
    locLabel: {
        fontSize: 9,
        color: COLORS.textSecondary,
        fontFamily: 'Poppins_600SemiBold',
        letterSpacing: 1,
        marginBottom: 2,
    },
    locText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: COLORS.text },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statChipText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    mapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        marginLeft: 'auto',
    },
    mapBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    cardFooter: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    footerLeft: { alignItems: 'center', gap: 6 },
    dateText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: COLORS.textSecondary },
    loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
    loadingText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: COLORS.textSecondary },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 20, color: COLORS.text, marginTop: 20 },
    emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, lineHeight: 22 },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 14,
    },
    retryText: { color: COLORS.white, fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
    activeRideBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '15',
        borderColor: COLORS.primary + '40',
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 14,
        padding: 14,
        gap: 10,
    },
    activePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
    activeRideText: { flex: 1, fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: COLORS.primary },
});

export default TripHistoryScreen;
