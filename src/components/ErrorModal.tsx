import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFontFamily } from '../utils/layout';

const orangeLottie = require('../assets/lotties/map_orange.json');
const pinkLottie = require('../assets/lotties/map_pink.json');

interface ErrorModalProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
    buttonText?: string;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ visible, title, message, onClose, buttonText = 'OK' }) => {
    const { theme, isFemale } = useTheme();
    const { isRTL } = useLanguage();

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.cardBackground || '#FFF' }]}>
                    <LottieView
                        source={isFemale ? pinkLottie : orangeLottie}
                        autoPlay
                        loop
                        style={styles.lottie}
                    />
                    <Text style={[styles.title, { color: theme.text, fontFamily: getFontFamily('bold', isRTL) }]}>
                        {title}
                    </Text>
                    <Text style={[styles.description, { color: theme.textSecondary, fontFamily: getFontFamily('regular', isRTL) }]}>
                        {message}
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary }]}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.buttonText, { fontFamily: getFontFamily('bold', isRTL) }]}>
                            {buttonText}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.18,
                shadowRadius: 20,
            },
            android: { elevation: 10 },
        }),
    },
    lottie: {
        width: 120,
        height: 120,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
    },
});

export default ErrorModal;
