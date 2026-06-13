import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SIZES } from "../../utils/constants";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getFontFamily, getFontSize } from "../../utils/layout";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
}) => {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();

  const getVariantStyle = () => {
    switch (variant) {
      case "secondary":
        return { backgroundColor: theme.secondary };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: theme.primary,
        };
      case "ghost":
        return { backgroundColor: "transparent" };
      default:
        return { backgroundColor: theme.primary };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
        return { color: theme.primary };
      case "ghost":
        return { color: theme.textSecondary };
      default:
        return { color: "#FFFFFF" };
    }
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color="#FFFFFF" />;
    }

    return (
      <Text
        style={[
          styles.text,
          getTextStyle(),
          {
            fontFamily: getFontFamily("semibold", isRTL),
            fontSize: getFontSize(16, isRTL),
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    );
  };

  if (variant === "primary") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[style, (disabled || loading) && styles.disabled]}
      >
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        getVariantStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    width: "92%",
    alignSelf: "center",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
  },
  text: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
