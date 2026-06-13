import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import OverlayService from '../native/OverlayService';
import { useRide } from '../context/RideContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFontFamily } from '../utils/layout';

const overlayLottie = require('../assets/lotties/wired-gradient-37-approve-checked-simple-hover-pinch.json');

const OverlayPermissionModal: React.FC = () => {
    const { showOverlayPermissionPrompt, setShowOverlayPermissionPrompt, isOnline } = useRide();
    const { isFemale } = useTheme();
    const { isRTL } = useLanguage();

    const handleAllow = async () => {
        setShowOverlayPermissionPrompt(false);
        if (Platform.OS !== 'android') return;

        try {
            await OverlayService.requestOverlayPermission();
            const granted = await OverlayService.hasOverlayPermission();
            if (granted && isOnline) {
                await OverlayService.startOverlay({ 
                    label: 'TezRide',
                    color: isFemale ? '#E91E63' : '#FF991C'
                });
            }
        } catch (err) {
            console.warn('[OverlayPermissionModal] permission request failed', err);
        }
    };

    return (
        <Modal visible={showOverlayPermissionPrompt} transparent animationType="fade">
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.animationWrapper}>
                        <LottieView source={overlayLottie} autoPlay loop style={styles.lottie} />
                    </View>
                    <Text style={[styles.title, { fontFamily: getFontFamily('bold', isRTL) }]}>Enable Background Mode</Text>
                    <Text style={[styles.message, { fontFamily: getFontFamily('regular', isRTL) }]}>
                        To keep receiving ride requests and ensure navigation works while using other apps, please enable background permissions.
                    </Text>

                    {Platform.OS === 'android' && Number(Platform.Version) >= 33 && (
                        <View style={styles.restrictedNote}>
                            <Text style={[styles.restrictedTitle, { fontFamily: getFontFamily('bold', isRTL) }]}>Important for Android 13+:</Text>
                            <Text style={[styles.restrictedText, { fontFamily: getFontFamily('regular', isRTL) }]}>
                                If the option is disabled, long press the App Icon {'>'} App Info {'>'} tap ⋮ (top right) {'>'} "Allow restricted settings".
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.primaryButton} onPress={handleAllow} activeOpacity={0.8}>
                        <Text style={styles.primaryButtonText}>Allow Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowOverlayPermissionPrompt(false)} activeOpacity={0.8}>
                        <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    animationWrapper: {
        width: 160,
        height: 160,
        marginBottom: 12,
    },
    lottie: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#101828',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 14,
        color: '#475569',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    restrictedNote: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        width: '100%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    restrictedTitle: {
        fontSize: 13,
        color: '#1E293B',
        marginBottom: 4,
    },
    restrictedText: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 16,
    },
    primaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FF991C',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    secondaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 15,
    },
});

export default OverlayPermissionModal;
