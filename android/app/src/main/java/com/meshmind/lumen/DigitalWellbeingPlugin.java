package com.meshmind.lumen;

import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lumen Digital Wellbeing & Screen Time Native Plugin
 * 
 * Ported & adapted from Mindful Architecture (https://github.com/akaMrNagar/Mindful):
 * - Checks & requests Android Usage Access (PACKAGE_USAGE_STATS) via AppOpsManager
 * - Queries UsageStatsManager.queryEvents for precise start/resume/pause timestamps
 * - Tracks screen unlocks (KEYGUARD_HIDDEN / SCREEN_INTERACTIVE)
 * - Classifies device apps into Productivity, Social, Entertainment, Gaming, Other
 * - Provides live app icons encoded as Base64 PNGs
 * - Handles Do Not Disturb (DND) interruption filters and Focus Session notifications
 */
@CapacitorPlugin(name = "DigitalWellbeing")
@SuppressWarnings("deprecation")
public class DigitalWellbeingPlugin extends Plugin {

    private static final String TAG = "DigitalWellbeingPlugin";
    private static final String FOCUS_CHANNEL_ID = "lumen_focus_channel";
    private static final int FOCUS_NOTIFICATION_ID = 4040;

    private static final Set<String> SOCIAL_PACKAGES = new HashSet<>();
    private static final Set<String> ENTERTAINMENT_PACKAGES = new HashSet<>();
    private static final Set<String> PRODUCTIVITY_PACKAGES = new HashSet<>();

    static {
        // Common Social Packages
        SOCIAL_PACKAGES.add("com.instagram.android");
        SOCIAL_PACKAGES.add("com.whatsapp");
        SOCIAL_PACKAGES.add("com.facebook.katana");
        SOCIAL_PACKAGES.add("com.facebook.orca");
        SOCIAL_PACKAGES.add("com.twitter.android");
        SOCIAL_PACKAGES.add("com.zhiliaoapp.musically");
        SOCIAL_PACKAGES.add("com.ss.android.ugc.trill");
        SOCIAL_PACKAGES.add("com.snapchat.android");
        SOCIAL_PACKAGES.add("com.reddit.frontpage");
        SOCIAL_PACKAGES.add("org.telegram.messenger");
        SOCIAL_PACKAGES.add("com.linkedin.android");
        SOCIAL_PACKAGES.add("com.discord");
        SOCIAL_PACKAGES.add("com.pinterest");

        // Common Entertainment / Video / Audio Packages
        ENTERTAINMENT_PACKAGES.add("com.google.android.youtube");
        ENTERTAINMENT_PACKAGES.add("com.netflix.mediaclient");
        ENTERTAINMENT_PACKAGES.add("com.spotify.music");
        ENTERTAINMENT_PACKAGES.add("com.amazon.avod.thirdpartyclient");
        ENTERTAINMENT_PACKAGES.add("tv.twitch.android.app");
        ENTERTAINMENT_PACKAGES.add("com.disney.disneyplus");
        ENTERTAINMENT_PACKAGES.add("com.hotstar.android");
        ENTERTAINMENT_PACKAGES.add("com.hbo.hbonow");
        ENTERTAINMENT_PACKAGES.add("com.apple.android.music");

        // Common Productivity Packages
        PRODUCTIVITY_PACKAGES.add("com.google.android.gm");
        PRODUCTIVITY_PACKAGES.add("com.android.chrome");
        PRODUCTIVITY_PACKAGES.add("com.google.android.apps.docs");
        PRODUCTIVITY_PACKAGES.add("com.google.android.keep");
        PRODUCTIVITY_PACKAGES.add("com.google.android.calendar");
        PRODUCTIVITY_PACKAGES.add("com.slack");
        PRODUCTIVITY_PACKAGES.add("notion.id");
        PRODUCTIVITY_PACKAGES.add("com.microsoft.office.outlook");
        PRODUCTIVITY_PACKAGES.add("com.microsoft.teams");
        PRODUCTIVITY_PACKAGES.add("com.todoist");
        PRODUCTIVITY_PACKAGES.add("com.ticktick.task");
    }

    /**
     * Checks if Usage Access permission is granted
     */
    @PluginMethod
    public void checkUsagePermission(PluginCall call) {
        boolean granted = isUsageAccessGranted();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    /**
     * Requests Usage Access permission by opening Android Settings
     */
    @PluginMethod
    public void requestUsagePermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("requested", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("requested", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Could not open Usage Access Settings: " + ex.getMessage());
            }
        }
    }

    /**
     * Checks if DND (Notification Policy Access) is granted
     */
    @PluginMethod
    public void checkDndPermission(PluginCall call) {
        Context ctx = getContext();
        boolean granted = false;
        if (ctx != null) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                granted = nm.isNotificationPolicyAccessGranted();
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Requests DND permission by opening system Notification Policy settings
     */
    @PluginMethod
    public void requestDndPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("requested", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open Notification Policy Settings: " + e.getMessage());
        }
    }

    /**
     * Set DND interruption filter (Do Not Disturb toggle)
     */
    @PluginMethod
    public void setDndMode(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.isNotificationPolicyAccessGranted()) {
                if (enabled) {
                    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                } else {
                    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("enabled", enabled);
                call.resolve(ret);
                return;
            }
            call.reject("DND permission not granted");
        } catch (Exception e) {
            call.reject("Failed to set DND filter: " + e.getMessage());
        }
    }

    /**
     * Queries Android UsageStatsManager to get real today's screen time, unlocks, and app usage breakdown.
     */
    @PluginMethod
    public void getTodayScreenTime(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        if (!isUsageAccessGranted()) {
            JSObject ret = new JSObject();
            ret.put("permissionGranted", false);
            ret.put("totalScreenSeconds", 0);
            ret.put("totalScreenMinutes", 0);
            ret.put("unlockCount", 0);
            ret.put("categories", createEmptyCategories());
            ret.put("apps", new JSArray());
            call.resolve(ret);
            return;
        }

        new Thread(() -> {
            try {
                Calendar cal = Calendar.getInstance();
                cal.set(Calendar.HOUR_OF_DAY, 0);
                cal.set(Calendar.MINUTE, 0);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                long start = cal.getTimeInMillis();
                long end = System.currentTimeMillis();

                UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
                if (usm == null) {
                    call.reject("UsageStatsManager not available");
                    return;
                }

                Map<String, Long> usageMap = new HashMap<>();
                Map<String, UsageEvents.Event> lastResumedEvents = new HashMap<>();
                int unlockCount = 0;

                // Mindful Query Events Algorithm
                try {
                    UsageEvents events = usm.queryEvents(start - (3 * 3600 * 1000L), end);
                    if (events != null) {
                        UsageEvents.Event event = new UsageEvents.Event();
                        while (events.hasNextEvent()) {
                            events.getNextEvent(event);
                            String pkg = event.getPackageName();
                            long ts = event.getTimeStamp();
                            int type = event.getEventType();

                            if (ts >= start) {
                                if (type == UsageEvents.Event.KEYGUARD_HIDDEN) {
                                    unlockCount++;
                                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                                           type == UsageEvents.Event.SCREEN_INTERACTIVE) {
                                    unlockCount++;
                                }
                            }

                            String eventKey = (pkg != null ? pkg : "") + (event.getClassName() != null ? event.getClassName() : "");

                            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                                lastResumedEvents.put(eventKey, event);
                                event = new UsageEvents.Event();
                            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED) {
                                UsageEvents.Event lastResumed = lastResumedEvents.remove(eventKey);
                                if (lastResumed != null && ts > start) {
                                    long resumeTs = Math.max(lastResumed.getTimeStamp(), start);
                                    long diff = ts - resumeTs;
                                    if (diff > 0 && pkg != null) {
                                        long cur = usageMap.containsKey(pkg) ? usageMap.get(pkg) : 0L;
                                        usageMap.put(pkg, cur + diff);
                                    }
                                }
                            }
                        }

                        // Handle apps currently in foreground
                        for (UsageEvents.Event openEvent : lastResumedEvents.values()) {
                            String pkg = openEvent.getPackageName();
                            if (pkg != null) {
                                long resumeTs = Math.max(openEvent.getTimeStamp(), start);
                                long diff = end - resumeTs;
                                if (diff > 0) {
                                    long cur = usageMap.containsKey(pkg) ? usageMap.get(pkg) : 0L;
                                    usageMap.put(pkg, cur + diff);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error in queryEvents: " + e.getMessage());
                }

                // Cross-validate with aggregate stats
                try {
                    Map<String, UsageStats> agg = usm.queryAndAggregateUsageStats(start, end);
                    if (agg != null) {
                        for (Map.Entry<String, UsageStats> entry : agg.entrySet()) {
                            String pkg = entry.getKey();
                            long fg = entry.getValue().getTotalTimeInForeground();
                            if (fg > 0) {
                                long cur = usageMap.containsKey(pkg) ? usageMap.get(pkg) : 0L;
                                if (fg > cur) {
                                    usageMap.put(pkg, fg);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error in queryAndAggregateUsageStats: " + e.getMessage());
                }

                PackageManager pm = ctx.getPackageManager();
                Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> launchables = pm.queryIntentActivities(mainIntent, 0);

                Map<String, ResolveInfo> launchableMap = new HashMap<>();
                for (ResolveInfo ri : launchables) {
                    if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                        launchableMap.put(ri.activityInfo.packageName, ri);
                    }
                }

                // App Usage records list
                List<AppUsageItem> appItems = new ArrayList<>();
                long totalScreenMs = 0;
                long socialMs = 0;
                long entertainmentMs = 0;
                long productivityMs = 0;
                long gamingMs = 0;
                long otherMs = 0;

                for (Map.Entry<String, Long> entry : usageMap.entrySet()) {
                    String pkg = entry.getKey();
                    long timeMs = entry.getValue();
                    if (timeMs < 1000) continue; // Skip less than 1 second

                    // Ignore system launcher or our own app if desired
                    String appName = pkg;
                    String category = classifyAppCategory(pkg, pm);

                    ResolveInfo ri = launchableMap.get(pkg);
                    if (ri != null) {
                        CharSequence label = ri.loadLabel(pm);
                        if (label != null && label.length() > 0) {
                            appName = label.toString();
                        }
                    } else {
                        try {
                            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                            CharSequence label = pm.getApplicationLabel(ai);
                            if (label != null) appName = label.toString();
                        } catch (Exception ignored) {}
                    }

                    totalScreenMs += timeMs;

                    if ("social".equals(category)) socialMs += timeMs;
                    else if ("entertainment".equals(category)) entertainmentMs += timeMs;
                    else if ("productivity".equals(category)) productivityMs += timeMs;
                    else if ("gaming".equals(category)) gamingMs += timeMs;
                    else otherMs += timeMs;

                    appItems.add(new AppUsageItem(pkg, appName, timeMs, category, ri));
                }

                // Sort descending by usage time
                Collections.sort(appItems, (a, b) -> Long.compare(b.timeMs, a.timeMs));

                JSArray appsArray = new JSArray();
                int iconCount = 0;
                for (AppUsageItem item : appItems) {
                    JSObject appObj = new JSObject();
                    appObj.put("packageName", item.packageName);
                    appObj.put("appName", item.appName);
                    appObj.put("screenSeconds", item.timeMs / 1000);
                    appObj.put("screenMinutes", item.timeMs / 60000);
                    appObj.put("category", item.category);

                    // Encode icon for top 15 apps
                    if (iconCount < 15 && item.resolveInfo != null) {
                        try {
                            Drawable drawable = item.resolveInfo.loadIcon(pm);
                            if (drawable != null) {
                                String base64Icon = encodeDrawableToBase64(drawable);
                                appObj.put("icon", "data:image/png;base64," + base64Icon);
                                iconCount++;
                            }
                        } catch (Exception ignored) {}
                    }
                    appsArray.put(appObj);
                }

                long totalSeconds = totalScreenMs / 1000;
                long totalMinutes = totalScreenMs / 60000;

                JSObject categoriesObj = new JSObject();

                categoriesObj.put("productivity", makeCategoryObj(productivityMs / 60000, totalMinutes));
                categoriesObj.put("social", makeCategoryObj(socialMs / 60000, totalMinutes));
                categoriesObj.put("entertainment", makeCategoryObj(entertainmentMs / 60000, totalMinutes));
                categoriesObj.put("gaming", makeCategoryObj(gamingMs / 60000, totalMinutes));
                categoriesObj.put("other", makeCategoryObj(otherMs / 60000, totalMinutes));

                JSObject ret = new JSObject();
                ret.put("permissionGranted", true);
                ret.put("totalScreenSeconds", totalSeconds);
                ret.put("totalScreenMinutes", totalMinutes);
                ret.put("unlockCount", Math.max(1, unlockCount));
                ret.put("categories", categoriesObj);
                ret.put("apps", appsArray);

                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error calculating screen time: " + e.getMessage(), e);
                call.reject("Failed to query screen usage: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Get list of all launchable device applications (for focus mode blocklist selection)
     */
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        new Thread(() -> {
            try {
                PackageManager pm = ctx.getPackageManager();
                Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> launchables = pm.queryIntentActivities(mainIntent, 0);

                JSArray appsArray = new JSArray();
                for (ResolveInfo ri : launchables) {
                    if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                        String pkg = ri.activityInfo.packageName;
                        if (pkg.equals(ctx.getPackageName())) continue; // Skip self

                        String label = ri.loadLabel(pm).toString();
                        String category = classifyAppCategory(pkg, pm);

                        JSObject obj = new JSObject();
                        obj.put("packageName", pkg);
                        obj.put("appName", label);
                        obj.put("category", category);
                        appsArray.put(obj);
                    }
                }

                JSObject ret = new JSObject();
                ret.put("apps", appsArray);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to list installed apps: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Start a native Focus Session with persistent notification and DND shield
     */
    @PluginMethod
    public void startFocusSession(PluginCall call) {
        String sessionType = call.getString("sessionType", "pomodoro");
        int minutes = call.getInt("minutes", 25);
        boolean enableDnd = call.getBoolean("enableDnd", true);

        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        try {
            // Setup Notification Channel
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    FOCUS_CHANNEL_ID,
                    "Lumen Focus Mode",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Ongoing focus mode session notifications");
                nm.createNotificationChannel(channel);
            }

            // Trigger DND if permitted
            if (enableDnd && nm != null && nm.isNotificationPolicyAccessGranted()) {
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
            }

            // Post ongoing notification
            if (nm != null) {
                NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, FOCUS_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("🛡️ Lumen Focus Shield Active")
                    .setContentText(sessionType.toUpperCase() + " • " + minutes + "m session in progress")
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW);

                nm.notify(FOCUS_NOTIFICATION_ID, builder.build());
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("minutes", minutes);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start focus session: " + e.getMessage());
        }
    }

    /**
     * Stop native Focus Session and clear ongoing notifications and DND
     */
    @PluginMethod
    public void stopFocusSession(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is null");
            return;
        }

        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(FOCUS_NOTIFICATION_ID);
                if (nm.isNotificationPolicyAccessGranted()) {
                    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop focus session: " + e.getMessage());
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private boolean isUsageAccessGranted() {
        Context ctx = getContext();
        if (ctx == null) return false;
        try {
            AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps != null) {
                int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    ctx.getPackageName()
                );
                if (mode == AppOpsManager.MODE_ALLOWED) return true;
            }

            UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm != null) {
                long now = System.currentTimeMillis();
                Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(now - 86400000L, now);
                return stats != null && !stats.isEmpty();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking usage permission: " + e.getMessage());
        }
        return false;
    }

    private String classifyAppCategory(String pkg, PackageManager pm) {
        if (SOCIAL_PACKAGES.contains(pkg)) return "social";
        if (ENTERTAINMENT_PACKAGES.contains(pkg)) return "entertainment";
        if (PRODUCTIVITY_PACKAGES.contains(pkg)) return "productivity";

        try {
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                int cat = ai.category;
                if (cat == ApplicationInfo.CATEGORY_SOCIAL) return "social";
                if (cat == ApplicationInfo.CATEGORY_VIDEO || cat == ApplicationInfo.CATEGORY_AUDIO) return "entertainment";
                if (cat == ApplicationInfo.CATEGORY_PRODUCTIVITY) return "productivity";
                if (cat == ApplicationInfo.CATEGORY_GAME) return "gaming";
            }
            if ((ai.flags & ApplicationInfo.FLAG_IS_GAME) != 0) {
                return "gaming";
            }
        } catch (Exception ignored) {}

        if (pkg.contains("game") || pkg.contains("arcade")) return "gaming";
        if (pkg.contains("video") || pkg.contains("music") || pkg.contains("play")) return "entertainment";
        if (pkg.contains("chat") || pkg.contains("message") || pkg.contains("social")) return "social";
        if (pkg.contains("mail") || pkg.contains("doc") || pkg.contains("calc") || pkg.contains("note")) return "productivity";

        return "other";
    }

    private String encodeDrawableToBase64(Drawable drawable) {
        int width = drawable.getIntrinsicWidth() > 0 ? Math.min(drawable.getIntrinsicWidth(), 96) : 64;
        int height = drawable.getIntrinsicHeight() > 0 ? Math.min(drawable.getIntrinsicHeight(), 96) : 64;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 85, baos);
        return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
    }

    private JSObject makeCategoryObj(long minutes, long totalMinutes) {
        JSObject obj = new JSObject();
        obj.put("minutes", minutes);
        int pct = totalMinutes > 0 ? (int) Math.round(((double) minutes / totalMinutes) * 100) : 0;
        obj.put("percentage", pct);
        return obj;
    }

    private JSObject createEmptyCategories() {
        JSObject obj = new JSObject();
        obj.put("productivity", makeCategoryObj(0, 0));
        obj.put("social", makeCategoryObj(0, 0));
        obj.put("entertainment", makeCategoryObj(0, 0));
        obj.put("gaming", makeCategoryObj(0, 0));
        obj.put("other", makeCategoryObj(0, 0));
        return obj;
    }

    private static class AppUsageItem {
        final String packageName;
        final String appName;
        final long timeMs;
        final String category;
        final ResolveInfo resolveInfo;

        AppUsageItem(String packageName, String appName, long timeMs, String category, ResolveInfo resolveInfo) {
            this.packageName = packageName;
            this.appName = appName;
            this.timeMs = timeMs;
            this.category = category;
            this.resolveInfo = resolveInfo;
        }
    }
}
