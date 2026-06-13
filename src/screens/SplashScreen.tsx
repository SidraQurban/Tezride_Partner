import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { COLORS } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { ensureValidToken } from '../services/api';
import Logo from '../components/Logo';
import { useTranslation } from 'react-i18next';
import { safeParseJson, sanitizeRideRecord, shouldRestoreRideNavigation } from '../utils/rideSafety';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { updateUser } = useAuth();
    const wordmarkOpacity = useRef(new Animated.Value(0)).current;
    const wordmarkY = useRef(new Animated.Value(24)).current;
    const taglineOpacity = useRef(new Animated.Value(0)).current;
    const badgeOpacity = useRef(new Animated.Value(0)).current;
    const loaderWidth = useRef(new Animated.Value(0)).current;
    const hasNavigated = useRef(false);

    useEffect(() => {
        // Staggered entrance animation
        Animated.sequence([
            Animated.parallel([
                Animated.timing(wordmarkOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(wordmarkY, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]),
            Animated.stagger(150, [
                Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(badgeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),
        ]).start();

        // Loader bar
        Animated.timing(loaderWidth, {
            toValue: width * 0.55,
            duration: 1400,
            useNativeDriver: false,
        }).start();

        const timer = setTimeout(async () => {
            if (hasNavigated.current) return;
            hasNavigated.current = true;

            try {
                const [token, storedUser, onboarded] = await Promise.all([
                    AsyncStorage.getItem('token'),
                    AsyncStorage.getItem('user'),
                    AsyncStorage.getItem('onboardingCompleted'),
                ]);

                if (token && storedUser) {
                    const user = safeParseJson<any>(storedUser);
                    if (!user?.id) {
                        await AsyncStorage.multiRemove(['token', 'user']);
                        navigation.replace('Login');
                        return;
                    }

                    const isValid = await ensureValidToken();
                    if (!isValid) {
                        navigation.replace('Login');
                        return;
                    }

                    const userRideKey = `activeRide_${user.id}`;
                    const storedRide = await AsyncStorage.getItem(userRideKey);
                    if (storedRide) {
                        const ride = sanitizeRideRecord(safeParseJson(storedRide));
                        if (!ride) {
                            await AsyncStorage.removeItem(userRideKey);
                        } else if ((!ride.driverId || ride.driverId === user.id) && shouldRestoreRideNavigation(ride)) {
                            navigation.replace('NavigationRide');
                            return;
                        } else if (ride.driverId && ride.driverId !== user.id) {
                            await AsyncStorage.removeItem(userRideKey);
                        }
                    }

                    try {
                        const { userService } = require('../services/user');
                        const statusResponse = await userService.getUserStatus(user.id);
                        const apiData = statusResponse.data?.data || statusResponse.data;

                        if (apiData) {
                            const { riderStatus, isRiderApproved, gender } = apiData;
                            let updatedStatus: 'notsubmitted' | 'pending' | 'approved' | 'rejected' = 'notsubmitted';
                            const riderStatusString = String(riderStatus).toLowerCase();

                            if (isRiderApproved || riderStatusString === 'approved' || riderStatus === 2) {
                                updatedStatus = 'approved';
                            } else if (riderStatusString === 'rejected' || riderStatus === 3) {
                                updatedStatus = 'rejected';
                            } else if (riderStatusString === 'pending' || riderStatus === 1) {
                                updatedStatus = 'pending';
                            }

                            const latestGender = gender?.toLowerCase() || user.gender;
                            const updatedUser = { ...user, verificationStatus: updatedStatus, gender: latestGender, isRegistered: updatedStatus !== 'notsubmitted' };
                            await updateUser(updatedUser);

                            if (updatedStatus !== 'approved') {
                                navigation.replace('VerificationPending');
                                return;
                            }
                            user.verificationStatus = updatedStatus;
                            user.gender = latestGender;
                        }
                    } catch (e: any) {
                        console.warn('[Splash] User sync failed, using cached data:', e.message);
                    }

                    const normalizedStatus = String(user?.verificationStatus || 'NotSubmitted').toLowerCase();
                    if (normalizedStatus === 'approved') {
                        navigation.replace('MainTabs');
                    } else if (normalizedStatus === 'pending' || normalizedStatus === 'rejected') {
                        navigation.replace('VerificationPending');
                    } else {
                        navigation.replace('RegistrationFlow', { userId: user.id });
                    }
                    return;
                } else if (token && !storedUser) {
                    navigation.replace('Login');
                    return;
                }

                if (onboarded === 'true') {
                    navigation.replace('Login');
                } else {
                    navigation.replace('Onboarding');
                }
            } catch (e) {
                console.error('[Splash] Navigation error:', e);
                navigation.replace('Onboarding');
            }
        }, 1600);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            {/* Background accent */}
            <View style={styles.topAccent} />
            <View style={styles.bottomAccent} />

            {/* Brand Center */}
            <View style={styles.centerContent}>
                {/* Logo wrapper */}
                <Animated.View style={{ opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }], marginBottom: 20 }}>
                    <Logo size={width * 0.85} />
                </Animated.View>

                {/* Tagline */}
                <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
                    {t('login.taglineMain')}
                </Animated.Text>

            </View>

            {/* Loader at bottom */}
            <View style={styles.footer}>
                <View style={styles.loaderTrack}>
                    <Animated.View style={[styles.loaderFill, { width: loaderWidth }]} />
                </View>
                <Text style={styles.version}>Partner v1.0</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFBF7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topAccent: {
        position: 'absolute',
        top: -80,
        right: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: COLORS.primary + '14',
    },
    bottomAccent: {
        position: 'absolute',
        bottom: -60,
        left: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: COLORS.secondary + '10',
    },
    centerContent: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    wordmark: {
        fontSize: 48,
        fontFamily: 'Poppins_700Bold',
        color: COLORS.primary,
        letterSpacing: -1,
        marginBottom: 8,
        textAlign: 'center',
    },
    tagline: {
        fontSize: 15,
        fontFamily: 'Poppins_500Medium',
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '12',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    badgeDot: {
        fontSize: 8,
        color: COLORS.primary,
    },
    badgeText: {
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
        color: COLORS.primary,
    },
    footer: {
        position: 'absolute',
        bottom: 52,
        alignItems: 'center',
        width: '100%',
    },
    loaderTrack: {
        width: width * 0.55,
        height: 3,
        backgroundColor: '#EEE',
        borderRadius: 2,
        overflow: 'hidden',
    },
    loaderFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    version: {
        marginTop: 12,
        fontSize: 12,
        color: '#AAA',
        fontFamily: 'Poppins_400Regular',
    },
});

export default SplashScreen;
