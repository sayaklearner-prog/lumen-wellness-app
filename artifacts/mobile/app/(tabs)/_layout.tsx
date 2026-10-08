import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { 
  LayoutGrid, 
  Sparkles, 
  Activity, 
  Utensils 
} from "lucide-react-native";
import { SlideMenuProvider, useSlideMenu } from "@/context/SlideMenuContext";
import { SlideMenuDrawer } from "@/components/SlideMenuDrawer";

function TabsContent() {
  const { isOpen, closeMenu } = useSlideMenu();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#10b981", // vibrant emerald
          tabBarInactiveTintColor: "#64748b", // slate-500
          tabBarStyle: {
            backgroundColor: "#070c0a",
            borderTopWidth: 1,
            borderTopColor: "rgba(16, 185, 129, 0.15)",
            height: Platform.OS === "ios" ? 88 : 72,
            paddingBottom: Platform.OS === "ios" ? 30 : 14,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            marginTop: 2,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
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
          name="profile"
          options={{
            href: null, // removed from bottom bar, accessed via top-right slide drawer
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            href: null, // accessed via top-right slide drawer
          }}
        />
        <Tabs.Screen
          name="safety"
          options={{
            href: null, // accessed via top-right slide drawer
          }}
        />
      </Tabs>

      {/* Slide drawer for all modules removed from bottom bar */}
      <SlideMenuDrawer isOpen={isOpen} onClose={closeMenu} />
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
