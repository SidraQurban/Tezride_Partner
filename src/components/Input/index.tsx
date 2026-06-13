import React from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    ViewStyle,
    KeyboardTypeOptions,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import { SIZES } from '../../utils/constants';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
    getRowDirection,
    getTextAlign,
    getFontFamily,
    normalizeToEnglishDigits,
} from '../../utils/layout';

interface InputProps {
    label?: string;
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    onBlur?: () => void;
    keyboardType?: KeyboardTypeOptions;
    secureTextEntry?: boolean;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    style?: ViewStyle;
    inputStyle?: any;
    editable?: boolean;
    maxLength?: number;
    multiline?: boolean;
    numberOfLines?: number;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    forceEnglishDigits?: boolean;
    forceRTLTextAlign?: boolean;
    forceLTRContent?: boolean;
}

const Input = React.forwardRef<TextInput, InputProps>(({
    label,
    placeholder,
    value,
    onChangeText,
    onBlur,
    keyboardType = 'default',
    secureTextEntry = false,
    error,
    leftIcon,
    rightIcon,
    style,
    inputStyle,
    editable = true,
    maxLength,
    multiline = false,
    numberOfLines,
    autoCapitalize = 'none',
    forceEnglishDigits = false,
    forceRTLTextAlign = true,
    forceLTRContent = false,
}, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const internalInputRef = React.useRef<TextInput>(null);
    const { isRTL } = useLanguage();
    const { theme } = useTheme();

    const handleChangeText = (text: string) => {
        if (!forceEnglishDigits) {
            onChangeText(text);
            return;
        }
        onChangeText(normalizeToEnglishDigits(text));
    };

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text style={[
                    styles.label,
                    {
                        textAlign: getTextAlign(isRTL),
                        fontFamily: getFontFamily('medium', isRTL),
                        color: theme.textSecondary,
                        width: '100%',
                    }
                ]}>
                    {label}
                </Text>
            )}
            <TouchableWithoutFeedback onPress={() => {
                if (ref && typeof ref === 'object' && 'current' in ref && ref.current) ref.current.focus();
                else internalInputRef.current?.focus();
            }}>
                <View style={[
                    styles.inputContainer,
                    {
                        flexDirection: 'row',
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.border,
                    },
                    isFocused && { borderColor: theme.primary, backgroundColor: theme.background },
                    error && { borderColor: theme.error },
                    !editable && styles.disabledInput
                ]}>
                    {leftIcon && (
                        <View
                            style={[
                                styles.iconLeft,
                                { marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 },
                            ]}
                            pointerEvents="none"
                        >
                            {leftIcon}
                        </View>
                    )}
                    <TextInput
                        ref={ref || internalInputRef}
                        style={[
                            styles.input,
                            {
                                textAlign: 'left', // Force left alignment for typing
                                writingDirection: 'ltr', // Force LTR for typing direction
                                fontFamily: getFontFamily('regular', isRTL),
                                color: theme.text,
                                fontSize: 14,
                                paddingVertical: isRTL 
                                    ? (Platform.OS === 'ios' ? 0 : 0) 
                                    : (Platform.OS === 'ios' ? 12 : 8),
                                includeFontPadding: isRTL ? true : false,
                                lineHeight: isRTL ? 26 : undefined,
                            },
                            inputStyle,
                            !editable && { color: theme.textSecondary },
                        ]}
                        placeholder={placeholder}
                        placeholderTextColor={theme.textSecondary + '80'}
                        value={value}
                        onChangeText={handleChangeText}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => {
                            setIsFocused(false);
                            onBlur && onBlur();
                        }}
                        keyboardType={keyboardType}
                        secureTextEntry={secureTextEntry}
                        editable={editable}
                        maxLength={maxLength}
                        multiline={multiline}
                        numberOfLines={numberOfLines}
                        autoCapitalize={autoCapitalize}
                    />
                    {rightIcon && (
                        <View
                            style={[
                                styles.iconRight,
                                { marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 },
                            ]}
                            pointerEvents="none"
                        >
                            {rightIcon}
                        </View>
                    )}
                </View>
            </TouchableWithoutFeedback>
            {error && (
                <Text style={[
                    styles.errorText,
                    {
                        textAlign: getTextAlign(isRTL),
                        fontFamily: getFontFamily('regular', isRTL),
                        color: theme.error,
                    }
                ]}>
                    {error}
                </Text>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
    },
    inputContainer: {
        borderRadius: SIZES.radius,
        borderWidth: 1,
        paddingHorizontal: 16,
        minHeight: 56,
        paddingVertical: 4,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: 14,
    },
    iconLeft: {},
    iconRight: {},
    disabledInput: {
        backgroundColor: '#EAEAEA',
        opacity: 0.7,
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },
});

export default Input;
