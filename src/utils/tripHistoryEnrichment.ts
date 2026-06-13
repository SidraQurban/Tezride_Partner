import { getAddressFromCoords } from './geocoding';
import { pricingService } from '../services/pricing';
import { HistoryTripItem, normalizeNumber } from './rideSafety';

const geocodeCache = new Map<string, string>();

const COORD_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

export const looksLikeCoordinates = (value?: string): boolean => {
    if (!value) return false;
    return COORD_PATTERN.test(value.trim());
};

const FARE_FIELD_KEYS = [
    'fare',
    'finalCost',
    'FinalCost',
    'finalFare',
    'FinalFare',
    'estimatedFare',
    'EstimatedFare',
    'amount',
    'Amount',
    'totalFare',
    'TotalFare',
    'driverEarning',
    'DriverEarning',
    'driverEarnings',
    'earnings',
    'Earnings',
    'price',
    'Price',
    'tripFare',
    'TripFare',
    'completedFare',
    'CompletedFare',
    'fareAmount',
    'FareAmount',
    'totalAmount',
    'TotalAmount',
    'payout',
    'Payout',
    'netAmount',
    'NetAmount',
];

export const extractFareFromRecord = (source: any): number | undefined => {
    if (!source || typeof source !== 'object') {
        return undefined;
    }

    for (const key of FARE_FIELD_KEYS) {
        const value = source[key];
        const parsed = normalizeNumber(value);
        if (parsed !== null && parsed > 0) {
            return parsed;
        }
        if (typeof value === 'string') {
            const fromText = parseFloat(value.replace(/[^\d.]/g, ''));
            if (Number.isFinite(fromText) && fromText > 0) {
                return fromText;
            }
        }
    }

    const nestedSources = [
        source.payment,
        source.Payment,
        source.pricing,
        source.Pricing,
        source.ride,
        source.Ride,
        source.summary,
        source.Summary,
        source.billing,
        source.Billing,
        source.fareDetails,
        source.FareDetails,
    ];

    for (const nested of nestedSources) {
        const nestedFare = extractFareFromRecord(nested);
        if (nestedFare) {
            return nestedFare;
        }
    }

    return undefined;
};

const extractAddressFromLocation = (location: any): string | undefined => {
    if (!location || typeof location !== 'object') {
        return undefined;
    }

    const candidates = [
        location.address,
        location.Address,
        location.name,
        location.Name,
        location.label,
        location.Label,
        location.formattedAddress,
        location.FormattedAddress,
        location.description,
        location.Description,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() && !looksLikeCoordinates(candidate)) {
            return candidate.trim();
        }
    }

    return undefined;
};

const cacheKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

const resolveAddress = async (
    lat: number,
    lon: number,
    existing?: string
): Promise<string | undefined> => {
    if (existing && !looksLikeCoordinates(existing)) {
        return existing;
    }

    const key = cacheKey(lat, lon);
    if (geocodeCache.has(key)) {
        return geocodeCache.get(key);
    }

    const resolved = await getAddressFromCoords(lat, lon);
    if (resolved) {
        geocodeCache.set(key, resolved);
        return resolved;
    }

    return existing;
};

const extractFareFromPricing = (payload: any): number | undefined => {
    if (!payload) {
        return undefined;
    }

    if (Array.isArray(payload)) {
        const preferred = payload.find((entry) => {
            const type = String(entry?.vehicleType ?? entry?.type ?? '').toLowerCase();
            return type.includes('bike') || type.includes('motor');
        }) ?? payload[0];

        return extractFareFromRecord(preferred);
    }

    if (typeof payload === 'object') {
        const direct = extractFareFromRecord(payload);
        if (direct) {
            return direct;
        }

        for (const value of Object.values(payload)) {
            const nested = extractFareFromPricing(value);
            if (nested) {
                return nested;
            }
        }
    }

    return undefined;
};

const estimateFareFromDistance = (distanceKm: number): number => {
    const baseFare = 80;
    const perKm = 18;
    return Math.round(baseFare + Math.max(0, distanceKm) * perKm);
};

const resolveFare = async (trip: HistoryTripItem, raw: any, fareByRideId: Record<string, number>): Promise<number | undefined> => {
    const rideKey = String(trip.rideId ?? trip.id);
    if (fareByRideId[rideKey]) {
        return fareByRideId[rideKey];
    }

    const fromRaw = extractFareFromRecord(raw);
    if (fromRaw) {
        return fromRaw;
    }

    if (trip.fare && trip.fare > 0) {
        return trip.fare;
    }

    if (trip.pickup && trip.dropoff) {
        try {
            const response = await pricingService.getEstimates({
                pickupLat: trip.pickup.lat,
                pickupLon: trip.pickup.lon,
                dropoffLat: trip.dropoff.lat,
                dropoffLon: trip.dropoff.lon,
                estimatedDistanceKm: trip.distance,
            });
            const payload = response.data?.data ?? response.data;
            const estimated = extractFareFromPricing(payload);
            if (estimated) {
                return estimated;
            }
        } catch {
            // Fall through to distance-based estimate
        }
    }

    if (trip.distance && trip.distance > 0) {
        return estimateFareFromDistance(trip.distance);
    }

    return undefined;
};

export const buildFareLookupFromTransactions = (transactions: any[]): Record<string, number> => {
    const lookup: Record<string, number> = {};

    for (const tx of transactions) {
        const rideId = tx?.rideId ?? tx?.RideId ?? tx?.referenceId ?? tx?.ReferenceId ?? tx?.tripId ?? tx?.TripId;
        const amount = Math.abs(
            normalizeNumber(tx?.amount ?? tx?.Amount ?? tx?.credit ?? tx?.Credit) ?? 0
        );

        if (rideId && amount > 0) {
            lookup[String(rideId)] = amount;
        }
    }

    return lookup;
};

export const enrichHistoryTrip = async (
    trip: HistoryTripItem,
    raw: any,
    fareByRideId: Record<string, number>
): Promise<HistoryTripItem> => {
    let pickupAddress =
        trip.pickupAddress && !looksLikeCoordinates(trip.pickupAddress)
            ? trip.pickupAddress
            : extractAddressFromLocation(raw?.pickup ?? raw?.Pickup);

    let dropoffAddress =
        trip.dropoffAddress && !looksLikeCoordinates(trip.dropoffAddress)
            ? trip.dropoffAddress
            : extractAddressFromLocation(raw?.dropoff ?? raw?.Dropoff);

    if (trip.pickup) {
        pickupAddress = await resolveAddress(trip.pickup.lat, trip.pickup.lon, pickupAddress);
    }

    if (trip.dropoff) {
        dropoffAddress = await resolveAddress(trip.dropoff.lat, trip.dropoff.lon, dropoffAddress);
    }

    const fare = await resolveFare(trip, raw, fareByRideId);

    return {
        ...trip,
        pickupAddress: pickupAddress || (trip.pickup ? `${trip.pickup.lat.toFixed(5)}, ${trip.pickup.lon.toFixed(5)}` : undefined),
        dropoffAddress: dropoffAddress || (trip.dropoff ? `${trip.dropoff.lat.toFixed(5)}, ${trip.dropoff.lon.toFixed(5)}` : undefined),
        fare,
    };
};

export const enrichHistoryTrips = async (
    trips: Array<{ trip: HistoryTripItem; raw: any }>,
    fareByRideId: Record<string, number> = {}
): Promise<HistoryTripItem[]> => {
    const batchSize = 4;
    const enriched: HistoryTripItem[] = [];

    for (let index = 0; index < trips.length; index += batchSize) {
        const batch = trips.slice(index, index + batchSize);
        const results = await Promise.all(
            batch.map(({ trip, raw }) => enrichHistoryTrip(trip, raw, fareByRideId))
        );
        enriched.push(...results);
    }

    return enriched;
};
