import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

let isNavigationReady = false;
const pendingNavigationActions: Array<() => void> = [];

const flushPendingNavigationActions = () => {
    if (!isNavigationReady) return;
    while (pendingNavigationActions.length > 0) {
        const action = pendingNavigationActions.shift();
        try { action?.(); } catch (e) { console.warn('[NavigationService] pending action failed', e); }
    }
};

export function setNavigationReady() {
    isNavigationReady = true;
    flushPendingNavigationActions();
}

export function navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
        if (params) {
            console.log(`[NavigationService] Navigating to: ${name}`, params);
        } else {
            console.log(`[NavigationService] Navigating to: ${name}`);
        }
        navigationRef.navigate(name, params as any);
    } else {
        console.warn('[NavigationService] Navigator not ready, buffering navigation to', name);
        pendingNavigationActions.push(() => navigate(name, params));
    }
}

export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
    } else {
        pendingNavigationActions.push(() => goBack());
    }
}

export function resetRoot(state: { index: number; routes: Array<{ name: string; params?: object }> }) {
    if (navigationRef.isReady()) {
        navigationRef.reset(state);
    } else {
        console.warn('[NavigationService] Navigator not ready, buffering reset');
        pendingNavigationActions.push(() => resetRoot(state));
    }
}

export default {
    navigationRef,
    setNavigationReady,
    navigate,
    goBack,
    resetRoot,
};
