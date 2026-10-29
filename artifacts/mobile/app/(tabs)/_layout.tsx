import React from "react";
import { Tabs } from "expo-router";
import { Platform, View, Text, StyleSheet, Pressable } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
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
 * Custom Floating Capsule Navigation Bar
 * ─────────────────────────────────────────────────────────────
 * Modeled directly after the luxury floating pill island in the
 * reference design. Replaces rectangular default tab buttons with:
 *  - Sleek curved capsule container (radius 36)
 *  - Active tab: smooth rounded white pill with dark icon & label
 *  - Inactive tabs: bright, crisp off-white icons and clean labels
 *  - Zero sharp square artifacts or clipped edges
 */
function FloatingCapsuleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.floatingBarWrapper} pointerEvents="box-none">
      <View style={styles.floatingBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // Skip hidden routes (e.g. reminders, profile, etc.)
          if ((options as any).href === null) return null;

          const isFocused = state.index === index;
          const label =
            options.tabBarLabel !== undefined
              ? (options.tabBarLabel as string)
              : options.title !== undefined
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const renderIcon = () => {
            const color = isFocused ? "#0b1612" : "#e2ece7";
            const size = 18;
            if (route.name === "index") {
              return <LayoutGrid size={size} color={color} strokeWidth={isFocused ? 2.5 : 2.0} />;
            }
            if (route.name === "coach") {
              return <Sparkles size={size} color={color} strokeWidth={isFocused ? 2.5 : 2.0} />;
            }
            if (route.name === "nutrition") {
              return <Utensils size={size} color={color} strokeWidth={isFocused ? 2.5 : 2.0} />;
            }
            if (route.name === "activity") {
              return <Activity size={size} color={color} strokeWidth={isFocused ? 2.5 : 2.0} />;
            }
            return null;
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={styles.tabPressable}
            >
              {isFocused ? (
                <View style={styles.activeCapsulePill}>
                  {renderIcon()}
                  <Text style={styles.activeCapsuleText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ) : (
                <View style={styles.inactiveTabCol}>
                  {renderIcon()}
                  <Text style={styles.inactiveTabText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
            title: "AI Coach",
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
    bottom: Platform.OS === "ios" ? 22 : 16,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  floatingBar: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 26, 21, 0.96)",
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  activeCapsulePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  activeCapsuleText: {
    color: "#0b1612",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  inactiveTabCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  inactiveTabText: {
    color: "#b4cbbf",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
