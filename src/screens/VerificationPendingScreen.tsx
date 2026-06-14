import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUI } from '../context/UIContext';
import { COLORS } from '../utils/constants';
import { CheckCircle2, Clock, LogOut, RefreshCcw, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { View as MotiView } from 'moti';
import { getFontFamily } from '../utils/layout';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button';

const VerificationPendingScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const { user, signOut, checkVerificationStatus } = useAuth();
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const { showError } = useUI();
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    // Auto-redirect when approved
    React.useEffect(() => {
        if (user?.verificationStatus === 'approved') {
            console.log('[VerificationPending] Status approved! Redirecting to Dashboard...');
            navigation.replace('MainTabs');
        }
    }, [user?.verificationStatus, navigation]);

    const getStatusContent = () => {
        switch (user?.verificationStatus) {
            case 'rejected':
                return {
                    icon: AlertCircle,
                    color: theme.error,
                    title: isRTL ? 'درخواست مسترد کر دی گئی' : 'Application Rejected',
                    desc: isRTL ? 'معذرت، آپ کے فراہم کردہ دستاویزات معیار پر پورا نہیں اترتے۔ براہ کرم دوبارہ کوشش کریں۔' : 'Sorry, your documents do not meet our requirements. Please re-upload clear documents.',
                    bg: theme.error + '15'
                };
            case 'approved':
                return {
                    icon: CheckCircle2,
                    color: theme.success,
                    title: isRTL ? 'اکاؤنٹ منظور ہو گیا' : 'Account Approved',
                    desc: isRTL ? 'مبارک ہو! آپ کا اکاؤنٹ منظور ہو گیا ہے۔ اب آپ رائیڈز شروع کر سکتے ہیں۔' : 'Congratulations! Your account is approved. You can now start receiving rides.',
                    bg: theme.success + '15'
                };
            default:
                return {
                    icon: Clock,
                    color: theme.primary,
                    title: isRTL ? 'اکاؤنٹ زیرِ جائزہ ہے' : 'Account Under Review',
                    desc: isRTL ? 'آپ کی دستاویزات جمع کر دی گئی ہیں۔ ہماری ٹیم ان کی تصدیق کر رہی ہے۔' : 'Thank you for submitting your documents. Our team is currently verifying your information.',
                    bg: theme.primary + '15'
                };
        }
    };

    const status = getStatusContent();

    const handleRefreshStatus = async () => {
        setIsRefreshing(true);
        await checkVerificationStatus();
        setIsRefreshing(false);
        
        // Only show error if isRiderApproved is false after API response
        // If approved, the auto-redirect will handle it
        if (user?.isRiderApproved === false) {
            showError(
                isRTL ? 'اسٹیٹس اپ ڈیٹ' : 'Status Update',
                isRTL ? 'آپ کا اکاؤنٹ ابھی تک زیرِ جائزہ ہے۔ تصدیق میں تھوڑا وقت لگ سکتا ہے۔' : 'Your account is not verified yet. It usually takes 24-48 hours for our team to review your documents.'
            );
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <MotiView
                    from={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', duration: 1000 }}
                    style={[styles.iconContainer, { backgroundColor: status.bg }]}
                >
                    <status.icon size={80} color={status.color} />
                </MotiView>

                <Text style={[styles.title, { color: theme.text, fontFamily: getFontFamily('bold', isRTL) }]}>
                    {status.title}
                </Text>
                <Text style={[styles.description, { color: theme.textSecondary, fontFamily: getFontFamily('medium', isRTL) }]}>
                    {status.desc}
                </Text>

                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <ShieldCheck color={theme.primary} size={20} />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={[styles.infoTitle, { color: theme.text, fontFamily: getFontFamily('semibold', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                            {isRTL ? 'متوقع وقت' : 'Estimated Approval Time'}
                        </Text>
                        <Text style={[styles.infoText, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                            24 - 48 {isRTL ? 'گھنٹے' : 'Hours'}
                        </Text>
                    </View>
                </View>

                <Button 
                    title={isRTL ? 'اسٹیٹس ریفریش کریں' : 'Refresh Status'}
                    onPress={handleRefreshStatus}
                    loading={isRefreshing}
                    style={{ width: '100%', borderRadius: 16, marginBottom: 16 }}
                />

                <TouchableOpacity 
                    style={[styles.logoutButton, { borderColor: theme.error }]}
                    onPress={signOut}
                >
                    <LogOut size={20} color={theme.error} style={[styles.buttonIcon, { marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }]} />
                    <Text style={[styles.logoutText, { color: theme.error, fontFamily: getFontFamily('bold', isRTL) }]}>
                        {t('profile.logout')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    iconContainer: {
        width: 150,
        height: 150,
        borderRadius: 75,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    infoCard: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        marginBottom: 40,
    },
    infoTitle: {
        fontSize: 14,
    },
    infoText: {
        fontSize: 13,
        marginTop: 2,
    },
    refreshButton: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    refreshText: {
        color: '#FFF',
        fontSize: 16,
    },
    logoutButton: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
    },
    logoutText: {
        fontSize: 16,
    },
    buttonIcon: {},
});

export default VerificationPendingScreen;
