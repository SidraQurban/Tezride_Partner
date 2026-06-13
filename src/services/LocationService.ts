import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import { driverService } from './driver';
import { BACKGROUND_LOCATION_TASK } from './BackgroundTaskService';

const LOCATION_TASK_NAME = BACKGROUND_LOCATION_TASK;

/**
 * Sends driver location to the backend API
 */
const sendLocationToBackend = async (latitude: number, longitude: number) => {
  try {
    // This will be handled by the backend team per requirements
    // For now, we implement the frontend call logic
    await driverService.updateLocation({ lat: latitude, lon: longitude });
    console.log(`[LocationService] Updated: ${latitude}, ${longitude}`);
  } catch (err: any) {
    console.warn('[LocationService] API Sync failed:', err.message);
  }
};

/**
 * Location Service to manage foreground and background tracking
 */
export const LocationService = {
  /**
   * Request both foreground and background permissions
   */
  async requestPermissions() {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') return false;

      // CRITICAL FIX: Background location is highly restricted in Expo Go 
      // and often causes native crashes if specific keys aren't matched in the binary.
      // We only request it if we are NOT in Expo Go or if explicitly needed.
      if (Constants.appOwnership === 'expo') {
        console.log('[LocationService] Running in Expo Go, skipping background permission request to prevent crash.');
        return true;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      return backgroundStatus === 'granted';
    } catch (err) {
      console.error('[LocationService] Permission error:', err);
      return false;
    }
  },

  /**
   * Start tracking location in background
   */
  async startTracking() {
    try {
      const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
      if (!isTaskDefined) {
        console.warn('[LocationService] Task not defined, skipping background tracking');
        return false;
      }

      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          console.log('[LocationService] Background tracking already active');
          return true;
        }
      } catch (err: any) {
        console.warn('[LocationService] Could not check tracking status:', err?.message);
      }

      // Skip background tasks in Expo Go as they require native Info.plist keys
      // that are often not present in the standard Expo Go binary.
      if (Constants.appOwnership === 'expo') {
        console.log('[LocationService] Running in Expo Go - foreground mode only');
        return true;
      }

      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: "TezRide Partner",
            notificationBody: "Tracking your location for better ride matches",
            notificationColor: "#FF991C",
          },
          pausesUpdatesAutomatically: false,
          deferredUpdatesInterval: 10000,
          deferredUpdatesDistance: 10,
        });
        console.log('[LocationService] Background tracking started');
        return true;
      } catch (startErr: any) {
        console.warn('[LocationService] Failed to start tracking:', startErr?.message || startErr);
        return false;
      }
    } catch (err: any) {
      console.error('[LocationService] startTracking error:', err);
      return false;
    }
  },

  /**
   * Stop all tracking
   */
  async stopTracking() {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('[LocationService] Background tracking stopped');
      }
    } catch (err: any) {
      console.warn('[LocationService] stopTracking error:', err?.message);
    }
  }
};
