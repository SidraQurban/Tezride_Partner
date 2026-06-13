import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

export interface ImageResult {
    uri: string;
    base64?: string;
    width: number;
    height: number;
}

/**
 * High-performance native image compression and scaling
 * Reduces size to ~150KB to completely avoid HTTP 413 payload limits
 */
const compressImage = async (uri: string): Promise<ImageResult | null> => {
    try {
        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1000 } }], // Scales to 1000px wide, preserving aspect ratio
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        return {
            uri: manipResult.uri,
            width: manipResult.width,
            height: manipResult.height,
        };
    } catch (e) {
        console.error('[ImageUploadService] Native compression failed:', e);
        return null;
    }
};

export const ImageUploadService = {
    /**
     * Request permissions and pick an image from gallery
     */
    pickImage: async (): Promise<ImageResult | null> => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Unable to access gallery. Please allow permissions in settings to upload photos.'
                );
                return null;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], // Resolved deprecation warning
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.6,
                base64: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const rawUri = result.assets[0].uri;
                const compressed = await compressImage(rawUri);
                if (compressed) return compressed;

                return {
                    uri: rawUri,
                    width: result.assets[0].width,
                    height: result.assets[0].height,
                };
            }
            return null;
        } catch (error) {
            console.error('[ImageUploadService] pickImage error:', error);
            Alert.alert('Error', 'Unable to open gallery. Please try again.');
            return null;
        }
    },

    /**
     * Request permissions and take a photo with camera
     */
    takePhoto: async (): Promise<ImageResult | null> => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Unable to access camera. Please allow permissions in settings to take photos.'
                );
                return null;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'], // Resolved deprecation warning
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.6,
                base64: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const rawUri = result.assets[0].uri;
                const compressed = await compressImage(rawUri);
                if (compressed) return compressed;

                return {
                    uri: rawUri,
                    width: result.assets[0].width,
                    height: result.assets[0].height,
                };
            }
            return null;
        } catch (error) {
            console.error('[ImageUploadService] takePhoto error:', error);
            Alert.alert('Error', 'Unable to open camera. Please try again.');
            return null;
        }
    }
};
