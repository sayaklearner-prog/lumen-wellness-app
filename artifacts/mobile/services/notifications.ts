import { Platform } from "react-native";

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }

  try {
    const Notifications = require("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch (err) {
    console.error("Notification permissions error", err);
    return false;
  }
}

export async function scheduleNotification(title: string, body: string, triggerSeconds: number) {
  if (Platform.OS === "web") {
    // Use browser Notification API as fallback
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;
    setTimeout(() => {
      new Notification(title, { body });
    }, triggerSeconds * 1000);
    return `web-${Date.now()}`;
  }

  try {
    const Notifications = require("expo-notifications");
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        seconds: triggerSeconds,
      } as any,
    });
    return id;
  } catch (err) {
    console.error("Failed scheduling local notification", err);
    return null;
  }
}

export async function cancelAllNotifications() {
  if (Platform.OS === "web") return;
  try {
    const Notifications = require("expo-notifications");
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.error("Failed canceling notifications", err);
  }
}
