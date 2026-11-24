import { BackHandler, Platform, ToastAndroid } from "react-native";

export type BackHandlerFn = () => boolean;

interface RegisteredHandler {
  id: string;
  priority: number;
  handler: BackHandlerFn;
}

let handlers: RegisteredHandler[] = [];
let tabHistory: string[] = ["index"];
let lastBackPressTime = 0;

/**
 * Register a back handler with a priority level:
 * - 100: Slide drawers (SlideMenuDrawer)
 * - 90: In-screen overlay sheets (e.g. food camera scanner, AI text logger)
 * - 80: Modal dialogs
 * - 50: Multi-step flows (Onboarding)
 * - 40: Auxiliary screens (Profile, Safety, Analytics, Reminders, Achievements)
 * - 30: Tab history stack (Coach -> Nutrition -> Home)
 */
export function registerBackHandler(
  id: string,
  priority: number,
  handler: BackHandlerFn
): () => void {
  // Remove existing handler with same id if any
  handlers = handlers.filter((h) => h.id !== id);

  handlers.push({ id, priority, handler });
  handlers.sort((a, b) => b.priority - a.priority);

  return () => {
    handlers = handlers.filter((h) => h.id !== id);
  };
}

/**
 * Tab history tracking
 */
export function recordTabVisit(tabName: string) {
  if (!tabName) return;
  // If already at the top of history, do not duplicate
  if (tabHistory.length > 0 && tabHistory[tabHistory.length - 1] === tabName) {
    return;
  }
  tabHistory.push(tabName);
  // Cap history to 20 entries to avoid memory growth
  if (tabHistory.length > 20) {
    tabHistory.shift();
  }
}

export function popTabHistory(): string | null {
  if (tabHistory.length <= 1) {
    return null; // Only home remains or empty
  }
  tabHistory.pop(); // Remove current
  return tabHistory[tabHistory.length - 1] || "index";
}

export function getTabHistory(): string[] {
  return [...tabHistory];
}

/**
 * Master dispatcher called by:
 * 1. Android Native MainActivity via `window.__lumenHandleBack()`
 * 2. React Native `BackHandler`
 * 3. Window `hardwareBackPress` event
 */
export function handleGlobalBack(): boolean {
  // 1. Check all registered prioritized handlers (Drawers -> Sheets -> Modals -> Sub-screens)
  for (const item of handlers) {
    try {
      const handled = item.handler();
      if (handled) {
        return true;
      }
    } catch (err) {
      console.warn(`[BackNav] Error in handler '${item.id}':`, err);
    }
  }

  // 2. Tab history fallback: if visited other tabs, pop back to previous tab
  const prevTab = popTabHistory();
  if (prevTab && prevTab !== "index") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lumenNavigateTab", { detail: prevTab }));
    }
    return true;
  }

  // 3. Root Home screen double-tap exit guard (2-second threshold)
  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    // Second press within 2s -> Allow Android native to exit the app
    return false;
  }

  lastBackPressTime = now;
  showBackExitPrompt();
  return true; // Keep app open on first press
}

function showBackExitPrompt() {
  if (Platform.OS === "android") {
    try {
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      return;
    } catch {}
  }

  // Fallback toast via DOM or Capacitor alert
  if (typeof document !== "undefined") {
    try {
      const existing = document.getElementById("lumen-exit-toast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "lumen-exit-toast";
      toast.innerText = "Press back again to exit";
      toast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(14, 25, 20, 0.95);
        color: #e2ece7;
        padding: 8px 18px;
        border-radius: 20px;
        font-size: 13px;
        font-family: -apple-system, sans-serif;
        font-weight: 600;
        border: 1px solid rgba(16, 185, 129, 0.35);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        z-index: 99999;
        pointer-events: none;
        transition: opacity 0.25s ease;
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 250);
      }, 1800);
    } catch {}
  }
}

// Bind to window for Android native Capacitor WebView bridge
if (typeof window !== "undefined") {
  (window as any).__lumenHandleBack = handleGlobalBack;
  window.addEventListener("hardwareBackPress", () => {
    handleGlobalBack();
  });
}

// Bind to React Native BackHandler for native environments
try {
  BackHandler.addEventListener("hardwareBackPress", handleGlobalBack);
} catch {}
