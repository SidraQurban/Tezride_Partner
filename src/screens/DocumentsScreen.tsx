import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SIZES } from '../utils/constants';
import { getFontFamily } from '../utils/layout';
import { ChevronLeft, FileText, ShieldCheck, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { userService } from '../services/user';
import Header from '../components/Header';

const ChevronLeftIcon = ChevronLeft as any;
const FileTextIcon = FileText as any;
const ShieldCheckIcon = ShieldCheck as any;
const CheckCircleIcon = CheckCircle as any;
const ClockIcon = Clock as any;
const AlertCircleIcon = AlertCircle as any;

const DocumentsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const [profileData, setProfileData] = useState<any>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        if (!user?.id) return;
        try {
            const res = await userService.getUserById(user.id);
            if (res.data?.data) {
                setProfileData(res.data.data);
            }
        } catch (error) {
            console.error('[Documents] Failed to fetch profile:', error);
        }
    };

    const verificationDetails = profileData?.verificationDetails;

    const renderField = (label: string, value: string, icon?: any) => (
        <View style={styles.fieldContainer}>
            {icon && <View style={styles.fieldIcon}>{icon}</View>}
            <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontFamily: getFontFamily('medium', isRTL) }]}>{label}</Text>
                <Text style={[styles.fieldValue, { color: theme.text, fontFamily: getFontFamily('semibold', isRTL) }]}>{value || '-'}</Text>
            </View>
        </View>
    );

    const renderImage = (label: string, imageUrl: string) => (
        <View style={styles.imageContainer}>
            <Text style={[styles.imageLabel, { color: theme.text, fontFamily: getFontFamily('semibold', isRTL) }]}>{label}</Text>
            {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.documentImage} />
            ) : (
                <View style={[styles.documentPlaceholder, { backgroundColor: theme.cardBackground }]}>
                    <FileTextIcon size={40} color={theme.textSecondary} />
                    <Text style={[styles.placeholderText, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL) }]}>No image uploaded</Text>
                </View>
            )}
        </View>
    );


    // riderStatus: 0 = NotSubmitted, 1 = Pending, 2 = Approved
    const getRiderStatusInfo = (status: number | undefined) => {
        switch (status) {
            case 2:
                return {
                    label: 'Approved',
                    icon: <CheckCircleIcon size={20} color={COLORS.success} />,
                    color: COLORS.success,
                    bg: '#F0FFF4',
                };
            case 1:
                return {
                    label: 'Pending Review',
                    icon: <ClockIcon size={20} color={COLORS.warning} />,
                    color: COLORS.warning,
                    bg: '#FFFBEB',
                };
            default:
                return {
                    label: 'Not Submitted',
                    icon: <AlertCircleIcon size={20} color={COLORS.textSecondary} />,
                    color: COLORS.textSecondary,
                    bg: COLORS.secondaryBackground,
                };
        }
    };

    const riderStatus = profileData?.riderProfile?.riderStatus;
    const riderStatusInfo = getRiderStatusInfo(riderStatus);

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <Header title={t('profile.documents', 'Verification Documents')} showBack={true} />

            <ScrollView 
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                {/* Rider Status Badge */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rider Verification Status</Text>
                    <View style={[styles.statusCard, { borderColor: riderStatusInfo.color, backgroundColor: riderStatusInfo.bg }]}>
                        <View style={styles.statusIcon}>{riderStatusInfo.icon}</View>
                        <Text style={[styles.statusText, { color: riderStatusInfo.color }]}>
                            {riderStatusInfo.label}
                        </Text>
                    </View>
                </View>

                {verificationDetails ? (
                    <>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>CNIC Information</Text>
                            {renderField('CNIC Number', verificationDetails.cnicNumber, <ShieldCheckIcon size={20} color={theme.primary} />)}
                            {renderField('Address', verificationDetails.address, <ShieldCheckIcon size={20} color={theme.primary} />)}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>CNIC Documents</Text>
                            {renderImage('CNIC Front', verificationDetails.cnicFrontImageUrl)}
                            {renderImage('CNIC Back', verificationDetails.cnicBackImageUrl)}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Submission Details</Text>
                            {renderField('Submitted At', verificationDetails.submittedAt ? new Date(verificationDetails.submittedAt).toLocaleDateString() : '-')}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <ShieldCheckIcon size={60} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No verification documents found</Text>
                        <Text style={styles.emptySubtext}>Please complete your registration to submit verification documents</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.text,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.text,
        marginBottom: 15,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondaryBackground,
        padding: 20,
        borderRadius: SIZES.radius,
        borderWidth: 2,
    },
    statusIcon: {
        marginRight: 15,
    },
    statusText: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: COLORS.secondaryBackground,
        padding: 15,
        borderRadius: SIZES.radius,
    },
    fieldIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    fieldContent: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: COLORS.textSecondary,
        marginBottom: 3,
    },
    fieldValue: {
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.text,
    },
    imageContainer: {
        marginBottom: 20,
    },
    imageLabel: {
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
        color: COLORS.textSecondary,
        marginBottom: 10,
    },
    documentImage: {
        width: '100%',
        height: 200,
        borderRadius: SIZES.radius,
        backgroundColor: COLORS.secondaryBackground,
    },
    documentPlaceholder: {
        width: '100%',
        height: 200,
        borderRadius: SIZES.radius,
        backgroundColor: COLORS.secondaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
        color: COLORS.textSecondary,
        marginTop: 10,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.text,
        marginTop: 20,
    },
    emptySubtext: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: COLORS.textSecondary,
        marginTop: 10,
        textAlign: 'center',
    },
});

export default DocumentsScreen;
