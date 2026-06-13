import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Linking,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

import { View as MotiView } from "moti";
import {
  Bell,
  Menu,
  Bike,
  Wifi,
  WifiOff,
  User,
  TrendingUp,
  Settings,
  Globe,
  LogOut,
  ChevronRight,
  Star,
  Clock,
  BarChart3,
} from "lucide-react-native";
import { useRide } from "../context/RideContext";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useUI } from "../context/UIContext";
import { getFontFamily, getFontSize, getTextStyle } from "../utils/layout";
import { ridesService } from "../services/rides";
import Logo from "../components/Logo/index";
import { formatPhoneNumber } from "../utils/helpers";
import { sanitizeHistoryItem } from "../utils/rideSafety";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.78;
const ACTION_CARD_WIDTH = (width - 52) / 3;

const QUICK_ACTION_ASSETS = {
  rides: require("../assets/superbike.png"),
  deliveries: require("../assets/delivery.png"),
  performance: require("../assets/speedometer.png"),
  wallet: require("../assets/wallet.png"),
  support: require("../assets/call-center.png"),
  safety: require("../assets/shield.png"),
} as const;

const isErrorStatusMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return /blocked|admin|review|approve|error|failed|unable|timed out|timeout|disabled|required|permission|location|gps|connection|balance|insufficient/.test(
    normalized,
  );
};

const getStatusModalTitle = (message: string) => {
  const normalized = message.toLowerCase();

  if (/balance|insufficient|recharge/.test(normalized)) {
    return "Insufficient Balance";
  }
  if (/blocked|admin|suspend|banned|disabled|deactivated/.test(normalized)) {
    return "Account Restricted";
  }
  if (/review|approve/.test(normalized)) {
    return "Verification Pending";
  }
  if (/location|gps|permission|required/.test(normalized)) {
    return "Action Required";
  }
  if (/connection|timed out|timeout|server/.test(normalized)) {
    return "Connection Issue";
  }

  return "Unable to Continue";
};

const getStatusModalDescription = (message: string) => {
  const normalized = message.toLowerCase();

  if (/balance|insufficient|recharge/.test(normalized)) {
    return "Insufficient balance to continue rides. Please top-up your wallet to start receiving new ride requests.";
  }
  if (/blocked|suspend|deactivated/.test(normalized)) {
    return "Your account has been restricted by the administration. Please contact support for more information.";
  }
  if (/review|approve/.test(normalized)) {
    return "Your documents are currently under review. This process typically takes 24-48 hours. We will notify you once you are approved.";
  }
  if (/location|gps|permission/.test(normalized)) {
    return 'TezRide requires location permissions to find nearby rides. Please enable "Always" location access in your system settings.';
  }

  return message;
};

import { SignalRService } from "../services/SignalRService";

const Dashboard = (props: any) => {
  const navigation = (props as any).navigation;
  const { t, i18n } = useTranslation();
  const {
    setActiveRide,
    isOnline,
    setIsOnline,
    isLoading,
    statusMessage,
    rideRequests,
    acceptIncomingRide,
    rejectIncomingRide,
    hasRestoredSession,
    setHasRestoredSession,
  } = useRide();

  useEffect(() => {
    const checkActiveRide = async () => {
      if (hasRestoredSession) return;

      try {
        const res = await ridesService.getCurrentRide();
        setHasRestoredSession(true);

        if (res.data && res.data.succeeded && res.data.data) {
          const ride = res.data.data;

          // Establish connection if not already
          if (!SignalRService.isConnected("DRIVER")) {
            await SignalRService.connect("DRIVER");
          }

          setActiveRide(ride);

          // Redirect to life navigation screen
          navigation.navigate("NavigationRide", {
            rideId: ride.rideId,
            initialRide: ride,
            customerName:
              ride.customerDetail?.firstName +
              " " +
              ride.customerDetail?.lastName,
            customerPhone: ride.customerDetail?.phoneNumber,
            pickupLat: ride.pickupLat,
            pickupLon: ride.pickupLon,
            dropoffLat: ride.dropoffLat,
            dropoffLon: ride.dropoffLon,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
            initialStatus: ride.status,
          });
        }
      } catch (error) {
        console.warn("[Dashboard] Current ride check failed:", error);
      }
    };
    checkActiveRide();
  }, [hasRestoredSession]);

  const { isRTL, setLanguage } = useLanguage();
  const { user, signOut, checkVerificationStatus } = useAuth();
  const { theme, isFemale } = useTheme();
  const { showError } = useUI();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalRides: 0,
    totalDistance: 0,
    currency: "PKR",
    averageRating: 0,
    rating: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [balance, setBalance] = useState({ balance: 0, currency: "PKR" });
  const [profileData, setProfileData] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleMessage, setVisibleMessage] = useState("");
  const [recentTrip, setRecentTrip] = useState<any>(null);
  const [locationPermissionModal, setLocationPermissionModal] = useState(false);
  const [locationPermissionChecked, setLocationPermissionChecked] =
    useState(false);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (user && !user.gender) {
      checkVerificationStatus();
    }
    fetchDashboardData();
    if (!locationPermissionChecked) {
      checkLocationPermissionRequested();
    }
  }, [user?.id]);

  const checkLocationPermissionRequested = async () => {
    try {
      const hasRequested = await AsyncStorage.getItem(
        "locationPermissionRequested",
      );
      setLocationPermissionChecked(true);
      if (!hasRequested) {
        setLocationPermissionModal(true);
      }
    } catch (error) {
      console.error("Error checking location permission status:", error);
      setLocationPermissionChecked(true);
    }
  };

  const requestLocationPermission = async () => {
    try {
      // Step 1: Request app-level location permission
      const { status, canAskAgain } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        if (!canAskAgain) {
          // Permanently denied ("Don't ask again" was checked) — must open Settings
          Linking.openSettings();
        }
        // First-time denial — just close the modal, let the user continue
        setLocationPermissionModal(false);
        return;
      }

      // Step 2: Check if the device GPS/Location Services is ON
      const isGpsEnabled = await Location.hasServicesEnabledAsync();

      if (!isGpsEnabled) {
        // Shows the native Android "Turn on Location?" system dialog
        await Location.enableNetworkProviderAsync();
      }

      // Both permission and GPS are handled — close the modal
      setLocationPermissionModal(false);
      await AsyncStorage.setItem("locationPermissionRequested", "true");
    } catch (err) {
      console.error("[Dashboard] Location permission error:", err);
      setLocationPermissionModal(false);
    }
  };

  const handleLocationPermissionLater = async () => {
    try {
      // In the partner app, we might want to track that we've shown the modal
      await AsyncStorage.setItem("locationPermissionRequested", "true");
      setLocationPermissionModal(false);
    } catch (error) {
      console.error("Error saving location permission status:", error);
      setLocationPermissionModal(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { userService } = require("../services/user");
      const [statsRes, balanceRes, profileRes, historyRes] = await Promise.all([
        ridesService.getRiderStats(),
        ridesService.getRiderBalance(),
        user?.id ? userService.getUserById(user.id) : Promise.resolve(null),
        ridesService.getRiderHistory({ pageIndex: 1, pageSize: 1 }),
      ]);

      if (statsRes?.data?.succeeded) {
        setStats(statsRes.data.data);
      }
      if (balanceRes?.data?.succeeded) {
        setBalance(balanceRes.data.data);
      }
      if (profileRes?.data?.data) {
        setProfileData(profileRes.data.data);
      }

      // Fetch recent trip
      if (historyRes?.data) {
        const historyResult = historyRes.data;
        const payload = historyResult?.data ?? historyResult ?? [];
        const list = Array.isArray(payload)
          ? payload
          : (payload?.items ?? payload?.rides ?? []);
        if (list.length > 0) {
          const sanitizedTrip = sanitizeHistoryItem(list[0]);
          if (sanitizedTrip) {
            setRecentTrip(sanitizedTrip);
          }
        }
      }
    } catch (err) {
      console.error("[Dashboard] Error fetching data:", err);
    } finally {
      setStatsLoaded(true);
    }
  };

  useEffect(() => {
    if (!statusMessage) {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -25,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setVisibleMessage(""));
      return;
    }

    if (
      isErrorStatusMessage(statusMessage) &&
      !/location|gps|permission/i.test(statusMessage)
    ) {
      const title = getStatusModalTitle(statusMessage);
      const description = getStatusModalDescription(statusMessage);
      const isBalance = /balance|insufficient/i.test(title + description);

      showError(
        title,
        description,
        isBalance ? (isRTL ? "بیلنس شامل کریں" : "TOP UP NOW") : "OK",
        isBalance ? () => navigation.navigate("Wallet") : undefined,
      );

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -25,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setVisibleMessage(""));
      return;
    }

    setVisibleMessage(statusMessage);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [statusMessage]);

  const handleToggleOnline = useCallback(async () => {
    if (isLoading) return;
    setIsOnline(!isOnline);
  }, [isLoading, isOnline, setIsOnline]);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0.55,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerOpen(false));
  };

  const handleLogout = async () => {
    closeDrawer();
    await signOut();
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData().finally(() => setRefreshing(false));
  }, []);

  const handleAcceptRide = async (ride: any) => {
    if (!ride?.rideId || acceptingId) return;
    setAcceptingId(ride.rideId);
    try {
      await acceptIncomingRide(ride);
    } catch (err) {
      console.error("[Dashboard] Error accepting ride:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectRide = async (ride: any) => {
    if (!ride?.rideId || rejectingId) return;
    setRejectingId(ride.rideId);
    try {
      await rejectIncomingRide(ride);
    } catch (err) {
      console.error("[Dashboard] Error rejecting ride:", err);
    } finally {
      setRejectingId(null);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerTop}>
        {/* Fixed Menu Icon on the Left */}
        <View style={[styles.headerSideSection, { left: 0 }]}>
          <TouchableOpacity
            onPress={openDrawer}
            style={[
              styles.iconBtn,
              {
                borderRadius: 12,
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Menu color={theme.secondary} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoWrapper}>
          <Logo style={styles.logoImage} />
        </View>

        <View style={[styles.headerSideSection, { right: 0 }]} />
      </View>

      <View style={[styles.headerStats, { flexDirection: "row" }]}>
        <TouchableOpacity
          style={[
            styles.statsCard,
            styles.walletCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
              flexDirection: "row",
            },
          ]}
          onPress={() => navigation.navigate("Wallet")}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.walletIconWrap,
              { backgroundColor: theme.primaryLight },
            ]}
          >
            <Image
              source={require("../assets/wallet.png")}
              style={[styles.walletIconImage, { tintColor: theme.primary }]}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.walletText, { marginLeft: 6 }]}>
            <Text
              style={[
                styles.walletLabel,
                {
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("semibold", isRTL),
                  fontSize: getFontSize(10, isRTL),
                  letterSpacing: isRTL ? 0 : 0.4,
                  lineHeight: isRTL ? 16 : 13,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              ellipsizeMode="tail"
            >
              {t("dashboard.walletBalance")}
            </Text>
            <Text
              style={[
                styles.walletAmount,
                { color: theme.text, fontFamily: getFontFamily("bold", isRTL) },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {balance.currency}{" "}
              {balance.balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
          <ChevronRight
            color={theme.primary}
            size={18}
            style={{ transform: [{ scaleX: 1 }] }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statsCard,
            styles.onlineCard,
            { backgroundColor: isOnline ? theme.success : theme.error },
          ]}
          onPress={handleToggleOnline}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={[styles.onlineInner, { flexDirection: "row" }]}>
              {isOnline ? (
                <Wifi color="#FFF" size={22} />
              ) : (
                <WifiOff color="#FFF" size={22} />
              )}
              <View style={[styles.onlineTextContainer, { marginLeft: 6 }]}>
                <Text
                  style={[
                    styles.onlineText,
                    getTextStyle(14, "bold", isRTL),
                    { color: "#FFF" },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isOnline
                    ? t("dashboard.onlineShort")
                    : t("dashboard.offline")}
                </Text>
                <Text
                  style={[
                    styles.onlineSubtext,
                    getTextStyle(10, "regular", isRTL),
                    { color: "rgba(255,255,255,0.92)" },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isOnline
                    ? t("dashboard.onlineDesc")
                    : t("dashboard.offlineSubtitle")}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeroCard = () => (
    <LinearGradient
      colors={theme.gradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroWaveDecor} pointerEvents="none">
        <View style={[styles.heroWaveCircle, styles.heroWaveCircleOne]} />
        <View style={[styles.heroWaveCircle, styles.heroWaveCircleTwo]} />
        <View style={[styles.heroWaveCircle, styles.heroWaveCircleThree]} />
      </View>

      <View style={[styles.heroHeader, { flexDirection: "row" }]}>
        <Text
          style={[
            styles.heroLabel,
            getTextStyle(14, "medium", isRTL),
            { color: "#FFF", opacity: 0.95 },
          ]}
        >
          {t("dashboard.totalearnings")}
        </Text>
        <TrendingUp color="#FFF" size={28} opacity={0.95} />
      </View>

      <Text
        style={[
          styles.heroValue,
          getTextStyle(32, "bold", isRTL),
          { color: "#FFF", marginBottom: 16, textAlign: "left" },
        ]}
      >
        {statsLoaded
          ? `${stats.currency} ${stats.totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—"}
      </Text>
      <View style={[styles.heroStats, { flexDirection: "row" }]}>
        <View style={styles.heroStatItem}>
          <Image
            source={QUICK_ACTION_ASSETS.wallet}
            style={styles.heroStatIcon}
            resizeMode="contain"
          />
          <Text style={styles.heroStatValue}>
            {statsLoaded && stats.totalRides ? stats.totalRides : "—"}
          </Text>
          <Text style={styles.heroStatLabel}>{t("dashboard.completed")}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStatItem}>
          <Text style={[styles.heroStatValue, { fontSize: 16 }]}>
            {statsLoaded && stats.totalDistance
              ? `${(stats.totalDistance as number).toFixed(1)}`
              : "—"}
          </Text>
          <Text style={styles.heroStatLabel}>{t("dashboard.totalDistance", "km driven")}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStatItem}>
          <Star color="#FFF" size={20} fill="#FFF" />
          <Text style={styles.heroStatValue}>
            {statsLoaded && stats.averageRating
              ? stats.averageRating.toFixed(1)
              : "—"}
          </Text>
          <Text style={styles.heroStatLabel}>{t("common.rating")}</Text>
        </View>
      </View>

    </LinearGradient>
  );

  const quickActions = [
    {
      id: "rides",
      title: t("dashboard.myRides"),
      icon: require("../assets/transport.png"),
      isImage: true,
      color: "#FFE5E5",
      screen: "RideRequestsList",
    },
    {
      id: "deliveries",
      title: t("dashboard.deliveries"),
      icon: require("../assets/delivery.png"),
      isImage: true,
      color: "#FDE8D7",
      screen: "DeliveryRequestsList",
    },
    {
      id: "analytics",
      title: t("dashboard.analytics", "Analytics"),
      icon: require("../assets/analysis.png"),
      isImage: true,
      color: "#DFF3E3",
      screen: "AnalyticsTab",
    },
    {
      id: "wallet",
      title: t("dashboard.myWallet"),
      icon: require("../assets/wallet.png"),
      isImage: true,
      color: "#E6E6FA",
      screen: "WalletTab",
    },
  ];

  const referGradient = isFemale
    ? (["#FFF0F6", "#FFE4F0"] as [string, string])
    : (["#FFF4E6", "#FFE5CC"] as [string, string]);

  const renderQuickActions = () => (
    <View style={styles.quickActionsSection}>
      <View style={[styles.sectionHeader, { flexDirection: "row" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* <BarChart3 color={theme.primary} size={20} /> */}
          <Text
            style={[
              styles.sectionTitle,
              getTextStyle(16, "bold", isRTL),
              { color: theme.text },
            ]}
          >
            {t("dashboard.quickActions")}
          </Text>
        </View>
      </View>
      <View style={styles.quickGrid}>
        {quickActions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.actionCard,
              {
                backgroundColor: item.color,
                width: "48.5%", // Use percentage to ensure 2 columns
                height: 120,
              },
            ]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.85}
          >
            <View style={styles.actionContent}>
              <Text
                style={[
                  styles.actionTitle,
                  getTextStyle(16, "bold", isRTL),
                  { color: "#333", textAlign: "left", width: "100%" },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Image
                source={item.icon}
                style={{
                  width: "100%",
                  height: responsiveHeight(8),
                }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderRideRequests = () => {
    if (!isOnline || rideRequests.length === 0) return null;

    return (
      <View style={styles.requestsSection}>
        <View style={[styles.sectionHeader, { flexDirection: "row" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Bike color={theme.primary} size={20} />
            <Text
              style={[
                styles.sectionTitle,
                getTextStyle(16, "bold", isRTL),
                { color: theme.text },
              ]}
            >
              {t("dashboard.incomingRequests", "Incoming Ride Requests")}
            </Text>
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>{rideRequests.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("RideRequestsList")}
          >
            <Text
              style={[
                styles.sectionLink,
                getTextStyle(13, "medium", isRTL),
                { color: theme.primary },
              ]}
            >
              {t("common.viewAll")}
            </Text>
          </TouchableOpacity>
        </View>

        {rideRequests.slice(0, 3).map((ride) => (
          <TouchableOpacity
            key={ride.rideId}
            style={[
              styles.requestCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={() => navigation.navigate("RideMapScreen", { ride })}
            activeOpacity={0.85}
          >
            <View style={[styles.requestHeader, { flexDirection: "row" }]}>
              <View style={styles.requestCustomerInfo}>
                <Text
                  style={[
                    styles.requestCustomerName,
                    getTextStyle(16, "bold", isRTL),
                    { color: theme.text },
                  ]}
                >
                  {ride.customerName || "Customer"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text
                    style={[
                      styles.requestRating,
                      getTextStyle(13, "medium", isRTL),
                      { color: theme.textSecondary, marginLeft: 4 },
                    ]}
                  >
                    {ride.customerRating?.toFixed(1) || "5.0"}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.requestFare,
                    getTextStyle(18, "bold", isRTL),
                    { color: theme.text },
                  ]}
                >
                  {ride.fare
                    ? `${stats.currency} ${ride.fare}`
                    : t("ride.calculatingFare", "Calculating...")}
                </Text>
                <View
                  style={[
                    styles.paymentBadgeSmall,
                    { backgroundColor: theme.primary + "15" },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentBadgeTextSmall,
                      { color: theme.primary },
                    ]}
                  >
                    {String(ride.paymentMethod || "Cash").toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.requestDivider} />

            <View style={styles.requestLocations}>
              <View
                style={[styles.requestLocationRow, { flexDirection: "row" }]}
              >
                <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                <Text
                  style={[
                    styles.requestLocationText,
                    getTextStyle(13, "regular", isRTL),
                    { color: theme.textSecondary, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  {ride.pickupAddress || "Pickup Location"}
                </Text>
              </View>
              <View
                style={[
                  styles.requestLocationRow,
                  { flexDirection: "row", marginTop: 4 },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                <Text
                  style={[
                    styles.requestLocationText,
                    getTextStyle(13, "regular", isRTL),
                    { color: theme.textSecondary, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  {ride.dropoffAddress || "Dropoff Location"}
                </Text>
              </View>
            </View>

            <View style={[styles.requestMeta, { flexDirection: "row" }]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Clock size={14} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.requestMetaText,
                    getTextStyle(13, "medium", isRTL),
                    { color: theme.textSecondary, marginLeft: 6 },
                  ]}
                >
                  {ride.distance ? `${ride.distance.toFixed(1)} km` : "—"} •{" "}
                  {ride.duration || "—"} min
                </Text>
              </View>
            </View>

            <View style={[styles.requestActions, { flexDirection: "row" }]}>
              <TouchableOpacity
                style={[
                  styles.requestButton,
                  styles.rejectButton,
                  { borderColor: theme.error },
                ]}
                onPress={() => handleRejectRide(ride)}
                disabled={!!acceptingId || !!rejectingId}
              >
                {rejectingId === ride.rideId ? (
                  <ActivityIndicator size="small" color={theme.error} />
                ) : (
                  <Text
                    style={[
                      styles.requestButtonText,
                      getTextStyle(15, "bold", isRTL),
                      { color: theme.error },
                    ]}
                  >
                    {t("ride.reject", "Reject")}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.requestButton,
                  styles.acceptButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => handleAcceptRide(ride)}
                disabled={!!acceptingId || !!rejectingId}
              >
                {acceptingId === ride.rideId ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text
                    style={[
                      styles.requestButtonText,
                      getTextStyle(15, "bold", isRTL),
                      { color: "#FFF" },
                    ]}
                  >
                    {t("ride.accept", "Accept")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderReferSection = () => (
    <LinearGradient
      colors={referGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.referCard}
    >
      <View style={[styles.referRow, { flexDirection: "row" }]}>
        <Text style={styles.referIcon}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.referTitle,
              getTextStyle(18, "bold", isRTL),
              { color: theme.primary, textAlign: "left" },
            ]}
          >
            {t("dashboard.referAndEarn")}
          </Text>
          <Text
            style={[
              styles.referSubtitle,
              getTextStyle(13, "regular", isRTL),
              { color: theme.textSecondary, textAlign: "left" },
            ]}
          >
            {t("dashboard.referDescription")}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.referButton, { backgroundColor: theme.primary }]}
          onPress={() => {}}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.referButtonText,
              getTextStyle(14, "bold", isRTL),
              { color: "#FFF" },
            ]}
          >
            {t("dashboard.referNow")}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderRecentTrips = () => (
    <View style={styles.recentTripsSection}>
      <View style={[styles.sectionHeader, { flexDirection: "row" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Clock color={theme.text} size={20} />
          <Text
            style={[
              styles.sectionTitle,
              getTextStyle(16, "bold", isRTL),
              { color: theme.text },
            ]}
          >
            {t("dashboard.recentTrips")}
          </Text>
        </View>
      </View>
      {recentTrip ? (
        <TouchableOpacity
          style={[
            styles.tripCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onPress={() => navigation.navigate("TripHistory")}
          activeOpacity={0.85}
        >
          <View style={[styles.tripRow, { flexDirection: "row" }]}>
            <View style={styles.tripMapBadge}>
              <Image
                source={require("../assets/distance-3.png")}
                style={styles.tripMapImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.tripInfo}>
              <Text
                style={[
                  styles.tripTitle,
                  getTextStyle(16, "bold", isRTL),
                  { color: theme.text, textAlign: "left" },
                ]}
              >
                {recentTrip?.dropoffAddress ||
                  recentTrip?.dropoff?.address ||
                  "Recent Trip"}
              </Text>
              <Text
                style={[
                  styles.tripSubtitle,
                  getTextStyle(14, "regular", isRTL),
                  { color: theme.textSecondary, textAlign: "left" },
                ]}
              >
                {recentTrip?.pickupAddress ||
                  recentTrip?.pickup?.address ||
                  "Pickup Location"}
              </Text>
              <Text
                style={[
                  styles.tripMeta,
                  getTextStyle(12, "regular", isRTL),
                  { color: theme.textSecondary, textAlign: "left" },
                ]}
              >
                {recentTrip?.distance
                  ? `${recentTrip.distance.toFixed(1)} km`
                  : "—"}{" "}
                • {recentTrip?.paymentMethod || "Cash"}
              </Text>
            </View>
            <View style={[styles.tripRight, { alignItems: "flex-end" }]}>
              <View style={[styles.tripTimeRow, { flexDirection: "row" }]}>
                <Text
                  style={[
                    styles.tripTime,
                    getTextStyle(12, "regular", isRTL),
                    { color: theme.textSecondary },
                  ]}
                >
                  {recentTrip?.createdAt
                    ? new Date(recentTrip.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </Text>
                <ChevronRight
                  color={theme.textSecondary}
                  size={16}
                  style={{ transform: [{ scaleX: 1 }] }}
                />
              </View>
              <View style={styles.tripAmountBadge}>
                <Text
                  style={[styles.tripAmount, getTextStyle(14, "bold", isRTL)]}
                >
                  {recentTrip?.fare || recentTrip?.finalCost
                    ? `${stats.currency} ${(recentTrip.fare || recentTrip.finalCost || 0).toFixed(2)}`
                    : "—"}
                </Text>
              </View>
              <View style={styles.tripStatusBadge}>
                <Text
                  style={[styles.tripStatus, getTextStyle(10, "medium", isRTL)]}
                >
                  {recentTrip?.status === "completed"
                    ? t("dashboard.completed")
                    : recentTrip?.status || "—"}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.tripCard,
            styles.emptyTripCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onPress={() => navigation.navigate("TripHistory")}
          activeOpacity={0.85}
        >
          <View style={[styles.tripRow, { flexDirection: "row" }]}>
            <View style={styles.tripMapBadge}>
              <Image
                source={require("../assets/distance-3.png")}
                style={styles.tripMapImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.tripInfo}>
              <Text
                style={[
                  styles.tripTitle,
                  getTextStyle(16, "medium", isRTL),
                  {
                    color: isFemale ? "#bd005e" : "#FF991C",
                    textAlign: "left",
                  },
                ]}
              >
                {t("dashboard.startFirstTrip", "Start Your First Trip")}
              </Text>
              <Text
                style={[
                  styles.tripMeta,
                  getTextStyle(14, "regular", isRTL),
                  { color: theme.textSecondary, textAlign: "left" },
                ]}
              >
                {t(
                  "dashboard.goOnlineToStart",
                  "Go online to start receiving ride requests",
                )}
              </Text>
            </View>
            <View style={[styles.tripRight, { alignItems: "flex-end" }]}>
              <ChevronRight
                color={theme.textSecondary}
                size={16}
                style={{ transform: [{ scaleX: 1 }] }}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDrawer = () => (
    <Modal
      transparent
      visible={drawerOpen}
      animationType="none"
      onRequestClose={closeDrawer}
    >
      <View style={[styles.drawerOverlay, { flexDirection: "row" }]}>
        <TouchableOpacity
          style={styles.drawerOverlayTouchable}
          activeOpacity={1}
          onPress={closeDrawer}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "#000", opacity: overlayAnim },
            ]}
          />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.drawerContent,
            { transform: [{ translateX: drawerAnim }], width: DRAWER_WIDTH },
          ]}
        >
          <LinearGradient
            colors={theme.gradient as [string, string, ...string[]]}
            style={styles.drawerHeader}
          >
            <View
              style={[
                styles.drawerProfile,
                { flexDirection: "row", alignItems: "center" },
              ]}
            >
              <View style={styles.drawerAvatar}>
                {profileData?.profilePictureUrl ? (
                  <Image
                    source={{ uri: profileData.profilePictureUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarImage,
                      { justifyContent: "center", alignItems: "center" },
                    ]}
                  >
                    <User color={theme.primary} size={30} />
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.drawerProfileText,
                  { alignItems: "flex-start", marginLeft: 14 },
                ]}
              >
                <Text
                  style={[
                    styles.drawerName,
                    getTextStyle(18, "bold", isRTL),
                    { textAlign: "left" },
                  ]}
                >
                  {profileData?.firstName
                    ? `${profileData.firstName}${profileData.lastName ? " " + profileData.lastName : ""}`
                    : user?.name || "Partner"}
                </Text>
                <Text
                  style={[
                    styles.drawerPhone,
                    getTextStyle(14, "regular", isRTL),
                    { textAlign: "left", writingDirection: "ltr" },
                  ]}
                >
                  {formatPhoneNumber(
                    profileData?.phoneNumber || user?.phoneNumber,
                  )}
                </Text>
              </View>
            </View>
          </LinearGradient>
          <ScrollView
            style={styles.drawerMenu}
            showsVerticalScrollIndicator={false}
          >
            <DrawerItem
              icon={require("../assets/people.png")}
              label={t("profile.title")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("EditProfile");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={require("../assets/superbike.png")}
              label={t("profile.vehicleDetails")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("VehicleDetails");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={require("../assets/wallet.png")}
              label={t("dashboard.myWallet")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("WalletTab");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={BarChart3}
              label={t("dashboard.analytics", "Analytics")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("AnalyticsTab");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={Clock}
              label={t("dashboard.recentTrips")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("TripHistory");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={Settings}
              label={t("settings.title")}
              onPress={() => {
                closeDrawer();
                navigation.navigate("Settings");
              }}
              isRTL={isRTL}
              theme={theme}
            />
            <DrawerItem
              icon={Globe}
              label={i18n.language === "en" ? "اردو (Urdu)" : "English"}
              onPress={() => {
                const newLang = i18n.language === "en" ? "ur" : "en";
                setLanguage(newLang);
                closeDrawer();
              }}
              isRTL={isRTL}
              theme={theme}
            />
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { flexDirection: "row", alignItems: "center" },
            ]}
            onPress={handleLogout}
          >
            <LogOut color={theme.error} size={20} />
            <Text
              style={[
                styles.logoutLabel,
                getTextStyle(16, "medium", isRTL),
                { color: theme.error, marginLeft: 12, textAlign: "left" },
              ]}
            >
              {t("profile.logout")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );

  const renderLocationPermissionModal = () => (
    <Modal
      transparent
      visible={locationPermissionModal}
      animationType="fade"
      onRequestClose={() => setLocationPermissionModal(false)}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setLocationPermissionModal(false)}
        style={styles.locationModalOverlay}
      >
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.locationModalCard,
              { backgroundColor: theme.cardBackground || "#FFF" },
            ]}
          >
            {/* ICON AREA */}
            <View style={styles.locationIconArea}>
              {/* BIG CIRCLE */}
              <View
                style={[
                  styles.locationBigCircle,
                  { backgroundColor: theme.primary + "15" },
                ]}
              >
                <Ionicons name="location" size={45} color={theme.primary} />
              </View>

              {/* ===== PERFECT CIRCULAR DOTS ===== */}
              {[...Array(10)].map((_, i) => {
                const radius = 80;
                const angle = (i * 360) / 10;
                const rad = (angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);
                const sizes = [14, 7, 10, 0, 7, 10, 6, 8, 0, 8];
                if (sizes[i] === 0) return null;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: 60 + y,
                      left: 60 + x,
                      width: sizes[i],
                      height: sizes[i],
                      borderRadius: sizes[i] / 2,
                      backgroundColor: theme.primary,
                      opacity: 0.6 + (i % 3) * 0.15,
                    }}
                  />
                );
              })}
            </View>

            <Text
              style={[
                styles.locationModalTitle,
                { color: theme.text, fontFamily: getFontFamily("bold", isRTL) },
              ]}
            >
              {t("enable_location_title", "Enable Location Access")}
            </Text>
            <Text
              style={[
                styles.locationModalDescription,
                {
                  color: theme.textSecondary,
                  fontFamily: getFontFamily("regular", isRTL),
                },
              ]}
            >
              {t(
                "enable_location_desc",
                "TezRide needs access to your location to help you find nearby rides and provide accurate pickup/dropoff locations.",
              )}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={requestLocationPermission}
              style={{ width: "100%", marginBottom: 12 }}
            >
              <LinearGradient
                colors={theme.gradient as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.locationModalButtonPrimary}
              >
                <Text
                  style={[
                    styles.locationModalButtonTextPrimary,
                    { fontFamily: getFontFamily("semibold", isRTL) },
                  ]}
                >
                  {t("enable_location_btn", "Allow Location")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLocationPermissionModal(false)}
              style={[
                styles.locationModalButtonSecondary,
                { backgroundColor: theme.border + "30" },
              ]}
            >
              <Text
                style={[
                  styles.locationModalButtonTextSecondary,
                  {
                    color: theme.text,
                    fontFamily: getFontFamily("semibold", isRTL),
                  },
                ]}
              >
                {t("dont_allow", "Later")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderHeader()}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.mainContent}>
          {renderHeroCard()}
          {renderRideRequests()}
          {renderQuickActions()}
        </View>
      </ScrollView>
      {renderDrawer()}
      {renderLocationPermissionModal()}
      {visibleMessage ? (
        <Animated.View
          style={[
            styles.toast,
            {
              top: insets.top + 90,
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Text style={styles.toastText}>{visibleMessage}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const DrawerItem = ({ icon: Icon, label, onPress, isRTL, theme }: any) => (
  <TouchableOpacity
    style={[styles.drawerItem, { flexDirection: "row", alignItems: "center" }]}
    onPress={onPress}
  >
    {typeof Icon === "number" ? (
      <Image
        source={Icon}
        style={{ width: 22, height: 22, tintColor: theme.textSecondary }}
        resizeMode="contain"
      />
    ) : (
      <Icon color={theme.textSecondary} size={22} />
    )}
    <Text
      style={[
        styles.drawerItemLabel,
        getTextStyle(16, "medium", isRTL),
        {
          color: theme.text,
          textAlign: "left",
          marginLeft: 15,
        },
      ]}
    >
      {label}
    </Text>
    <ChevronRight color={theme.border} size={18} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#FFF",
  },
  headerTop: {
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
  },
  headerSideSection: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  logoWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: responsiveWidth(100),
    height: responsiveHeight(9),
    resizeMode: "contain",
  },
  iconBtn: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerStats: {
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
    minHeight: 64,
  },
  statsCard: {
    flex: 1,
    minHeight: 68,
    maxHeight: 92,
  },
  walletCard: {
    alignItems: "center",
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(2),
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  walletIconWrap: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  walletIconImage: {
    width: responsiveWidth(5.5),
    height: responsiveWidth(5.5),
  },
  walletText: {
    flex: 1,
    marginLeft: responsiveWidth(1.5),
    justifyContent: "center",
    minWidth: 0,
    overflow: "hidden",
  },
  walletLabel: {
    fontSize: responsiveFontSize(1.6),
    textTransform: "uppercase",
    letterSpacing: 0.5,
    overflow: "hidden",
  },
  walletAmount: {
    fontSize: responsiveFontSize(2),
    marginTop: 1,
  },
  onlineCard: {
    borderRadius: 18,
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(3),
    justifyContent: "center",
    alignItems: "center",
  },
  onlineInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
    width: "100%",
  },
  onlineTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  onlineText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2.5),
  },
  onlineSubtext: {
    color: "rgba(255,255,255,0.92)",
    fontSize: responsiveFontSize(1.8),
    marginTop: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  heroCard: {
    padding: responsiveHeight(2.5),
    borderRadius: 28,
    marginBottom: responsiveHeight(3),
    overflow: "hidden",
    minHeight: responsiveHeight(28),
    maxHeight: responsiveHeight(34),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  heroWaveDecor: {
    ...(StyleSheet.absoluteFill as object),
    overflow: "hidden",
  },
  heroWaveCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroWaveCircleOne: {
    width: 180,
    height: 180,
    bottom: -90,
    left: -40,
  },
  heroWaveCircleTwo: {
    width: 140,
    height: 140,
    bottom: -70,
    right: 20,
  },
  heroWaveCircleThree: {
    width: 100,
    height: 100,
    bottom: -30,
    left: "40%",
  },
  heroHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroLabel: {
    color: "#FFF",
    fontSize: 14,
    opacity: 0.95,
  },
  heroValue: {
    color: "#FFF",
    fontSize: responsiveFontSize(4.5),
    marginBottom: responsiveHeight(1.5),
  },
  heroStats: {
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: responsiveHeight(1.5),
  },
  heroStatIcon: {
    width: responsiveWidth(5.5),
    height: responsiveWidth(5.5),
    tintColor: "#FFF",
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatValue: {
    color: "#FFF",
    fontSize: responsiveFontSize(2.5),
    fontWeight: "700",
    marginTop: responsiveHeight(0.8),
  },
  heroStatLabel: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.7),
    opacity: 0.9,
    marginTop: responsiveHeight(0.3),
  },
  heroDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 12,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
  },
  sectionLink: {
    fontSize: 13,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  actionContent: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  actionIconImage: {
    width: 24,
    height: 24,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionDescription: {
    fontSize: 9,
    marginTop: 2,
  },
  referCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  referRow: {
    alignItems: "center",
    gap: 12,
  },
  referIcon: {
    fontSize: 34,
  },
  referTitle: {
    fontSize: 14,
  },
  referSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },
  referButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  referButtonText: {
    color: "#FFF",
    fontSize: 14,
  },
  recentTripsSection: {
    marginBottom: 20,
  },
  tripCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  emptyTripCard: {
    opacity: 0.7,
  },
  tripRow: {
    alignItems: "center",
  },
  tripMapBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
    marginRight: 14,
  },
  tripMapImage: {
    width: "100%",
    height: "100%",
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  tripSubtitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  tripMeta: {
    fontSize: 11,
  },
  tripRight: {
    minWidth: 88,
  },
  tripTimeRow: {
    alignItems: "center",
    gap: 2,
  },
  tripTime: {
    fontSize: 11,
  },
  tripAmountBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tripAmount: {
    color: "#059669",
    fontSize: 12,
  },
  tripStatusBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tripStatus: {
    color: "#10B981",
    fontSize: 10,
  },
  drawerOverlay: {
    flex: 1,
    zIndex: 1000,
  },
  drawerOverlayTouchable: {
    ...(StyleSheet.absoluteFill as object),
  },
  drawerContent: {
    backgroundColor: "#FFF",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 1001,
  },
  drawerHeader: {
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 22,
  },
  drawerProfile: {
    alignItems: "center",
  },
  drawerAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 31,
    backgroundColor: "#F5F5F5",
  },
  drawerProfileText: {
    flex: 1,
    marginLeft: 14,
  },
  drawerName: {
    color: "#FFF",
    fontSize: 18,
  },
  drawerPhone: {
    color: "#FFF",
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  drawerMenu: {
    flex: 1,
  },
  drawerItem: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  drawerItemLabel: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
    marginBottom: 10,
  },
  logoutLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  toastText: {
    color: "#FFF",
    fontSize: 14,
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  statusModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  statusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  statusTitle: {
    fontSize: 22,
    marginBottom: 10,
    textAlign: "center",
  },
  statusMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  statusButton: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
  },
  statusButtonText: {
    color: "#FFF",
    fontSize: 15,
  },
  locationModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationModalCard: {
    width: "85%",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  locationIconArea: {
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    width: 120,
    height: 120,
  },
  locationBigCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  locationModalTitle: {
    fontSize: responsiveFontSize(2.2),
    marginBottom: 8,
    marginTop: 20,
    textAlign: "center",
  },
  locationModalDescription: {
    fontSize: responsiveFontSize(1.6),
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  locationModalButtonPrimary: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  locationModalButtonTextPrimary: {
    color: "#FFF",
    fontSize: responsiveFontSize(1.8),
  },
  locationModalButtonSecondary: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },
  locationModalButtonTextSecondary: {
    fontSize: responsiveFontSize(1.8),
  },
  mainContent: {
    flex: 1,
  },
  requestsSection: {
    marginBottom: 24,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
  },
  requestCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  requestHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestCustomerInfo: {
    flex: 1,
  },
  requestCustomerName: {
    fontSize: 16,
    marginBottom: 2,
  },
  requestRating: {
    fontSize: 13,
    marginLeft: 4,
  },
  requestFare: {
    fontSize: 18,
  },
  requestDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  requestLocations: {
    marginBottom: 12,
  },
  requestLocationRow: {
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  requestLocationText: {
    fontSize: 13,
    flex: 1,
  },
  requestMeta: {
    marginBottom: 16,
  },
  requestMetaText: {
    fontSize: 13,
    marginLeft: 6,
  },
  requestActions: {
    gap: 12,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  rejectButton: {
    backgroundColor: "transparent",
  },
  acceptButton: {
    borderWidth: 0,
  },
  requestButtonText: {
    fontSize: 15,
  },
  paymentBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentBadgeTextSmall: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
  },
});

export default Dashboard;
