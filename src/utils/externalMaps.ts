import { Alert, Linking, Platform } from 'react-native';

export interface MapDestination {
    latitude: number;
    longitude: number;
    label?: string;
}

const openUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
        await Linking.openURL(url);
        return true;
    }
    return false;
};

export const openGoogleMapsNavigation = async (dest: MapDestination): Promise<boolean> => {
    const { latitude, longitude } = dest;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

    const nativeUrl = Platform.select({
        ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
        android: `google.navigation:q=${latitude},${longitude}&mode=d`,
        default: webUrl,
    });

    if (nativeUrl && await openUrl(nativeUrl)) {
        return true;
    }

    await Linking.openURL(webUrl);
    return true;
};

export const openAppleMapsNavigation = async (dest: MapDestination): Promise<boolean> => {
    const { latitude, longitude, label } = dest;
    const query = label ? encodeURIComponent(label) : `${latitude},${longitude}`;
    const url = `maps://?daddr=${latitude},${longitude}&q=${query}`;
    if (await openUrl(url)) {
        return true;
    }
    const webUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}`;
    await Linking.openURL(webUrl);
    return true;
};

export const promptExternalNavigation = (dest: MapDestination, isRTL = false) => {
    const title = isRTL ? 'نیویگیشن کھولیں' : 'Open Navigation';
    const message = isRTL ? 'کس ایپ میں راستہ کھولنا ہے؟' : 'Choose an app to open turn-by-turn directions.';

    const options: Array<{ text: string; onPress: () => void }> = [
        {
            text: 'Google Maps',
            onPress: () => {
                openGoogleMapsNavigation(dest).catch(() => {
                    Alert.alert('Error', 'Could not open Google Maps.');
                });
            },
        },
    ];

    if (Platform.OS === 'ios') {
        options.push({
            text: 'Apple Maps',
            onPress: () => {
                openAppleMapsNavigation(dest).catch(() => {
                    Alert.alert('Error', 'Could not open Apple Maps.');
                });
            },
        });
    }

    Alert.alert(title, message, [
        ...options,
        { text: isRTL ? 'منسوخ' : 'Cancel', style: 'cancel' },
    ]);
};
