import type { TextStyle, ViewStyle } from 'react-native';

export const getRowDirection = (isRTL: boolean): ViewStyle['flexDirection'] =>
  'row'; // Always force LTR row direction

export const getTextAlign = (isRTL: boolean): TextStyle['textAlign'] =>
  'left'; // Always force left for consistent LTR typing behavior

export const getWritingDirection = (isRTL: boolean): TextStyle['writingDirection'] =>
  'ltr'; // Always force LTR for consistent LTR typing behavior

export const getFlexAlign = (isRTL: boolean): ViewStyle['alignItems'] =>
  'flex-start'; // Always force LTR alignment

export const getFlexJustify = (isRTL: boolean): ViewStyle['justifyContent'] =>
  'flex-start'; // Always force LTR justification

/**
 * Returns an object with marginStart/End swapped if needed for manual RTL.
 * React Native handles start/end automatically IF I18nManager.isRTL is true.
 * Use this for dynamic RTL where I18nManager hasn't restarted yet.
 */
export const getHorizontalSpacing = (isRTL: boolean, value: number, property: 'margin' | 'padding' = 'margin'): ViewStyle => {
  if (property === 'margin') {
    return {
      marginLeft: value,
      marginRight: 0,
    };
  }
  return {
    paddingLeft: value,
    paddingRight: 0,
  };
};

export const flipHorizontalSpacing = (
  isRTL: boolean,
  start: number,
  end: number
): Pick<ViewStyle, 'marginLeft' | 'marginRight'> => ({
  marginLeft: start,
  marginRight: end,
});

const urduDigitMap: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export const normalizeToEnglishDigits = (input: string): string =>
  input.replace(/[۰-۹٠-٩]/g, (digit) => urduDigitMap[digit] ?? digit);

export const getFontFamily = (weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular', isUrdu: boolean = false): string => {
  if (isUrdu) {
    return weight === 'bold' || weight === 'semibold' ? 'NotoNastaliqUrdu_700Bold' : 'NotoNastaliqUrdu_400Regular';
  }
  
  switch (weight) {
    case 'medium': return 'Poppins_500Medium';
    case 'semibold': return 'Poppins_600SemiBold';
    case 'bold': return 'Poppins_700Bold';
    default: return 'Poppins_400Regular';
  }
};

export const getFontSize = (size: number, isUrdu: boolean = false): number => {
  if (isUrdu) {
    return size * 0.8;
  }
  return size;
};

export const getTextStyle = (size: number, weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular', isRTL: boolean = false): TextStyle => {
  const finalSize = getFontSize(size, isRTL);
  return {
    fontFamily: getFontFamily(weight, isRTL),
    fontSize: finalSize,
    lineHeight: isRTL ? finalSize * 1.9 : undefined, // Increased multiplier to avoid clipping
  };
};

