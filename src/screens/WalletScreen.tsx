import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SIZES } from '../utils/constants';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, ArrowDownLeft, ArrowUpRight, History, Plus, List, FileText } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getFontFamily, getTextAlign, getFontSize } from '../utils/layout';
import { ridesService } from '../services/rides';
import { ActivityIndicator } from 'react-native';
import { responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

const WalletIcon = Wallet as any;
const ArrowDownLeftIcon = ArrowDownLeft as any;
const ArrowUpRightIcon = ArrowUpRight as any;

const WalletScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { theme, isFemale } = useTheme();
    const cardGradient = isFemale ? ['#FF6B9E', '#E43076'] : (theme.gradient as [string, string, ...string[]]);

    const [loading, setLoading] = React.useState(true);
    const [balance, setBalance] = React.useState({ balance: 0, currency: 'PKR' });
    const [transactions, setTransactions] = React.useState<any[]>([]);

    React.useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        try {
            setLoading(true);
            const [balanceRes, txRes] = await Promise.all([
                ridesService.getRiderBalance(),
                ridesService.getRiderTransactions({ pageIndex: 1, pageSize: 20 })
            ]);

            if (balanceRes.data?.succeeded) {
                setBalance(balanceRes.data.data);
            }
            if (txRes.data?.succeeded) {
                setTransactions(txRes.data.data);
            }
        } catch (err) {
            console.error('[WalletScreen] Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('wallet.title')} showBack={true} />
<View style={{ paddingHorizontal: responsiveWidth(5), marginTop: responsiveHeight(1) }}>
                <Text style={{ fontSize: getFontSize(16, isRTL), fontFamily: getFontFamily('semibold', isRTL) }}>
                {t('dashboard.myWallet')}
                </Text>
                </View>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: insets.bottom + 80 }
                ]}
            >
                <LinearGradient
                    colors={cardGradient as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.walletCard as any}
                >
                    <View style={styles.walletInfo}>
                        <Text style={[styles.walletLabel, { textAlign: 'left', fontSize: getFontSize(14, isRTL) }]}>
                            {t('wallet.availableBalance', 'Total Balance')}
                        </Text>
                        <Text style={[styles.balanceText, { textAlign: 'left', fontSize: getFontSize(32, isRTL) }]}>
                            {balance.currency} {balance.balance.toLocaleString()}
                        </Text>
                    </View>
                    <View style={styles.walletBgIcon}>
                        <WalletIcon color="rgba(255,255,255,0.25)" size={70} strokeWidth={1.5} />
                    </View>
                </LinearGradient>

                <View style={styles.actionsCard}>
                    <TouchableOpacity style={styles.actionBtn}>
                        <View style={[styles.actionIconCircle, { backgroundColor: isFemale ? '#FFF0F6' : '#FFF7ED' }]}>
                            <Plus color={isFemale ? '#E43076' : '#F97316'} size={24} />
                        </View>
                        <Text style={[styles.actionText, { fontFamily: getFontFamily('semibold', isRTL) }]}>{t('wallet.topUp', 'Top Up')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <View style={[styles.actionIconCircle, { backgroundColor: isFemale ? '#FFF0F6' : '#FFF7ED' }]}>
                            <List color={isFemale ? '#E43076' : '#F97316'} size={24} />
                        </View>
                        <Text style={[styles.actionText, { fontFamily: getFontFamily('semibold', isRTL) }]}>{t('wallet.transactions', 'Transactions')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.sectionHeader, { flexDirection: 'row' }] as any}>
                    <Text style={[styles.sectionTitle, { textAlign: 'left', fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(18, isRTL) }]}>
                        {t('wallet.recentActivity', 'Recent Activity')}
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : transactions.length > 0 ? (
                    transactions.map((item) => (
                        <Card key={item.id} style={[styles.transactionCard, { flexDirection: 'row' }] as any}>
                            <View style={styles.txIconContainer}>
                                {item.amount > 0 ? (
                                    <ArrowDownLeftIcon color={COLORS.success} size={20} />
                                ) : (
                                    <ArrowUpRightIcon color={COLORS.error} size={20} />
                                )}
                            </View>
                            <View style={[styles.txInfo, { alignItems: 'flex-start', marginLeft: 15 }] as any}>
                                <Text style={[styles.txTitle, { fontSize: getFontSize(15, isRTL) }]}>{item.description || t('wallet.transaction')}</Text>
                                <Text style={[styles.txDate, { fontSize: getFontSize(12, isRTL) }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <Text style={[
                                styles.txAmount,
                                { color: item.amount > 0 ? COLORS.success : COLORS.text, textAlign: 'right', fontSize: getFontSize(16, isRTL) }
                            ] as any}>
                                {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                            </Text>
                        </Card>
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <FileText color="#CBD5E1" size={60} strokeWidth={1.5} />
                        <Text style={[styles.emptyText, { fontFamily: getFontFamily('medium', isRTL) }]}>
                            {t('wallet.noRecentActivity', 'No recent activity')}
                        </Text>
                    </View>
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
    header: {
        padding: SIZES.padding,
        backgroundColor: COLORS.white,
    },
    headerTitle: {
        fontSize: 24,
        color: COLORS.text,
    },
    content: {
        padding: SIZES.padding,
        // paddingBottom will be applied dynamically
    },
    walletCard: {
        paddingHorizontal: 24,
        paddingVertical: 32,
        marginBottom: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12 },
            android: { elevation: 8 }
        }),
    },
    walletInfo: {
        flex: 1,
        zIndex: 2,
    },
    walletBgIcon: {
        position: 'absolute',
        right: 15,
        top: 25,
        zIndex: 1,
    },
    walletLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        marginBottom: 6,
    },
    balanceText: {
        color: COLORS.white,
        fontSize: 32,
        fontWeight: 'bold',
    },
    actionsCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        paddingVertical: 20,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 35,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
            android: { elevation: 4 }
        }),
    },
    actionBtn: {
        alignItems: 'center',
        flex: 1,
    },
    actionIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    actionText: {
        fontSize: 14,
        color: COLORS.text,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: '#94A3B8',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        color: COLORS.text,
    },
    seeAll: {
        fontWeight: '700',
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 10,
    },
    txIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.secondaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
        marginEnd: 15,
    },
    txInfo: {
        flex: 1,
    },
    txTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    txDate: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    txAmount: {
        fontSize: 16,
        fontWeight: '800' as const,
    },
});

export default WalletScreen;
