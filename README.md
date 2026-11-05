# Lumen AI OS 🌿
### *Next-Generation Bio-Intelligence & Clinical Longevity Telemetry Platform*

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-10b981?style=for-the-badge&logo=android)](https://github.com/sayaklearner-prog/lumen-wellness-app)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%201.5%20Pro%20%2F%20Flash-38bdf8?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Native Alarms](https://img.shields.io/badge/Native%20Alarms-Android%20AlarmManager-f59e0b?style=for-the-badge&logo=android)](https://developer.android.com/)
[![Telemetry](https://img.shields.io/badge/Telemetry-Google%20Sheets%20Real--Time%20Sync-059669?style=for-the-badge&logo=googlesheets)](https://sheets.google.com/)

---

## 📌 Executive Summary

**Lumen AI OS** is a clinical-grade bio-intelligence and wellness operating system built for modern longevity, metabolic pacing, and circadian synchronization. Designed with an ultra-premium, dark-mode medical telemetry aesthetic (inspired by *Whoop*, *Oura*, and *Apple Health*), Lumen bridges hardware sensor telemetry, multimodal computer vision, and cutting-edge generative AI into a unified, local-first mobile ecosystem.

Unlike traditional fitness apps that function as static "graveyards of charts," Lumen functions as an active clinical companion: evaluating biometric recovery, calculating dynamic daily readiness, ringing loud acoustic bio-alarms directly through hardware channels, and automatically streaming administrative telemetry to cloud spreadsheets in real time.

---

## 🏛 System Architecture & Data Flow

```
                                      +---------------------------------------------+
                                      |            LUMEN CLIENT APPS                |
                                      |  (Expo / React Native + Capacitor Android)   |
                                      +---------------------------------------------+
                                                             |
                                                             | Bi-directional RPC / State
                                                             v
+--------------------------------------------------------------------------------------------------------------------+
|                                           LUMEN MOBILE CORE RUNTIME                                                |
|                                                                                                                    |
|   +-----------------------+   +------------------------+   +-----------------------+   +-----------------------+   |
|   |  Dashboard & Hero     |   |   3-Pillar Clinical    |   |  Native Bio-Alarms &  |   |   AI Coach & Persona  |   |
|   |  Readiness Engine     |   |   Synthesis (Gemini)   |   |  Hydration (Android)  |   |   Memory Engine       |   |
|   +-----------------------+   +------------------------+   +-----------------------+   +-----------------------+   |
|              |                            |                            |                            |              |
|   +------------------------------------------------------------------------------------------------------------+   |
|   |                                    UNIFIED CLIENT SERVICES LAYER                                           |   |
|   |  * sheetsTelemetryService  * nativeStepCounter  * digitalWellbeingService  * fitnessWatchSensor * googleAuth   |   |
|   +------------------------------------------------------------------------------------------------------------+   |
|              |                                                         |                            |              |
|              v                                                         v                            v              |
|   +-----------------------+                                 +----------------------+   +-----------------------+   |
|   | Local-First Storage   |                                 | Hardware Sensor Bus  |   | Native AlarmManager   |   |
|   | SQLite Master + KV    |                                 | Pedometer/Step Counter|   | Acoustic Ring & Vibe  |   |
|   +-----------------------+                                 +----------------------+   +-----------------------+   |
+--------------------------------------------------------------------------------------------------------------------+
       |                                                   |                                          |
       | Offline Queue Flush                               | Telemetry Webhook                        | Generative AI
       v                                                   v                                          v
+-----------------------+                       +-----------------------+                  +-----------------------+
|  FASTAPI / DOCKER     |                       |  GOOGLE APPS SCRIPT   |                  |     GOOGLE GEMINI     |
|  BACKEND API SERVER   |                       |  WEBHOOK (SHEETS)     |                  |  AI 1.5 PRO / FLASH   |
|  * Biometric Analysis |                       |  * Real-Time Logins   |                  |  * 3-Pillar Synthesis |
|  * Meal Vision Engine |                       |  * User Signups       |                  |  * Clinical Insights  |
|  * Long-Term Backups  |                       |  * Clinical Targets   |                  |  * Vision Food Macros |
+-----------------------+                       +-----------------------+                  +-----------------------+
```

---

## 📂 Monorepo Repository Structure

```
lumen-wellness-app/
├── android/                             # Android Studio native Capacitor project
│   ├── app/
│   │   ├── src/main/assets/public/      # Bundled production mobile web assets
│   │   ├── src/main/java/.../           # Native AlarmReceiver & NotificationReceiver
│   │   └── AndroidManifest.xml          # Exact alarm, wake lock, sensor permissions
│   └── build.gradle                     # Gradle configuration & SDK target specifications
│
├── artifacts/
│   ├── mobile/                          # Primary Expo / React Native Mobile Application
│   │   ├── app/
│   │   │   ├── (auth)/                  # Onboarding, Welcome, OAuth & OTP verification
│   │   │   │   ├── welcome.tsx          # Google OAuth, Email OTP, and Guest access
│   │   │   │   └── onboarding.tsx       # Clinical targets, personal metrics, mode selection
│   │   │   ├── (tabs)/                  # Main Application Navigation Screens
│   │   │   │   ├── index.tsx            # Dashboard, Hero Readiness, Circular Ring, Streaks
│   │   │   │   ├── activity.tsx         # Sensor tracking, steps, workouts, calorie burn
│   │   │   │   ├── analytics.tsx        # 3-Pillar Clinical AI Synthesis (Gemini Engine)
│   │   │   │   ├── nutrition.tsx        # Macro pacing, daily meals, hydration logs
│   │   │   │   ├── coach.tsx            # Conversational AI Advisor with 4 clinical personas
│   │   │   │   ├── reminders.tsx        # Hardware Bio-Alarms & Cellular Hydration engine
│   │   │   │   ├── safety.tsx           # Clinical guardrails, red flags & disclaimer modal
│   │   │   │   ├── profile.tsx          # Settings, Gemini Key manager, Sheets diagnostics
│   │   │   │   └── achievements.tsx     # Gamified badges, milestones & consistency streaks
│   │   │   └── _layout.tsx              # Root Stack router, Slide Navigation menu & Drawer
│   │   ├── services/                    # Core business logic & native bridge services
│   │   │   ├── sheetsTelemetryService.ts# Real-time Google Sheets auto-sync with offline queue
│   │   │   ├── geminiAi.ts              # Gemini AI API failover, prompt synthesis, caching
│   │   │   ├── authService.ts           # Email OTP, session tokens & verified identity
│   │   │   ├── googleAuth.ts            # Google Cloud OAuth 2.0 PKCE & JWT decoder
│   │   │   ├── notifications.ts         # Android AlarmManager exact alarm scheduler
│   │   │   ├── alarm.ts                 # Acoustic sound synthesizer & vibration motor
│   │   │   ├── hydrationService.ts      # Cellular fluid algorithm & daytime prompt engine
│   │   │   ├── nativeStepCounter.ts     # Device pedometer / accelerometer sensor bridge
│   │   │   ├── digitalWellbeingService.ts# Screen time, circadian blue-light monitor
│   │   │   └── db.ts / storage.ts       # Unified SQLite Master database & key-value cache
│   │   └── constants/theme.ts           # Emerald luxury dark-mode design tokens
│   │
│   ├── api-server/                      # Express & Node.js microservice endpoints
│   ├── hosting/                         # Static Firebase OAuth bridge callback handler
│   └── wellness/                        # Legacy React + Vite desktop web interface
│
├── backend/                             # High-performance FastAPI Python Backend
│   ├── app/
│   │   ├── api/v1/                      # REST endpoints (auth, workouts, coach, analytics)
│   │   ├── core/                        # Configuration, JWT signing, security helpers
│   │   ├── database/                    # SQLAlchemy models & SQLite/Postgres sessions
│   │   └── ai/                          # Anthropic Claude & OpenAI GPT vision analyzers
│   └── main.py                          # FastAPI application initialization & middleware
│
├── lib/                                 # Shared TypeScript monorepo packages
│   ├── api-spec/                        # OpenAPI 3.0 contract specification
│   ├── api-client-react/                # Auto-generated TanStack React Query SDK hooks
│   └── api-zod/                         # Zod schema validators & runtime guards
│
├── package.json                         # Monorepo workspaces & pnpm dependencies
└── capacitor.config.json                # Capacitor native Android app metadata
```

---

## 🌟 Core Technical Innovations

### 1. Dynamic Hero Bio-Readiness Engine (`app/(tabs)/index.tsx`)
- **Circular Readiness Gauge**: Preserves a normalized 0–10 clinical scale visualizing composite physiological capacity across 5 evaluated pillars (Nutrition, Hydration, Sleep, Activity, Screen Time).
- **Intelligent Clinical Interpretation**: Rather than displaying static or generic text, Lumen synthesizes real-time metrics into actionable circadian recommendations:
  - *Optimal Recovery ($\ge 7.5$ score + $\ge 7$h sleep)*:  
    `"Deep recovery is optimal. High-strain day—push workouts hard, but cut caffeine by 2:00 PM."`
  - *Cellular Hydration Leading*:  
    `"Cellular hydration is strong. Peak performance day—ideal for strength and high-intensity output."`
  - *Sleep Deficit (< 6.0h sleep)*:  
    `"Sleep deficit detected. Restorative pacing advised—prioritize light mobility, fluids, and an early wind-down."`
- **Responsive Viewport Containment**: Built with `flex: 1`, `minWidth: 0`, and `numberOfLines={3}` with `ellipsizeMode="tail"`, ensuring the layout **never clips or overflows** on compact 320px–360px mobile viewports.

---

### 2. 3-Pillar Clinical AI Synthesis (`app/(tabs)/analytics.tsx` & `geminiAi.ts`)
- **Real-Time Gemini AI Integration**: Connects directly to Google's official Gemini Generative Language API (`v1beta` models including `gemini-1.5-flash` and `gemini-1.5-pro`).
- **Clinical Tri-Pillar Architecture**:
  1. **Biometrics & Autonomic Recovery**: Analyzes resting heart rate, step strain, and screen time fatigue.
  2. **Cellular Hydration & Metabolism**: Correlates fluid intake pacing, calorie distribution, and macro splits.
  3. **Sleep Architecture & Circadian Rhythm**: Evaluates sleep duration, rest quality, and next-day energy reserve.
- **Failover & Caching Resilience**:
  - Automatically caches generated reports by date key (`lumen_ai_synthesis_YYYY-MM-DD`) in local SQLite storage, eliminating redundant API consumption.
  - Multi-endpoint failover: tries user-managed API keys, falls back to environment keys, and provides rule-based clinical synthesis if network connectivity is absent.
- **Relocated Key Security**: Relocated the Gemini API Key management interface completely out of the analysis tab into **Settings (Profile ➔ AI & Units)** with live format validation (`AIzaSy...`) and connection health diagnostics.

---

### 3. Production Native Bio-Alarms & Hydration Engine (`app/(tabs)/reminders.tsx`)
- **Exact Android AlarmManager**: Uses `setExactAndAllowWhileIdle()` via native receivers, allowing Lumen alarms to fire loudly **even when the app is killed, the screen is turned off, or the phone is set to Do-Not-Disturb / Silent mode**.
- **Continuous Acoustic Tone & Vibration**: Plays custom wake audio with infinite loop vibration until dismissed or snoozed via a glowing, full-screen HUD modal.
- **Cellular Hydration Prompts**:
  - Smart daytime scheduler operating strictly between **8:00 AM and 10:00 PM**.
  - Configurable nudge frequencies: **1h, 1.5h, 2h, and 3h**.
  - Visual intake tracking against clinical daily milliliter targets.

---

### 4. Real-Time Google Sheets User Telemetry (`sheetsTelemetryService.ts`)
- **Zero-Maintenance Cloud Tracking**: Every time a user verifies their account, logs in via Google, or completes their onboarding health profile, Lumen silently relays their telemetry to a private Google Sheet via Google Apps Script Web App.
- **Logged Columns**:
  | Column | Data Description |
  |---|---|
  | `Timestamp` | Local formatted date and time (`Nov 5, 2026, 10:47 PM`) |
  | `Full Name` | User's full name (from onboarding or Google profile) |
  | `Email Address` | Verified email address (Google account or Email OTP) |
  | `Event Type` | `"New Signup"`, `"User Login"`, `"Google Sign-In"`, or `"Profile Update"` |
  | `Platform / OS` | Client runtime (`android`, `ios`, `web`) |
  | `Health Goal Mode` | Clinical focus (`standard`, `athletic`, `longevity`, etc.) |
  | `Daily Calorie Target` | Calorie baseline (e.g. `2600`) |
  | `Daily Sleep Target` | Target sleep duration in hours (e.g. `8.0`) |
  | `Daily Steps Target` | Target step count (e.g. `10000`) |
  | `App Version` | Client release version (`1.0.0`) |
- **Offline Queue Fallback**: If the device loses internet connection, payloads are automatically stored in an offline queue inside SQLite (`lumen_pending_sheets_telemetry`) and automatically flushed when network access resumes.
- **In-App Testing Dashboard**: Profile ➔ Settings includes an **Auto-Sync Active** badge and a **"Send Test Ping to Google Sheet"** button for immediate end-to-end verification.

---

### 5. Multi-Persona Longevity Coach (`app/(tabs)/coach.tsx`)
Lumen features a stateful conversational AI coach that can be calibrated across 4 distinct behavioral personas:
1. **Clinical Specialist (Dr. Thorne)**: Evidence-based, biochemical, biomarker-focused guidance.
2. **Empathetic Guide (Maya)**: Supportive, mindful, stress-reduction and habit-forming mentorship.
3. **Biohacker (Kai)**: High-performance optimization, cold thermogenesis, fasting protocols, and HRV training.
4. **Disciplined Trainer (Marcus)**: Direct, motivational, accountability-driven physical conditioning.

---

### 6. Local-First Unified Persistence (`services/storage.ts` & `services/db.ts`)
- **Bypasses Android 2KB Limit**: Native Android `SecureStore` caps individual keys at 2KB. Lumen circumvents this with a unified SQLite database engine capable of storing arbitrary JSON payloads, historical snapshots, and meal databases.
- **Immediate In-Memory Consistency**: Dual-layer architecture provides an in-memory `Map` cache for synchronous zero-latency reads while asynchronously flushing writes to disk.

---

## 🛠 Technology Stack

| Layer | Framework / Technology | Purpose |
|---|---|---|
| **Mobile Runtime** | Expo 52 / React Native 0.76 | Cross-platform native mobile engine |
| **Native Bridge** | Capacitor 7 (Android) | Hardware bridge, APK generation, AlarmManager integration |
| **Styling & Design** | React Native StyleSheet + Custom Design System | Luxury emerald dark-mode tokens (`#050b08`, `#10b981`) |
| **Navigation** | Expo Router (File-based Routing) | Deep linking, modal stacks, tab layouts |
| **Icons & Visuals** | Lucide React Native & SVG Linear Gradients | Scalable high-contrast icons & vector gauges |
| **AI Synthesis** | Google Gemini 1.5 Flash & Pro API | Multimodal vision & 3-pillar clinical synthesis |
| **Cloud Telemetry** | Google Apps Script Web App / Sheets API | Real-time user login & registration telemetry |
| **Database (Client)** | SQLite (Android/iOS) + LocalStorage (Web) | Local-first biometric history, offline queues |
| **State Management** | TanStack React Query 5 | Server synchronization, cache invalidation |
| **Backend API** | FastAPI (Python 3.11) + Uvicorn | High-throughput async REST microservice |
| **ORM & DB (Server)** | SQLAlchemy + PostgreSQL / SQLite | Server persistence & long-term data storage |

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `npm install -g pnpm`
- **Python**: `3.10+` (optional, for FastAPI backend)
- **Android Studio**: Ladybug / Jellyfish (for compiling native Android APK)

---

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sayaklearner-prog/lumen-wellness-app.git
cd lumen-wellness-app

# Install monorepo dependencies
pnpm install
```

---

### 2. Environment Configuration
Create a `.env` file in `artifacts/mobile/.env`:
```env
# Gemini API Key (Optional fallback; users can also set this in Settings)
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...

# Google Sheets Telemetry Webhook URL
EXPO_PUBLIC_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbztZswgy51yZvpA21CxtYiGVizELYmfX0U2eIufOgMqKE1vzCCEL14oRIdirscXYVJlxw/exec

# Backend API Base URL
EXPO_PUBLIC_API_URL=https://lumen-wellness-app.onrender.com
```

---

### 3. Run Mobile App in Development
```bash
# Navigate to mobile project
cd artifacts/mobile

# Run Expo Dev Server
npx expo start
```
- Press `w` to open in browser (Web mode).
- Press `a` to run on an attached Android device or emulator.
- Scan QR code with Expo Go on iOS / Android.

---

### 4. Build Production Web Bundle for Android WebView
Whenever frontend code is updated, export the bundle and copy it to the Android assets directory:
```bash
cd artifacts/mobile

# Export production web bundle
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npx expo export --platform web --clear

# Copy bundle into Android native assets
cd ../..
cp -r artifacts/mobile/dist/* android/app/src/main/assets/public/
```

---

### 5. Compile Android APK with Gradle
```bash
cd android

# Compile Debug APK
./gradlew assembleDebug

# Output APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📊 Google Sheets Setup Guide (for Custom Sheets)

If you wish to deploy a new Google Sheet to collect user telemetry:

1. Open **[sheets.new](https://sheets.new)** in your browser and create a spreadsheet.
2. In the top menu, navigate to **Extensions ➔ Apps Script**.
3. Replace the editor contents with:
```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "Full Name", "Email Address", "Event Type",
        "Platform / OS", "Health Goal Mode", "Daily Calorie Target",
        "Daily Sleep Target", "Daily Steps Target", "App Version"
      ]);
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e6f4ea");
      sheet.setFrozenRows(1);
    }
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name || "N/A",
      data.email || "N/A",
      data.event || "Signup",
      data.platform || "Unknown",
      data.healthMode || "N/A",
      data.calorieTarget || "N/A",
      data.sleepTarget || "N/A",
      data.stepsTarget || "N/A",
      data.appVersion || "1.0.0"
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```
4. Click **Deploy ➔ New deployment**.
5. Select type **Web app**, configure **Execute as: Me**, and **Who has access: Anyone**.
6. Copy the resulting URL and paste it into `sheetsTelemetryService.ts` or `EXPO_PUBLIC_SHEETS_WEBHOOK_URL`.

---

## 🔒 Security, Privacy & Compliance Disclaimers

> [!IMPORTANT]
> **Clinical Boundary Disclaimer**: Lumen AI OS provides physiological tracking, wellness habit optimization, and educational AI synthesis. It is **not** a certified medical diagnostic device and does not diagnose, treat, cure, or prevent any acute medical condition. Users experiencing clinical emergencies or severe health red flags are prompted with immediate emergency contact hotlines via `safety.tsx`.

- **Client-Side Key Isolation**: Gemini API keys are persisted exclusively in device-encrypted storage and are never logged to public telemetry or external servers.
- **Zero Ingestion of Sensitive Biometrics into Public Sheets**: The Google Sheets telemetry webhook only captures administrative operational metrics (name, email, platform, and broad daily targets); granular meal pictures, chat coach transcripts, and private health notes remain safely stored in local device SQLite storage.

---

## 📄 License & Attribution

Developed with 💚 by the **Lumen Engineering & Longevity Research Team**.  
All rights reserved © 2026.
