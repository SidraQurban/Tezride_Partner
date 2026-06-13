export interface RideLocation {
    lat: number;
    lon: number;
}

export interface SafeRideRecord {
    rideId: string;
    status: string;
    pickup: RideLocation;
    dropoff: RideLocation;
    timeoutSec: number;
    event?: string;
    type?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    timestamp?: number;
    fare?: number;
    distance?: number;
    driverId?: string;
    customerId?: string;
    customerName?: string;
    customerRating?: number;
    customerPhone?: string;
    customerProfilePicUrl?: string;
    paymentMethod?: string;
    startedAt?: string;
    acceptedAt?: string;
}

export const RIDE_NAVIGATION_STATUSES = new Set(['confirmed', 'approaching', 'arrived', 'started']);
export const RIDE_CACHEABLE_STATUSES = new Set(['accepted', 'confirmed', 'approaching', 'arrived', 'started']);

export const normalizeNumber = (value: any): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value: any): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

export const safeParseJson = <T>(raw: string | null, fallback: T | null = null): T | null => {
    if (!raw) {
        return fallback;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const normalizeRideStatus = (value: any): string => {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'intransit') {
        return 'started';
    }

    return normalized || 'accepted';
};

export const normalizeRideLocation = (value: any): RideLocation | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const lat = normalizeNumber(value.lat ?? value.latitude ?? value.Lat ?? value.Latitude);
    const lon = normalizeNumber(value.lon ?? value.longitude ?? value.Lon ?? value.Longitude ?? value.lng ?? value.Lng ?? value.long ?? value.Long);

    if (lat === null || lon === null) {
        return null;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }

    return { lat, lon };
};

export const sanitizeRideRecord = (value: any, fallback?: any): SafeRideRecord | null => {
    const source = value && typeof value === 'object' ? value : {};
    const base = fallback && typeof fallback === 'object' ? fallback : {};

    const rideId = source.rideId ?? source.id ?? source.RideId ?? source.RideID ?? base.rideId ?? base.id;
    if (!rideId) {
        return null;
    }

    let pickup = normalizeRideLocation(
        source.pickup
        ?? base.pickup
        ?? source.Pickup
        ?? base.Pickup
        ?? {
            lat: source.pickupLatitude ?? source.PickupLatitude ?? source.pickupLat ?? source.PickupLat ?? base.pickupLatitude ?? base.pickupLat,
            lon: source.pickupLongitude ?? source.PickupLongitude ?? source.pickupLon ?? source.PickupLon ?? base.pickupLongitude ?? base.pickupLon,
        }
    );
    let dropoff = normalizeRideLocation(
        source.dropoff
        ?? base.dropoff
        ?? source.Dropoff
        ?? base.Dropoff
        ?? {
            lat: source.dropoffLatitude ?? source.DropoffLatitude ?? source.dropoffLat ?? source.DropoffLat ?? base.dropoffLatitude ?? base.dropoffLat,
            lon: source.dropoffLongitude ?? source.DropoffLongitude ?? source.dropoffLon ?? source.DropoffLon ?? base.dropoffLongitude ?? base.dropoffLon,
        }
    );

    if (!pickup || !dropoff) {
        pickup = pickup ?? normalizeRideLocation(base?.pickup) ?? { lat: 33.6844, lon: 73.0479 };
        dropoff = dropoff ?? normalizeRideLocation(base?.dropoff) ?? { lat: 33.6844, lon: 73.0479 };
        console.warn(`[rideSafety] Missing pickup or dropoff for rideId: ${rideId}. Using fallback locations to prevent state loss.`);
    }

    const timeoutSec = normalizeNumber(source.timeoutSec ?? base.timeoutSec) ?? 30;
    const fare = normalizeNumber(
        source.fare ?? source.estimatedFare ?? source.EstimatedFare ?? base.fare ?? base.estimatedFare
    );
    const distance = normalizeNumber(source.distance ?? base.distance);
    const timestamp = normalizeNumber(source.timestamp ?? base.timestamp);

    return {
        ...base,
        ...source,
        rideId: String(rideId),
        status: normalizeRideStatus(source.status ?? base.status),
        pickup,
        dropoff,
        timeoutSec: Math.min(180, Math.max(5, Math.round(timeoutSec))),
        event: normalizeText(source.event ?? base.event),
        type: normalizeText(source.type ?? source.vehicleType ?? source.VehicleType ?? base.type),
        pickupAddress: normalizeText(
            source.pickupAddress
            ?? source.PickupAddress
            ?? base.pickupAddress
            ?? base.PickupAddress
        ),
        dropoffAddress: normalizeText(
            source.dropoffAddress
            ?? source.DropoffAddress
            ?? base.dropoffAddress
            ?? base.DropoffAddress
        ),
        timestamp: timestamp ?? Date.now(),
        fare: fare ?? 0,
        distance: distance ?? undefined,
        driverId: normalizeText(source.driverId ?? source.DriverId ?? base.driverId),
        customerId: normalizeText(source.customerId ?? source.CustomerId ?? base.customerId),
        customerName: normalizeText(source.customerName ?? source.CustomerName ?? base.customerName),
        customerRating: normalizeNumber(source.customerRating ?? source.CustomerRating ?? base.customerRating) ?? 5.0,
        customerPhone: normalizeText(source.customerPhone ?? source.CustomerPhone ?? base.customerPhone),
        customerProfilePicUrl: normalizeText(source.customerProfilePicUrl ?? source.CustomerProfilePicUrl ?? base.customerProfilePicUrl),
        paymentMethod: normalizeText(source.paymentMethod ?? source.PaymentMethod ?? base.paymentMethod ?? base.PaymentMethod),
        startedAt: normalizeText(source.startedAt ?? base.startedAt),
        acceptedAt: normalizeText(source.acceptedAt ?? base.acceptedAt),
    };
};

export const shouldRestoreRideNavigation = (ride: any): boolean => {
    const status = normalizeRideStatus(ride?.status);
    return RIDE_NAVIGATION_STATUSES.has(status);
};

const HISTORY_STATUS_BY_CODE: Record<number, string> = {
    0: 'pending',
    1: 'accepted',
    2: 'arrived',
    3: 'started',
    4: 'completed',
    5: 'cancelled by customer',
    6: 'cancelled by you',
};

export const normalizeHistoryStatus = (value: any): string => {
    const numeric = normalizeNumber(value);
    if (numeric !== null && HISTORY_STATUS_BY_CODE[numeric]) {
        return HISTORY_STATUS_BY_CODE[numeric];
    }
    return normalizeRideStatus(value);
};

export interface HistoryTripItem {
    id: string;
    rideId?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    pickup?: RideLocation;
    dropoff?: RideLocation;
    fare?: number;
    distance?: number;
    duration?: number;
    paymentMethod?: string;
    status: string;
    createdAt?: string;
    completedAt?: string;
    startedAt?: string;
}

/** Normalizes rider history API rows (camelCase / PascalCase / flat coords). */
export const sanitizeHistoryItem = (value: any): HistoryTripItem | null => {
    const source = value && typeof value === 'object' ? value : {};
    const rideId = source.rideId ?? source.id ?? source.RideId ?? source.rideID;

    if (!rideId && !source.id) {
        return null;
    }

    const pickup = normalizeRideLocation(
        source.pickup
        ?? source.Pickup
        ?? {
            lat: source.pickupLatitude ?? source.PickupLatitude ?? source.pickupLat ?? source.PickupLat,
            lon: source.pickupLongitude ?? source.PickupLongitude ?? source.pickupLon ?? source.PickupLon,
        }
    );
    const dropoff = normalizeRideLocation(
        source.dropoff
        ?? source.Dropoff
        ?? {
            lat: source.dropoffLatitude ?? source.DropoffLatitude ?? source.dropoffLat ?? source.DropoffLat,
            lon: source.dropoffLongitude ?? source.DropoffLongitude ?? source.dropoffLon ?? source.DropoffLon,
        }
    );

    const pickupFromObject = source.pickup ?? source.Pickup;
    const dropoffFromObject = source.dropoff ?? source.Dropoff;

    const pickupAddress = normalizeText(
        source.pickupAddress
        ?? source.PickupAddress
        ?? source.pickupLocation
        ?? source.PickupLocation
        ?? source.fromAddress
        ?? source.FromAddress
        ?? (typeof pickupFromObject === 'object'
            ? pickupFromObject.address ?? pickupFromObject.Address ?? pickupFromObject.name ?? pickupFromObject.Name
            : undefined)
    );
    const dropoffAddress = normalizeText(
        source.dropoffAddress
        ?? source.DropoffAddress
        ?? source.dropoffLocation
        ?? source.DropoffLocation
        ?? source.toAddress
        ?? source.ToAddress
        ?? (typeof dropoffFromObject === 'object'
            ? dropoffFromObject.address ?? dropoffFromObject.Address ?? dropoffFromObject.name ?? dropoffFromObject.Name
            : undefined)
    );

    const fare = normalizeNumber(
        source.fare
        ?? source.finalCost
        ?? source.FinalCost
        ?? source.finalFare
        ?? source.FinalFare
        ?? source.estimatedFare
        ?? source.EstimatedFare
        ?? source.amount
        ?? source.Amount
        ?? source.totalFare
        ?? source.TotalFare
        ?? source.driverEarning
        ?? source.DriverEarning
        ?? source.driverEarnings
        ?? source.earnings
        ?? source.price
        ?? source.Price
        ?? source.payment?.amount
        ?? source.Payment?.Amount
        ?? source.pricing?.fare
        ?? source.Pricing?.Fare
    );
    const distance = normalizeNumber(
        source.distance
        ?? source.distanceKm
        ?? source.DistanceKm
        ?? source.totalDistance
        ?? source.TotalDistance
    );

    const createdAt = normalizeText(
        source.createdAt
        ?? source.CreatedAt
        ?? source.assignedAt
        ?? source.AssignedAt
        ?? source.requestedAt
        ?? source.RequestedAt
        ?? source.date
        ?? source.Date
    );
    const completedAt = normalizeText(
        source.completedAt
        ?? source.CompletedAt
        ?? source.finishedAt
        ?? source.FinishedAt
    );

    const duration = normalizeNumber(
        source.duration
        ?? source.Duration
        ?? source.durationMinutes
        ?? source.DurationMinutes
        ?? source.rideDuration
        ?? source.RideDuration
        ?? source.tripDuration
        ?? source.TripDuration
    );

    const paymentMethod = normalizeText(
        source.paymentMethod
        ?? source.PaymentMethod
        ?? source.payment_method
    );

    const startedAt = normalizeText(
        source.startedAt ?? source.StartedAt
    );

    return {
        id: String(rideId ?? source.id),
        rideId: rideId ? String(rideId) : undefined,
        pickup: pickup ?? undefined,
        dropoff: dropoff ?? undefined,
        pickupAddress,
        dropoffAddress,
        fare: fare ?? undefined,
        distance: distance ?? undefined,
        duration: duration ?? undefined,
        paymentMethod: paymentMethod ?? undefined,
        status: normalizeHistoryStatus(source.status ?? source.Status),
        createdAt: createdAt ?? completedAt,
        completedAt,
        startedAt,
    };
};

