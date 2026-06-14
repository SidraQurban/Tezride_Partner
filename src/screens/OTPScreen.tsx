import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../utils/constants";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { authService } from "../services/auth";
import Svg, { Circle } from "react-native-svg";
import { ChevronLeft, ChevronRight, Languages } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import BackButton from "../components/BackButton";

const { width } = Dimensions.get("window");

// ─── Circular Timer ──────────────────────────────────────────────────────────
const TIMER_MAX = 60;
const RADIUS = 28;
const CIRC = 2 * Math.PI * RADIUS;

const CircularTimer = ({ seconds }: { seconds: number }) => {
  const { theme } = useTheme();
  const progress = seconds / TIMER_MAX;
  const strokeDashoffset = CIRC * (1 - progress);
  const color = theme.primary;

  return (
    <View style={timerStyles.wrapper}>
      <Svg width={120} height={120} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* track */}
        <Circle
          cx={60}
          cy={60}
          r={RADIUS * 1.8}
          stroke="#F3F4F6"
          strokeWidth={8}
          fill="white"
        />
        {/* fill */}
        <Circle
          cx={60}
          cy={60}
          r={RADIUS * 1.8}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${CIRC * 1.8} ${CIRC * 1.8}`}
          strokeDashoffset={strokeDashoffset * 1.8}
          strokeLinecap="round"
        />
      </Svg>
      <View style={timerStyles.labelContainer}>
        <Text style={[timerStyles.label, { color: "#1A1A1A" }]}>{seconds}</Text>
      </View>
    </View>
  );
};

const timerStyles = StyleSheet.create({
  wrapper: {
    width: 120,
    height: 120,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 32, fontFamily: "Poppins_700Bold" },
});

// ─── OTP Box ─────────────────────────────────────────────────────────────────
const OtpBox = ({
  focused,
  hasError,
  children,
}: {
  focused: boolean;
  hasError: boolean;
  children: React.ReactNode;
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        boxStyles.box,
        focused && boxStyles.boxFocused,
        hasError && boxStyles.boxError,
      ]}
    >
      {children}
    </View>
  );
};

const boxStyles = StyleSheet.create({
  box: {
    width: (width - 100) / 6,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  boxFocused: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
  },
  boxFilled: {
    backgroundColor: "#FFFFFF",
  },
  boxError: {
    borderColor: "#E74C3C",
  },
  digit: {
    fontSize: 22,
    fontFamily: "Poppins_600SemiBold",
    color: "#D1D5DB",
  },
  digitFilled: {
    color: "#1A1A1A",
  },
});

// ─── Main OTPScreen ───────────────────────────────────────────────────────────
const OTPScreen = ({ navigation, route }: any) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isRTL, setLanguage } = useLanguage();
  const { phone } = route.params;
  const { signIn } = useAuth();
  const { theme } = useTheme();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [timer, setTimer] = useState(TIMER_MAX);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const otpString = otp.join("");
  const isComplete = otpString.length === 6;

  // Auto-focus first box
  useEffect(() => {
    const id = setTimeout(() => inputRefs.current[0]?.focus(), 400);
    return () => clearTimeout(id);
  }, []);

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleChange = (value: string, index: number) => {
    // Paste full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, 6);
      if (pasted.length > 0) {
        const updated = ["", "", "", "", "", ""];
        for (let i = 0; i < pasted.length; i++) updated[i] = pasted[i];
        setOtp(updated);
        setError("");
        const nextIdx = Math.min(pasted.length - 1, 5);
        inputRefs.current[nextIdx]?.focus();
        setFocusedIdx(nextIdx);
        if (pasted.length === 6) {
          Keyboard.dismiss();
          setTimeout(() => handleVerify(pasted), 200);
        }
      }
      return;
    }

    if (value === "") {
      const updated = [...otp];
      updated[index] = "";
      setOtp(updated);
      setError("");
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setFocusedIdx(index - 1);
      }
      return;
    }

    const digit = value.replace(/\D/g, "").slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    setError("");

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIdx(index + 1);
    }
    if (digit && index === 5) {
      const full = updated.join("");
      if (full.length === 6) {
        Keyboard.dismiss();
        setTimeout(() => handleVerify(full), 200);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIdx(index - 1);
      const updated = [...otp];
      updated[index - 1] = "";
      setOtp(updated);
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    if (loading) return;
    const code = codeOverride ?? otpString;
    if (code.length < 6) return;
    setLoading(true);
    setError("");

    try {
      const response = await authService.verifyOtp(phone, code);
      const apiData = response.data?.data || response.data;
      const token = apiData?.jwToken || apiData?.token || "";
      const refreshToken = apiData?.refreshToken || "";
      const userId = apiData?.id || "";

      if (!token) {
        setError("Invalid response from server. Please try again.");
        return;
      }

      const rawRiderStatus = apiData?.riderStatus ?? "NotSubmitted";
      const riderStatusString = String(rawRiderStatus).toLowerCase();
      let normalizedRiderStatus:
        | "approved"
        | "pending"
        | "rejected"
        | "notsubmitted" = "notsubmitted";
      if (riderStatusString === "approved" || riderStatusString === "2") {
        normalizedRiderStatus = "approved";
      } else if (riderStatusString === "pending" || riderStatusString === "1") {
        normalizedRiderStatus = "pending";
      } else if (
        riderStatusString === "rejected" ||
        riderStatusString === "3"
      ) {
        normalizedRiderStatus = "rejected";
      }

      const isApproved = normalizedRiderStatus === "approved";
      const isPending = normalizedRiderStatus === "pending";

      const userData: any = {
        id: userId,
        username: apiData?.username || phone,
        roles: apiData?.roles || ["Rider"],
        name: apiData?.name || null,
        phoneNumber: phone,
        gender: apiData?.gender?.toLowerCase() || null,
        role: "Rider",
        isRegistered: isApproved || isPending,
        verificationStatus: normalizedRiderStatus,
      };

      await signIn(token, refreshToken, userData);

      if (isApproved) navigation.replace("MainTabs");
      else if (isPending)
        navigation.replace("VerificationPending", { userId });
      else navigation.replace("RegistrationFlow", { userId });
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("incorrect")
      ) {
        setError("Invalid or expired code. Please try again.");
      } else if (err.response?.status === 400) {
        setError(msg || "Incorrect code. Please check and retry.");
      } else if (err.response?.status === 401) {
        setError("Unauthorized. Please request a new code.");
      } else {
        setError(msg || "Verification failed. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setOtp(["", "", "", "", "", ""]);
    setTimer(TIMER_MAX);
    setError("");
    setFocusedIdx(0);
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
    try {
      await authService.sendOtp(phone);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.Message ||
        err.message ||
        "Failed to resend code";
      if (msg.includes("Please wait before requesting another OTP")) {
        setError("Please wait 1 minute before resending the code.");
      } else {
        setError(msg);
      }
    } finally {
      setResending(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ur" : "en";
    setLanguage(newLang);
  };

  const formattedPhone = `+92${phone}`;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={[styles.container, { backgroundColor: "#FFFFFF" }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header with Back and Language */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <BackButton />
        <TouchableOpacity
          onPress={toggleLanguage}
          style={styles.langPill}
          activeOpacity={0.7}
        >
          <Languages size={16} color={theme.secondary} style={{ marginRight: 8 }} />
          <Text style={[styles.langPillText, { color: theme.secondary }]}>
            {i18n.language === "en" ? "اردو" : "English"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>{t("otp.sentCode")}</Text>
          <Text style={styles.infoText}>{t("otp.toYouOn")}</Text>
          <Text style={[styles.phoneDisplay, { color: theme.primary }]}>
            {formattedPhone}
          </Text>
        </View>

        {/* Circular Timer */}
        <View style={styles.timerRow}>
          <CircularTimer seconds={timer} />
        </View>

        {/* OTP Boxes */}
        <View style={[styles.otpRow, { direction: "ltr" }]}>
          {otp.map((digit, i) => (
            <OtpBox
              key={i}
              focused={focusedIdx === i}
              hasError={!!error}
            >
              <TextInput
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                style={[styles.otpInput, { color: "#1A1A1A" }]}
                value={digit}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                onFocus={() => setFocusedIdx(i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                // selectionColor={theme.primary}
                cursorColor={theme.primary}
              />
            </OtpBox>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendInfo}>
            {t("otp.didntReceive")}{" "}
            {timer > 0 ? (
              <Text style={styles.resendTimer}>
                {t("otp.resend")} ({timer}s)
              </Text>
            ) : (
              <Text 
                style={[styles.resendTimer, { color: theme.primary }]}
                onPress={handleResend}
              >
                {t("otp.resend")}
              </Text>
            )}
          </Text>
        </View>
      </View>

      {/* Verify CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            styles.verifyBtn,
            (!isComplete || loading) && styles.verifyBtnDisabled,
          ]}
          onPress={() => handleVerify()}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isComplete ? (theme.gradient as any) : ["#FFE0CC", "#FFE0CC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.verifyBtnText}>{t("otp.continue")}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
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
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  infoSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  infoText: {
    fontSize: 18,
    fontFamily: "Poppins_500Medium",
    color: "#333",
    textAlign: "center",
    lineHeight: 28,
  },
  phoneDisplay: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    marginTop: 8,
  },
  timerRow: {
    marginBottom: 40,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  otpInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Poppins_600SemiBold",
    padding: 0,
  },
  errorText: {
    color: "#E74C3C",
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  resendRow: {
    marginTop: 20,
    alignItems: "center",
  },
  resendInfo: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "#9CA3AF",
  },
  resendTimer: {
    color: "#9CA3AF",
    fontFamily: "Poppins_600SemiBold",
  },
  footer: {
    paddingHorizontal: 24,
  },
  verifyBtn: {
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  btnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
  },
});

export default OTPScreen;
