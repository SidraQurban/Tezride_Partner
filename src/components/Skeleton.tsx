import React from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface SkeletonProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: any;
}

const Skeleton = ({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-1, 1],
  });

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              {
                translateX: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-300, 300],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E1E9EE",
    overflow: "hidden",
  },
});

export const RideRequestSkeleton = () => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.header}>
      <Skeleton width={48} height={48} borderRadius={14} />
      <View style={skeletonStyles.headerText}>
        <Skeleton width={100} height={16} />
        <Skeleton width={150} height={20} style={{ marginTop: 8 }} />
      </View>
      <Skeleton width={50} height={24} borderRadius={8} />
    </View>
    <View style={skeletonStyles.divider} />
    <View style={skeletonStyles.locationRow}>
      <Skeleton width={20} height={20} borderRadius={10} />
      <Skeleton width="80%" height={16} style={{ marginLeft: 8 }} />
    </View>
    <View style={[skeletonStyles.locationRow, { marginTop: 12 }]}>
      <Skeleton width={20} height={20} borderRadius={10} />
      <Skeleton width="70%" height={16} style={{ marginLeft: 8 }} />
    </View>
    <View style={skeletonStyles.actions}>
      <Skeleton width="48%" height={44} borderRadius={12} />
      <Skeleton width="48%" height={44} borderRadius={12} />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
});

export default Skeleton;
