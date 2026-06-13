import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../utils/constants";
import { normalizeToEnglishDigits } from "../utils/layout";
import { authService } from "../services/auth";
import Logo from "../components/Logo";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView, MotiText } from "moti";
import { Languages, Check } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { responsiveFontSize, responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";

const { height, width } = Dimensions.get("window");

const LoginScreen = ({ navigation }: any) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { setLanguage } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);

  const borderAnim = useRef(new RNAnimated.Value(0)).current;

  const onInputFocus = () => {
    setIsFocused(true);
    RNAnimated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const onInputBlur = () => {
    setIsFocused(false);
    RNAnimated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(209, 213, 219, 0.8)", theme.secondary],
  });

  const toggleLanguage = () => {
    const newLang = i18nInstance.language === "en" ? "ur" : "en";
    setLanguage(newLang);
  };

  const validatePhone = (text: string) => {
    let numeric = normalizeToEnglishDigits(text).replace(/[^0-9]/g, "");
    if (numeric.startsWith("0")) numeric = numeric.substring(1);
    setPhone(numeric.slice(0, 10));
    setError("");
  };

  const handleLogin = async () => {
    if (!phone || phone.length !== 10) {
      setError(t("login.errorInvalidPhone"));
      return;
    }
    setLoading(true);
    try {
      await authService.sendOtp(phone);
      navigation.navigate("OTP", { phone });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.Message ||
        err.message ||
        "Failed to send OTP";
      if (msg.includes("Please wait before requesting another OTP")) {
        setError("Please wait 1 minute before requesting another OTP.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isReady = phone.length === 10;

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        
        {/* Immersive Background */}
        <LinearGradient
          colors={["#FFFFFF", "#FFFFFF"]}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Animated Background Blobs for Mesh Effect */}
        <MotiView
          from={{ opacity: 0, scale: 0.5, translateX: 50 }}
          animate={{ opacity: 0.1, scale: 1, translateX: 0 }}
          transition={{ loop: true, type: "timing", duration: 10000, repeatReverse: true }}
          style={[styles.blob, { top: -100, right: -50, backgroundColor: theme.primary, width: 300, height: 300 }]}
        />
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateX: -50 }}
          animate={{ opacity: 0.08, scale: 1.2, translateX: 20 }}
          transition={{ loop: true, type: "timing", duration: 8000, repeatReverse: true }}
          style={[styles.blob, { top: 300, left: -100, backgroundColor: theme.secondary || "#FF5C00", width: 250, height: 250 }]}
        />

        {/* Top bar: Language toggle */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={toggleLanguage}
            style={styles.langPill}
            activeOpacity={0.7}
          >
            <Languages size={16} color={theme.secondary} style={{ marginRight: 8 }} />
            <Text style={[styles.langPillText, { color: theme.secondary }]}>
              {i18nInstance.language === "en" ? "اردو" : "English"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.topSection}>
            {/* Hero branding area */}
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", duration: 800 }}
              style={styles.logoWrapper}
            >
              {/* <Logo size={width * 0.45} /> */}
              <Image source={require("../assets/logo_customer.png")} style={styles.logo} resizeMode="contain" />
            </MotiView>

            <MotiText
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 200 }}
              style={styles.taglineMain}
            >
              Enter your phone number{"\n"}to continue
            </MotiText>

            {/* Redesigned Input */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 400 }}
              style={styles.inputWrapper}
            >
              <RNAnimated.View style={[styles.phoneContainer, { borderColor }]}>
                <TouchableOpacity 
                  onPress={() => setShowCountryModal(true)}
                  style={styles.countrySelector}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flag}>🇵🇰</Text>
                  <Ionicons name="caret-down" size={14} color={theme.secondary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <View style={styles.verticalDivider} />
                <View style={styles.inputFieldContainer}>
                  <Text style={[styles.countryCode, { color: "#6B7280" }]}>+92</Text>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="3XXXXXXXXX"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={validatePhone}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    selectionColor={theme.secondary}
                  />
                </View>
              </RNAnimated.View>
              {error ? <Text style={styles.errText}>{error}</Text> : null}
            </MotiView>
          </View>

          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
            {/* Privacy Policy text - Set color to primary as requested */}
            <TouchableOpacity activeOpacity={0.7} style={styles.privacyContainer}>
              <Text style={styles.privacyNote}>
                {t("login.privacyPrefix")}{" "}
                <Text style={[styles.privacyLink, { color: theme.secondary }]}>
                  {t("login.privacyPolicy")}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Pill shaped CTA button with peach gradient */}
            <TouchableOpacity
              style={[
                styles.ctaBtn,
                !isReady && styles.ctaBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isReady || loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isReady 
                  ? ["#FF5C00", "#FF991C"] 
                  : ["#FFE0CC", "#FFE0CC"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Check size={32} color={isReady ? "#FFF" : "rgba(255,255,255,0.8)"} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Country Picker Modal */}
        <Modal
          visible={showCountryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCountryModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowCountryModal(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <TouchableOpacity 
                    style={styles.countryRow}
                    onPress={() => setShowCountryModal(false)}
                  >
                    <View style={styles.modalLeft}>
                      <Text style={styles.modalFlag}>🇵🇰</Text>
                      <Text style={styles.modalCountryName}>Pakistan</Text>
                    </View>
                    <Text style={[styles.modalCountryCode, { color: theme.secondary }]}>+92</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Hidden dev shortcut */}
        <TouchableOpacity
          style={styles.devShortcut}
          onPress={() => navigation.navigate("Test")}
        />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  blob: {
    position: "absolute",
    borderRadius: 1000,
    filter: Platform.OS === "ios" ? "blur(40px)" : "none",
  },
  topBar: {
    paddingHorizontal: 24,
    alignItems: "flex-end",
    zIndex: 20,
    width: "100%",
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  langPillText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    marginTop: height * 0.03, // Moved up from 0.05
  },
  logo: {
   height:responsiveHeight(12), 
   width:responsiveWidth(80), // Reduced from 100
   alignSelf: 'center'
  },
  logoWrapper: {
    marginBottom: 5, // Reduced from 10
  },
  taglineMain: {
    fontSize: responsiveFontSize(2.2), // Slightly bigger
    fontFamily: "Poppins_700Bold",
    color: "#000",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 40,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: 20,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },
  flag: {
    fontSize: 22,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginRight: 12,
  },
  inputFieldContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  countryCode: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Poppins_500Medium",
    color: "#111827",
    paddingVertical: 0,
  },
  errText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  bottomSection: {
    alignItems: "center",
  },
  privacyContainer: {
    marginBottom: 20,
  },
  privacyNote: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
  },
  privacyLink: {
    fontFamily: "Poppins_600SemiBold",
    textDecorationLine: "underline",
  },
  ctaBtn: {
    width: "100%",
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
  },
  btnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaBtnDisabled: {
    opacity: 1, // Let gradient handle look
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  countryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  modalLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalCountryName: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#374151",
    marginLeft: 12,
  },
  modalFlag: {
    fontSize: 24,
  },
  modalCountryCode: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
  devShortcut: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    opacity: 0,
  },
});

export default LoginScreen;


