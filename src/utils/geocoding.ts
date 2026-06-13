import * as Location from 'expo-location';

/**
 * Get a human-readable address from coordinates
 * @param latitude 
 * @param longitude 
 * @returns Address string or null
 */
export const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results && results.length > 0) {
            const item = results[0];
            const name = item.name || '';
            const street = item.street || '';
            const district = item.district || item.subregion || '';
            const city = item.city || '';

            const parts = [name, street, district, city].filter(p => p && p.length > 0);
            if (parts.length > 0) {
                return parts.join(', ');
            }

            const cityOnly = [city, item.region, item.country].filter(p => p && p.length > 0);
            if (cityOnly.length > 0) {
                return cityOnly.join(', ');
            }
        }
        return null;
    } catch (error) {
        console.warn('[Geocoding] Reverse geocode failed:', error);
        return null;
    }
};
