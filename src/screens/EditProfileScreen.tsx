import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SIZES } from '../utils/constants';
import { ChevronLeft, Save, User, MapPin, Calendar, Smartphone, ShieldCheck, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { userService } from '../services/user';
import { useUI } from '../context/UIContext';
import { getFontFamily, getFontSize, getTextStyle } from '../utils/layout';
import { COLORS } from '../utils/constants';
import Header from '../components/Header';

const EditProfileScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const { showError } = useUI();

    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        dateOfBirth: '',
        gender: '',
        address: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        if (!user?.id) return;
        try {
            setFetching(true);
            const res = await userService.getUserById(user.id);
            if (res.data?.data) {
                const data = res.data.data;
                setProfileData(data);
                setFormData({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    phoneNumber: data.phoneNumber || '',
                    dateOfBirth: data.dateOfBirth || '',
                    gender: data.gender || '',
                    address: data.verificationDetails?.address || '',
                });
            }
        } catch (error) {
            console.error('[EditProfile] Failed to fetch profile:', error);
        } finally {
            setFetching(false);
        }
    };

    const handlePhotoSelection = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            uploadPhoto(result.assets[0]);
        }
    };

    const uploadPhoto = async (asset: any) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('File', {
                uri: asset.uri,
                type: 'image/jpeg',
                name: 'profile-picture.jpg',
            } as any);

            const res = await userService.uploadProfilePicture(formData);
            if (res.data?.succeeded) {
                setProfileData({ ...profileData, profilePictureUrl: res.data.data });
                Alert.alert('Success', 'Profile picture updated successfully');
            }
        } catch (error) {
            console.error('[EditProfile] Photo upload failed:', error);
            Alert.alert('Error', 'Failed to upload photo');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profileData?.id) {
            Alert.alert('Error', 'Could not find user record');
            return;
        }

        setLoading(true);
        try {
            await userService.updateUser({
                id: profileData.id,
                firstName: formData.firstName,
                lastName: formData.lastName,
                gender: formData.gender,
                address: formData.address,
            });
            Alert.alert('Success', 'Profile updated successfully!');
            navigation.goBack();
        } catch (error) {
            console.error('[EditProfile] Failed to update profile:', error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (label: string, value: string, icon: any, onChangeText?: (text: string) => void, editable: boolean = true) => (
        <View style={styles.inputContainer}>
            <Text style={[styles.label, getTextStyle(13, 'medium', isRTL), { color: theme.textSecondary, textAlign: 'left' }]}>
                {label}
            </Text>
            <View style={[
                styles.inputWrapper,
                {
                    backgroundColor: editable ? theme.cardBackground : theme.border + '20',
                    borderColor: theme.border,
                    flexDirection: 'row'
                }
            ]}>
                <View style={[styles.inputIcon, { opacity: editable ? 1 : 0.5 }]}>
                    {React.createElement(icon, { color: theme.primary, size: 20 })}
                </View>
                <TextInput
                    style={[styles.input, getTextStyle(15, 'regular', isRTL), {
                        color: theme.text,
                        textAlign: 'left',
                        writingDirection: 'ltr',
                        opacity: editable ? 1 : 0.7,
                        marginLeft: 10
                    }]}
                    value={value}
                    onChangeText={onChangeText}
                    editable={editable}
                    placeholder={`Enter ${label}`}
                    placeholderTextColor={theme.textSecondary + '80'}
                />
            </View>
        </View>
    );

    const renderGenderPicker = () => (
        <View style={styles.genderSection}>
            <Text style={[styles.label, getTextStyle(13, 'medium', isRTL), { color: theme.textSecondary, textAlign: 'left' }]}>
                {t('registration.gender', 'Gender')}
            </Text>
            <View style={[styles.genderContainer, { flexDirection: 'row' }]}>
                {['male', 'female'].map((g) => (
                    <View
                        key={g}
                        style={[
                            styles.genderOption,
                            {
                                backgroundColor: formData.gender === g ? theme.primary + '08' : theme.border + '15',
                                borderColor: formData.gender === g ? theme.primary + '50' : theme.border,
                                opacity: formData.gender === g ? 1 : 0.5,
                                flexDirection: 'row'
                            }
                        ]}
                    >
                        <View style={[
                            styles.radio,
                            { borderColor: formData.gender === g ? theme.primary : theme.textSecondary, opacity: 0.6 }
                        ]}>
                            {formData.gender === g && <View style={[styles.radioInner, { backgroundColor: theme.primary, opacity: 0.6 }]} />}
                        </View>
                        <Text style={[
                            styles.genderLabel,
                            getTextStyle(14, formData.gender === g ? 'semibold' : 'medium', isRTL),
                            {
                                color: formData.gender === g ? theme.primary : theme.textSecondary,
                                opacity: 0.8,
                                marginLeft: 10
                            }
                        ]}>
                            {t(`registration.${g}`, g)}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );

    if (fetching) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
                <Header title={t('profile.personalDetails')} showBack={true} />
                
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
                >
                <View style={styles.avatarSection}>
                    <TouchableOpacity
                        onPress={handlePhotoSelection}
                        style={[styles.avatarWrapper, { borderColor: theme.primaryLight }]}
                        disabled={loading}
                    >
                        {profileData?.profilePictureUrl ? (
                            <Image source={{ uri: profileData.profilePictureUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                                <User color={theme.primary} size={40} />
                            </View>
                        )}
                        <View style={[styles.cameraIconBadge, { backgroundColor: theme.primary }]}>
                            <Camera color="#FFF" size={14} />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.avatarHint, { color: theme.textSecondary, fontFamily: getFontFamily('medium', isRTL) }]}>
                        Tap to change photo
                    </Text>
                </View>

                <View style={styles.form}>
                    {renderInput(t('registration.fullName'), formData.firstName + (formData.lastName ? ' ' + formData.lastName : ''), User, (text) => {
                        const parts = text.trim().split(' ');
                        setFormData({
                            ...formData,
                            firstName: parts[0] || '',
                            lastName: parts.length > 1 ? parts.slice(1).join(' ') : ''
                        });
                    })}

                    {renderInput(t('login.mobileNumber'), formData.phoneNumber, Smartphone, undefined, false)}

                    {renderInput(t('registration.dob'), formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString() : '-', Calendar, undefined, false)}

                    {renderGenderPicker()}

                    {renderInput(t('registration.address'), formData.address, MapPin, (text) => setFormData({ ...formData, address: text }))}
                </View>

                <View style={[styles.infoBox, { backgroundColor: theme.primaryLight + '40', borderColor: theme.primaryLight, flexDirection: 'row' }]}>
                    <ShieldCheck color={theme.primary} size={20} />
                    <Text style={[styles.infoText, getTextStyle(12, 'medium', isRTL), { color: theme.primary, textAlign: 'left', marginLeft: 12 }]}>
                        {isRTL ? 'آپ کی ذاتی معلومات محفوظ ہیں اور صرف تصدیق کے لیے استعمال کی جاتی ہیں۔' : 'Your personal information is secure and used only for verification purposes.'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    </KeyboardAvoidingView>
);
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 100,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18 },
    saveBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    content: { padding: 20 },
    avatarSection: { alignItems: 'center', marginBottom: 30 },
    avatarWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        padding: 3,
    },
    avatar: { width: '100%', height: '100%', borderRadius: 45 },
    form: { marginBottom: 20 },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 13, marginBottom: 8, marginLeft: 4 },
    inputWrapper: {
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    inputIcon: { width: 30, alignItems: 'center' },
    input: { flex: 1, height: '100%', fontSize: 15, paddingHorizontal: 10 },
    infoBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        gap: 12,
    },
    infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
    cameraIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    avatarHint: { fontSize: 13, marginTop: 10 },
    genderSection: { marginBottom: 20 },
    genderContainer: { flexDirection: 'row', gap: 12 },
    genderOption: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        gap: 10,
    },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5 },
    genderLabel: { fontSize: 14, textTransform: 'capitalize' },
});

export default EditProfileScreen;
