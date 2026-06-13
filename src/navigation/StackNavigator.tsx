import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import OTPScreen from '../screens/OTPScreen';
import RegistrationFlow from '../screens/RegistrationFlow';
import RideRequest from '../screens/RideRequest';
import NavigationRide from '../screens/NavigationRide';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportScreen from '../screens/SupportScreen';
import SafetyScreen from '../screens/SafetyScreen';
import BottomTabNavigator from './BottomTabNavigator';
import RideRequestsListScreen from '../screens/RideRequestsListScreen';
import RideMapScreen from '../screens/RideMapScreen';
import DeliveryRequestsListScreen from '../screens/DeliveryRequestsListScreen';
import EarningsScreen from '../screens/EarningsScreen';
import WalletScreen from '../screens/WalletScreen';
import TripHistoryScreen from '../screens/TripHistoryScreen';
import TripHistoryDetailScreen from '../screens/TripHistoryDetailScreen';
import VerificationPendingScreen from '../screens/VerificationPendingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import VehicleDetailsScreen from '../screens/VehicleDetailsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ChatScreen from '../screens/ChatScreen';
import { useLanguage } from '../context/LanguageContext';

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
    return (
        <Stack.Navigator
            id="main_stack"
            initialRouteName="Splash"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { direction: 'ltr' },
            }}
        >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
            <Stack.Screen name="RegistrationFlow" component={RegistrationFlow} />
            <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="RideRequest" component={RideRequest} />
            <Stack.Screen name="RideRequestsList" component={RideRequestsListScreen} />
            <Stack.Screen name="RideMapScreen" component={RideMapScreen} />
            <Stack.Screen name="DeliveryRequestsList" component={DeliveryRequestsListScreen} />
            <Stack.Screen name="Earnings" component={EarningsScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="NavigationRide" component={NavigationRide} />
            <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
            <Stack.Screen name="TripHistoryDetail" component={TripHistoryDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Safety" component={SafetyScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Documents" component={DocumentsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
    );
};

export default StackNavigator;
