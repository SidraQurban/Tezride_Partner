import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Modal,
  ActionSheetIOS,
  KeyboardAvoidingView,
  TextInput,
  Dimensions,
  Keyboard,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { COLORS, SIZES } from "../utils/constants";
import Button from "../components/Button";
import Input from "../components/Input";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { userService } from "../services/user";
import { getFontFamily, getFontSize } from "../utils/layout";
import {
  ChevronLeft,
  Calendar,
  Camera,
  CheckCircle,
  Info,
  User as UserIcon,
  ArrowLeft,
} from "lucide-react-native";
import { ImageUploadService } from "../services/ImageUploadService";
import BackButton from "../components/BackButton";
import { MotiView } from "moti";
import { responsiveHeight } from "react-native-responsive-dimensions";
import { Ionicons } from "@expo/vector-icons";

const { width, height: screenHeight } = Dimensions.get("window");

// ── Vehicle Type Selection Card ─────────────────────────────────────────────

const VehicleTypeCard = ({
  type,
  selected,
  onSelect,
  image,
  theme,
  isRTL,
  label,
}: any) => (
  <TouchableOpacity
    activeOpacity={0.65}
    onPress={() => onSelect(type)}
    style={[
      vCardStyles.card,
      {
        backgroundColor: selected ? theme.primary + "0C" : theme.cardBackground,
        borderColor: selected ? theme.primary : theme.border,
      },
    ]}
  >
    <View
      style={[
        vCardStyles.iconWrap,
        { backgroundColor: selected ? theme.primary + "18" : "#F3F4F6" },
      ]}
    >
      <Image
        source={image}
        style={vCardStyles.vehicleImg}
        resizeMode="contain"
      />
    </View>
    <Text
      style={[
        vCardStyles.label,
        {
          color: selected ? theme.primary : theme.text,
          fontFamily: getFontFamily(selected ? "semibold" : "regular", isRTL),
          fontSize: getFontSize(14, isRTL),
        },
      ]}
    >
      {label}
    </Text>
    <View
      style={[
        vCardStyles.radio,
        { borderColor: selected ? theme.primary : "#CBD5E1" },
      ]}
    >
      {selected && (
        <View
          style={[vCardStyles.radioDot, { backgroundColor: theme.primary }]}
        />
      )}
    </View>
  </TouchableOpacity>
);

const vCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleImg: {
    width: 34,
    height: 34,
  },
  label: {
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

// ── Compact Document Upload Button ─────────────────────────────────────────

const ImprovedUploadButton = ({
  label,
  uri,
  onPress,
  onGuidePress,
  isRTL,
  theme,
  error,
}: any) => (
  <View style={{ marginBottom: 10 }}>
    <TouchableOpacity
      style={[
        uploadStyles.card,
        {
          borderColor: error ? theme.error : uri ? theme.success : theme.border,
          backgroundColor: uri ? theme.success + "06" : theme.cardBackground,
          borderStyle: uri ? "solid" : "dashed",
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          uploadStyles.iconBox,
          {
            backgroundColor: uri ? theme.success + "18" : theme.primary + "10",
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={uploadStyles.preview} />
        ) : (
          <Camera color={theme.primary} size={18} />
        )}
      </View>
      <View style={uploadStyles.textArea}>
        <Text
          style={[
            uploadStyles.label,
            {
              color: theme.text,
              fontFamily: getFontFamily("medium", isRTL),
              fontSize: getFontSize(13, isRTL),
            },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            uploadStyles.status,
            {
              color: uri ? theme.success : theme.textSecondary,
              fontFamily: getFontFamily("regular", isRTL),
              fontSize: getFontSize(11, isRTL),
            },
          ]}
        >
          {uri
            ? isRTL
              ? "✓ تصویر اپلوڈ ہو گئی"
              : "✓ Uploaded"
            : isRTL
              ? "تصویر لینے کے لیے دبائیں"
              : "Tap to upload"}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onGuidePress}
        style={uploadStyles.infoBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Info color={theme.textSecondary} size={16} />
      </TouchableOpacity>
    </TouchableOpacity>
    {error ? (
      <Text
        style={[
          uploadStyles.error,
          { color: theme.error, fontSize: getFontSize(11, isRTL) },
        ]}
      >
        {error}
      </Text>
    ) : null}
  </View>
);

const uploadStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  textArea: { flex: 1 },
  label: { marginBottom: 2 },
  status: {},
  infoBtn: { padding: 4 },
  error: { marginTop: 3, marginLeft: 4 },
});

// ── Visual Guide Examples ───────────────────────────────────────────────────

const VisualGuideItem = ({ type, isDo, theme, isRTL }: any) => {
  const images: any = {
    vehicle: {
      do: require("../assets/car.png"),
      dont: require("../assets/car.png"),
    },
    cnic_front: {
      do: require("../assets/cnic_front_real.jpg"),
      dont: require("../assets/cnic_front_real.jpg"),
    },
    cnic_back: {
      do: require("../assets/cnic_front_real.jpg"),
      dont: require("../assets/cnic_front_real.jpg"),
    },
    license: {
      do: require("../assets/license_pak_raw.jpg"),
      dont: require("../assets/license_real.jpeg"),
    },
  };

  let displayImage;
  switch (type) {
    case "license":
      displayImage = isDo ? images.license.do : images.license.dont;
      break;
    case "cnic_front":
      displayImage = isDo ? images.cnic_front.do : images.cnic_front.dont;
      break;
    case "cnic_back":
      displayImage = isDo ? images.cnic_back.do : images.cnic_back.dont;
      break;
    case "vehicle":
    default:
      displayImage = isDo ? images.vehicle.do : images.vehicle.dont;
      break;
  }

  const label = isDo
    ? isRTL
      ? "درست طریقہ"
      : "Correct Way"
    : isRTL
      ? "غلط طریقہ"
      : "Incorrect Way";
  const icon = isDo ? (
    <CheckCircle size={14} color={theme.success} />
  ) : (
    <Info size={14} color={theme.error} />
  );

  return (
    <View style={guideModalStyles.guideItem}>
      <View
        style={[
          guideModalStyles.guideImageContainer,
          { borderColor: isDo ? theme.success : theme.error },
        ]}
      >
        <Image
          source={displayImage}
          style={[guideModalStyles.guideImage, !isDo && { opacity: 0.7 }]}
        />
        {!isDo && (
          <View style={guideModalStyles.dontOverlay}>
            <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 20 }}>
              ✕
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 6,
          gap: 4,
        }}
      >
        {icon}
        <Text
          style={{
            color: isDo ? theme.success : theme.error,
            fontSize: getFontSize(11, isRTL),
            fontFamily: getFontFamily("semibold", isRTL),
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
};

// ── Guide Modal Content ─────────────────────────────────────────────────────

const GuideModalContent = ({
  title,
  type,
  content,
  isRTL,
  theme,
  onClose,
}: any) => (
  <View style={guideModalStyles.container}>
    <View style={guideModalStyles.handle} />
    <View style={guideModalStyles.header}>
      <Text
        style={[
          guideModalStyles.title,
          { color: theme.text, fontFamily: getFontFamily("bold", isRTL) },
        ]}
      >
        {title}
      </Text>
      <TouchableOpacity onPress={onClose} style={guideModalStyles.closeBtn}>
        <Text style={{ fontSize: 20, color: theme.textSecondary }}>×</Text>
      </TouchableOpacity>
    </View>
    <ScrollView
      style={guideModalStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          guideModalStyles.infoBox,
          { backgroundColor: theme.primary + "10" },
        ]}
      >
        <Info color={theme.primary} size={16} />
        <Text
          style={[
            guideModalStyles.infoText,
            { color: theme.text, fontFamily: getFontFamily("medium", isRTL) },
          ]}
        >
          {isRTL
            ? "بہترین نتائج کے لیے ان ہدایات پر عمل کریں"
            : "Follow these instructions for best results"}
        </Text>
      </View>

      <Text
        style={[
          guideModalStyles.contentText,
          {
            color: theme.textSecondary,
            fontFamily: getFontFamily("regular", isRTL),
            textAlign: isRTL ? "right" : "left",
          },
        ]}
      >
        {content}
      </Text>

      <View style={guideModalStyles.visualSection}>
        <Text
          style={[
            guideModalStyles.sectionTitle,
            {
              textAlign: isRTL ? "right" : "left",
              fontFamily: getFontFamily("bold", isRTL),
              color: theme.text,
            },
          ]}
        >
          {isRTL ? "تصویری مثالیں" : "Visual Examples"}
        </Text>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <VisualGuideItem
            type={type}
            isDo={true}
            theme={theme}
            isRTL={isRTL}
          />
          <VisualGuideItem
            type={type}
            isDo={false}
            theme={theme}
            isRTL={isRTL}
          />
        </View>
      </View>

      <View style={guideModalStyles.bulletSection}>
        <Text
          style={[
            guideModalStyles.sectionTitle,
            {
              textAlign: isRTL ? "right" : "left",
              fontFamily: getFontFamily("bold", isRTL),
              color: theme.text,
            },
          ]}
        >
          {isRTL ? "اہم نکات" : "Important Tips"}
        </Text>
        <View style={{ marginTop: 10 }}>
          {[
            isRTL ? "تمام کونے نظر آنے چاہئیں" : "All corners must be visible",
            isRTL ? "روشنی مناسب ہونی چاہئے" : "Lighting must be adequate",
            isRTL ? "تصویر دھندلی نہیں ہونی چاہئے" : "Image must not be blurry",
          ].map((tip, i) => (
            <View
              key={i}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <View
                style={[
                  guideModalStyles.dot,
                  { backgroundColor: theme.primary },
                ]}
              />
              <Text
                style={{
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("regular", isRTL),
                  fontSize: 12,
                }}
              >
                {tip}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Button
        title={isRTL ? "سمجھ گیا" : "I Understand"}
        onPress={onClose}
        style={{ marginTop: 16, marginBottom: 32 }}
      />
    </ScrollView>
  </View>
);

const guideModalStyles = StyleSheet.create({
  container: {
    maxHeight: "90%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 15 },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 12 },
  contentText: { fontSize: 12, lineHeight: 19, marginBottom: 18 },
  visualSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 13 },
  guideItem: { width: "48%" },
  guideImageContainer: {
    height: 120,
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  guideImage: { width: "90%", height: "90%", resizeMode: "contain" },
  dontOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(239, 68, 68, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  bulletSection: { marginBottom: 14 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});

// ── Simple Date Picker ──────────────────────────────────────────────────────

const SimpleDatePicker = ({
  value,
  onChange,
  error,
  label,
  placeholder,
}: any) => {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDay, setTempDay] = useState("");
  const [tempMonth, setTempMonth] = useState("");
  const [tempYear, setTempYear] = useState("");

  const dayRef = React.useRef<TextInput>(null);
  const monthRef = React.useRef<TextInput>(null);
  const yearRef = React.useRef<TextInput>(null);

  const openPicker = () => {
    if (value) {
      const parts = value.split("/");
      setTempDay(parts[0] || "");
      setTempMonth(parts[1] || "");
      setTempYear(parts[2] || "");
    }
    setShowPicker(true);
  };

  const handleConfirm = () => {
    const d = parseInt(tempDay);
    const m = parseInt(tempMonth);
    const y = parseInt(tempYear);
    if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1940) {
      Alert.alert("Invalid Date", "Date is invalid.");
      return;
    }
    onChange(
      `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
    );
    setShowPicker(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={dpStyles.label}>{label}</Text>
      <TouchableOpacity
        style={[dpStyles.input, error ? dpStyles.inputError : null]}
        onPress={openPicker}
      >
        <Calendar
          color={value ? theme.primary : COLORS.textSecondary}
          size={16}
        />
        <Text
          style={[
            dpStyles.inputText,
            !value && { color: COLORS.textSecondary },
          ]}
        >
          {value || placeholder || "DD/MM/YYYY"}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={dpStyles.errorText}>{error}</Text> : null}

      <Modal visible={showPicker} transparent animationType="slide">
        <KeyboardAvoidingView style={dpStyles.modalOverlay} behavior="padding">
          <View style={dpStyles.modalCard}>
            <Text style={dpStyles.modalTitle}>
              {isRTL ? "تاریخِ پیدائش" : "Date of Birth"}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <TextInput
                ref={dayRef}
                style={[dpStyles.dateInput, { writingDirection: "ltr" }]}
                placeholder="DD"
                value={tempDay}
                onChangeText={(v) => {
                  setTempDay(v);
                  if (v.length === 2) monthRef.current?.focus();
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                ref={monthRef}
                style={[dpStyles.dateInput, { writingDirection: "ltr" }]}
                placeholder="MM"
                value={tempMonth}
                onChangeText={(v) => {
                  setTempMonth(v);
                  if (v.length === 2) yearRef.current?.focus();
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                ref={yearRef}
                style={[
                  dpStyles.dateInput,
                  { flex: 2, writingDirection: "ltr" },
                ]}
                placeholder="YYYY"
                value={tempYear}
                onChangeText={(v) => {
                  setTempYear(v);
                  if (v.length === 4) Keyboard.dismiss();
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button
                title={isRTL ? "منسوخ" : "Cancel"}
                onPress={() => setShowPicker(false)}
                variant="ghost"
                style={{
                  flex: 1,
                  backgroundColor: "#F3F4F6",
                  height: 48,
                  borderRadius: 14,
                }}
                textStyle={{ color: theme.textSecondary }}
              />
              <Button
                title={isRTL ? "تصدیق کریں" : "Confirm"}
                onPress={handleConfirm}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const dpStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.error },
  inputText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: COLORS.text,
    flex: 1,
  },
  errorText: { fontSize: 11, color: COLORS.error, marginTop: 3 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 30,
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Poppins_700Bold",
    color: "#1A1A1A",
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 10,
    textAlign: "center",
    fontSize: 15,
    color: "#1A1A1A",
  },
});

// ── Main Registration Flow Screen ───────────────────────────────────────────

const RegistrationFlow = ({ navigation, route }: any) => {
  const { userId } = route.params || {};
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();

  const activeUserId = userId || user?.id || "";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    cnic: "",
    dob: "",
    gender: "",
    address: "",
    bikeType: "",
    bikeModel: "",
    bikeYear: "",
    plateNumber: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [docs, setDocs] = useState<Record<string, string>>({
    profilePic: "",
    vehiclePhoto: "",
    drivingLicense: "",
    cnicFront: "",
    cnicBack: "",
    vehicleReg: "",
  });

  const [guideVisible, setGuideVisible] = useState(false);
  const [activeGuide, setActiveGuide] = useState<{
    title: string;
    type: string;
    content: string;
  } | null>(null);

  // Persistence
  React.useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem("temp_reg_v2");
      if (saved) {
        const p = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...p.formData }));
        setStep(p.step || 1);
      }
    };
    load();
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem("temp_reg_v2", JSON.stringify({ formData, step }));
  }, [formData, step]);

  const setField = (k: string, v: string) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const handleImagePickWrapper = async (key: string, label: string) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Camera", "Gallery"], cancelButtonIndex: 0 },
        async (idx) => {
          const res =
            idx === 1
              ? await ImageUploadService.takePhoto()
              : idx === 2
                ? await ImageUploadService.pickImage()
                : null;
          if (res) setDocs((p) => ({ ...p, [key]: res.uri }));
        },
      );
    } else {
      Alert.alert(`Upload ${label}`, "Choose Source", [
        {
          text: "Camera",
          onPress: async () => {
            const r = await ImageUploadService.takePhoto();
            if (r) setDocs((p) => ({ ...p, [key]: r.uri }));
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            const r = await ImageUploadService.pickImage();
            if (r) setDocs((p) => ({ ...p, [key]: r.uri }));
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const showGuide = (title: string, type: string, content: string) => {
    setActiveGuide({ title, type, content });
    setGuideVisible(true);
  };

  const validate = () => {
    const e: any = {};
    if (step === 1) {
      if (!formData.bikeType) {
        Alert.alert("Select Vehicle", "Please select your vehicle type.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!formData.bikeModel) e.bikeModel = "Required";
      if (!formData.bikeYear) e.bikeYear = "Required";
      if (!formData.plateNumber) e.plateNumber = "Required";
      setErrors(e);
      if (Object.keys(e).length > 0) return false;
      if (!docs.vehiclePhoto) {
        Alert.alert("Missing Photo", "Vehicle photo is required.");
        return false;
      }
      if (!docs.drivingLicense) {
        Alert.alert("Missing Photo", "Driving license is required.");
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!formData.firstName) e.firstName = "Required";
      if (!formData.lastName) e.lastName = "Required";
      if (!formData.dob) e.dob = "Required";
      if (!formData.gender) e.gender = "Required";
      if (!formData.cnic) e.cnic = "Required";
      else if (formData.cnic.length !== 13) e.cnic = "CNIC must be 13 digits";
      if (!formData.address) e.address = "Required";
      setErrors(e);
      if (Object.keys(e).length > 0) return false;
      if (!docs.profilePic) {
        Alert.alert("Missing Photo", "Profile picture is required.");
        return false;
      }
      if (!docs.cnicFront) {
        Alert.alert("Missing Photo", "CNIC Front is required.");
        return false;
      }
      if (!docs.cnicBack) {
        Alert.alert("Missing Photo", "CNIC Back is required.");
        return false;
      }
      return true;
    }
    return false;
  };

  const nextStep = () => {
    if (!validate()) return;
    if (step < 3) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const data = new FormData();
      data.append("UserId", activeUserId);
      data.append("FirstName", formData.firstName);
      data.append("LastName", formData.lastName);
      data.append("Gender", formData.gender);
      data.append("CnicNumber", formData.cnic);
      data.append("Address", formData.address);
      data.append("VehicleType", formData.bikeType);
      data.append("VehicleModel", formData.bikeModel);
      data.append("VehicleYear", formData.bikeYear);
      data.append("NumberPlate", formData.plateNumber);

      if (formData.dob) {
        const p = formData.dob.split("/");
        data.append("DateOfBirth", `${p[2]}-${p[1]}-${p[0]}`);
      }

      const addFile = (uri: string, field: string) => {
        if (!uri) return;
        const name = uri.split("/").pop() || `${field}.jpg`;
        // @ts-ignore
        data.append(field, {
          uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
          name,
          type: "image/jpeg",
        });
      };

      addFile(docs.profilePic, "ProfileImage");
      addFile(docs.vehiclePhoto, "VehicleImage");
      addFile(docs.drivingLicense, "DrivingLicenseImage");
      addFile(docs.cnicFront, "CnicFrontImage");
      addFile(docs.cnicBack, "CnicBackImage");
      addFile(docs.vehicleReg, "VehicleRegImage");

      await userService.verifyRider(data);
      AsyncStorage.removeItem("temp_reg_v2");
      await updateUser({ isRegistered: true, verificationStatus: "pending" });
      navigation.replace("VerificationPending");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to submit details.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step Header ───────────────────────────────────────────────────────────

  const stepMeta = [
    { en: "Vehicle", ur: "گاڑی" },
    { en: "Details", ur: "تفصیلات" },
    { en: "Personal", ur: "ذاتی" },
  ];

  const renderHeader = () => (
    <View
      style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}
    >
      <BackButton
        onPress={() => {
          if (step > 1) {
            setStep(step - 1);
          } else {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("Login");
            }
          }
        }}
        size={24}
      />

      <View style={styles.stepContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.stepBarWrap}>
            <View
              style={[
                styles.stepBar,
                { backgroundColor: i <= step ? theme.secondary : "#E5E7EB" },
              ]}
            />
            <Text
              style={[
                styles.stepLabel,
                {
                  color: i <= step ? theme.secondary : "#9CA3AF",
                  fontFamily: getFontFamily(
                    i === step ? "medium" : "regular",
                    isRTL,
                  ),
                },
              ]}
            >
              {isRTL ? stepMeta[i - 1].ur : stepMeta[i - 1].en}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ width: 36 }} />
    </View>
  );

  // ── Step Content ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <MotiView 
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={{ flex: 1, paddingTop: responsiveHeight(1) }}
          >
            <View style={[styles.stepHeaderBlock, { marginBottom: 20 }]}>
              <Text
                style={[
                  styles.stepTitle,
                  {
                    color: theme.text,
                    fontFamily: getFontFamily("bold", isRTL),
                    fontSize: getFontSize(22, isRTL),
                    lineHeight: isRTL ? 36 : undefined,
                  },
                ]}
              >
                {t("registration.chooseVehicle")}
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  {
                    color: theme.textSecondary,
                    fontFamily: getFontFamily("regular", isRTL),
                    fontSize: getFontSize(13, isRTL),
                    marginTop: 4,
                    lineHeight: isRTL ? 22 : undefined,
                  },
                ]}
              >
                {isRTL
                  ? "اپنی گاڑی کی قسم منتخب کریں"
                  : "Select the type of vehicle you drive"}
              </Text>
            </View>

            <View style={{ gap: 12, marginTop: 20 }}>
              <VehicleTypeCard
                type="Bike"
                label={t("registration.bike")}
                selected={formData.bikeType === "Bike"}
                onSelect={(v: string) => setField("bikeType", v)}
                image={require("../assets/bike-removebg.png")}
                theme={theme}
                isRTL={isRTL}
              />
              <VehicleTypeCard
                type="Rickshaw"
                label={t("registration.rickshaw")}
                selected={formData.bikeType === "Rickshaw"}
                onSelect={(v: string) => setField("bikeType", v)}
                image={require("../assets/rickshaw-removebg.png")}
                theme={theme}
                isRTL={isRTL}
              />
              <VehicleTypeCard
                type="Car"
                label={t("registration.car")}
                selected={formData.bikeType === "Car"}
                onSelect={(v: string) => setField("bikeType", v)}
                image={require("../assets/car-removebg.png")}
                theme={theme}
                isRTL={isRTL}
              />
            </View>
          </MotiView>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepHeaderBlock}>
              <Text
                style={[
                  styles.stepTitle,
                  {
                    color: theme.text,
                    fontFamily: getFontFamily("bold", isRTL),
                    fontSize: getFontSize(18, isRTL),
                  },
                ]}
              >
                {t("registration.vehicleDetails")}
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  {
                    color: theme.textSecondary,
                    fontFamily: getFontFamily("regular", isRTL),
                    fontSize: getFontSize(12, isRTL),
                  },
                ]}
              >
                {isRTL
                  ? "گاڑی کی تصویر اور دستاویزات اپلوڈ کریں"
                  : "Upload your vehicle photo and documents"}
              </Text>
            </View>

            <Text
              style={[
                styles.sectionLabel,
                {
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("medium", isRTL),
                },
              ]}
            >
              {isRTL ? "دستاویزات" : "Documents"}
            </Text>
            <ImprovedUploadButton
              label={t("registration.vehiclePhoto")}
              uri={docs.vehiclePhoto}
              theme={theme}
              isRTL={isRTL}
              onPress={() => handleImagePickWrapper("vehiclePhoto", "Vehicle")}
              onGuidePress={() =>
                showGuide(
                  t("registration.vehiclePhoto"),
                  "vehicle",
                  t(
                    "registration.vehiclePhotoGuide",
                    "Take a clear side-view photo of your vehicle. Make sure the number plate is visible.",
                  ),
                )
              }
            />
            <ImprovedUploadButton
              label={t("registration.drivingLicense")}
              uri={docs.drivingLicense}
              theme={theme}
              isRTL={isRTL}
              onPress={() =>
                handleImagePickWrapper("drivingLicense", "License")
              }
              onGuidePress={() =>
                showGuide(
                  t("registration.drivingLicense"),
                  "license",
                  t(
                    "registration.drivingLicenseGuide",
                    "Place your license on a flat surface. Avoid glare and ensure text is readable.",
                  ),
                )
              }
            />

            <Text
              style={[
                styles.sectionLabel,
                {
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("medium", isRTL),
                  marginTop: 6,
                },
              ]}
            >
              {isRTL ? "گاڑی کی معلومات" : "Vehicle Info"}
            </Text>
            <Input
              label={t("registration.vehicleModel")}
              placeholder={t("registration.placeholderModel")}
              value={formData.bikeModel}
              onChangeText={(v) => setField("bikeModel", v)}
              error={errors.bikeModel}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Input
                label={t("registration.year")}
                placeholder={t("registration.placeholderYear")}
                value={formData.bikeYear}
                onChangeText={(v) => setField("bikeYear", v)}
                error={errors.bikeYear}
                style={{ flex: 1 }}
                keyboardType="number-pad"
              />
              <Input
                label={t("registration.numberPlate")}
                placeholder={t("registration.placeholderPlate")}
                value={formData.plateNumber}
                onChangeText={(v) => setField("plateNumber", v)}
                error={errors.plateNumber}
                style={{ flex: 2 }}
                autoCapitalize="characters"
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View>
            <View style={styles.stepHeaderBlock}>
              <Text
                style={[
                  styles.stepTitle,
                  {
                    color: theme.text,
                    fontFamily: getFontFamily("bold", isRTL),
                    fontSize: getFontSize(18, isRTL),
                  },
                ]}
              >
                {t("registration.personalInfo", "Personal Details")}
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  {
                    color: theme.textSecondary,
                    fontFamily: getFontFamily("regular", isRTL),
                    fontSize: getFontSize(12, isRTL),
                  },
                ]}
              >
                {isRTL
                  ? "اپنی ذاتی معلومات اور تصویر شامل کریں"
                  : "Add your personal details and photo"}
              </Text>
            </View>

            {/* Profile Photo */}
            <View style={{ alignItems: "center", marginBottom: 18 }}>
              <TouchableOpacity
                style={[
                  styles.profileUpload,
                  { borderColor: docs.profilePic ? theme.primary : "#E5E7EB" },
                ]}
                onPress={() => handleImagePickWrapper("profilePic", "Profile")}
              >
                {docs.profilePic ? (
                  <Image
                    source={{ uri: docs.profilePic }}
                    style={styles.profileImg}
                  />
                ) : (
                  <Ionicons name="person-outline" size={40} color={theme.primary} />
                )}
                <View
                  style={[
                    styles.profileBadge,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Camera size={11} color="#FFF" />
                </View>
              </TouchableOpacity>
              <Text
                style={[
                  styles.profileLabel,
                  {
                    color: theme.textSecondary,
                    fontFamily: getFontFamily("regular", isRTL),
                    fontSize: getFontSize(11, isRTL),
                  },
                ]}
              >
                {t("registration.profilePhotoLabel")}
              </Text>
            </View>

            {/* Name Row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Input
                label={t("registration.firstName")}
                placeholder={t("registration.placeholderFirstName")}
                value={formData.firstName}
                onChangeText={(v) => setField("firstName", v)}
                error={errors.firstName}
                style={{ flex: 1 }}
              />
              <Input
                label={t("registration.lastName")}
                placeholder={t("registration.placeholderLastName")}
                value={formData.lastName}
                onChangeText={(v) => setField("lastName", v)}
                error={errors.lastName}
                style={{ flex: 1 }}
              />
            </View>

            <SimpleDatePicker
              label={t("registration.dob")}
              placeholder={t("registration.placeholderDOB")}
              value={formData.dob}
              onChange={(v: string) => setField("dob", v)}
              error={errors.dob}
            />

            {/* Gender */}
            <View style={{ marginBottom: 14 }}>
              <Text style={dpStyles.label}>{t("registration.gender")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["male", "female", "other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setField("gender", g)}
                    style={[
                      styles.genderBtn,
                      {
                        borderColor:
                          formData.gender === g ? theme.primary : theme.border,
                        backgroundColor:
                          formData.gender === g
                            ? theme.primary + "10"
                            : theme.cardBackground,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          formData.gender === g
                            ? theme.primary
                            : theme.textSecondary,
                        fontSize: getFontSize(12, isRTL),
                        fontFamily: getFontFamily(
                          formData.gender === g ? "semibold" : "regular",
                          isRTL,
                        ),
                      }}
                    >
                      {t(`registration.${g}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Input
              label={t("registration.cnicNumber")}
              placeholder={t("registration.placeholderCNIC")}
              value={formData.cnic}
              onChangeText={(v) =>
                setField("cnic", v.replace(/\D/g, "").slice(0, 13))
              }
              error={errors.cnic}
              keyboardType="number-pad"
              maxLength={13}
            />
            <Input
              label={t("registration.address")}
              placeholder={t("registration.placeholderAddress")}
              value={formData.address}
              onChangeText={(v) => setField("address", v)}
              error={errors.address}
              multiline
            />

            {/* Identity Documents */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("medium", isRTL),
                  marginTop: 6,
                },
              ]}
            >
              {isRTL ? "شناختی کارڈ" : "Identity Documents"}
            </Text>
            <ImprovedUploadButton
              label={t("registration.cnicFront")}
              uri={docs.cnicFront}
              theme={theme}
              isRTL={isRTL}
              onPress={() =>
                handleImagePickWrapper("cnicFront", t("registration.cnicFront"))
              }
              onGuidePress={() =>
                showGuide(
                  t("registration.cnicFront"),
                  "cnic_front",
                  t(
                    "registration.cnicFrontGuide",
                    "Ensure the CNIC is well-lit and all four corners are visible. Avoid flash glare.",
                  ),
                )
              }
            />
            <ImprovedUploadButton
              label={t("registration.cnicBack")}
              uri={docs.cnicBack}
              theme={theme}
              isRTL={isRTL}
              onPress={() =>
                handleImagePickWrapper("cnicBack", t("registration.cnicBack"))
              }
              onGuidePress={() =>
                showGuide(
                  t("registration.cnicBack"),
                  "cnic_back",
                  t(
                    "registration.cnicBackGuide",
                    "The barcode and details on the back must be clearly readable.",
                  ),
                )
              }
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top"]}
    >
      {renderHeader()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}

          <View style={{ marginTop: 30 }}>
            <Button
              title={
                loading
                  ? t("common.submitting", "Submitting...")
                  : step === 3
                    ? t("registration.completeReq")
                    : t("registration.nextStep")
              }
              onPress={nextStep}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={guideVisible} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <GuideModalContent
            title={activeGuide?.title}
            type={activeGuide?.type}
            content={activeGuide?.content}
            theme={theme}
            isRTL={isRTL}
            onClose={() => setGuideVisible(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  stepContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  stepBarWrap: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    marginTop: responsiveHeight(2),
  },
  stepBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 9,
    letterSpacing: 0.2,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  stepHeaderBlock: {
    marginBottom: 18,
  },
  stepTitle: {
    fontSize: 18,
    marginBottom: 3,
  },
  stepSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0,
    backgroundColor: "#FFF",
  },
  profileUpload: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  profileImg: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  profileBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileLabel: {
    marginTop: 6,
    fontSize: 11,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
  },
});

export default RegistrationFlow;
