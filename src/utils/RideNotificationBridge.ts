import SoundService from './SoundService';

/**
 * RideNotificationBridge (Partner App)
 * Maps incoming SignalR/Push events to audio and UI feedback.
 */

interface NotificationConfig {
  playSound?: boolean;
  soundKey?: 'notification' | 'completed';
  title?: string;
  message?: string;
}

const RIDE_SOUND_EVENTS: Record<string, NotificationConfig> = {
  // New ride request available
  ride_request: {
    playSound: true,
    soundKey: 'notification',
  },
  RideRequest: {
    playSound: true,
    soundKey: 'notification',
  },
  // Ride confirmed (assigned to this driver)
  ride_confirmed: {
    playSound: true,
    soundKey: 'notification',
  },
  RideConfirmed: {
    playSound: true,
    soundKey: 'notification',
  },
  // Custom event for ride completion
  ride_completed: {
    playSound: true,
    soundKey: 'completed',
  }
};

export const RideNotificationBridge = {
  /**
   * Main entry point to bridge an event to a sound/notification.
   */
  handleEvent: async (eventName: string) => {
    const config = RIDE_SOUND_EVENTS[eventName];
    if (!config) return;

    if (config.playSound) {
      await SoundService.play(config.soundKey || 'notification');
    }
  }
};
