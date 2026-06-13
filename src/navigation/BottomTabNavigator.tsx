import React from 'react';
import { View, StyleSheet, Text, Image as RNImage } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, ClipboardList, Wallet, User, BarChart3 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import Dashboard from '../screens/Dashboard';
import EarningsScreen from '../screens/EarningsScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getFontFamily, getFontSize } from '../utils/layout';

const Tab = createBottomTabNavigator();

const TabIcon = ({ focused, color, Icon, asset, size = 22 }: { focused: boolean; color: string; Icon?: any; asset?: any; size?: number }) => (
    <View style={styles.tabIconWrap}>
        {asset ? (
            <RNImage source={asset} style={[styles.tabIconImage, { tintColor: color, width: size, height: size }]} />
        ) : (
            Icon && <Icon color={color} size={24} />
        )}
    </View>
);

const BottomTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();

    return (
        <Tab.Navigator
            id="MainTabs"
            initialRouteName="DashboardTab"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textSecondary,
                tabBarStyle: {
                    flexDirection: 'row',
                    height: 70 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
                    paddingTop: 8,
                    borderTopLeftRadius: 25,
                    borderTopRightRadius: 25,
                    position: 'absolute',
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 0,
                    elevation: 15,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                },
                tabBarLabelStyle: {
                    fontFamily: getFontFamily('medium', isRTL),
                    fontSize: getFontSize(12, isRTL),
                    marginTop: 2,
                },
            }}
        >
            <Tab.Screen
                name="DashboardTab"
                component={Dashboard}
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.tabLabelContainer}>
                            <Text style={{ color, fontSize: getFontSize(12, isRTL), fontFamily: getFontFamily('medium', isRTL) }}>{t('navigation.home')}</Text>
                            {focused && <View style={[styles.tabIndicator, { backgroundColor: theme.primary }]} />}
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon focused={focused} color={color} asset={require('../assets/home.png')} />
                    ),
                }}
            />
            <Tab.Screen
                name="AnalyticsTab"
                component={EarningsScreen}
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.tabLabelContainer}>
                            <Text style={{ color, fontSize: getFontSize(12, isRTL), fontFamily: getFontFamily('medium', isRTL) }}>{t('navigation.analytics', 'Analytics')}</Text>
                            {focused && <View style={[styles.tabIndicator, { backgroundColor: theme.primary }]} />}
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon focused={focused} color={color} Icon={BarChart3} />
                    ),
                }}
            />
            <Tab.Screen
                name="WalletTab"
                component={WalletScreen}
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.tabLabelContainer}>
                            <Text style={{ color, fontSize: getFontSize(12, isRTL), fontFamily: getFontFamily('medium', isRTL) }}>{t('navigation.wallet', 'Wallet')}</Text>
                            {focused && <View style={[styles.tabIndicator, { backgroundColor: theme.primary }]} />}
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon focused={focused} color={color} asset={require('../assets/wallet.png')} />
                    ),
                }}
            />
            <Tab.Screen
                name="ProfileTab"
                component={ProfileScreen}
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.tabLabelContainer}>
                            <Text style={{ color, fontSize: getFontSize(12, isRTL), fontFamily: getFontFamily('medium', isRTL) }}>{t('navigation.profile', 'Profile')}</Text>
                            {focused && <View style={[styles.tabIndicator, { backgroundColor: theme.primary }]} />}
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon focused={focused} color={color} asset={require('../assets/people.png')} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    tabIconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 32,
    },
    tabLabelContainer: {
        alignItems: 'center',
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 24,
        height: 3,
        borderRadius: 2,
    },
    tabIconImage: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
    },
});

export default BottomTabNavigator;
