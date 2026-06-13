import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StackNavigator from './navigation/StackNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRide } from './context/RideContext';


import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RideProvider } from './context/RideContext';
import { CustomerProvider } from './context/CustomerContext';
import { UIProvider } from './context/UIContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { navigationRef, setNavigationReady } from './services/NavigationService';
import ErrorBoundary from './components/ErrorBoundary';
import OverlayPermissionModal from './components/OverlayPermissionModal';
import NotificationHandler from './components/NotificationHandler';

import './locales/i18n';
import {
    useFonts,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { FONTS } from './utils/constants';

const applyGlobalTypography = () => {
    try {
        // In RN 0.76+, defaultProps is deprecated and often non-configurable.
        // We attempt a safe check and wrap everything in try-catch to ensure zero startup impact.
        const TextComponent = Text as any;
        if (TextComponent && TextComponent.defaultProps) {
            TextComponent.defaultProps.style = [
                { fontFamily: FONTS.regular },
                TextComponent.defaultProps.style,
            ];
        } else if (TextComponent) {
            // If defaultProps doesn't exist, we try to create it, but catch any errors 
            // if the object is sealed or non-extensible.
            try {
                TextComponent.defaultProps = { style: { fontFamily: FONTS.regular } };
            } catch (e) {
                // Ignore errors on sealed properties
            }
        }
    } catch (e) {
        console.warn('[Typography] Could not set Text defaultProps:', e);
    }

    try {
        const TextInputComponent = TextInput as any;
        if (TextInputComponent && TextInputComponent.defaultProps) {
            TextInputComponent.defaultProps.style = [
                { fontFamily: FONTS.regular, textAlign: 'left', writingDirection: 'ltr' },
                TextInputComponent.defaultProps.style,
            ];
        } else if (TextInputComponent) {
            try {
                TextInputComponent.defaultProps = { style: { fontFamily: FONTS.regular, textAlign: 'left', writingDirection: 'ltr' } };
            } catch (e) {
                // Ignore errors on sealed properties
            }
        }
    } catch (e) {
        console.warn('[Typography] Could not set TextInput defaultProps:', e);
    }
};

applyGlobalTypography();

/**
 * Inner component that can safely call useLanguage()
 * (only renders after LanguageProvider is mounted).
 */
// Removed OnlineStatusOverlay to resolve user request regarding "unrelevant Online icon display on top of header"

const AppContent = () => {
    return (
        <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady()}>
            <View style={{ flex: 1, direction: 'ltr' }}>
                <StatusBar style="auto" />
                <StackNavigator />
                <OverlayPermissionModal />
            </View>
        </NavigationContainer>
    );
};

export default function App() {
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
        NotoNastaliqUrdu_400Regular,
        NotoNastaliqUrdu_700Bold,
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary>
                {/*
                 * Provider order (outermost → innermost):
                 *   AuthProvider   — manages JWT token, no deps
                 *   LanguageProvider — loads saved language from AsyncStorage before rendering children
                 *   RideProvider   — SignalR service (reads token via AsyncStorage directly)
                 *   SafeAreaProvider → NavigationContainer → Screens
                 */}
                <AuthProvider>
                    <ThemeProvider>
                        <LanguageProvider>
                            <UIProvider>
                                <RideProvider>
                                    <NotificationHandler />
                                    <CustomerProvider>
                                        <SafeAreaProvider>
                                            <AppContent />
                                        </SafeAreaProvider>
                                    </CustomerProvider>
                                </RideProvider>
                            </UIProvider>
                        </LanguageProvider>
                    </ThemeProvider>
                </AuthProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}


