import React from "react";
import { Tabs } from "expo-router";
import { Platform, View, Text, StyleSheet, Pressable } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  LayoutGrid, 
  Sparkles, 
  Activity, 
  Utensils 
} from "lucide-react-native";
import { SlideMenuProvider, useSlideMenu } from "@/context/SlideMenuContext";
import { SlideMenuDrawer } from "@/components/SlideMenuDrawer";
import { GlobalStepTracker } from "@/components/GlobalStepTracker";
import THEME from "@/constants/theme";

/**
 * EXACT 4 PRIMARY TABS ONLY
 * ─────────────────────────────────────────────────────────────
 * Strictly limits bottom navigation to the 4 core buttons:
 *  1. Home (Grid)
 *  2. Coach (Sparkles)
 *  3. Nutrition (Utensils)
 *  4. Activity (Activity Pulse)
 *
 * All other auxiliary screens (reminders, profile, analytics,
 * safety, achievements) are accessed exclusively via the slide
 * drawer and in-app triggers, never appearing in the bottom bar.
 */
const PRIMARY_TABS: Record<
  string,
  { label: string; icon: (color: string, focused: boolean) => React.ReactNode }
> = {
  index: {
    label: "Home",
    icon: (color, focused) => (
      <LayoutGrid size={19} color={color} strokeWidth={focused ? 2.5 : 2.0} />
    ),
  },
  coach: {
    label: "Coach",
    icon: (color, focused) => (
      <Sparkles size={19} color={color} strokeWidth={focused ? 2.5 : 2.0} />
    ),
  },
  nutrition: {
    label: "Nutrition",
    icon: (color, focused) => (
      <Utensils size={19} color={color} strokeWidth={focused ? 2.5 : 2.0} />
    ),
  },
  activity: {
    label: "Activity",
    icon: (color, focused) => (
      <Activity size={19} color={color} strokeWidth={focused ? 2.5 : 2.0} />
    ),
  },
};

/**
 * Luxury 4-Button Floating Capsule Navigation Bar
 * ─────────────────────────────────────────────────────────────
 * Matches the reference design aesthetic (Image 1):
 *  - Exactly 4 balanced buttons (Home, Coach, Nutrition, Activity)
 *  - Active tab: Smooth rounded white capsule pill with dark icon & bold label
 *  - Inactive tabs: Clean circular touch targets with subtle glass rings & bright crisp icons
 *  - Elevated dark capsule bar with smooth rounded ends (radius 36)
 *  - Zero sharp squares, zero clipped labels, zero leaked auxiliary tabs
 */
const FloatingCapsuleTabBar = React.memo(function FloatingCapsuleTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // STRICT FILTER: Only include the 4 allowed primary tabs
  const validRoutes = state.routes.filter((route) => route.name in PRIMARY_TABS);
  const bottomInset = Platform.OS === "ios" 
    ? Math.max(insets.bottom, 20) 
    : Math.max(insets.bottom + 12, 18);

  return (
    <View style={[styles.floatingBarWrapper, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.floatingBar} renderToHardwareTextureAndroid={true}>
        {validRoutes.map((route) => {
          const tabConfig = PRIMARY_TABS[route.name];
          const isFocused = state.routes[state.index]?.name === route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={({ pressed }) => [
                styles.tabPressable,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              {isFocused ? (
                /* Active: Smooth rounded white capsule pill with dark icon & bold text */
                <View style={styles.activeCapsulePill}>
                  {tabConfig.icon("#0b1612", true)}
                  <Text style={styles.activeCapsuleText}>{tabConfig.label}</Text>
                </View>
              ) : (
                /* Inactive: Clean round touch target with glass ring & bright crisp icon */
                <View style={styles.inactiveIconCircle}>
                  {tabConfig.icon("#e2ece7", false)}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

function TabsContent() {
  const { isLeftOpen, closeLeftMenu, isRightOpen, closeRightMenu } = useSlideMenu();

  return (
    <>
      {/* 24/7 Continuous Internal Device Step & Motion Tracker */}
      <GlobalStepTracker />

      <Tabs
        tabBar={(props) => <FloatingCapsuleTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: "Coach",
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            title: "Nutrition",
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Activity",
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="safety"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="achievements"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Primary Left Slide Drawer */}
      <SlideMenuDrawer side="left" isOpen={isLeftOpen} onClose={closeLeftMenu} />

      {/* Top-Right Slide Drawer */}
      <SlideMenuDrawer side="right" isOpen={isRightOpen} onClose={closeRightMenu} />
    </>
  );
}

export default function TabsLayout() {
  return (
    <SlideMenuProvider>
      <TabsContent />
    </SlideMenuProvider>
  );
}

const styles = StyleSheet.create({
  floatingBarWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  floatingBar: {
    width: "100%",
    maxWidth: 400,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(14, 25, 20, 0.96)",
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  tabPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeCapsulePill: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 4,
  },
  activeCapsuleText: {
    color: "#0b1612",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  inactiveIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
});
