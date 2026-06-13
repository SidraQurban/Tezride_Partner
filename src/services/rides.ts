import api from './api';

export interface LocationDto {
    lat: number;
    lon: number;
}

export interface CreateRideRequestDto {
    customerId?: string;
    customerName?: string;
    customerProfilePicUrl?: string;
    vehicleType?: string;
    pickup: LocationDto;
    dropoff: LocationDto;
    genderPreference?: string;
    minRating?: number;
}

export const ridesService = {
    // ── Customer Ride Actions ──────────────────────────────────────────────────

    /** POST /api/customer/rides/request */
    requestRide: (data: CreateRideRequestDto) =>
        api.post('/api/customer/rides/request', data),

    /** GET /api/customer/rides/{rideId} */
    getRideById: (rideId: string) => api.get(`/api/customer/rides/${rideId}`),

    /** POST /api/customer/rides/{rideId}/cancel */
    cancelRide: (rideId: string) =>
        api.post(`/api/customer/rides/${rideId}/cancel`),

    /** POST /api/customer/rides/{rideId}/select-driver */
    selectDriver: (rideId: string, driverId: string) =>
        api.post(`/api/customer/rides/${rideId}/select-driver`, { driverId }),

    /** GET /api/customer/rides/history */
    getCustomerHistory: (params?: { pageIndex?: number; pageSize?: number }) =>
        api.get('/api/customer/rides/history', { params }),

    // ── Rider (Driver) Actions ─────────────────────────────────────────────────

    /** POST /api/rider/rides/action — accept/reject/ignore */
    driverAction: (payload: { rideId: string; action: string }) =>
        api.post('/api/rider/rides/action', payload),

    /** POST /api/rider/rides/{rideId}/status */
    updateRideStatus: (rideId: string, status: number, lat?: number, lon?: number) =>
        api.post(`/api/rider/rides/${rideId}/status`, { status, lat, lon }),

    /** POST /api/rider/rides/{rideId}/complete */
    completeRide: (rideId: string, distanceKm: number, payFromWallet: boolean = false) =>
        api.post(`/api/rider/rides/${rideId}/complete`, { distanceKm, payFromWallet }),

    /** GET /api/rider/rides/history */
    getRiderHistory: (params?: { pageIndex?: number; pageSize?: number }) =>
        api.get('/api/rider/rides/history', { params }),

    /** GET /api/rider/rides/stats */
    getRiderStats: (params?: { period?: 'today' | 'weekly' | 'monthly' }) => 
        api.get('/api/rider/rides/stats', { params }),

    /** GET /api/rider/rides/transactions */
    getRiderTransactions: (params?: { pageIndex?: number; pageSize?: number }) =>
        api.get('/api/rider/rides/transactions', { params }),

    /** GET /api/rider/rides/balance */
    getRiderBalance: () => api.get('/api/rider/rides/balance'),

    /** GET /api/rider/rides/current-ride */
    getCurrentRide: () => api.get('/api/rider/rides/current-ride'),
};
