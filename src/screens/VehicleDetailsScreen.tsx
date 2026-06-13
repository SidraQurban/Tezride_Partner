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
import { ChevronLeft, Bike, FileText, Calendar, Hash } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFontFamily, getFontSize, getTextStyle } from '../utils/layout';
import { userService } from '../services/user';

const ChevronLeftIcon = ChevronLeft as any;
const BikeIcon = Bike as any;
const FileTextIcon = FileText as any;
const CalendarIcon = Calendar as any;
const HashIcon = Hash as any;

import Header from '../components/Header';

const VehicleDetailsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

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
            console.error('[VehicleDetails] Failed to fetch profile:', error);
        }
    };

    const riderProfile = profileData?.riderProfile;

    const renderField = (label: string, value: string, icon?: any) => (
        <View style={[styles.fieldContainer, { flexDirection: 'row', alignItems: 'center' }]}>
            {icon && <View style={[styles.fieldIcon, { marginRight: 15 }]}>{icon}</View>}
            <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, getTextStyle(12, 'medium', isRTL), { color: theme.textSecondary, textAlign: 'left' }]}>{label}</Text>
                <Text style={[styles.fieldValue, getTextStyle(16, 'semibold', isRTL), { color: theme.text, textAlign: 'left' }]}>{value || '-'}</Text>
            </View>
        </View>
    );

    const renderImage = (label: string, imageUrl: string) => (
        <View style={styles.imageContainer}>
            <Text style={[styles.imageLabel, getTextStyle(14, 'semibold', isRTL), { color: theme.text, textAlign: 'left', marginBottom: 10 }]}>{label}</Text>
            {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.documentImage} />
            ) : (
                <View style={[styles.documentPlaceholder, { backgroundColor: theme.cardBackground }]}>
                    <FileTextIcon size={40} color={theme.textSecondary} />
                    <Text style={[styles.placeholderText, getTextStyle(13, 'regular', isRTL), { color: theme.textSecondary, textAlign: 'center', marginTop: 10 }]}>No image uploaded</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <Header title={t('profile.vehicleDetails')} showBack={true} />

            <ScrollView 
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                {riderProfile ? (
                    <>
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, getTextStyle(18, 'bold', isRTL), { color: theme.text, textAlign: 'left', marginBottom: 15 }]}>Vehicle Information</Text>
                            {renderField('Vehicle Type', riderProfile.vehicleType, <BikeIcon size={20} color={theme.primary} />)}
                            {renderField('Vehicle Model', riderProfile.vehicleModel, <BikeIcon size={20} color={theme.primary} />)}
                            {renderField('Vehicle Year', riderProfile.vehicleYear, <CalendarIcon size={20} color={theme.primary} />)}
                            {renderField('Number Plate', riderProfile.numberPlate, <HashIcon size={20} color={theme.primary} />)}
                        </View>

                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, getTextStyle(18, 'bold', isRTL), { color: theme.text, textAlign: 'left', marginBottom: 15 }]}>Vehicle Documents</Text>
                            {renderImage('Vehicle Image', riderProfile.vehicleImageUrl)}
                            {renderImage('Driving License', riderProfile.drivingLicenseImageUrl)}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Verification Status</Text>
                            {renderField('Rider Status', riderProfile.riderStatus === 2 ? 'Approved' : riderProfile.riderStatus === 1 ? 'Pending' : 'Not Submitted')}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <BikeIcon size={60} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No vehicle details found</Text>
                        <Text style={styles.emptySubtext}>Please complete your registration to add vehicle information</Text>
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

export default VehicleDetailsScreen;
