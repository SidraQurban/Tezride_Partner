export const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString()}`;
};

/**
 * Formats a raw phone number into a human-readable Pakistani format.
 * Handles stored formats: 928888888888 / +928888888888 / 08888888888 / 8888888888
 * Output: +92 8888888888
 */
export const formatPhoneNumber = (phone?: string | null): string => {
    if (!phone) return '';
    // Strip all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // If it starts with 92 and is 12 digits, extract the local 10-digit part
    if (digits.startsWith('92') && digits.length === 12) {
        return `+92 ${digits.slice(2)}`;
    }
    // If it's a 10-digit local number starting with 0, strip the 0
    if (digits.startsWith('0') && digits.length === 11) {
        return `+92 ${digits.slice(1)}`;
    }
    // If already 10 digits (no prefix)
    if (digits.length === 10) {
        return `+92 ${digits}`;
    }
    // Fallback — just prepend + and return as-is
    return `+${digits}`;
};

export const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export const maskCNIC = (cnic: string) => {
    if (cnic.length < 13) return cnic;
    return `${cnic.slice(0, 5)}-${cnic.slice(5, 12)}-${cnic.slice(12)}`;
};

export const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'accepted': return '#27AE60';
        case 'pending': return '#F2C94C';
        case 'cancelled': return '#EB5757';
        case 'completed': return '#2D9CDB';
        default: return '#666';
    }
};
