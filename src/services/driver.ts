import api from './api';

export interface UpdateLocationPayload {
    vehicleType?: string;
    lat: number;
    lon: number;
    gender?: string;
    rating?: number;
    isActive?: boolean;
}

export const driverService = {
    /**
     * Accept or reject a ride request.
     */
    action: (payload: { driverId: string; rideId: string; action: string }) =>
        api.post('/api/rider/rides/action', payload),

    /**
     * REST fallback location update.
     * Prefer SignalR UpdateLocation hub method when connected.
     */
    updateLocation: (payload: UpdateLocationPayload) =>
        api.post('/api/rider/rides/update-location', payload),
};
