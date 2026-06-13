import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { COLORS, FONTS, SIZES } from "../utils/constants";
import Button from "../components/Button";
import LottieView from "lottie-react-native";
import { useLanguage } from "../context/LanguageContext";
import { getTextAlign, getFontFamily, getFontSize } from "../utils/layout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "../components/Logo/index";
import { responsiveHeight } from "react-native-responsive-dimensions";

const { width, height } = Dimensions.get("window");

// Define Slide outside OnboardingScreen to prevent unnecessary remounts of FlatList items
const Slide = ({ item, index, isRTL, language }: any) => {
  // BUG FIX: react-native-web applies transform: scaleX(-1) to FlatList inverted items.
  // Lottie web crashes or clones the first animation across all instances if initialized
  // at the exact moment the parent CSS transforms are applied.
  // Delaying mount by a single frame ensures the DOM is ready.
  const [mountLottie, setMountLottie] = useState(false);

  useEffect(() => {
    // Unmount and remount specifically when language changes or component loads
    setMountLottie(false);
    const timer = setTimeout(() => {
      setMountLottie(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [language]);

  return (
    <View
      style={{
        width,
        alignItems: "center",
        paddingHorizontal: 40,
        paddingTop: 20,
      }}
    >
      <View style={styles.imageContainer}>
        {mountLottie ? (
          <LottieView
            // Strictly unique key forces true unmount
            key={`lottie-${item.id}-${language}-${index}`}
            source={item.animation}
            autoPlay
            loop
            resizeMode="contain"
            style={{ width: width * 0.7, height: width * 0.7 }}
          />
        ) : (
          <View style={{ width: width * 0.7, height: width * 0.7 }} />
        )}
      </View>
      <Text
        style={[
          styles.title,
          {
            textAlign: "center",
            fontFamily: getFontFamily("bold", isRTL),
            fontSize: getFontSize(24, isRTL),
          },
        ]}
      >
        {item.title}
      </Text>
      <Text
        style={[
          styles.description,
          {
            textAlign: "center",
            fontFamily: getFontFamily("regular", isRTL),
            fontSize: getFontSize(16, isRTL),
          },
        ]}
      >
        {item.description}
      </Text>
    </View>
  );
};

const OnboardingScreen = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const { setLanguage, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const ref = useRef<any>(null);
  const hasMounted = useRef(false);

  const renderItem = React.useCallback(
    ({ item, index }: any) => (
      <Slide item={item} index={index} isRTL={isRTL} language={i18n.language} />
    ),
    [isRTL, i18n.language],
  );

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    // Check if onboarding was already completed
    const checkStatus = async () => {
      const status = await AsyncStorage.getItem("onboardingCompleted");
      if (status === "true") {
        navigation.replace("Login");
      }
    };
    checkStatus();
  }, []);

  // Memoize slides to prevent unnecessary re-renders of list items
  const slides = useMemo(
    () => [
      {
        id: "1",
        title: t("onboarding.title1"),
        description: t("onboarding.desc1"),
        animation: require("../assets/lotties/e-bike kickstand.lottie"),
      },
      {
        id: "2",
        title: t("onboarding.title2"),
        description: t("onboarding.desc2"),
        animation: require("../assets/lotties/Money.lottie"),
      },
      {
        id: "3",
        title: t("onboarding.title3"),
        description: t("onboarding.desc3"),
        animation: require("../assets/lotties/Secured.lottie"),
      },
    ],
    [t],
  );

  const toggleLanguage = async () => {
    const newLang = i18n.language === "en" ? "ur" : "en";
    await setLanguage(newLang);
    // Reset to first slide when language changes to avoid offset issues
    setCurrentSlideIndex(0);
    ref?.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const updateCurrentSlideIndex = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentSlideIndex(currentIndex);
  };

  const goToNextSlide = () => {
    const nextSlideIndex = currentSlideIndex + 1;
    if (nextSlideIndex < slides.length) {
      const offset = nextSlideIndex * width;
      ref?.current?.scrollToOffset({ offset });
      setCurrentSlideIndex(nextSlideIndex);
    }
  };

  const skip = async () => {
    try {
      await AsyncStorage.setItem("onboardingCompleted", "true");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (e) {
      navigation.replace("Login");
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.headerWrapper}>
        <View style={[styles.header, { flexDirection: "row" }]}>
          <TouchableOpacity style={styles.langToggle} onPress={toggleLanguage}>
            <Text
              style={[
                styles.langToggleText,
                {
                  fontFamily: getFontFamily("bold", isRTL),
                  fontSize: getFontSize(14, isRTL),
                },
              ]}
            >
              {i18n.language === "en"
                ? t("settings.urdu")
                : t("settings.english")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} style={styles.skipBtn}>
            <Text
              style={[
                styles.skipText,
                {
                  fontFamily: getFontFamily("semibold", isRTL),
                  fontSize: getFontSize(14, isRTL),
                },
              ]}
            >
              {t("onboarding.skip")}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Centered Logo overlay */}
        <View style={styles.logoOverlay} pointerEvents="none">
          <Logo  style={{height:responsiveHeight(9)}}/>
        </View>
      </View>

      <FlatList
        key="onboarding-list"
        ref={ref}
        onMomentumScrollEnd={updateCurrentSlideIndex}
        pagingEnabled
        data={slides}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        scrollEventThrottle={16}
      />

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => {
            return (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentSlideIndex === index && styles.indicatorActive,
                ]}
              />
            );
          })}
        </View>

        <View style={{ marginTop: 20 }}>
          {currentSlideIndex === slides.length - 1 ? (
            <Button title={t("onboarding.getStarted")} onPress={skip} />
          ) : (
            <Button title={t("onboarding.next")} onPress={goToNextSlide} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerWrapper: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  logoOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  langToggle: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  langToggleText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: "bold",
  },
  imageContainer: {
    height: height * 0.35,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    color: COLORS.text,
    marginTop: 20,
  },
  description: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 15,
    paddingHorizontal: 10,
    lineHeight: 24,
  },
  footer: {
    height: height * 0.25,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  indicator: {
    height: 8,
    width: 8,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 4,
    borderRadius: 4,
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  skipText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
});

export default OnboardingScreen;
