import React from "react";
import { TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  transparent?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color,
  size = 24,
  transparent = false,
}) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  const finalColor = color || theme.secondary;
  const bgColor = "transparent";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.touchArea}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        style={[
          styles.container,
          {
            backgroundColor: bgColor,
          },
        ]}
      >
        <Ionicons name="arrow-back" size={size} color={finalColor} />
      </MotiView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchArea: {
    padding: 4,
  },
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(BackButton);
