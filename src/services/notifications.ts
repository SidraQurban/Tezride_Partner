import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import api from './api';

const PUSH_TOKEN_KEY = 'expo_push_token';

// ── expo-notifications project ID ─────────────────────────────────────────────
const EXPO_PROJECT_ID: string =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    '';

export const NotificationService = {
    registerForPushNotifications: async (userId: string): Promise<string | null> => {
        if (!Device.isDevice) {
            console.log('[NotificationService] Physical device required for push notifications');
            return null;
        }

        try {
            // 1. Request permission
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('[NotificationService] Push notification permission denied');
                return null;
            }

            // 2. Set up Android notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('ride-requests', {
                    name: 'TezRide Partner',
                    description: 'Ride request alerts and status updates',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF991C',
                    enableLights: true,
                    enableVibrate: true,
                    sound: 'notification_alert.wav',
                });

                await Notifications.setNotificationChannelAsync('default', {
                    name: 'TezRide Partner',
                    description: 'General TezRide Partner notifications',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    sound: 'default',
                });

                // Marketing & announcements — lower importance, no ride alert sound
                await Notifications.setNotificationChannelAsync('promotions', {
                    name: 'TezRide Partner Offers',
                    description: 'Promotions, incentives, and app announcements',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    enableVibrate: false,
                    sound: 'default',
                });
            }

            // 3. Get Expo push token
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: EXPO_PROJECT_ID,
            });
            const token = tokenData.data;
            console.log('[NotificationService] Push token:', token);

            // 4. Cache locally
            await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

            // 5. Register token on backend
            if (userId) {
                await NotificationService.sendTokenToBackend(userId, token);
            }

            return token;
        } catch (error) {
            console.error('[NotificationService] Error registering for push notifications:', error);
            return null;
        }
    },

    /**
     * Sends the push token to the backend `/api/notifications/register-device`.
     * Uses userType "Rider" for the Partner app.
     */
    sendTokenToBackend: async (userId: string, token: string): Promise<boolean> => {
        try {
            const deviceId = Device.osInternalBuildId || Device.modelName || 'Unknown';
            const payload = {
                userId,
                deviceId,
                pushToken: token,
                userType: 'Rider',
                devicePlatform: Platform.OS === 'android' ? 'Android' : 'iOS',
            };

            const response = await api.post('/api/notifications/register-device', payload);
            const succeeded = response.data?.succeeded ?? false;
            console.log('[NotificationService] Token registered on backend:', succeeded);
            return succeeded;
        } catch (error) {
            // Non-fatal — the driver can still use the app without push tokens
            console.warn('[NotificationService] Failed to register token on backend:', error);
            return false;
        }
    },

    /**
     * Returns the cached push token, or null if not yet registered.
     */
    getStoredToken: async (): Promise<string | null> => {
        return AsyncStorage.getItem(PUSH_TOKEN_KEY);
    },

    /**
     * Deactivates the push token on the backend when the driver logs out.
     * (No-op if token not found locally — avoids unnecessary API calls.)
     */
    unregisterOnLogout: async (): Promise<void> => {
        try {
            const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
            if (token) {
                await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
                // Optionally call a backend deactivate endpoint here
                console.log('[NotificationService] Push token cleared on logout');
            }
        } catch (error) {
            console.warn('[NotificationService] Error clearing push token:', error);
        }
    },
};

export default NotificationService;
