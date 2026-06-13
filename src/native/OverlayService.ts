import { NativeModules, Platform, Linking } from 'react-native';

const { TezrideOverlay } = NativeModules as any || {};

const isAndroid = Platform.OS === 'android';

export const hasOverlayPermission = async (): Promise<boolean> => {
    if (!isAndroid || !TezrideOverlay || !TezrideOverlay.hasOverlayPermission) return false;
    try {
        return await TezrideOverlay.hasOverlayPermission();
    } catch (e) {
        return false;
    }
};

export const requestOverlayPermission = async (): Promise<void> => {
    if (!isAndroid) return;
    // If native module provides a request flow, use it, otherwise open settings
    try {
        if (TezrideOverlay && TezrideOverlay.requestOverlayPermission) {
            await TezrideOverlay.requestOverlayPermission();
            return;
        }
    } catch (_) { }

    // Fallback: deep link to Android overlay permission settings
    try {
        await Linking.openSettings();
    } catch (_) { }
};

export const startOverlay = async (opts?: { icon?: string; label?: string; color?: string }) => {
    if (!isAndroid || !TezrideOverlay || !TezrideOverlay.startOverlay) return;
    try {
        await TezrideOverlay.startOverlay(opts || {});
    } catch (e) {
        console.warn('[OverlayService] startOverlay failed:', e);
    }
};

export const stopOverlay = async () => {
    if (!isAndroid || !TezrideOverlay || !TezrideOverlay.stopOverlay) return;
    try {
        await TezrideOverlay.stopOverlay();
    } catch (e) {
        console.warn('[OverlayService] stopOverlay failed:', e);
    }
};

export default {
    hasOverlayPermission,
    requestOverlayPermission,
    startOverlay,
    stopOverlay,
};
