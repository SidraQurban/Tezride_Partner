import api from './api';

export interface GeospatialSettings {
    waveSize?: number;
    waveIntervalSeconds?: number;
    driverActiveTimeoutSeconds?: number;
    initialSearchRadiusKm?: number;
    h3Resolution?: number;
    /** Comma-separated list of radii in km, e.g. "1,2,5" */
    waveRadiiKm?: string;
    maxNearestDriversFetch?: number;
    customerSelectionTimeoutSeconds?: number;
}

export const geospatialService = {
    /** GET /api/admin/geospatial/settings — fetch current geospatial configuration */
    getSettings: () => api.get('/api/admin/geospatial/settings'),

    /** PUT /api/admin/geospatial/settings — update geospatial configuration */
    updateSettings: (settings: GeospatialSettings) =>
        api.put('/api/admin/geospatial/settings', settings),
};
