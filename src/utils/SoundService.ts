import { Audio } from 'expo-av';

/**
 * SoundService (Partner App)
 * Manages notification sounds for ride requests and completions.
 */

const SOUNDS = {
  notification: require('../assets/notification_alert.mp3'),
  completed: require('../assets/completed_ride_alert.mp3'),
};

let loadedSounds: { [key: string]: Audio.Sound } = {};

const SoundService = {
  /**
   * Preloads all notification sounds into memory.
   */
  preload: async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      for (const [key, source] of Object.entries(SOUNDS)) {
        if (!loadedSounds[key]) {
          const { sound } = await Audio.Sound.createAsync(source);
          loadedSounds[key] = sound;
        }
      }
      console.log('[SoundService:Partner] All sounds preloaded.');
    } catch (error) {
      console.warn('[SoundServiceUnits:Partner] Preload failed:', (error as any)?.message);
    }
  },

  /**
   * Plays a specific sound by key.
   * @param key - 'notification' or 'completed'
   */
  play: async (key: string = 'notification') => {
    try {
      const sound = loadedSounds[key];
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } else {
        // Fallback for missing/unloaded sounds
        const { sound: newSound } = await Audio.Sound.createAsync(SOUNDS[key as keyof typeof SOUNDS]);
        loadedSounds[key] = newSound;
        await newSound.playAsync();
      }
    } catch (error) {
      console.warn(`[SoundService:Partner] Play failed for ${key}:`, (error as any)?.message);
    }
  },

  /**
   * Release all sound objects.
   */
  unload: async () => {
    try {
      for (const key in loadedSounds) {
        await loadedSounds[key].unloadAsync();
      }
      loadedSounds = {};
      console.log('[SoundService:Partner] All sounds unloaded.');
    } catch (error) {
      console.warn('[SoundService:Partner] Unload failed:', (error as any)?.message);
    }
  },
};

export default SoundService;
