package com.meshmind.lumen;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lumen Native Step Counter Capacitor Plugin
 * 
 * Controls the 24/7 background pedometer service and delivers real-time
 * hardware step counts to the frontend across app closures and restarts.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(
            alias = "activityRecognition",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        )
    }
)
public class StepCounterPlugin extends Plugin {

    private static final String TAG = "StepCounterPlugin";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Loading StepCounterPlugin");

        // Hook listener to forward native service step updates to JS listeners
        StepCounterService.setStepUpdateListener((steps, distanceKm, calories, cadenceSpm) -> {
            JSObject data = new JSObject();
            data.put("steps", steps);
            data.put("distanceKm", distanceKm);
            data.put("caloriesBurned", calories);
            data.put("cadenceSpm", cadenceSpm);
            data.put("date", StepCounterService.getTodayDateString());
            notifyListeners("stepUpdate", data);
        });

        // Auto-start service if enabled
        Context context = getContext();
        if (context != null && StepCounterService.isTrackingEnabled(context) && hasStepPermission()) {
            startServiceInternal(context);
        }
    }

    private boolean hasStepPermission() {
        Context context = getContext();
        if (context == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // Android 10+
            return ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void startServiceInternal(Context context) {
        try {
            Intent intent = new Intent(context, StepCounterService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting StepCounterService: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkStepPermissions(PluginCall call) {
        boolean granted = hasStepPermission();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("hasHardwareSensor", hasHardwareStepSensor());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestStepPermissions(PluginCall call) {
        if (hasStepPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("alreadyGranted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissionForAlias("activityRecognition", call, "stepPermissionCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void stepPermissionCallback(PluginCall call) {
        boolean granted = hasStepPermission();
        if (granted) {
            Context context = getContext();
            if (context != null) {
                startServiceInternal(context);
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void startBackgroundTracking(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (!hasStepPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                requestPermissionForAlias("activityRecognition", call, "startTrackingAfterPermissionCallback");
                return;
            }
        }

        StepCounterService.setTrackingEnabled(context, true);
        startServiceInternal(context);

        int steps = StepCounterService.getTodaySteps(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("isTracking", true);
        ret.put("steps", steps);
        ret.put("distanceKm", steps * 0.00075);
        ret.put("caloriesBurned", steps * 0.043);
        ret.put("hasHardwareSensor", hasHardwareStepSensor());
        call.resolve(ret);
    }

    @PermissionCallback
    private void startTrackingAfterPermissionCallback(PluginCall call) {
        Context context = getContext();
        if (hasStepPermission() && context != null) {
            StepCounterService.setTrackingEnabled(context, true);
            startServiceInternal(context);
            int steps = StepCounterService.getTodaySteps(context);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("isTracking", true);
            ret.put("steps", steps);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("isTracking", false);
            ret.put("error", "ACTIVITY_RECOGNITION permission was denied");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void stopBackgroundTracking(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            StepCounterService.setTrackingEnabled(context, false);
            Intent intent = new Intent(context, StepCounterService.class);
            context.stopService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("isTracking", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        Context context = getContext();
        int steps = StepCounterService.getTodaySteps(context);
        boolean isTracking = StepCounterService.isTrackingEnabled(context);

        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("distanceKm", Double.parseDouble(String.format(java.util.Locale.US, "%.2f", steps * 0.00075)));
        ret.put("caloriesBurned", Math.round(steps * 0.043));
        ret.put("isTracking", isTracking);
        ret.put("hasHardwareSensor", hasHardwareStepSensor());
        ret.put("date", StepCounterService.getTodayDateString());
        call.resolve(ret);
    }

    private boolean hasHardwareStepSensor() {
        Context context = getContext();
        if (context == null) return false;
        SensorManager sm = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) return false;
        Sensor counter = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        Sensor detector = sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        return counter != null || detector != null;
    }
}
