package com.meshmind.lumen;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * NotificationAlarmReceiver
 * 
 * Handles proactive notification alarm triggers even when the app is completely
 * closed or phone is sleeping. Also restores scheduled alarms on device reboot.
 */
public class NotificationAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "LumenNotificationAlarm";
    public static final String ACTION_TRIGGER_NOTIFICATION = "com.meshmind.lumen.ACTION_TRIGGER_NOTIFICATION";
    public static final String PREFS_NAME = "LumenNotificationSchedules";
    public static final String KEY_SCHEDULES_JSON = "saved_schedules";

    // Channels
    public static final String CHANNEL_ALERTS = "lumen_alerts";
    public static final String CHANNEL_HYDRATION = "lumen_hydration";
    public static final String CHANNEL_MOVEMENT = "lumen_movement";
    public static final String CHANNEL_BRIEFING = "lumen_briefing";
    public static final String CHANNEL_SCREENTIME = "lumen_screentime";
    public static final String CHANNEL_NUTRITION = "lumen_nutrition";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "NotificationAlarmReceiver triggered with action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            // Phone rebooted - re-arm all proactive alarms
            rearmSchedulesOnBoot(context);
            return;
        }

        if (ACTION_TRIGGER_NOTIFICATION.equals(action)) {
            int id = intent.getIntExtra("id", (int) (System.currentTimeMillis() % 100000));
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String channelId = intent.getStringExtra("channelId");
            long intervalMillis = intent.getLongExtra("intervalMillis", 0L);

            if (title == null || title.isEmpty()) {
                title = "Lumen Health Alert";
            }
            if (channelId == null || channelId.isEmpty()) {
                channelId = CHANNEL_ALERTS;
            }

            // Ensure notification channels exist
            createNotificationChannels(context);

            // Deliver notification
            showNotification(context, id, title, body, channelId);

            // If repeating interval is requested, reschedule the alarm
            if (intervalMillis > 0) {
                long nextTrigger = System.currentTimeMillis() + intervalMillis;
                scheduleNextAlarm(context, id, title, body, channelId, nextTrigger, intervalMillis);
            }
        }
    }

    public static void showNotification(Context context, int id, String title, String body, String channelId) {
        try {
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                Log.w(TAG, "Notifications are disabled at the OS level");
                return;
            }

            createNotificationChannels(context);

            // Intent to launch MainActivity when tapped
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra("notification_id", id);
            openIntent.putExtra("notification_channel", channelId);

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                id,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .setSound(defaultSoundUri)
                .setVibrate(new long[]{0, 250, 150, 250})
                .setColor(Color.parseColor("#10b981"));

            NotificationManagerCompat.from(context).notify(id, builder.build());
            Log.i(TAG, "Notification #" + id + " displayed successfully: " + title);
        } catch (Exception e) {
            Log.e(TAG, "Error displaying notification: " + e.getMessage(), e);
        }
    }

    public static void scheduleNextAlarm(Context context, int id, String title, String body, String channelId, long triggerAtMillis, long intervalMillis) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, NotificationAlarmReceiver.class);
            intent.setAction(ACTION_TRIGGER_NOTIFICATION);
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("channelId", channelId);
            intent.putExtra("intervalMillis", intervalMillis);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }

            Log.i(TAG, "Scheduled alarm #" + id + " for " + triggerAtMillis + " ms");
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling alarm: " + e.getMessage(), e);
        }
    }

    public static void cancelAlarm(Context context, int id) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, NotificationAlarmReceiver.class);
            intent.setAction(ACTION_TRIGGER_NOTIFICATION);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                id,
                intent,
                PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }

            NotificationManagerCompat.from(context).cancel(id);
            Log.i(TAG, "Cancelled alarm #" + id);
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling alarm: " + e.getMessage(), e);
        }
    }

    private void rearmSchedulesOnBoot(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String schedulesJson = prefs.getString(KEY_SCHEDULES_JSON, "[]");
            JSONArray array = new JSONArray(schedulesJson);
            long now = System.currentTimeMillis();

            Log.i(TAG, "Re-arming " + array.length() + " proactive notification schedules on boot");

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                int id = obj.optInt("id");
                String title = obj.optString("title");
                String body = obj.optString("body");
                String channelId = obj.optString("channelId", CHANNEL_ALERTS);
                long triggerAtMillis = obj.optLong("triggerAtMillis");
                long intervalMillis = obj.optLong("intervalMillis", 0L);

                if (triggerAtMillis <= now) {
                    if (intervalMillis > 0) {
                        // Advance to the next cycle
                        while (triggerAtMillis <= now) {
                            triggerAtMillis += intervalMillis;
                        }
                    } else {
                        // One-shot in past, skip
                        continue;
                    }
                }

                scheduleNextAlarm(context, id, title, body, channelId, triggerAtMillis, intervalMillis);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error re-arming schedules on boot: " + e.getMessage(), e);
        }
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        // 1. Critical Biomarker Alerts
        NotificationChannel alerts = new NotificationChannel(
            CHANNEL_ALERTS,
            "Lumen Critical Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        alerts.setDescription("Urgent health alerts, bio-metric anomalies, and alarms");
        alerts.enableLights(true);
        alerts.setLightColor(Color.RED);
        alerts.enableVibration(true);

        // 2. Hydration Reminders
        NotificationChannel hydration = new NotificationChannel(
            CHANNEL_HYDRATION,
            "Hydration Prompts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        hydration.setDescription("Intelligent cellular fluid intake and hydration reminders");
        hydration.enableLights(true);
        hydration.setLightColor(Color.CYAN);

        // 3. Movement & Sedentary
        NotificationChannel movement = new NotificationChannel(
            CHANNEL_MOVEMENT,
            "Inactivity & Movement Alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        movement.setDescription("Sedentary break reminders and daily step quota progress");
        movement.enableLights(true);
        movement.setLightColor(Color.GREEN);

        // 4. Daily Bio-Briefing
        NotificationChannel briefing = new NotificationChannel(
            CHANNEL_BRIEFING,
            "Daily Bio-Briefings",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        briefing.setDescription("Morning readiness briefings and nightly sleep wind-down");

        // 5. Digital Wellbeing & Screen Time
        NotificationChannel wellbeing = new NotificationChannel(
            CHANNEL_SCREENTIME,
            "Digital Wellbeing & Screen Limits",
            NotificationManager.IMPORTANCE_HIGH
        );
        wellbeing.setDescription("Daily mindful screen time thresholds and focus session notifications");

        // 6. Nutrition & Meals
        NotificationChannel nutrition = new NotificationChannel(
            CHANNEL_NUTRITION,
            "Nutrition & Meal Prompts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        nutrition.setDescription("Meal logging prompts and macronutrient tracking");

        manager.createNotificationChannel(alerts);
        manager.createNotificationChannel(hydration);
        manager.createNotificationChannel(movement);
        manager.createNotificationChannel(briefing);
        manager.createNotificationChannel(wellbeing);
        manager.createNotificationChannel(nutrition);
    }
}
