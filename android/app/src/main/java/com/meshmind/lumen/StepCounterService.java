package com.meshmind.lumen;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Lumen 24/7 Background Step Counter Foreground Service
 * 
 * Runs continuously in the background even when the app is closed, minimized, or screen is off.
 * Hardware-level tracking uses Android's Sensor.TYPE_STEP_COUNTER and Sensor.TYPE_STEP_DETECTOR
 * with fallback to Sensor.TYPE_ACCELEROMETER.
 */
public class StepCounterService extends Service implements SensorEventListener {

    private static final String TAG = "StepCounterService";
    public static final String CHANNEL_ID = "lumen_step_tracker_channel";
    public static final int NOTIFICATION_ID = 10023;
    public static final String PREFS_NAME = "LumenStepPreferences";

    // SharedPreferences Keys
    public static final String KEY_PREF_DATE = "pref_date";
    public static final String KEY_BASE_BOOT_STEPS = "base_boot_steps";
    public static final String KEY_TODAY_STEPS = "today_steps";
    public static final String KEY_REBOOT_OFFSET = "reboot_offset";
    public static final String KEY_TRACKING_ENABLED = "tracking_enabled";

    // Broadcast action for live UI sync
    public static final String ACTION_STEP_UPDATE = "com.meshmind.lumen.ACTION_STEP_UPDATE";

    public interface StepUpdateListener {
        void onStepUpdate(int steps, double distanceKm, double calories, int cadenceSpm);
    }

    private static StepUpdateListener sListener = null;

    public static void setStepUpdateListener(StepUpdateListener listener) {
        sListener = listener;
    }

    private SensorManager mSensorManager;
    private Sensor mStepCounterSensor;
    private Sensor mStepDetectorSensor;
    private Sensor mAccelSensor;

    private boolean mUsingStepCounter = false;
    private boolean mUsingStepDetector = false;
    private boolean mUsingAccelerometer = false;

    private PowerManager.WakeLock mWakeLock = null;

    // Accelerometer peak detection fallback state
    private float mLastMag = 0f;
    private float mAvgMag = 9.81f;
    private long mLastStepTime = 0;
    private int mLastNotifiedSteps = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Creating StepCounterService (24/7 background pedometer)");
        acquireWakeLock();
        createNotificationChannel();
        startForegroundWithNotification(getTodaySteps(this));

        mSensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (mSensorManager != null) {
            registerSensors();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        setTrackingEnabled(this, true);
        acquireWakeLock();
        startForegroundWithNotification(getTodaySteps(this));
        if (mSensorManager != null) {
            registerSensors();
        }
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void acquireWakeLock() {
        if (mWakeLock == null) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    mWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Lumen:StepCounterWakeLock");
                    mWakeLock.setReferenceCounted(false);
                    mWakeLock.acquire(10 * 60 * 1000L); // 10 min window, re-acquired on events
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not acquire partial WakeLock: " + e.getMessage());
            }
        }
    }

    private void releaseWakeLock() {
        try {
            if (mWakeLock != null && mWakeLock.isHeld()) {
                mWakeLock.release();
            }
        } catch (Exception ignored) {
        } finally {
            mWakeLock = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Lumen Background Step Tracker",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Maintains continuous 24/7 step and calorie tracking when app is closed");
                channel.setShowBadge(false);
                channel.enableVibration(false);
                channel.setSound(null, null);
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundWithNotification(int steps) {
        Notification notification = buildNotification(steps);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ (API 34)
                boolean hasActivityRecognition = ContextCompat.checkSelfPermission(
                    this, Manifest.permission.ACTIVITY_RECOGNITION
                ) == PackageManager.PERMISSION_GRANTED;

                int fgsType = hasActivityRecognition 
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH 
                    : ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;

                startForeground(NOTIFICATION_ID, notification, fgsType);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground with specific type failed, falling back: " + e.getMessage());
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ex) {
                Log.e(TAG, "Failed startForeground entirely: " + ex.getMessage());
            }
        }
    }

    private Notification buildNotification(int steps) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
            pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);
        }

        double km = steps * 0.00075;
        double cals = steps * 0.043;
        String contentText = String.format(Locale.getDefault(), "%,d steps today • %.2f km • %.0f kcal", steps, km, cals);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🚶 Lumen Step Tracker Active")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false);

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent);
        }

        return builder.build();
    }

    private void updateNotification(int steps) {
        if (Math.abs(steps - mLastNotifiedSteps) >= 10) {
            mLastNotifiedSteps = steps;
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildNotification(steps));
            }
        }
    }

    private void registerSensors() {
        if (mSensorManager == null) return;

        // 1. Hardware Step Counter (counts total cumulative steps since phone boot - lowest power)
        mStepCounterSensor = mSensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (mStepCounterSensor != null) {
            boolean ok = mSensorManager.registerListener(this, mStepCounterSensor, SensorManager.SENSOR_DELAY_UI);
            if (ok) {
                mUsingStepCounter = true;
                Log.i(TAG, "Registered hardware Sensor.TYPE_STEP_COUNTER");
                return;
            }
        }

        // 2. Hardware Step Detector (triggers event per detected step)
        mStepDetectorSensor = mSensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        if (mStepDetectorSensor != null) {
            boolean ok = mSensorManager.registerListener(this, mStepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
            if (ok) {
                mUsingStepDetector = true;
                Log.i(TAG, "Registered hardware Sensor.TYPE_STEP_DETECTOR");
                return;
            }
        }

        // 3. Accelerometer fallback
        mAccelSensor = mSensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (mAccelSensor != null) {
            boolean ok = mSensorManager.registerListener(this, mAccelSensor, SensorManager.SENSOR_DELAY_UI);
            if (ok) {
                mUsingAccelerometer = true;
                Log.i(TAG, "Registered fallback Sensor.TYPE_ACCELEROMETER");
            }
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values == null || event.values.length == 0) return;

        int sensorType = event.sensor.getType();

        if (sensorType == Sensor.TYPE_STEP_COUNTER) {
            int hardwareSteps = (int) event.values[0];
            handleHardwareStepCounter(hardwareSteps);
        } else if (sensorType == Sensor.TYPE_STEP_DETECTOR) {
            if (event.values[0] == 1.0f) {
                incrementTodaySteps(1);
            }
        } else if (sensorType == Sensor.TYPE_ACCELEROMETER) {
            handleAccelerometerSample(event.values);
        }
    }

    private void handleHardwareStepCounter(int rawBootSteps) {
        String today = getTodayDateString();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String savedDate = prefs.getString(KEY_PREF_DATE, "");
        int baseBootSteps = prefs.getInt(KEY_BASE_BOOT_STEPS, -1);
        int rebootOffset = prefs.getInt(KEY_REBOOT_OFFSET, 0);
        int currentTodaySteps = prefs.getInt(KEY_TODAY_STEPS, 0);

        if (!today.equals(savedDate) || baseBootSteps == -1) {
            // New day or first run: set today's baseline, preserving any prior steps logged today
            prefs.edit()
                .putString(KEY_PREF_DATE, today)
                .putInt(KEY_BASE_BOOT_STEPS, rawBootSteps)
                .putInt(KEY_REBOOT_OFFSET, currentTodaySteps)
                .apply();
            notifySteps(currentTodaySteps);
            return;
        }

        // Check if device rebooted today (rawBootSteps resets to 0 upon phone reboot)
        if (rawBootSteps < baseBootSteps) {
            rebootOffset += currentTodaySteps;
            baseBootSteps = rawBootSteps;
            prefs.edit()
                .putInt(KEY_BASE_BOOT_STEPS, baseBootSteps)
                .putInt(KEY_REBOOT_OFFSET, rebootOffset)
                .apply();
        }

        int calculatedSteps = Math.max(0, (rawBootSteps - baseBootSteps) + rebootOffset);
        // Ensure steps never decrease below current today steps
        int finalSteps = Math.max(calculatedSteps, currentTodaySteps);
        prefs.edit().putInt(KEY_TODAY_STEPS, finalSteps).apply();

        notifySteps(finalSteps);
    }

    private synchronized void incrementTodaySteps(int delta) {
        String today = getTodayDateString();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String savedDate = prefs.getString(KEY_PREF_DATE, "");
        int currentSteps = 0;
        if (today.equals(savedDate)) {
            currentSteps = prefs.getInt(KEY_TODAY_STEPS, 0);
        }

        int newTotal = currentSteps + delta;
        prefs.edit()
            .putString(KEY_PREF_DATE, today)
            .putInt(KEY_TODAY_STEPS, newTotal)
            .apply();

        notifySteps(newTotal);
    }

    private void handleAccelerometerSample(float[] values) {
        float x = values[0];
        float y = values[1];
        float z = values[2];

        float mag = (float) Math.sqrt(x * x + y * y + z * z);
        mAvgMag = mAvgMag * 0.9f + mag * 0.1f;
        float netMag = Math.abs(mag - mAvgMag);

        long now = System.currentTimeMillis();
        // Calibrated gait thresholds: 1.20 m/s^2 dynamic peak and 380ms minimum step interval
        // Prevents over-counting from hand sway, micro-vibrations, or foot recoil
        if (netMag > 1.20f && netMag < 8.5f) {
            if (mag > mLastMag && (now - mLastStepTime) >= 380) {
                mLastStepTime = now;
                incrementTodaySteps(1);
            }
        }
        mLastMag = mag;
    }

    private void notifySteps(int steps) {
        updateNotification(steps);

        double km = steps * 0.00075;
        double cals = steps * 0.043;
        int cadence = 0;

        if (sListener != null) {
            try {
                sListener.onStepUpdate(steps, km, cals, cadence);
            } catch (Exception e) {
                Log.w(TAG, "Listener exception: " + e.getMessage());
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No-op
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "Destroying StepCounterService");
        releaseWakeLock();
        if (mSensorManager != null) {
            mSensorManager.unregisterListener(this);
        }

        // If tracking was still enabled, restart service
        if (isTrackingEnabled(this)) {
            Log.i(TAG, "Auto-restarting StepCounterService via restart intent");
            Intent restartIntent = new Intent(getApplicationContext(), StepCounterService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent);
            } else {
                startService(restartIntent);
            }
        }
    }

    // Static helper to query today's steps directly from SharedPreferences
    public static int getTodaySteps(Context context) {
        if (context == null) return 0;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = getTodayDateString();
        String savedDate = prefs.getString(KEY_PREF_DATE, "");
        if (today.equals(savedDate)) {
            return prefs.getInt(KEY_TODAY_STEPS, 0);
        }
        return 0;
    }

    // Static helper to baseline or synchronize today's steps from external tracker
    public static void setInitialStepsToday(Context context, int initialSteps) {
        if (context == null || initialSteps <= 0) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = getTodayDateString();
        String savedDate = prefs.getString(KEY_PREF_DATE, "");
        int currentSteps = 0;
        if (today.equals(savedDate)) {
            currentSteps = prefs.getInt(KEY_TODAY_STEPS, 0);
        }
        if (initialSteps > currentSteps) {
            prefs.edit()
                .putString(KEY_PREF_DATE, today)
                .putInt(KEY_TODAY_STEPS, initialSteps)
                .apply();
        }
    }

    public static boolean isTrackingEnabled(Context context) {
        if (context == null) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_TRACKING_ENABLED, true);
    }

    public static void setTrackingEnabled(Context context, boolean enabled) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, enabled).apply();
    }

    public static String getTodayDateString() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return sdf.format(new Date());
    }
}
