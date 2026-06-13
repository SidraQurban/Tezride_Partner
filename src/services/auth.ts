import api from './api';
import { APP_ROLES } from '../utils/constants';

export const authService = {
    // ── OTP flow (phone-based) ────────────────────────────────────────────────

    sendOtp: (phone: string) => {
        // Normalize to international format (923XXXXXXXXX)
        let normalized = phone;
        if (normalized.startsWith('0')) {
            normalized = normalized.substring(1); // remove 0
        }
        if (!normalized.startsWith('92')) {
            normalized = `92${normalized}`; // add 92
        }
        return api.post(`/api/Account/send-otp?phoneNumber=${normalized}`);
    },

    verifyOtp: (phone: string, otp: string, fallbackRole?: string) => {
        // Normalize to international format (923XXXXXXXXX)
        let normalized = phone;
        if (normalized.startsWith('0')) {
            normalized = normalized.substring(1);
        }
        if (!normalized.startsWith('92')) {
            normalized = `92${normalized}`;
        }
        const roleToUse = fallbackRole || APP_ROLES.DRIVER;
        console.log(`[API Request] Sending verify-otp with role: ${roleToUse}`);
        return api.post('/api/Account/verify-otp', {
            phoneNumber: normalized,
            otp: otp,
            role: roleToUse,
        });
    },

    refreshToken: (refreshToken: string) =>
        api.post(`/api/Account/refresh-token?refreshToken=${refreshToken}`),

    // ── Email / password flow ─────────────────────────────────────────────────

    /** POST /api/Account/Authentication — email + password login */
    login: (email: string, password: string) =>
        api.post('/api/Account/Authentication', { email, password }),

    // ── Email verification ────────────────────────────────────────────────────

    /** GET /api/Account/confirm-email */
    confirmEmail: (userId: string, token: string) =>
        api.get('/api/Account/confirm-email', { params: { userId, token } }),

    /** GET /api/Account/resend-confirm-email */
    resendConfirmEmail: (email: string) =>
        api.get('/api/Account/resend-confirm-email', { params: { email } }),

    // ── Password reset ────────────────────────────────────────────────────────

    /** GET /api/Account/forgot-password */
    forgotPassword: (email: string) =>
        api.get('/api/Account/forgot-password', { params: { email } }),

    /** POST /api/Account/reset-password */
    resetPassword: (data: {
        email: string;
        token: string;
        newPassword: string;
        confirmPassword: string;
    }) => api.post('/api/Account/reset-password', data),
};
