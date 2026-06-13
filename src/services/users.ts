import api from './api';

export const usersService = {
    submitRating: (data: { rideId: string; targetUserId: string; rating: number; comment?: string }) =>
        api.post('/api/ratings/submit', data),
};
