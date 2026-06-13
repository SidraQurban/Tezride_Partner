import api from './api';

export const userService = {

    getUser: () => api.get('/api/user'),

    getUserById: (id: string) => api.get(`/api/user/${id}`),

    getUserStatus: (id: string) => api.get(`/api/user/status/${id}`),


    /** PUT /api/user/profile — update profile details */
    updateUser: (data: {
        id: string;
        firstName?: string;
        lastName?: string;
        profilePictureUrl?: string;
        dateOfBirth?: string;
        gender?: string;
        phoneNumber?: string;
        [key: string]: any;
    }) => api.put('/api/user/profile', data),

    createUser: (data: any) => api.put('/api/user/profile', data),

    /** DELETE /api/user/{id} */
    deleteUser: (id: string) => api.delete(`/api/user/${id}`),

    verifyRider: (formData: FormData) =>
        api.post('/api/user/verify/rider', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    verifyCustomer: (formData: FormData) =>
        api.post('/api/user/verify/customer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    uploadProfilePicture: (formData: FormData) => {
        return api.post('/api/user/profile-picture', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};
