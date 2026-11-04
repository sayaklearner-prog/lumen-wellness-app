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
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * NotificationAlarmReceiver
 * 
 * Production Android AlarmManager & Notification Engine:
 * - Wakes phone and rings continuous alarm audio stream (USAGE_ALARM) even when locked/silent
 * - Native Lock-Screen Heads-Up HUD with direct Snooze (5m) and Dismiss actions
 * - Auto-restores all proactive alarms and reminders on device reboot
 */
public class NotificationAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "LumenNotificationAlarm";
    public static final String ACTION_TRIGGER_NOTIFICATION = "com.meshmind.lumen.ACTION_TRIGGER_NOTIFICATION";
    public static final String ACTION_DISMISS_ALARM = "com.meshmind.lumen.ACTION_DISMISS_ALARM";
    public static final String ACTION_SNOOZE_ALARM = "com.meshmind.lumen.ACTION_SNOOZE_ALARM";
    public static final String PREFS_NAME = "LumenNotificationSchedules";
    public static final String KEY_SCHEDULES_JSON = "saved_schedules";

    // Channels
    public static final String CHANNEL_ALARMS = "lumen_alarms";
    public static final String CHANNEL_ALERTS = "lumen_alerts";
    public static final String CHANNEL_HYDRATION = "lumen_hydration";
    public static final String CHANNEL_MOVEMENT = "lumen_movement";
    public static final String CHANNEL_BRIEFING = "lumen_briefing";
    public static final String CHANNEL_SCREENTIME = "lumen_screentime";
    public static final String CHANNEL_NUTRITION = "lumen_nutrition";

    // Static ringtone, player and wakelock holders
    private static MediaPlayer sActivePlayer = null;
    private static Ringtone sActiveRingtone = null;
    private static PowerManager.WakeLock sWakeLock = null;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "NotificationAlarmReceiver triggered with action: " + action);

        // 1. Device Reboot / Package update recovery
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            rearmSchedulesOnBoot(context);
            return;
        }

        int id = intent.getIntExtra("id", (int) (System.currentTimeMillis() % 100000));
        String title = intent.getStringExtra("title");
        if (title == null || title.isEmpty()) {
            title = "Lumen Alarm";
        }

        // 2. Direct Dismiss Action from Lock Screen / Notification
        if (ACTION_DISMISS_ALARM.equals(action)) {
            Log.i(TAG, "Dismissing alarm #" + id);
            stopActiveRingtone();
            NotificationManagerCompat.from(context).cancel(id);
            return;
        }

        // 3. Direct Snooze Action (5 minutes) from Lock Screen / Notification
        if (ACTION_SNOOZE_ALARM.equals(action)) {
            Log.i(TAG, "Snoozing alarm #" + id + " for 5 minutes");
            stopActiveRingtone();
            NotificationManagerCompat.from(context).cancel(id);

            long snoozeTrigger = System.currentTimeMillis() + (5 * 60 * 1000L);
            scheduleNextAlarm(context, id, title, "⏰ Snoozed alarm (5 min)", CHANNEL_ALARMS, snoozeTrigger, 0L, true);

            try {
                Toast.makeText(context, "Alarm snoozed for 5 minutes", Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {}
            return;
        }

        // 4. Trigger Alarm / Notification
        if (ACTION_TRIGGER_NOTIFICATION.equals(action)) {
            String body = intent.getStringExtra("body");
            String channelId = intent.getStringExtra("channelId");
            long intervalMillis = intent.getLongExtra("intervalMillis", 0L);
            boolean isAlarm = intent.getBooleanExtra("isAlarm", false) || CHANNEL_ALARMS.equals(channelId);

            if (channelId == null || channelId.isEmpty()) {
                channelId = isAlarm ? CHANNEL_ALARMS : CHANNEL_ALERTS;
            }

            // Ensure notification channels exist
            createNotificationChannels(context);

            // Deliver notification or full loud phone alarm
            showNotification(context, id, title, body, channelId, isAlarm);

            // If repeating interval is requested (e.g. daily 24h, or hydration every 2h), reschedule next occurrence
            if (intervalMillis > 0) {
                long nextTrigger = System.currentTimeMillis() + intervalMillis;
                scheduleNextAlarm(context, id, title, body, channelId, nextTrigger, intervalMillis, isAlarm);
            }
        }
    }

    public static synchronized void acquireWakeLock(Context context, long timeoutMs) {
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                if (sWakeLock != null && sWakeLock.isHeld()) {
                    sWakeLock.release();
                }
                int flags = PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP;
                sWakeLock = pm.newWakeLock(flags, "Lumen::AlarmWakeLock");
                sWakeLock.acquire(timeoutMs);
                Log.i(TAG, "Acquired WakeLock for " + timeoutMs + "ms");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock: " + e.getMessage());
        }
    }

    public static synchronized void playAlarmSound(Context context) {
        stopActiveRingtone();
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            sActivePlayer = new MediaPlayer();
            sActivePlayer.setDataSource(context, alarmUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                sActivePlayer.setAudioAttributes(attrs);
            } else {
                sActivePlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }

            sActivePlayer.setLooping(true);
            sActivePlayer.prepare();
            sActivePlayer.start();
            Log.i(TAG, "Playing looping alarm via MediaPlayer (USAGE_ALARM)");

            // Safety timeout: automatically silence after 90 seconds if untouched
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    stopActiveRingtone();
                }
            }, 90000);
        } catch (Exception e) {
            Log.e(TAG, "MediaPlayer failed for alarm, falling back to RingtoneManager: " + e.getMessage());
            try {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                sActiveRingtone = RingtoneManager.getRingtone(context, alarmUri);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    sActiveRingtone.setLooping(true);
                }
                sActiveRingtone.play();
            } catch (Exception ex) {
                Log.e(TAG, "RingtoneManager fallback failed: " + ex.getMessage());
            }
        }
    }

    public static synchronized void stopActiveRingtone() {
        try {
            if (sActivePlayer != null) {
                if (sActivePlayer.isPlaying()) {
                    sActivePlayer.stop();
                }
                sActivePlayer.release();
                sActivePlayer = null;
                Log.i(TAG, "Stopped MediaPlayer alarm");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping active player: " + e.getMessage());
            sActivePlayer = null;
        }

        try {
            if (sActiveRingtone != null) {
                if (sActiveRingtone.isPlaying()) {
                    sActiveRingtone.stop();
                }
                sActiveRingtone = null;
                Log.i(TAG, "Stopped Ringtone alarm");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping active ringtone: " + e.getMessage());
            sActiveRingtone = null;
        }

        try {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
                sWakeLock = null;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error releasing wake lock: " + e.getMessage());
        }
    }

    public static void showNotification(Context context, int id, String title, String body, String channelId) {
        showNotification(context, id, title, body, channelId, CHANNEL_ALARMS.equals(channelId));
    }

    public static void showNotification(Context context, int id, String title, String body, String channelId, boolean isAlarm) {
        try {
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                Log.w(TAG, "Notifications are disabled at the OS level");
                return;
            }

            createNotificationChannels(context);

            if (isAlarm) {
                // Wake the screen & CPU
                acquireWakeLock(context, 30000);
                // Play loud continuous alarm tone
                playAlarmSound(context);
            }

            // Launch MainActivity when tapped
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra("notification_id", id);
            openIntent.putExtra("notification_channel", channelId);
            openIntent.putExtra("alarm_id", id);
            openIntent.putExtra("alarm_title", title);
            openIntent.putExtra("is_ringing", isAlarm);

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                id,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            // Action: Snooze (5m)
            Intent snoozeIntent = new Intent(context, NotificationAlarmReceiver.class);
            snoozeIntent.setAction(ACTION_SNOOZE_ALARM);
            snoozeIntent.putExtra("id", id);
            snoozeIntent.putExtra("title", title);
            PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                id + 100000,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            // Action: Dismiss
            Intent dismissIntent = new Intent(context, NotificationAlarmReceiver.class);
            dismissIntent.setAction(ACTION_DISMISS_ALARM);
            dismissIntent.putExtra("id", id);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                context,
                id + 200000,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Uri defaultSoundUri = isAlarm
                ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(contentPendingIntent)
                .setSound(defaultSoundUri)
                .setColor(Color.parseColor("#10b981"));

            if (isAlarm) {
                // High-priority Heads-up alarm configuration
                builder.setPriority(NotificationCompat.PRIORITY_MAX)
                       .setCategory(NotificationCompat.CATEGORY_ALARM)
                       .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                       .setOngoing(true)
                       .setAutoCancel(false)
                       .setFullScreenIntent(contentPendingIntent, true)
                       .setDeleteIntent(dismissPendingIntent)
                       .setVibrate(new long[]{0, 800, 400, 800, 400, 1000})
                       .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze (5m)", snoozePendingIntent)
                       .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent);
            } else {
                builder.setPriority(NotificationCompat.PRIORITY_HIGH)
                       .setCategory(NotificationCompat.CATEGORY_REMINDER)
                       .setAutoCancel(true)
                       .setVibrate(new long[]{0, 250, 150, 250});
            }

            NotificationManagerCompat.from(context).notify(id, builder.build());
            Log.i(TAG, (isAlarm ? "Alarm" : "Notification") + " #" + id + " displayed successfully: " + title);
        } catch (Exception e) {
            Log.e(TAG, "Error displaying notification: " + e.getMessage(), e);
        }
    }

    public static void scheduleNextAlarm(Context context, int id, String title, String body, String channelId, long triggerAtMillis, long intervalMillis) {
        scheduleNextAlarm(context, id, title, body, channelId, triggerAtMillis, intervalMillis, CHANNEL_ALARMS.equals(channelId));
    }

    public static void scheduleNextAlarm(Context context, int id, String title, String body, String channelId, long triggerAtMillis, long intervalMillis, boolean isAlarm) {
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
            intent.putExtra("isAlarm", isAlarm);

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

            Log.i(TAG, "Scheduled alarm #" + id + " (isAlarm=" + isAlarm + ") for " + triggerAtMillis + " ms");
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

            stopActiveRingtone();
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
                boolean isAlarm = obj.optBoolean("isAlarm", CHANNEL_ALARMS.equals(channelId));

                if (triggerAtMillis <= now) {
                    if (intervalMillis > 0) {
                        while (triggerAtMillis <= now) {
                            triggerAtMillis += intervalMillis;
                        }
                    } else {
                        continue;
                    }
                }

                scheduleNextAlarm(context, id, title, body, channelId, triggerAtMillis, intervalMillis, isAlarm);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error re-arming schedules on boot: " + e.getMessage(), e);
        }
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        // 1. Loud Phone Alarms Channel
        NotificationChannel alarms = new NotificationChannel(
            CHANNEL_ALARMS,
            "Lumen Alarms & Wakeups",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarms.setDescription("Continuous ringing wakeups and critical alarms");
        alarms.enableLights(true);
        alarms.setLightColor(Color.MAGENTA);
        alarms.enableVibration(true);
        alarms.setVibrationPattern(new long[]{0, 800, 400, 800, 400, 1000});
        alarms.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        alarms.setBypassDnd(true);

        AudioAttributes alarmAudioAttrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        Uri alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSoundUri == null) {
            alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        alarms.setSound(alarmSoundUri, alarmAudioAttrs);

        // 2. Critical Biomarker Alerts
        NotificationChannel alerts = new NotificationChannel(
            CHANNEL_ALERTS,
            "Lumen Critical Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        alerts.setDescription("Urgent health alerts and bio-metric anomalies");
        alerts.enableLights(true);
        alerts.setLightColor(Color.RED);
        alerts.enableVibration(true);

        // 3. Hydration Reminders
        NotificationChannel hydration = new NotificationChannel(
            CHANNEL_HYDRATION,
            "Hydration Prompts",
            NotificationManager.IMPORTANCE_HIGH
        );
        hydration.setDescription("Intelligent cellular fluid intake and hydration reminders");
        hydration.enableLights(true);
        hydration.setLightColor(Color.CYAN);
        hydration.enableVibration(true);

        // 4. Movement & Sedentary
        NotificationChannel movement = new NotificationChannel(
            CHANNEL_MOVEMENT,
            "Inactivity & Movement Alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        movement.setDescription("Sedentary break reminders and daily step quota progress");
        movement.enableLights(true);
        movement.setLightColor(Color.GREEN);

        // 5. Daily Bio-Briefing
        NotificationChannel briefing = new NotificationChannel(
            CHANNEL_BRIEFING,
            "Daily Bio-Briefings",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        briefing.setDescription("Morning readiness briefings and nightly sleep wind-down");

        // 6. Digital Wellbeing & Screen Time
        NotificationChannel wellbeing = new NotificationChannel(
            CHANNEL_SCREENTIME,
            "Digital Wellbeing & Screen Limits",
            NotificationManager.IMPORTANCE_HIGH
        );
        wellbeing.setDescription("Daily mindful screen time thresholds and focus session notifications");

        // 7. Nutrition & Meals
        NotificationChannel nutrition = new NotificationChannel(
            CHANNEL_NUTRITION,
            "Nutrition & Meal Prompts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        nutrition.setDescription("Meal logging prompts and macronutrient tracking");

        manager.createNotificationChannel(alarms);
        manager.createNotificationChannel(alerts);
        manager.createNotificationChannel(hydration);
        manager.createNotificationChannel(movement);
        manager.createNotificationChannel(briefing);
        manager.createNotificationChannel(wellbeing);
        manager.createNotificationChannel(nutrition);
    }
}
