export interface LatLng {
    latitude: number;
    longitude: number;
}

export interface DirectionsResult {
    coords: LatLng[];
    distance?: string;
    duration?: string;
}

let hasWarnedMissingGoogleMapsKey = false;
let hasWarnedOsrmFailure = false;

const fetchOsrmRoute = async (origin: LatLng, destination: LatLng): Promise<DirectionsResult | null> => {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`OSRM status ${response.status}`);
        }

        const json = await response.json();
        if (json.code === 'Ok' && Array.isArray(json.routes) && json.routes.length > 0) {
            const route = json.routes[0];
            const coords = decodePolyline(route.geometry || '');

            if (coords.length > 1) {
                return {
                    coords,
                    distance: route.distance ? `${(route.distance / 1000).toFixed(1)} km` : undefined,
                    duration: route.duration ? `${Math.ceil(route.duration / 60)} min` : undefined,
                };
            }
        }

        throw new Error(json.code || 'OSRM route unavailable');
    } catch {
        return null;
    }
};

/**
 * Decodes a Google Directions API encoded polyline string.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export const decodePolyline = (encoded: string): LatLng[] => {
    if (!encoded) return [];

    const points: LatLng[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
        let b: number;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
};

/**
 * Fetches a driving route between two points using Google Directions API.
 * Falls back to a straight-line path if the API call fails or no key is provided.
 */
export const fetchDirections = async (
    origin: LatLng,
    destination: LatLng,
    apiKey: string
): Promise<DirectionsResult> => {
    const fallback: DirectionsResult = {
        coords: [origin, destination],
        distance: undefined,
        duration: undefined,
    };

    const hasValidOrigin =
        Number.isFinite(origin?.latitude) &&
        Number.isFinite(origin?.longitude);
    const hasValidDestination =
        Number.isFinite(destination?.latitude) &&
        Number.isFinite(destination?.longitude);

    const latDiff = Math.abs(origin.latitude - destination.latitude);
    const lonDiff = Math.abs(origin.longitude - destination.longitude);
    if (latDiff < 0.0002 && lonDiff < 0.0002) {
        return {
            coords: [origin, destination],
            distance: "0.1 km",
            duration: "1 min",
        };
    }

    if (!hasValidOrigin || !hasValidDestination) {
        return fallback;
    }

    if (!apiKey) {
        if (!hasWarnedMissingGoogleMapsKey) {
            hasWarnedMissingGoogleMapsKey = true;
            console.warn('[mapUtils] No Google Maps API key — using OSRM fallback routing');
        }

        const osrmRoute = await fetchOsrmRoute(origin, destination);
        if (osrmRoute) {
            return osrmRoute;
        }

        if (!hasWarnedOsrmFailure) {
            hasWarnedOsrmFailure = true;
            console.warn('[mapUtils] OSRM fallback failed — using straight-line route');
        }
        return fallback;
    }

    try {
        const originStr = `${origin.latitude},${origin.longitude}`;
        const destStr   = `${destination.latitude},${destination.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${apiKey}&mode=driving`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            console.warn('[mapUtils] Directions API non-OK status:', response.status);
            return fallback;
        }

        const json = await response.json();

        if (json.status === 'OK' && json.routes?.length > 0) {
            const route = json.routes[0];
            const leg   = route.legs?.[0];
            const coords = decodePolyline(route.overview_polyline?.points || '');

            if (coords.length > 0) {
                return {
                    coords,
                    distance: leg?.distance?.text,
                    duration: leg?.duration?.text,
                };
            }
        }

        if (json.status === 'REQUEST_DENIED') {
            console.error('[mapUtils] Directions API key denied:', json.error_message);
        } else if (json.status !== 'OK') {
            console.warn('[mapUtils] Directions API status:', json.status);
        }

        const osrmRoute = await fetchOsrmRoute(origin, destination);
        return osrmRoute ?? fallback;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            console.warn('[mapUtils] Directions fetch timed out — using fallback');
        } else {
            console.warn('[mapUtils] Directions fetch error:', err?.message);
        }

        const osrmRoute = await fetchOsrmRoute(origin, destination);
        return osrmRoute ?? fallback;
    }
};

/**
 * Fetches a two-leg route: origin → waypoint → destination.
 * Used to draw driver→pickup→dropoff in a single continuous polyline.
 */
export const fetchTwoLegRoute = async (
    origin: LatLng,
    waypoint: LatLng,
    destination: LatLng,
    apiKey: string
): Promise<DirectionsResult> => {
    const fallback: DirectionsResult = {
        coords: [origin, waypoint, destination],
    };

    if (!apiKey) return fallback;

    try {
        const originStr    = `${origin.latitude},${origin.longitude}`;
        const waypointStr  = `${waypoint.latitude},${waypoint.longitude}`;
        const destStr      = `${destination.latitude},${destination.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&waypoints=${waypointStr}&destination=${destStr}&key=${apiKey}&mode=driving`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const json = await response.json();

        if (json.status === 'OK' && json.routes?.length > 0) {
            const route = json.routes[0];
            const coords = decodePolyline(route.overview_polyline?.points || '');

            if (coords.length > 0) {
                const totalDistance = route.legs?.map((l: any) => l.distance?.value || 0).reduce((a: number, b: number) => a + b, 0);
                const totalDuration = route.legs?.map((l: any) => l.duration?.value || 0).reduce((a: number, b: number) => a + b, 0);

                return {
                    coords,
                    distance: totalDistance ? `${(totalDistance / 1000).toFixed(1)} km` : undefined,
                    duration: totalDuration ? `${Math.ceil(totalDuration / 60)} min` : undefined,
                };
            }
        }
        return fallback;
    } catch (err: any) {
        console.warn('[mapUtils] Two-leg route error:', err?.message);
        return fallback;
    }
};
