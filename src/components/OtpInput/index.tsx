import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Platform,
} from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

interface OtpInputProps {
    length?: number;
    onCodeFilled: (code: string) => void;
    onCodeChanged?: (code: string) => void;
}

const OtpInput: React.FC<OtpInputProps> = ({ length = 6, onCodeFilled, onCodeChanged }) => {
    const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
    const inputs = useRef<TextInput[]>([]);

    useEffect(() => {
        if (onCodeChanged) onCodeChanged(otp.join(''));
        if (otp.every(val => val !== '') && otp.join('').length === length) {
            onCodeFilled(otp.join(''));
        }
    }, [otp]);

    const handleChangeText = (text: string, index: number) => {
        // Handle pasted content
        if (text.length > 1) {
            const pastedData = text.slice(0, length).split('');
            const newOtp = [...otp];
            pastedData.forEach((char, i) => {
                if (i < length) newOtp[i] = char;
            });
            setOtp(newOtp);
            // Focus last filled box
            const nextIndex = Math.min(pastedData.length, length - 1);
            inputs.current[nextIndex]?.focus();
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);

        if (text && index < length - 1) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    return (
        <View style={styles.container}>
            {otp.map((digit, index) => (
                <View
                    key={index}
                    style={[
                        styles.inputContainer,
                        otp[index] ? styles.activeInput : styles.inactiveInput
                    ]}
                >
                    <TextInput
                        ref={(ref) => {
                            if (ref) inputs.current[index] = ref;
                        }}
                        style={[styles.input, { writingDirection: 'ltr' }]}
                        maxLength={Platform.OS === 'android' ? 1 : length} // Allow paste on android
                        keyboardType="number-pad"
                        onChangeText={(text) => handleChangeText(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        value={digit}
                        textAlign="center"
                        autoFocus={index === 0}
                        selectionColor={COLORS.primary}
                    />
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        direction: 'ltr' as any,
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        marginVertical: 20,
    },
    inputContainer: {
        width: 44,
        height: 52,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    inactiveInput: {
        borderColor: COLORS.border,
    },
    activeInput: {
        borderColor: COLORS.primary,
    },
    input: {
        fontSize: 24,
        fontFamily: 'Poppins_600SemiBold',
        color: COLORS.text,
        width: '100%',
        height: '100%',
    },
});

export default OtpInput;
