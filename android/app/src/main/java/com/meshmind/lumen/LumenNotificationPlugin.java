package com.meshmind.lumen;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Lumen Native Notification Plugin for Capacitor
 * 
 * Provides production-grade proactive notification management, instant alert
 * dispatch, and persistent Android AlarmManager scheduling.
 */
@CapacitorPlugin(
    name = "LumenNotification",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class LumenNotificationPlugin extends Plugin {

    private static final String TAG = "LumenNotificationPlugin";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Loading LumenNotificationPlugin");
        try {
            NotificationAlarmReceiver.createNotificationChannels(getContext());
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize notification channels", e);
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        boolean areEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        boolean hasPermission = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasPermission = getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED;
        }

        JSObject ret = new JSObject();
        ret.put("granted", areEnabled && hasPermission);
        ret.put("areNotificationsEnabled", areEnabled);
        ret.put("hasRuntimePermission", hasPermission);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermCallback");
                return;
            }
        }

        boolean areEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("granted", areEnabled);
        ret.put("areNotificationsEnabled", areEnabled);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED;
        boolean areEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();

        JSObject ret = new JSObject();
        ret.put("granted", granted && areEnabled);
        ret.put("areNotificationsEnabled", areEnabled);
        ret.put("hasRuntimePermission", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed opening notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void postNotification(PluginCall call) {
        String title = call.getString("title", "Lumen Health Alert");
        String body = call.getString("body", "");
        String channelId = call.getString("channelId", NotificationAlarmReceiver.CHANNEL_ALERTS);
        int id = call.getInt("id", (int) (System.currentTimeMillis() % 100000));

        try {
            NotificationAlarmReceiver.showNotification(getContext(), id, title, body, channelId);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed posting notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void scheduleNotification(PluginCall call) {
        int id = call.getInt("id", (int) (System.currentTimeMillis() % 100000));
        String title = call.getString("title", "Lumen Reminder");
        String body = call.getString("body", "");
        String channelId = call.getString("channelId", NotificationAlarmReceiver.CHANNEL_ALERTS);
        Double triggerDouble = call.getDouble("triggerAtMillis");
        Double intervalDouble = call.getDouble("intervalMillis", 0.0);

        if (triggerDouble == null) {
            call.reject("triggerAtMillis is required");
            return;
        }

        long triggerAtMillis = triggerDouble.longValue();
        long intervalMillis = intervalDouble != null ? intervalDouble.longValue() : 0L;

        try {
            Context context = getContext();
            NotificationAlarmReceiver.scheduleNextAlarm(context, id, title, body, channelId, triggerAtMillis, intervalMillis);

            // Persist to SharedPreferences
            saveScheduleToPrefs(context, id, title, body, channelId, triggerAtMillis, intervalMillis);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            ret.put("triggerAtMillis", (double) triggerAtMillis);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed scheduling notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelNotification(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }

        try {
            Context context = getContext();
            NotificationAlarmReceiver.cancelAlarm(context, id);
            removeScheduleFromPrefs(context, id);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed cancelling notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAllNotifications(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(NotificationAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String json = prefs.getString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, "[]");
            JSONArray array = new JSONArray(json);

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                int id = obj.optInt("id");
                NotificationAlarmReceiver.cancelAlarm(context, id);
            }

            prefs.edit().putString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, "[]").apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed cancelling all notifications: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getScheduledNotifications(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(NotificationAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String json = prefs.getString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, "[]");
            JSONArray array = new JSONArray(json);

            JSArray retArray = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("id", obj.optInt("id"));
                item.put("title", obj.optString("title"));
                item.put("body", obj.optString("body"));
                item.put("channelId", obj.optString("channelId"));
                item.put("triggerAtMillis", (double) obj.optLong("triggerAtMillis"));
                item.put("intervalMillis", (double) obj.optLong("intervalMillis"));
                retArray.put(item);
            }

            JSObject ret = new JSObject();
            ret.put("schedules", retArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed reading scheduled notifications: " + e.getMessage());
        }
    }

    private synchronized void saveScheduleToPrefs(Context context, int id, String title, String body, String channelId, long triggerAtMillis, long intervalMillis) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(NotificationAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String json = prefs.getString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, "[]");
            JSONArray array = new JSONArray(json);

            JSONArray updated = new JSONArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("id") != id) {
                    updated.put(obj);
                }
            }

            JSONObject newObj = new JSONObject();
            newObj.put("id", id);
            newObj.put("title", title);
            newObj.put("body", body);
            newObj.put("channelId", channelId);
            newObj.put("triggerAtMillis", triggerAtMillis);
            newObj.put("intervalMillis", intervalMillis);
            updated.put(newObj);

            prefs.edit().putString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, updated.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed saving schedule to prefs: " + e.getMessage(), e);
        }
    }

    private synchronized void removeScheduleFromPrefs(Context context, int id) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(NotificationAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String json = prefs.getString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, "[]");
            JSONArray array = new JSONArray(json);

            JSONArray updated = new JSONArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("id") != id) {
                    updated.put(obj);
                }
            }

            prefs.edit().putString(NotificationAlarmReceiver.KEY_SCHEDULES_JSON, updated.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed removing schedule from prefs: " + e.getMessage(), e);
        }
    }
}
