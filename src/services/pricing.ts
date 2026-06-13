import api from './api';

export interface PricingEstimateParams {
    pickupLat: number;
    pickupLon: number;
    dropoffLat: number;
    dropoffLon: number;
    estimatedDistanceKm?: number;
    estimatedDurationMinutes?: number;
}

export const pricingService = {
    /**
     * GET /api/pricing/estimates
     * Returns fare estimates for all vehicle types before the customer books.
     */
    getEstimates: (params: PricingEstimateParams) =>
        api.get('/api/pricing/estimates', { params }),
};
