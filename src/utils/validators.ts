export const validatePhone = (phone: string) => {
    const regex = /^(03)[0-9]{9}$/;
    return regex.test(phone);
};

export const validateCNIC = (cnic: string) => {
    const regex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$|^[0-9]{13}$/;
    return regex.test(cnic);
};

export const validatePlateNumber = (plate: string) => {
    return plate.length >= 3 && plate.length <= 10;
};

export const validateRequired = (value: string) => {
    return value.trim().length > 0;
};
