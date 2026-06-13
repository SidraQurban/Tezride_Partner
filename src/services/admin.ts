import api from './api';

/** Verification status values (from OpenAPI spec) */
export const VerificationStatus = {
    NotSubmitted: 0,
    Pending: 1,
    Approved: 2,
    Rejected: 3,
} as const;

export type VerificationStatus = typeof VerificationStatus[keyof typeof VerificationStatus];

export const adminService = {
    getUsers: (params?: { pageIndex?: number; pageSize?: number }) =>
        api.get('/api/admin/identity/users', { params }),

    getPendingVerifications: () =>
        api.get('/api/admin/identity/verifications/pending'),

    verifyRider: (identityUserId: string, status: VerificationStatus) =>
        api.post(`/api/admin/identity/verify/rider/${identityUserId}`, null, {
            params: { status },
        }),

    verifyCustomer: (identityUserId: string, status: VerificationStatus) =>
        api.post(`/api/admin/identity/verify/customer/${identityUserId}`, null, {
            params: { status },
        }),

    blockRider: (userId: string, block: boolean) =>
        api.post(`/api/admin/identity/block/rider/${userId}`, null, {
            params: { block },
        }),

    blockCustomer: (userId: string, block: boolean) =>
        api.post(`/api/admin/identity/block/customer/${userId}`, null, {
            params: { block },
        }),
};
