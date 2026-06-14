import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { navigate, navigationRef } from '../services/NavigationService';
import { SignalRService } from '../services/SignalRService';
import { NotificationService } from '../services/notifications';

interface AuthUser {
    id: string;
    username?: string;
    name?: string | null;
    phoneNumber?: string;
    gender?: 'male' | 'female' | 'other';
    role?: string;
    roles?: string[];
    isRegistered: boolean;
    verificationStatus?: 'pending' | 'approved' | 'rejected' | 'notsubmitted';
    isRiderApproved?: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    signIn: (token: string, refreshToken: string | null, userData: AuthUser) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (updates: Partial<AuthUser>) => Promise<void>;
    checkVerificationStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadUser();

        // Listen for auth_logout events (emitted by SignalRService on 401)
        const sub = DeviceEventEmitter.addListener('auth_logout', () => {
            console.log('[AuthContext] auth_logout event received — signing out');
            signOut();
        });

        return () => sub.remove();
    }, []);

    const loadUser = async () => {
        try {
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                console.log('[AuthContext] User loaded with gender:', parsed.gender);
            }
        } catch (e) {
            console.error('[AuthContext] loadUser error:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = useCallback(async (
        token: string,
        refreshToken: string | null,
        userData: AuthUser
    ) => {
        console.log('[AuthContext] Auth State Change: SIGN IN', userData.id);
        setUser(userData);
        const ops = [
            AsyncStorage.setItem('token', token),
            AsyncStorage.setItem('user', JSON.stringify(userData)),
        ];
        if (refreshToken) {
            ops.push(AsyncStorage.setItem('refreshToken', refreshToken));
        }
        await Promise.all(ops);
        console.log('[AuthContext] Auth State Change: Session Persisted Successfully');

        // Register push token — fire-and-forget, never blocks login
        NotificationService.registerForPushNotifications(userData.id).catch(err =>
            console.warn('[AuthContext] Push registration failed (non-fatal):', err)
        );
    }, []);

    const signOut = useCallback(async () => {
        console.log('[AuthContext] Auth State Change: SIGN OUT');

        try {
            const currentUserId = user?.id;
            setUser(null);

            // 0. Clear cached push token
            await NotificationService.unregisterOnLogout();

            // 1. Disconnect and cleanup SignalR
            await SignalRService.disconnect('DRIVER');
            await SignalRService.disconnect('CUSTOMER');
            SignalRService.clearAllHandlers('DRIVER');
            SignalRService.clearAllHandlers('CUSTOMER');

            // 2. Perform thorough cleanup (clears AsyncStorage and emits auth_logout)
            const { forceLogout } = require('../services/api');
            await forceLogout(false);

            // 3. Clear user-scoped ride data
            if (currentUserId) {
                await AsyncStorage.removeItem(`activeRide_${currentUserId}`);
            }

            console.log('[AuthContext] Auth State Change: Session Cleared');

            // 4. Navigate to Login if navigation is ready
            if (navigationRef.isReady()) {
                navigationRef.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                });
            }
        } catch (e) {
            console.warn('[AuthContext] signOut error:', e);
        }
    }, [user?.id]);

    /**
     * Update persisted user object after registration completes.
     */
    const updateUser = useCallback(async (updates: Partial<AuthUser>) => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => { });
            return updated;
        });
    }, []);

    /**
     * Refresh verification status from backend
     */
    const checkVerificationStatus = useCallback(async () => {
        if (!user) return;
        try {
            const api = require('../services/api').default;
            console.log(`[AuthContext] Checking status for user: ${user.id}`);

            // Use the dedicated status endpoint
            const response = await api.get(`/api/User/status/${user.id}`);
            const apiData = response.data?.data || response.data;

            if (apiData) {
                // riderStatus: 0=NotSubmitted, 1=Pending, 2=Approved, 3=Rejected
                const { riderStatus, isRiderApproved, gender } = apiData;
                console.log(`[AuthContext] riderStatus: ${riderStatus}, isRiderApproved: ${isRiderApproved}, gender: ${gender}`);

                let status: 'notsubmitted' | 'pending' | 'approved' | 'rejected' = 'notsubmitted';
                const normalizedRiderStatus = String(riderStatus).toLowerCase();
                if (isRiderApproved || normalizedRiderStatus === 'approved' || riderStatus === 2) {
                    status = 'approved';
                } else if (normalizedRiderStatus === 'rejected' || riderStatus === 3) {
                    status = 'rejected';
                } else if (normalizedRiderStatus === 'pending' || riderStatus === 1) {
                    status = 'pending';
                }

                await updateUser({
                    verificationStatus: status,
                    isRegistered: status !== 'notsubmitted',
                    gender: gender?.toLowerCase() || user.gender,
                    isRiderApproved: isRiderApproved
                });
            }
        } catch (e) {
            console.warn('[AuthContext] checkVerificationStatus error:', e);
        }
    }, [user, updateUser]);

    const contextValue = React.useMemo(() => ({
        user, isLoading, signIn, signOut, updateUser, checkVerificationStatus
    }), [user, isLoading, signIn, signOut, updateUser, checkVerificationStatus]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
