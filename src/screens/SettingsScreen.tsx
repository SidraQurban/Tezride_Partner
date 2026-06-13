import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Alert,
    Modal,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '../utils/constants';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, ChevronDown, Globe, Bell, ShieldCheck, Info, LogOut, User, Check } from 'lucide-react-native';
import { getTextAlign, getFontFamily, getFontSize } from '../utils/layout';
import Header from '../components/Header';

const LANGUAGE_OPTIONS = [
    { code: 'en', label: 'English' },
    { code: 'ur', label: 'اردو' },
] as const;

const ChevronRightIcon = ChevronRight as any;
const GlobeIcon = Globe as any;
const BellIcon = Bell as any;
const ShieldCheckIcon = ShieldCheck as any;
const InfoIcon = Info as any;
const LogOutIcon = LogOut as any;
const UserIcon = User as any;

const SettingsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { language, setLanguage, isRTL } = useLanguage();
    const { signOut } = useAuth();
    const insets = useSafeAreaInsets();
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

    const selectedLanguage =
        LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

    const handleLanguageSelect = async (code: 'en' | 'ur') => {
        if (code !== language) {
            await setLanguage(code);
        }
        setLanguageMenuOpen(false);
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    },
                },
            ]
        );
    };

    const SettingItem = ({ icon, title, value, onValueChange, showSwitch, onPress, rightLabel }: any) => (
        <TouchableOpacity
            style={[styles.item, { flexDirection: 'row' }]}
            onPress={onPress}
            disabled={showSwitch && !onPress}
            activeOpacity={showSwitch ? 1 : 0.7}
        >
            <View style={[styles.itemLeft, { flexDirection: 'row' }]}>
                <View style={[styles.iconBox, { marginRight: 14 }]}>{icon}</View>
                <Text style={[styles.itemTitle, { textAlign: 'left', fontFamily: getFontFamily('medium', isRTL), fontSize: getFontSize(16, isRTL) }]}>
                    {title}
                </Text>
            </View>
            {showSwitch ? (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: '#D1D5DB', true: COLORS.primary }}
                    thumbColor={COLORS.white}
                    style={{ transform: [{ scaleX: 1 }] }}
                />
            ) : rightLabel ? (
                <View style={styles.rightLabelPill}>
                    <Text style={[styles.rightLabelText, { fontSize: getFontSize(12, isRTL) }]}>{rightLabel}</Text>
                </View>
            ) : (
                <ChevronRightIcon
                    size={20}
                    color={COLORS.border}
                    style={{ transform: [{ scaleX: 1 }] }}
                />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('settings.title')} showBack={true} />
            <ScrollView
                contentContainerStyle={[
                    styles.content as any,
                    { paddingBottom: insets.bottom + 80 },
                ]}
            >
                {/* Preferences section */}
                <Text style={[styles.sectionTitle, { textAlign: 'left', fontFamily: getFontFamily('bold', isRTL), fontSize: getFontSize(12, isRTL) }]}>
                    {t('settings.preferences')}
                </Text>
                <View style={styles.sectionCard}>
                    <View style={[styles.languageRow, { flexDirection: 'row' }]}>
                        <View style={[styles.itemLeft, { flexDirection: 'row' }]}>
                            <View style={[styles.iconBox, { marginRight: 14 }]}>
                                <GlobeIcon size={20} color={COLORS.primary} />
                            </View>
                            <Text style={[styles.itemTitle, { textAlign: 'left', fontFamily: getFontFamily('medium', isRTL), fontSize: getFontSize(16, isRTL) }]}>
                                {t('settings.language')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.languageDropdown, { flexDirection: 'row' }]}
                            onPress={() => setLanguageMenuOpen(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.languageDropdownText, { fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(14, isRTL) }]}>
                                {selectedLanguage.label}
                            </Text>
                            <ChevronDown size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <Modal
                        visible={languageMenuOpen}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setLanguageMenuOpen(false)}
                    >
                        <Pressable style={styles.dropdownBackdrop} onPress={() => setLanguageMenuOpen(false)}>
                            <Pressable
                                style={[styles.dropdownMenu, { alignSelf: 'flex-end', marginRight: 24 }]}
                                onPress={(e) => e.stopPropagation()}
                            >
                                {LANGUAGE_OPTIONS.map((option) => {
                                    const isSelected = language === option.code;
                                    return (
                                        <TouchableOpacity
                                            key={option.code}
                                            style={[
                                                styles.dropdownOption,
                                                { flexDirection: 'row' },
                                                isSelected && styles.dropdownOptionSelected,
                                            ]}
                                            onPress={() => handleLanguageSelect(option.code)}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownOptionText,
                                                    isSelected && styles.dropdownOptionTextSelected,
                                                    { fontFamily: getFontFamily('medium', option.code === 'ur'), fontSize: getFontSize(14, isRTL) },
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                            {isSelected ? <Check size={18} color={COLORS.primary} /> : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </Pressable>
                        </Pressable>
                    </Modal>

                    {/* Bell Notifications */}
                    <SettingItem
                        icon={<BellIcon size={20} color={COLORS.textSecondary} />}
                        title={t('settings.pushNotif')}
                        showSwitch={true}
                        value={true}
                        onValueChange={() => {}}
                    />
                </View>

                {/* Account section */}
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left', fontFamily: getFontFamily('bold', isRTL) }]}>
                    {t('common.account', 'Account')}
                </Text>
                <View style={styles.sectionCard}>
                    <SettingItem
                        icon={<UserIcon size={20} color={COLORS.textSecondary} />}
                        title={t('navigation.profile', 'Profile')}
                        onPress={() => navigation.navigate('Profile')}
                    />
                </View>

                {/* Security section */}
                <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left', fontFamily: getFontFamily('bold', isRTL) }]}>
                    {t('settings.security')}
                </Text>
                <View style={styles.sectionCard}>
                    <SettingItem
                        icon={<ShieldCheckIcon size={20} color={COLORS.textSecondary} />}
                        title={t('dashboard.safety', 'Safety')}
                        onPress={() => navigation.navigate('Safety')}
                    />
                    <SettingItem
                        icon={<InfoIcon size={20} color={COLORS.textSecondary} />}
                        title={t('dashboard.support', 'Support')}
                        onPress={() => navigation.navigate('Support')}
                    />
                    <SettingItem
                        icon={<ShieldCheckIcon size={20} color={COLORS.textSecondary} />}
                        title={t('settings.privacyPolicy')}
                        onPress={() => {}}
                    />
                    <SettingItem
                        icon={<InfoIcon size={20} color={COLORS.textSecondary} />}
                        title={t('settings.tos')}
                        onPress={() => {}}
                    />
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOutIcon color="#EF4444" size={20} />
                    <Text style={[styles.logoutText, { fontFamily: getFontFamily('semibold', isRTL) }]}>Logout</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>{t('settings.deleteAccount')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.secondaryBackground },
    content: { padding: SIZES.padding },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 10,
        marginTop: 24,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    sectionCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemTitle: { fontSize: 15, color: COLORS.text },
    rightLabelPill: {
        backgroundColor: COLORS.primary + '18',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    rightLabelText: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.primary,
    },
    languageRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    languageDropdown: {
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primary + '12',
        borderWidth: 1,
        borderColor: COLORS.primary + '35',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 120,
        justifyContent: 'space-between',
    },
    languageDropdownText: {
        fontSize: 14,
        color: COLORS.primary,
    },
    dropdownBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-start',
        paddingTop: 180,
        paddingHorizontal: 16,
    },
    dropdownMenu: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        overflow: 'hidden',
        minWidth: 200,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    dropdownOption: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    dropdownOptionSelected: {
        backgroundColor: COLORS.primary + '10',
    },
    dropdownOptionText: {
        fontSize: 15,
        color: COLORS.text,
    },
    dropdownOptionTextSelected: {
        color: COLORS.primary,
        fontFamily: 'Poppins_600SemiBold',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 32,
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    logoutText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#EF4444' },
    deleteBtn: { marginTop: 20, alignItems: 'center', padding: 15 },
    deleteText: { color: COLORS.textSecondary, fontFamily: 'Poppins_500Medium', fontSize: 13 },
});

export default SettingsScreen;
