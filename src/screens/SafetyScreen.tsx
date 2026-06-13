import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { 
    ShieldAlert, 
    ShieldCheck, 
    AlertTriangle, 
    ChevronRight,
    UserPlus,
    HeartPulse,
    PhoneCall
} from 'lucide-react-native';
import Header from '../components/Header';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getFontFamily } from '../utils/layout';

const SafetyScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { theme, isFemale } = useTheme();

    const emergencyContacts = [
        { name: isRTL ? 'پولیس (15)' : 'Police (15)', phone: '15', icon: ShieldAlert, color: '#DC2626' },
        { name: isRTL ? 'ایمبولینس (1122)' : 'Ambulance (1122)', phone: '1122', icon: HeartPulse, color: '#EF4444' },
        { name: isRTL ? 'TezRide ہیلپ لائن' : 'TezRide Helpline', phone: '042111123456', icon: PhoneCall, color: theme.primary },
    ];

    const safetyTips = [
        {
            title: isRTL ? 'ہیلمٹ کا استعمال' : 'Always Wear a Helmet',
            desc: isRTL ? 'اپنی اور سوار کی حفاظت کے لیے ہمیشہ ہیلمٹ پہنیں۔' : 'For your safety and the rider\'s, always wear a helmet and provide one to the passenger.',
            icon: ShieldCheck
        },
        {
            title: isRTL ? 'سفر کی تفصیلات شیئر کریں' : 'Share Trip Details',
            desc: isRTL ? 'اپنے پیاروں کے ساتھ اپنے سفر کی لائیو لوکیشن شیئر کریں۔' : 'Use the "Share Trip" feature to let your family know your live location.',
            icon: UserPlus
        },
        {
            title: isRTL ? 'ٹریفک قوانین کی پابندی' : 'Follow Traffic Rules',
            desc: isRTL ? 'ٹریفک سگنلز اور رفتار کی حد کا خیال رکھیں۔' : 'Respect traffic signals and speed limits at all times.',
            icon: AlertTriangle
        }
    ];

    const handleCall = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleSOS = () => {
        Alert.alert(
            isRTL ? 'ہنگامی مدد' : 'Emergency Assistance',
            isRTL ? 'کیا آپ ہنگامی مدد (SOS) طلب کرنا چاہتے ہیں؟' : 'Do you want to request emergency assistance (SOS)?',
            [
                { text: isRTL ? 'نہیں' : 'No', style: 'cancel' },
                { 
                    text: isRTL ? 'ہاں، کال کریں' : 'Yes, Call 15', 
                    onPress: () => handleCall('15'),
                    style: 'destructive'
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={{ paddingTop: insets.top }}>
                <Header title={t('dashboard.safety', 'Safety')} showBack={true} />
            </View>
            
            <ScrollView 
                contentContainerStyle={[
                    styles.content, 
                    { paddingBottom: insets.bottom + 20 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* SOS Button Section */}
                <TouchableOpacity 
                    style={[styles.sosCard, { backgroundColor: '#FEE2E2' }]} 
                    onPress={handleSOS}
                    activeOpacity={0.9}
                >
                    <View style={styles.sosIconContainer}>
                        <ShieldAlert color="#DC2626" size={32} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.sosTitle, { fontFamily: getFontFamily('bold', isRTL) }]}>
                            {isRTL ? 'ہنگامی SOS بٹن' : 'Emergency SOS Button'}
                        </Text>
                        <Text style={[styles.sosDesc, { fontFamily: getFontFamily('regular', isRTL) }]}>
                            {isRTL ? 'کسی بھی ہنگامی صورتحال میں فوری مدد کے لیے یہاں کلک کریں۔' : 'Click here for immediate assistance in case of an emergency.'}
                        </Text>
                    </View>
                    <ChevronRight color="#DC2626" size={20} />
                </TouchableOpacity>

                {/* Emergency Contacts */}
                <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: getFontFamily('bold', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'ہنگامی نمبرز' : 'Emergency Contacts'}
                </Text>
                <View style={styles.contactsGrid}>
                    {emergencyContacts.map((contact, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={[styles.contactItem, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                            onPress={() => handleCall(contact.phone)}
                        >
                            <View style={[styles.contactIconWrap, { backgroundColor: contact.color + '15' }]}>
                                <contact.icon color={contact.color} size={24} />
                            </View>
                            <Text style={[styles.contactName, { color: theme.text, fontFamily: getFontFamily('semibold', isRTL) }]}>
                                {contact.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Insurance Info */}
                <View style={[styles.infoCard, { backgroundColor: isFemale ? '#FFF0F6' : '#F0F9FF', borderColor: isFemale ? '#FFD1E8' : '#BAE6FD' }]}>
                    <View style={styles.infoHeader}>
                        <ShieldCheck color={isFemale ? '#D01770' : '#0284C7'} size={24} />
                        <Text style={[styles.infoTitle, { color: isFemale ? '#D01770' : '#0369A1', fontFamily: getFontFamily('bold', isRTL) }]}>
                            {isRTL ? 'انشورنس کور' : 'Insurance Coverage'}
                        </Text>
                    </View>
                    <Text style={[styles.infoText, { color: isFemale ? '#9D174D' : '#0C4A6E', fontFamily: getFontFamily('regular', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                        {isRTL 
                            ? 'آپ کے ہر سفر کے دوران آپ اور آپ کے سوار کا انشورنس کور موجود ہے۔ حادثے کی صورت میں فوری طور پر ہمیں مطلع کریں۔' 
                            : 'Every trip you take is covered by our insurance partner. In case of an accident, please report it immediately through the app.'}
                    </Text>
                </View>

                {/* Safety Tips */}
                <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: getFontFamily('bold', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'حفاظتی تدابیر' : 'Safety Tips'}
                </Text>
                {safetyTips.map((tip, index) => (
                    <View 
                        key={index} 
                        style={[styles.tipCard, { backgroundColor: theme.cardBackground, borderColor: theme.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    >
                        <View style={[styles.tipIconWrap, { backgroundColor: theme.primaryLight }]}>
                            <tip.icon color={theme.primary} size={20} />
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                            <Text style={[styles.tipTitle, { color: theme.text, fontFamily: getFontFamily('semibold', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                                {tip.title}
                            </Text>
                            <Text style={[styles.tipDesc, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL), textAlign: isRTL ? 'right' : 'left' }]}>
                                {tip.desc}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    sosCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sosIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sosTitle: {
        fontSize: 18,
        color: '#991B1B',
        marginBottom: 4,
    },
    sosDesc: {
        fontSize: 13,
        color: '#B91C1C',
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 16,
    },
    contactsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    contactItem: {
        width: '48%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    contactIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    contactName: {
        fontSize: 14,
        textAlign: 'center',
    },
    infoCard: {
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 17,
        marginLeft: 12,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 22,
    },
    tipCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        alignItems: 'flex-start',
    },
    tipIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipTitle: {
        fontSize: 15,
        marginBottom: 4,
    },
    tipDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
});

export default SafetyScreen;
