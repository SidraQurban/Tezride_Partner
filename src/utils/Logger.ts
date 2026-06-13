import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, Clipboard } from 'react-native';

const ERROR_LOG_KEY = 'app_error_logs';
const MAX_LOGS = 10;

export interface ErrorLog {
    timestamp: string;
    message: string;
    stack?: string;
    isFatal: boolean;
    deviceInfo: {
        os: string;
        version: string;
        isDev: boolean;
    };
}

export const Logger = {
    async logError(error: Error | string, isFatal: boolean = false) {
        try {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            
            const newLog: ErrorLog = {
                timestamp: new Date().toISOString(),
                message,
                stack,
                isFatal,
                deviceInfo: {
                    os: Platform.OS,
                    version: String(Platform.Version),
                    isDev: __DEV__,
                },
            };

            const existingLogsRaw = await AsyncStorage.getItem(ERROR_LOG_KEY);
            const existingLogs: ErrorLog[] = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
            
            const updatedLogs = [newLog, ...existingLogs].slice(0, MAX_LOGS);
            await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
            
            console.error(`[Logger] Captured ${isFatal ? 'Fatal ' : ''}Error:`, message);
        } catch (e) {
            console.warn('[Logger] Failed to save error log:', e);
        }
    },

    async getLogs(): Promise<ErrorLog[]> {
        try {
            const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
            return logs ? JSON.parse(logs) : [];
        } catch {
            return [];
        }
    },

    async clearLogs() {
        await AsyncStorage.removeItem(ERROR_LOG_KEY);
    },

    copyToClipboard(text: string) {
        Clipboard.setString(text);
        Alert.alert('Success', 'Error log copied to clipboard');
    }
};

/**
 * Initialize global error handlers
 */
export const initGlobalErrorHandlers = () => {
    // 1. JS Exception Handler (Standard React Native)
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler(async (error: any, isFatal?: boolean) => {
        await Logger.logError(error, !!isFatal);
        
        // In production, we might want to show an alert if it's fatal
        if (isFatal && !__DEV__) {
            Alert.alert(
                'Unexpected Crash',
                `The app encountered a fatal error:\n\n${error.message}\n\nPlease share this with the developers.`,
                [{ text: 'OK' }]
            );
        }
        
        // Call original handler to allow standard crash behavior
        originalHandler(error, isFatal);
    });

    // 2. Unhandled Promise Rejections
    // @ts-ignore
    if (global.Promise && global.Promise.onUnhandled) {
        // @ts-ignore
        global.Promise.onUnhandled = (id, rejection) => {
            Logger.logError(`Unhandled Rejection: ${rejection}`);
        };
    }
};
