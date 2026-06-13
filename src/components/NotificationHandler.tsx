import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import SoundService from '../utils/SoundService';
import { RideNotificationBridge } from '../utils/RideNotificationBridge';
import { SignalRService } from '../services/SignalRService';

/**
 * NotificationHandler (Partner App)
 * Orchestrates signalR sounds and push notifications.
 */

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NotificationHandler: React.FC = () => {
  useEffect(() => {
    // 1. Preload sounds
    SoundService.preload();

    // 2. Setup Android channels
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('ride-requests', {
        name: 'Ride Requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'notification_alert.wav', // Fallback
      });
    }

    // 3. Listen to SignalR events for foreground sounds
    const events = ['ride_request', 'RideRequest', 'ride_confirmed', 'RideConfirmed'];
    const unsubs = events.map(event => 
      SignalRService.on('DRIVER', event, () => {
        RideNotificationBridge.handleEvent(event);
      })
    );

    return () => {
      unsubs.forEach(unsub => unsub());
      SoundService.unload();
    };
  }, []);

  return null;
};

export default NotificationHandler;
