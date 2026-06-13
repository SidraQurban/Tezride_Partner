import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Platform,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { User, Settings, ChevronRight, LogOut, Star, Camera } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userService } from '../services/user';
import { ridesService } from '../services/rides';
import { getFontFamily, getFontSize } from '../utils/layout';
import { ImageUploadService } from '../services/ImageUploadService';
import { formatPhoneNumber } from '../utils/helpers';

import Header from '../components/Header';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { user, signOut } = useAuth();
    const { theme } = useTheme();
    const [profileData, setProfileData] = React.useState<any>(null);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [totalRides, setTotalRides] = React.useState(0);

    React.useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        if (!user?.id) return;
        try {
            const [profileRes, statsRes] = await Promise.all([
                userService.getUserById(user.id),
                ridesService.getRiderStats(),
            ]);

            if (profileRes?.data?.data) {
                setProfileData(profileRes.data.data);
            }
            if (statsRes?.data?.succeeded) {
                setTotalRides(statsRes.data.data.totalRides || 0);
                if (statsRes.data.data.rating || statsRes.data.data.averageRating) {
                    setProfileData((prev: any) => {
                        const base = prev || {};
                        return {
                            ...base,
                            rating: statsRes.data.data.rating || statsRes.data.data.averageRating
                        };
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleImagePick = async () => {
        const result = await ImageUploadService.pickImage();
        if (result) {
            uploadImage(result.uri);
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            const data = new FormData();
            const filename = uri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            // @ts-ignore
            data.append('File', {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: filename || 'profile.jpg',
                type,
            });

            setUploading(true);
            setUploadProgress(10);
            
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => prev < 90 ? prev + 10 : prev);
            }, 200);

            await userService.uploadProfilePicture(data);
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                Alert.alert('Success', 'Profile picture updated successfully!');
                fetchProfile();
            }, 500);
        } catch (error) {
            setUploading(false);
            Alert.alert('Error', 'Failed to upload profile picture.');
        }
    };

    const handleLogout = async () => {
        await signOut();
    };

    const menuItems = [
        { id: '1', title: t('profile.personalDetails'), icon: require('../assets/people.png'), color: '#4F46E5', screen: 'EditProfile' },
        { id: '2', title: t('profile.vehicleDetails'), icon: require('../assets/superbike.png'), color: '#10B981', screen: 'VehicleDetails' },
        { id: '3', title: t('profile.documents'), icon: require('../assets/security.png'), color: '#F59E0B', screen: 'Documents' },
        { id: '4', title: t('settings.title'), icon: Settings, color: '#64748B', screen: 'Settings' },
    ];

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <Header title={t('profile.title')} showBack={true} />
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
            >
                {/* Profile Header */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarWrapper, { borderColor: theme.primaryLight }]}>
                            {profileData?.profilePictureUrl ? (
                                <Image source={{ uri: profileData.profilePictureUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                                    <User color={theme.primary} size={40} />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity 
                            style={[styles.editBadge, { backgroundColor: theme.primary }]}
                            onPress={handleImagePick}
                        >
                            <Camera color="#FFF" size={16} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.name, { color: theme.text, fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(18, isRTL) }]}>
                        {profileData?.firstName
                            ? `${profileData.firstName}${profileData.lastName ? ' ' + profileData.lastName : ''}`
                            : (user?.name || 'Partner')}
                    </Text>
                    <Text style={[styles.phone, { color: theme.textSecondary, fontFamily: getFontFamily('medium', isRTL), fontSize: getFontSize(14, isRTL), writingDirection: 'ltr' }]}>
                        {formatPhoneNumber(profileData?.phoneNumber || user?.phoneNumber)}
                    </Text>

                    <View style={styles.ratingBadge}>
                        <Star color="#F59E0B" size={16} fill="#F59E0B" />
                        <Text style={[styles.ratingText, { fontSize: getFontSize(14, isRTL) }]}>
                            {profileData?.rating?.toFixed(1) || profileData?.averageRating?.toFixed(1) || '5.0'} ({totalRides || profileData?.totalRides || 0} {t('dashboard.trips')})
                        </Text>
                    </View>
                </View>

                {/* Menu Items */}
                <View style={styles.menuContainer}>
                    {menuItems.map((item) => (
                        <TouchableOpacity 
                            key={item.id} 
                            style={[styles.menuItem, { flexDirection: 'row' }]}
                            onPress={() => navigation.navigate(item.screen)}
                        >
                            <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]}>
                                {typeof item.icon === 'number' ? (
                                    <Image source={item.icon} style={{ width: 22, height: 22, tintColor: item.color }} resizeMode="contain" />
                                ) : (
                                    <item.icon color={item.color} size={22} />
                                )}
                            </View>
                            <Text style={[styles.menuLabel, { 
                                color: theme.text, 
                                fontFamily: getFontFamily('medium', isRTL),
                                fontSize: getFontSize(16, isRTL),
                                textAlign: 'left',
                                marginLeft: 15,
                            }]}>
                                {item.title}
                            </Text>
                            <ChevronRight color={theme.border} size={20} style={{ transform: [{ scaleX: 1 }] }} />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity 
                    style={[styles.logoutBtn, { flexDirection: 'row' }]} 
                    onPress={handleLogout}
                >
                    <View style={[styles.menuIconBg, { backgroundColor: theme.error + '15' }]}>
                        <LogOut color={theme.error} size={22} />
                    </View>
                    <Text style={[styles.logoutText, { 
                        color: theme.error, 
                        fontFamily: getFontFamily('bold', isRTL),
                        fontSize: getFontSize(16, isRTL),
                        marginLeft: 15,
                    }]}>
                        {t('profile.logout')}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>
                    {t('profile.version', { version: '1.2.4' })}
                </Text>
            </ScrollView>

            {uploading && (
                <View style={styles.uploadOverlay}>
                    <View style={styles.uploadCard}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.uploadText, { color: theme.text }]}>Uploading...</Text>
                        <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: theme.primary }]} />
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    header: { alignItems: 'center', marginBottom: 30 },
    avatarContainer: { marginBottom: 15 },
    avatarWrapper: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 4,
        padding: 4,
    },
    avatar: { width: '100%', height: '100%', borderRadius: 50 },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    name: { fontSize: 22, marginBottom: 4 },
    phone: { fontSize: 16, opacity: 0.7, marginBottom: 12 },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    ratingText: { marginLeft: 6, fontSize: 13, color: '#F59E0B', fontWeight: 'bold' },
    menuContainer: { marginBottom: 30 },
    menuItem: {
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    menuIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuLabel: { flex: 1, fontSize: 16 },
    logoutBtn: {
        alignItems: 'center',
        paddingVertical: 15,
    },
    logoutText: { fontSize: 16 },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 20,
    },
    uploadOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    uploadCard: {
        width: width * 0.8,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
    },
    uploadText: { fontSize: 18, fontWeight: 'bold', marginVertical: 20 },
    progressBg: { width: '100%', height: 6, backgroundColor: '#F1F5F9', borderRadius: 3 },
    progressFill: { height: '100%', borderRadius: 3 },
});

export default ProfileScreen;
