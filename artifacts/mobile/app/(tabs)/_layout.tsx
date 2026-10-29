import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";
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

function TabsContent() {
  const { isLeftOpen, closeLeftMenu, isRightOpen, closeRightMenu } = useSlideMenu();

  return (
    <>
      {/* 24/7 Continuous Internal Device Step & Motion Tracker */}
      <GlobalStepTracker />

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: THEME.colors.navActiveIcon,
          tabBarInactiveTintColor: THEME.colors.navInactiveIcon,
          tabBarActiveBackgroundColor: THEME.colors.navActivePill,
          tabBarStyle: {
            position: "absolute",
            bottom: Platform.OS === "ios" ? 24 : 16,
            left: 20,
            right: 20,
            backgroundColor: THEME.colors.navIslandBg,
            borderTopWidth: 0,
            borderRadius: THEME.radii.pill,
            height: Platform.OS === "ios" ? 72 : 64,
            paddingBottom: Platform.OS === "ios" ? 10 : 8,
            paddingTop: 8,
            paddingHorizontal: 8,
            ...THEME.shadows.nav,
            borderWidth: 1,
            borderColor: "rgba(156, 182, 174, 0.12)",
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: THEME.fonts.bold,
            marginTop: 2,
          },
          tabBarItemStyle: {
            borderRadius: THEME.radii.pill,
            marginHorizontal: 4,
            paddingVertical: 4,
          },
          headerShown: false,
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.colors.navIslandBg, borderRadius: THEME.radii.pill }]} />
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <LayoutGrid size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: "AI Coach",
            tabBarIcon: ({ color }) => <Sparkles size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            title: "Nutrition",
            tabBarIcon: ({ color }) => <Utensils size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Activity",
            tabBarIcon: ({ color }) => <Activity size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            href: null, // accessed via slide drawer
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // removed from bottom bar, accessed via slide drawer
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            href: null, // accessed via slide drawer
          }}
        />
        <Tabs.Screen
          name="safety"
          options={{
            href: null, // accessed via slide drawer
          }}
        />
        <Tabs.Screen
          name="achievements"
          options={{
            href: null, // accessed via slide drawer and home screen badges card
          }}
        />
      </Tabs>

      {/* Primary Left Slide Drawer */}
      <SlideMenuDrawer side="left" isOpen={isLeftOpen} onClose={closeLeftMenu} />

      {/* Top-Right Slide Drawer (preserved for later use) */}
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
