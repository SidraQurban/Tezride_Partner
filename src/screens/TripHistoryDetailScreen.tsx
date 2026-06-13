import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Image,
    Alert,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import { MapPin, ArrowLeft, Clock, Download, Navigation } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getFontFamily } from '../utils/layout';
import { decodePolyline } from '../utils/mapUtils';
import axios from 'axios';
import Header from '../components/Header';

import { Platform } from 'react-native';
let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
let PROVIDER_GOOGLE: any = undefined;

if (Platform.OS !== 'web') {
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
        Polyline = Maps.Polyline;
        PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    } catch (e) {
        console.warn('Native maps not available in TripHistoryDetailScreen');
    }
}

const { width, height } = Dimensions.get('window');

const TripHistoryDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();
    const mapRef = useRef<any>(null);
    const { trip } = route.params || {};

    const [routeCoords, setRouteCoords] = useState<any[]>([]);
    const [loadingMap, setLoadingMap] = useState(true);

    const pickup = trip?.pickup || (trip?.pickupCoords ? { latitude: trip.pickupCoords.lat, longitude: trip.pickupCoords.lon } : (trip?.pickupLatitude ? { latitude: trip.pickupLatitude, longitude: trip.pickupLongitude } : null));
    const dropoff = trip?.dropoff || (trip?.dropoffCoords ? { latitude: trip.dropoffCoords.lat, longitude: trip.dropoffCoords.lon } : (trip?.dropoffLatitude ? { latitude: trip.dropoffLatitude, longitude: trip.dropoffLongitude } : null));

    useEffect(() => {
        if (!pickup || !dropoff) {
            setLoadingMap(false);
            return;
        }
        fetchRoute();
    }, [pickup, dropoff]);

    const fetchRoute = async () => {
        try {
            setLoadingMap(true);
            const pickupLat = pickup.latitude || pickup.lat;
            const pickupLon = pickup.longitude || pickup.lon;
            const dropoffLat = dropoff.latitude || dropoff.lat;
            const dropoffLon = dropoff.longitude || dropoff.lon;

            const url = `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${dropoffLon},${dropoffLat}?overview=full&geometries=polyline`;
            const response = await axios.get(url);

            if (response.data.code === 'Ok' && response.data.routes.length > 0) {
                const points = decodePolyline(response.data.routes[0].geometry);
                setRouteCoords(points);
            } else {
                setRouteCoords([
                    { latitude: pickupLat, longitude: pickupLon },
                    { latitude: dropoffLat, longitude: dropoffLon }
                ]);
            }
        } catch (error) {
            console.error('Error fetching history route:', error);
            // fallback
            const pickupLat = pickup.latitude || pickup.lat;
            const pickupLon = pickup.longitude || pickup.lon;
            const dropoffLat = dropoff.latitude || dropoff.lat;
            const dropoffLon = dropoff.longitude || dropoff.lon;
            setRouteCoords([
                { latitude: pickupLat, longitude: pickupLon },
                { latitude: dropoffLat, longitude: dropoffLon }
            ]);
        } finally {
            setLoadingMap(false);
        }
    };

    const fitToMarkers = () => {
        if (mapRef.current && pickup && dropoff) {
            const pickupLat = pickup.latitude || pickup.lat;
            const pickupLon = pickup.longitude || pickup.lon;
            const dropoffLat = dropoff.latitude || dropoff.lat;
            const dropoffLon = dropoff.longitude || dropoff.lon;

            mapRef.current.fitToCoordinates([
                { latitude: pickupLat, longitude: pickupLon },
                { latitude: dropoffLat, longitude: dropoffLon }
            ], {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: true,
            });
        }
    };

    const handleDownloadReceipt = () => {
        Alert.alert("Success", "Trip receipt downloaded successfully!");
    };

    if (!trip) {
        return (
            <SafeAreaView style={[styles.container, styles.errorWrap]}>
                <Text style={styles.errorText}>No trip details found.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'DashboardTab' })}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const pickupLat = pickup?.latitude || pickup?.lat || 0;
    const pickupLon = pickup?.longitude || pickup?.lon || 0;
    const dropoffLat = dropoff?.latitude || dropoff?.lat || 0;
    const dropoffLon = dropoff?.longitude || dropoff?.lon || 0;

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <Header title={t('earnings.history', 'Trip Details')} showBack={true} />
            <ScrollView 
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >

            {/* Map Preview */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: pickupLat || 24.8607,
                        longitude: pickupLon || 67.0011,
                        latitudeDelta: 0.03,
                        longitudeDelta: 0.03,
                    }}
                    onLayout={fitToMarkers}
                >
                    {pickup && (
                        <Marker coordinate={{ latitude: pickupLat, longitude: pickupLon }} title="Pickup">
                            <View style={styles.markerOutline}>
                                <View style={[styles.markerCircle, { backgroundColor: '#10B981' }]} />
                            </View>
                        </Marker>
                    )}

                    {dropoff && (
                        <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLon }} title="Dropoff">
                            <View style={styles.markerOutline}>
                                <View style={[styles.markerCircle, { backgroundColor: '#EF4444' }]} />
                            </View>
                        </Marker>
                    )}

                    {routeCoords.length > 0 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor={theme.primary}
                            strokeWidth={5}
                        />
                    )}
                </MapView>

                {loadingMap && (
                    <View style={styles.mapLoader}>
                        <ActivityIndicator size="small" color="#FF991C" />
                    </View>
                )}
            </View>

            {/* Details Panel */}
            <View style={styles.detailsPanel}>
                {/* Timeline */}
                <View style={styles.timelineContainer}>
                    <View style={styles.timelineRow}>
                        <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                        <View style={styles.timelineTextWrap}>
                            <Text style={styles.timelineLabel}>Pickup</Text>
                            <Text style={styles.timelineAddress} numberOfLines={1}>
                                {trip.pickupAddress || 'Lucky One Mall'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.timelineLine} />

                    <View style={styles.timelineRow}>
                        <View style={[styles.timelineDot, { backgroundColor: '#EF4444' }]} />
                        <View style={styles.timelineTextWrap}>
                            <Text style={styles.timelineLabel}>Dropoff</Text>
                            <Text style={styles.timelineAddress} numberOfLines={1}>
                                {trip.dropoffAddress || 'Bahadurabad'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Info Grid */}
                <View style={styles.gridContainer}>
                    <View style={styles.gridRow}>
                        <View style={styles.gridCol}>
                            <Text style={styles.gridLabel}>Distance</Text>
                            <Text style={styles.gridValue}>{trip.distance ? `${trip.distance.toFixed(1)} km` : '—'}</Text>
                        </View>
                        <View style={styles.gridCol}>
                            <Text style={styles.gridLabel}>Duration</Text>
                            <Text style={styles.gridValue}>{trip.duration ? `${trip.duration} min` : '—'}</Text>
                        </View>
                        <View style={styles.gridCol}>
                            <Text style={styles.gridLabel}>Fare</Text>
                            <Text style={[styles.gridValue, { color: theme.primary }]}>{trip.fare ? `Rs. ${Math.round(trip.fare)}` : '—'}</Text>
                        </View>
                    </View>

                    <View style={styles.gridRow}>
                        <View style={styles.gridCol}>
                            <Text style={styles.gridLabel}>Payment</Text>
                            <Text style={styles.gridValue}>{trip.paymentMethod || 'Cash'}</Text>
                        </View>
                        <View style={styles.gridCol2}>
                            <Text style={styles.gridLabel}>Date & Time</Text>
                            <Text style={styles.gridValue}>
                                {trip.createdAt ? new Date(trip.createdAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '12 May 2024, 09:41 AM'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Download Receipt Button */}
                <TouchableOpacity onPress={handleDownloadReceipt} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.downloadBtn, { borderWidth: 0 }]}
                    >
                        <Download color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
                        <Text style={[styles.downloadBtnText, { color: "#FFFFFF" }]}>Download Receipt</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1.5,
        borderBottomColor: '#F1F5F9',
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backArrowBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#101828',
    },
    mapContainer: {
        height: height * 0.28,
        width: '100%',
        position: 'relative',
        borderBottomWidth: 1.5,
        borderBottomColor: '#F1F5F9',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    mapLoader: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 8,
        padding: 6,
    },
    markerOutline: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    markerCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    detailsPanel: {
        flex: 1,
        padding: 24,
    },
    timelineContainer: {
        marginBottom: 20,
        position: 'relative',
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 16,
        zIndex: 5,
    },
    timelineLine: {
        position: 'absolute',
        left: 4,
        top: 14,
        bottom: 14,
        width: 2,
        backgroundColor: '#E2E8F0',
        zIndex: 1,
    },
    timelineTextWrap: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    timelineAddress: {
        fontSize: 15,
        fontWeight: '600',
        color: '#101828',
    },
    divider: {
        height: 1.5,
        backgroundColor: '#F1F5F9',
        marginVertical: 20,
    },
    gridContainer: {
        marginBottom: 24,
        gap: 20,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    gridCol: {
        flex: 1,
    },
    gridCol2: {
        flex: 2,
    },
    gridLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    gridValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#101828',
    },
    downloadBtn: {
        flexDirection: 'row',
        width: '100%',
        height: 52,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#FFEED4',
        backgroundColor: '#FFFBF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 'auto',
    },
    downloadBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF991C',
    },
    errorWrap: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
        marginBottom: 20,
    },
    backBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#FF991C',
        borderRadius: 12,
    },
    backBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default TripHistoryDetailScreen;
