import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignalRService } from './SignalRService';
import { driverService } from './driver';
import { safeParseJson } from '../utils/rideSafety';

export const BACKGROUND_LOCATION_TASK = 'tezride-background-location';

// Define the task at the top level of this module
try {
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
        TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
            if (error) {
                console.error('[BGLocation] Task error:', error.message);
                return;
            }
            if (data?.locations?.[0]) {
                const { latitude, longitude } = data.locations[0].coords;
                try {
                    let sent = false;
                    // Attempt SignalR first
                    if (SignalRService.isConnected('DRIVER')) {
                        try {
                            const raw = await AsyncStorage.getItem('driverProfile');
                            const profile = safeParseJson(raw, { vehicleType: 'bike', gender: 'male', rating: 4.5 }) as any;

                            // Read cached route info set by NavigationRide when it calculates the active leg
                            const routeRaw = await AsyncStorage.getItem('lastRouteInfo');
                            const routeInfo = safeParseJson(routeRaw, {}) as any;

                            await SignalRService.invoke('DRIVER', 'UpdateLocation', {
                                vehicleType: profile.vehicleType || 'bike',
                                lat: latitude,
                                lon: longitude,
                                gender: profile.gender || 'male',
                                rating: profile.rating || 4.5,
                                isActive: true,
                                driverName: profile.driverName || '',
                                profilePicUrl: profile.profilePicUrl || '',
                                vehiclePlateNumber: profile.vehiclePlateNumber || '',
                                distanceRemaining: routeInfo?.distance || null,
                                durationRemaining: routeInfo?.duration || null,
                            });
                            sent = true;
                        } catch (invokeErr) {
                            console.warn('[BGLocation] SignalR invoke failed in background, falling back to REST');
                        }
                    }

                    if (!sent) {
                        // REST Fallback
                        await driverService.updateLocation({
                            lat: latitude,
                            lon: longitude,
                            isActive: true
                        });
                    }
                } catch (err: any) {
                    console.warn('[BGLocation] Background update failed:', err?.message);
                }
            }
        });
        console.log('[BackgroundTaskService] Background location task defined');
    }
} catch (err) {
    console.warn('[BackgroundTaskService] Failed to define task:', err);
}

export default {
    BACKGROUND_LOCATION_TASK,
};
