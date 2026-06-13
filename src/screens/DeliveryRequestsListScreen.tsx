import React, { useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
    Linking,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '../utils/constants';
import { Truck, MapPin, Clock, ChevronRight, ChevronLeft, WifiOff } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import Header from '../components/Header';
import { useRide } from '../context/RideContext';
import { getFontFamily } from '../utils/layout';

const { width } = Dimensions.get('window');

// ── Memoized Item Component ──────────────────────────────────────────────────
interface DeliveryItemProps {
    item: any;
    isRTL: boolean;
    t: any;
    accepting: string | null;
    rejecting: string | null;
    onAccept: (item: any) => void;
    onReject: (item: any) => void;
    navigation: any;
}

const DeliveryRequestItem = React.memo(({ item, isRTL, t, accepting, rejecting, onAccept, onReject, navigation }: DeliveryItemProps) => {
    if (!item?.rideId) return null;
    const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;
    const now = Date.now();
    const elapsed = Math.floor((now - (item.timestamp || now)) / 1000);
    const remaining = Math.max(0, (item.timeoutSec || 15) - elapsed);
    const isAccepting = accepting === item.rideId;
    const isRejecting = rejecting === item.rideId;
    const isBusy = isAccepting || isRejecting;
    const pickupLat = item.pickup?.lat ?? 0;
    const pickupLon = item.pickup?.lon ?? 0;
    const dropoffLat = item.dropoff?.lat ?? 0;
    const dropoffLon = item.dropoff?.lon ?? 0;

    return (
        <View style={styles.card}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    try { navigation.navigate('RideMapScreen', { ride: item }); } catch { }
                }}
            >
                <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.iconBadge, { backgroundColor: '#FFF7ED' }]}>
                        <Truck color="#F97316" size={24} />
                    </View>
                    <View style={[styles.headerInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text style={styles.requestId}>#{String(item.rideId).slice(0, 8)}</Text>
                        <Text style={styles.fareText}>{t('common.currency')} —</Text>
                    </View>
                    <View style={[styles.timeBadge, { backgroundColor: remaining <= 5 ? '#FEE2E2' : '#FFF7ED' }]}>
                        <Clock size={12} color={remaining <= 5 ? '#EF4444' : '#F97316'} />
                        <Text style={[styles.timeText, { color: remaining <= 5 ? '#EF4444' : '#F97316' }]}>{remaining}s</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.locationContainer}>
                    <View style={[styles.locationRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <MapPin size={16} color={COLORS.success} />
                        <Text style={[styles.locationText, { textAlign: isRTL ? 'right' : 'left', marginHorizontal: 8 }]} numberOfLines={2}>
                            {item.pickupAddress || (pickupLat !== 0 ? `${pickupLat.toFixed(5)}, ${pickupLon.toFixed(5)}` : 'Loading...')}
                        </Text>
                    </View>
                    <View style={[styles.locationRow, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 10 }]}>
                        <MapPin size={16} color="#EF4444" />
                        <Text style={[styles.locationText, { textAlign: isRTL ? 'right' : 'left', marginHorizontal: 8 }]} numberOfLines={2}>
                            {item.dropoffAddress || (dropoffLat !== 0 ? `${dropoffLat.toFixed(5)}, ${dropoffLon.toFixed(5)}` : 'Loading...')}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            <View style={[styles.cardActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                    style={[styles.rejectButton, isBusy && { opacity: 0.6 }]}
                    onPress={() => onReject(item)}
                    disabled={isBusy}
                    activeOpacity={0.7}
                >
                    {isRejecting
                        ? <ActivityIndicator size="small" color="#6B7280" />
                        : <Text style={styles.rejectButtonText}>{t('ride.decline')}</Text>
                    }
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.acceptButton, isBusy && { opacity: 0.6 }]}
                    onPress={() => onAccept(item)}
                    disabled={isBusy}
                    activeOpacity={0.7}
                >
                    {isAccepting
                        ? <ActivityIndicator size="small" color={COLORS.white} />
                        : <Text style={styles.acceptButtonText}>{t('ride.accept')}</Text>
                    }
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.cardFooter, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                onPress={() => {
                    if (pickupLat === 0) return;
                    const url = Platform.select({
                        ios: `maps:0,0?q=${pickupLat},${pickupLon}`,
                        android: `geo:0,0?q=${pickupLat},${pickupLon}(Pickup)`,
                    });
                    if (url) Linking.openURL(url).catch(() => { });
                }}
            >
                <Text style={styles.viewDetailsText}>{t('ride.viewOnMap')}</Text>
                <ChevronIcon color="#F97316" size={18} />
            </TouchableOpacity>
        </View>
    );
});

const DeliveryRequestsListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { isOnline, isLoading, rideRequests, acceptIncomingRide, rejectIncomingRide, activeRide } = useRide();

    const isMountedRef = useRef(true);
    const [accepting, setAccepting] = React.useState<string | null>(null);
    const [rejecting, setRejecting] = React.useState<string | null>(null);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Navigate when ride is confirmed
    useEffect(() => {
        if (!isMountedRef.current) return;
        if (activeRide?.status === 'confirmed') {
            navigation.navigate('NavigationRide');
        }
    }, [activeRide?.status, navigation]);

    const deliveryRequests = rideRequests.filter((r: any) => r?.type === 'delivery');

    const handleAccept = useCallback(async (item: any) => {
        const rideId = item?.rideId;
        if (!rideId || accepting || !isMountedRef.current) return;
        setAccepting(rideId);
        try { await acceptIncomingRide(item); }
        catch (err) { console.error('[DeliveryList] Accept error:', err); }
        finally { if (isMountedRef.current) setAccepting(null); }
    }, [acceptIncomingRide, accepting]);

    const handleReject = useCallback(async (item: any) => {
        const rideId = item?.rideId;
        if (!rideId || rejecting || !isMountedRef.current) return;
        setRejecting(rideId);
        try { await rejectIncomingRide(item); }
        catch (err) { console.error('[DeliveryList] Reject error:', err); }
        finally { if (isMountedRef.current) setRejecting(null); }
    }, [rejectIncomingRide, rejecting]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <DeliveryRequestItem
            item={item}
            isRTL={isRTL}
            t={t}
            accepting={accepting}
            rejecting={rejecting}
            onAccept={handleAccept}
            onReject={handleReject}
            navigation={navigation}
        />
    ), [isRTL, t, accepting, rejecting, handleAccept, handleReject, navigation]);

    const keyExtractor = useCallback((item: any) => item?.rideId || String(Math.random()), []);

    if (!isOnline) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={t('dashboard.deliveries')} showBack={true} />
                <View style={styles.emptyContainer}>
                    <WifiOff size={64} color={COLORS.textSecondary} opacity={0.3} />
                    <Text style={[styles.emptyText, { fontFamily: getFontFamily('medium', isRTL) }]}>
                        {t('dashboard.offlineDesc')}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackText}>{t('common.goBack')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('dashboard.deliveries')} showBack={true} />

            {isLoading && deliveryRequests.length === 0 ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            ) : activeRide?.status === 'accepted' ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                    <Text style={{ marginTop: 10, color: '#F97316', fontFamily: 'Poppins_600SemiBold' }}>
                        {t('ride.waitingForSelection', 'Waiting for confirmation...')}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={deliveryRequests}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[
                        styles.listContent,
                        deliveryRequests.length === 0 && styles.emptyListContent,
                    ]}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    updateCellsBatchingPeriod={50}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Truck size={64} color={COLORS.textSecondary} opacity={0.2} />
                            <Text style={styles.emptyText}>{t('ride.noRequests')}</Text>
                            <Text style={styles.emptySubText}>Delivery requests appear here when you are online</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    cardHeader: {
        alignItems: 'center',
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginHorizontal: 12,
    },
    requestId: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    fareText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: {
        fontSize: 12,
        color: '#F97316',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 12,
    },
    locationContainer: {
        marginBottom: 12,
    },
    locationRow: {
        alignItems: 'center',
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 6,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 5,
        marginBottom: 5,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#F97316',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: COLORS.white,
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
    },
    rejectButton: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    rejectButtonText: {
        color: '#6B7280',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
    },
    viewDetailsText: {
        fontSize: 13,
        color: '#F97316',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 120,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginTop: 12,
    },
    goBackText: {
        color: '#F97316',
        marginTop: 12,
        fontSize: 15,
        fontWeight: '600',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyListContent: {
        flex: 1,
    },
    emptySubText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 20,
        opacity: 0.7,
    },
});

export default DeliveryRequestsListScreen;
