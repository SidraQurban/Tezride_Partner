import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../utils/constants';
import Header from '../components/Header';
import Card from '../components/Card';
import { TrendingUp, Wallet, Award, MapPin, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getFontFamily, getTextAlign, getFontSize } from '../utils/layout';
import { ridesService } from '../services/rides';
import { responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

const TrendingUpIcon = TrendingUp as any;
const WalletIcon = Wallet as any;
const AwardIcon = Award as any;
const MapPinIcon = MapPin as any;
const ArrowDownLeftIcon = ArrowDownLeft as any;
const ArrowUpRightIcon = ArrowUpRight as any;

const EarningsScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalEarnings: 0, totalRides: 0, totalDistance: 0, currency: 'PKR', averageRating: 0, ratingCount: 0 });
    const [balance, setBalance] = useState({ balance: 0, currency: 'PKR' });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const formatCurrency = (value: number, currency: string) =>
        `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const displayCurrency = balance.currency || stats.currency || 'PKR';
    const formattedBalance = formatCurrency(balance.balance, displayCurrency);
    const fetchEarningsData = async (tab: 'daily' | 'weekly' | 'monthly', isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const periodMap = {
                'daily': 'today',
                'weekly': 'weekly',
                'monthly': 'monthly'
            } as const;

            const [statsRes, balanceRes, txRes] = await Promise.all([
                ridesService.getRiderStats({ period: periodMap[tab] }),
                ridesService.getRiderBalance(),
                ridesService.getRiderTransactions({ pageIndex: 1, pageSize: 50 })
            ]);

            if (statsRes.data?.succeeded) {
                setStats(statsRes.data.data);
            }
            if (balanceRes.data?.succeeded) {
                setBalance(balanceRes.data.data);
            }
            if (txRes.data?.succeeded && Array.isArray(txRes.data.data)) {
                setTransactions(txRes.data.data);
            }
        } catch (err) {
            console.error('[EarningsScreen] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchEarningsData(activeTab, true);
        }, [activeTab])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchEarningsData(activeTab, true);
    }, [activeTab]);

    const chartData = React.useMemo(() => {
        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        if (activeTab === 'daily') {
            const data = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('en-US', { weekday: 'short' });

                let total = 0;
                transactions.forEach(tx => {
                    const txDate = new Date(tx.createdAt);
                    if (tx.amount > 0 && txDate.toDateString() === d.toDateString()) {
                        total += tx.amount;
                    }
                });
                data.push({ label, amount: total });
            }
            return data;
        } else if (activeTab === 'weekly') {
            const data = daysOfWeek.map(day => ({ label: day, amount: 0 }));
            const now = new Date();
            const currentDay = now.getDay();
            const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - distanceToMonday);
            monday.setHours(0, 0, 0, 0);

            transactions.forEach(tx => {
                const txDate = new Date(tx.createdAt);
                if (tx.amount > 0 && txDate >= monday) {
                    const dayIndex = txDate.getDay();
                    const labelIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                    if (data[labelIndex]) {
                        data[labelIndex].amount += tx.amount;
                    }
                }
            });
            return data;
        } else {
            const data = [
                { label: 'Wk 1', amount: 0 },
                { label: 'Wk 2', amount: 0 },
                { label: 'Wk 3', amount: 0 },
                { label: 'Wk 4', amount: 0 },
            ];

            const now = new Date();
            transactions.forEach(tx => {
                if (tx.amount > 0) {
                    const txDate = new Date(tx.createdAt);
                    const diffTime = Math.abs(now.getTime() - txDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 7) {
                        data[3].amount += tx.amount;
                    } else if (diffDays <= 14) {
                        data[2].amount += tx.amount;
                    } else if (diffDays <= 21) {
                        data[1].amount += tx.amount;
                    } else if (diffDays <= 28) {
                        data[0].amount += tx.amount;
                    }
                }
            });
            return data;
        }
    }, [transactions, activeTab]);

    const tabs = [
        { id: 'daily', label: t('earnings.daily') },
        { id: 'weekly', label: t('earnings.weekly') },
        { id: 'monthly', label: t('earnings.monthly') },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header
                title={t('earnings.title')}
                showBack={true}
            />
            <View style={{ paddingHorizontal: responsiveWidth(5), marginTop: responsiveHeight(1) }}>
                <Text style={{ fontSize: getFontSize(16, isRTL), fontFamily: getFontFamily('semibold', isRTL) }}>
                Performance Analytics
                </Text>
                </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: insets.bottom + 80 }
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.primary]}
                        tintColor={theme.primary}
                    />
                }
            >
                <View style={[styles.tabBar, { flexDirection: 'row' }]}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            activeOpacity={0.85}
                            style={[
                                styles.tab,
                                activeTab === tab.id && { backgroundColor: theme.primaryLight },
                            ]}
                            onPress={() => setActiveTab(tab.id as any)}
                        >
                            <Text style={[
                                styles.tabText,
                                { fontSize: getFontSize(14, isRTL) },
                                activeTab === tab.id && { color: theme.primary, fontFamily: getFontFamily('semibold', isRTL) },
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.summarySection}>
                    <Card style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
                        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.primaryLight }]}>
                                <TrendingUpIcon size={14} color={theme.primary} />
                            </View>
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: getFontSize(10, isRTL) }]} numberOfLines={1}>{t('earnings.totalWeeklyEarnings', 'Earnings')}</Text>
                        </View>
                        <Text style={[styles.cardValue, { color: theme.text, fontSize: getFontSize(16, isRTL) }]} numberOfLines={1} adjustsFontSizeToFit>{stats.totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </Card>

                    <Card style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
                        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.primaryLight }]}>
                                <AwardIcon size={14} color={theme.primary} />
                            </View>
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: getFontSize(10, isRTL) }]} numberOfLines={1}>{t('earnings.totalTrips', 'Total Trips')}</Text>
                        </View>
                        <Text style={[styles.cardValue, { color: theme.text, fontSize: getFontSize(16, isRTL) }]} numberOfLines={1} adjustsFontSizeToFit>{stats.totalRides}</Text>
                    </Card>

                    <Card style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
                        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.primaryLight }]}>
                                <MapPinIcon size={14} color={theme.primary} />
                            </View>
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: getFontSize(10, isRTL) }]} numberOfLines={1}>{t('earnings.kilometers', 'Kilometers')}</Text>
                        </View>
                        <Text style={[styles.cardValue, { color: theme.text, fontSize: getFontSize(16, isRTL) }]} numberOfLines={1} adjustsFontSizeToFit>{stats.totalDistance.toFixed(1)} km</Text>
                    </Card>

                    <Card style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
                        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.primaryLight }]}>
                                <WalletIcon size={14} color={theme.primary} />
                            </View>
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: getFontSize(10, isRTL) }]} numberOfLines={1}>Balance</Text>
                        </View>
                        <Text style={[styles.cardValue, { color: theme.text, fontSize: getFontSize(16, isRTL) }]} numberOfLines={1} adjustsFontSizeToFit>{formattedBalance}</Text>
                    </Card>
                </View>

                <Text style={[styles.sectionTitle, { textAlign: getTextAlign(isRTL), fontFamily: getFontFamily('semibold', isRTL), marginBottom: 10 }]}>
                    {t('earnings.earningsActivity', 'Earnings Activity')}
                </Text>
                <Card style={[styles.chartCard, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.chartGridLines}>
                        <View style={styles.chartGridLine} />
                        <View style={styles.chartGridLine} />
                        <View style={styles.chartGridLine} />
                        <View style={styles.chartGridLine} />
                    </View>
                    <View style={[styles.chartBarContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        {chartData.map((d, i) => {
                            const maxAmount = Math.max(...chartData.map(x => x.amount), 100);
                            const barHeight = maxAmount > 0 ? Math.max(10, (d.amount / maxAmount) * 120) : 10;
                            return (
                                <View key={i} style={styles.chartBarWrapper}>
                                    <View style={[styles.chartBar, { height: barHeight, backgroundColor: theme.primary }]} />
                                    <Text style={styles.chartLabel}>{d.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </Card>

                <Text style={[styles.sectionTitle, { textAlign: getTextAlign(isRTL), fontFamily: getFontFamily('semibold', isRTL), marginTop: 14, marginBottom: 8 }]}>
                    {t('wallet.recentTransactions', 'Recent Activity')}
                </Text>

                {loading && !refreshing ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
                ) : transactions.length > 0 ? (
                    transactions.slice(0, 5).map((item) => (
                        <Card key={item.id} style={[styles.transactionCard, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: theme.cardBackground }] as any}>
                            <View style={[styles.txIconContainer, { backgroundColor: theme.primaryLight }]}>
                                {item.amount > 0 ? (
                                    <ArrowDownLeftIcon color={theme.success} size={16} />
                                ) : (
                                    <ArrowUpRightIcon color={theme.error} size={16} />
                                )}
                            </View>
                            <View style={[styles.txInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start', marginHorizontal: 10 }] as any}>
                                <Text style={[styles.txTitle, { color: theme.text }]}>{item.description || t('earnings.rideEarning', 'Ride Earning')}</Text>
                                <Text style={[styles.txDate, { color: theme.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <Text style={[styles.txAmount, { color: item.amount > 0 ? theme.success : theme.text, textAlign: isRTL ? 'left' : 'right' }]}>
                                {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                            </Text>
                        </Card>
                    ))
                ) : (
                    <Card style={styles.emptyCard}>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            {t('earnings.noRecentActivity', 'No recent earnings activity.')}
                        </Text>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.secondaryBackground,
    },
    content: {
        padding: 20,
    },
    tabBar: {
        backgroundColor: 'transparent',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#F3E3C7',
        padding: 4,
        marginBottom: 20,
        overflow: 'hidden',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    summarySection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        maxWidth: '48%',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
            },
            android: { elevation: 1 },
        }),
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    cardIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontFamily: FONTS.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    cardValue: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    sectionTitle: {
        fontSize: 15,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginBottom: 10,
    },
    chartCard: {
        paddingVertical: 16,
        paddingHorizontal: 14,
        marginBottom: 16,
        minHeight: 180,
    },
    chartGridLines: {
        position: 'absolute',
        top: 14,
        left: 14,
        right: 14,
        bottom: 32,
        justifyContent: 'space-between',
        zIndex: 0,
    },
    chartGridLine: {
        height: 1,
        backgroundColor: '#F2F2F2',
    },
    chartBarContainer: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexDirection: 'row',
        height: 130,
        paddingHorizontal: 4,
        zIndex: 1,
    },
    chartBarWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginHorizontal: 3,
    },
    chartBar: {
        width: 12,
        borderRadius: 99,
    },
    chartLabel: {
        fontSize: 9,
        color: COLORS.textSecondary,
        fontFamily: FONTS.regular,
        marginTop: 6,
        textAlign: 'center',
    },
    transactionCard: {
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
    },
    txIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txInfo: {
        flex: 1,
    },
    txTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
    },
    txDate: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        marginTop: 3,
    },
    txAmount: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
    },
    emptyCard: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
    },
    balanceContainer: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceText: {
        marginLeft: 10,
    },
    balanceLabel: {
        fontSize: 10,
        fontFamily: FONTS.medium,
    },
    balanceValue: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        marginTop: 2,
    },
});

export default EarningsScreen;
