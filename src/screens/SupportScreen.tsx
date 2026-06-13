import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SIZES } from '../utils/constants';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import { Phone, MessageSquare, HelpCircle, FileText, ChevronRight } from 'lucide-react-native';

const PhoneIcon = Phone as any;
const MessageIcon = MessageSquare as any;

import Header from '../components/Header';
import { useLanguage } from '../context/LanguageContext';
import { getFontFamily, getTextAlign, getFontSize } from '../utils/layout';

// FAQ Item Component
const FAQItem = ({ faq, isRTL }: any) => {
    const [expanded, setExpanded] = useState(false);
    const HelpIcon = HelpCircle as any;

    return (
        <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => setExpanded(!expanded)}
            style={[styles.faqCard, { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1 }]}
        >
            <View style={[styles.faqHeader, { flexDirection: 'row' }]}>
                <View style={[styles.faqIconBox, { backgroundColor: COLORS.primary + '10' }]}>
                    <HelpIcon size={18} color={COLORS.primary} />
                </View>
                <Text style={[styles.faqQuestion, { flex: 1, textAlign: 'left', marginHorizontal: 12, fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(14, isRTL) }]}>
                    {faq.q}
                </Text>
                <ChevronRight 
                    size={18} 
                    color="#94A3B8" 
                    style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }, { scaleX: 1 }] }} 
                />
            </View>
            {expanded && (
                <View style={[styles.faqAnswerContainer, { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 12, paddingTop: 12 }]}>
                    <Text style={[styles.faqAnswer, { textAlign: 'left', fontFamily: getFontFamily('regular', isRTL), fontSize: getFontSize(13, isRTL) }]}>
                        {faq.a}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const SupportScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const [issue, setIssue] = useState('');
    const [email, setEmail] = useState('');

    const faqs = [
        {
            q: isRTL ? 'میں اپنی کمائی کیسے وصول کر سکتا ہوں؟' : 'How do I receive my earnings?',
            a: isRTL ? 'آپ کی کمائی ہفتہ وار بنیادوں پر آپ کے بینک اکاؤنٹ یا ایزی پیسہ/جاز کیش میں منتقل کی جاتی ہے۔' : 'Your earnings are transferred weekly to your linked bank account or EasyPaisa/JazzCash wallet.'
        },
        {
            q: isRTL ? 'رائیڈ کینسل ہونے پر کیا ہوگا؟' : 'What happens if a ride is cancelled?',
            a: isRTL ? 'اگر صارف رائیڈ کینسل کرتا ہے تو آپ کو کینسلیشن فیس مل سکتی ہے، بشرطیکہ آپ پک اپ پوائنٹ کے قریب ہوں۔' : 'If a customer cancels, you may receive a cancellation fee if you have already reached or are near the pickup point.'
        },
        {
            q: isRTL ? 'میں اپنی گاڑی کی معلومات کیسے تبدیل کروں؟' : 'How can I change my vehicle info?',
            a: isRTL ? 'آپ سیٹنگز میں جا کر "گاڑی کی تفصیلات" کے سیکشن سے اپنی گاڑی کی معلومات اپ ڈیٹ کر سکتے ہیں۔' : 'You can update your vehicle information from the "Vehicle Details" section in the Settings menu.'
        },
        {
            q: isRTL ? 'میرا اکاؤنٹ کیوں بلاک ہو سکتا ہے؟' : 'Why could my account be blocked?',
            a: isRTL ? 'کم ریٹنگ، غیر مناسب رویہ، یا ٹریفک قوانین کی بار بار خلاف ورزی پر اکاؤنٹ بلاک کیا جا سکتا ہے۔' : 'Accounts can be blocked due to low ratings, unprofessional behavior, or repeated traffic violations.'
        },
        {
            q: isRTL ? 'انشورنس کے بارے میں معلومات کیسے ملے گی؟' : 'How does insurance work?',
            a: isRTL ? 'ہر ایکٹو ٹرپ کے دوران آپ اور سوار کا انشورنس کور موجود ہوتا ہے۔ مزید معلومات کے لیے سیفٹی پیج دیکھیں۔' : 'Every active trip is insured. For more details, please visit the Safety page from the dashboard.'
        }
    ];

    const handleCall = () => {
        Linking.openURL('tel:+923001234567');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('profile.support')} showBack={true} />
            <ScrollView 
                contentContainerStyle={[
                    styles.content, 
                    { paddingBottom: insets.bottom + 80 }
                ]}
            >
                <View style={[styles.contactRow, { flexDirection: 'row' }]}>
                    <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
                        <View style={[styles.iconBox, { backgroundColor: '#E1F5FE' }]}>
                            <PhoneIcon color="#0288D1" size={24} />
                        </View>
                        <Text style={[styles.contactText, { fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(14, isRTL) }]}>{t('common.callSupport')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contactCard} onPress={() => navigation.navigate('Chat', { recipientId: 'admin', recipientName: 'TezRide Support' })}>
                        <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                            <MessageIcon color="#2E7D32" size={24} />
                        </View>
                        <Text style={[styles.contactText, { fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(14, isRTL) }]}>{t('common.liveChat')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, { textAlign: 'left', fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(18, isRTL) }]}>{t('common.faqs')}</Text>
                {faqs.map((faq, i) => (
                    <FAQItem key={i} faq={faq} isRTL={isRTL} />
                ))}

                <Text style={[styles.sectionTitle, { textAlign: 'left', fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(18, isRTL) }]}>{t('common.reportIssue')}</Text>
                <View style={[styles.formCard, { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 20 }]}>
                    <Input
                        label={isRTL ? 'ای میل' : 'Your Email'}
                        placeholder={t('common.placeholderEmail')}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <Input
                        label={isRTL ? 'مسئلہ بیان کریں' : 'Describe your issue'}
                        placeholder={isRTL ? 'تفصیل یہاں لکھیں...' : 'Write details here...'}
                        value={issue}
                        onChangeText={setIssue}
                        multiline
                        numberOfLines={4}
                        style={styles.textArea}
                    />
                    <Button 
                        title={t('common.submit')} 
                        onPress={() => {
                            if (!issue || !email) {
                                Alert.alert('Error', 'Please fill all fields');
                                return;
                            }
                            Alert.alert('Success', 'Your report has been submitted. We will contact you soon.');
                            setIssue('');
                        }} 
                        style={{ marginTop: 10 }}
                    />
                </View>
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
        ...FONTS.h2,
    },
    content: {
        padding: SIZES.padding,
        // paddingBottom will be applied dynamically
    },
    contactRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    contactCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        padding: 20,
        borderRadius: SIZES.radius,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    contactText: {
        fontWeight: '700',
        fontSize: 14,
        color: COLORS.text,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 15,
        marginTop: 10,
    },
    faqCard: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    faqIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faqQuestion: {
        fontSize: 14,
        color: COLORS.text,
        lineHeight: 20,
    },
    faqAnswerContainer: {
        paddingLeft: 4,
    },
    faqAnswer: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    formCard: {
        padding: 20,
        marginBottom: 20,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
});

export default SupportScreen;
