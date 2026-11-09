package com.meshmind.lumen;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

/**
 * Lumen 24/7 Midnight Rollover Broadcast Receiver
 * 
 * Fired automatically at 00:00:00 exact local midnight by Android's AlarmManager
 * even when the app is completely closed, minimized, or the phone is in deep Doze mode.
 * 
 * Actions performed:
 * 1. Archives yesterday's completed steps to SharedPreferences history.
 * 2. Resets today's active step count to 0.
 * 3. Updates the foreground service notification to show 0 steps for the new day.
 * 4. Schedules the next midnight alarm for the following night.
 */
public class MidnightRolloverReceiver extends BroadcastReceiver {

    private static final String TAG = "MidnightRolloverRcvr";
    public static final String ACTION_MIDNIGHT_ROLLOVER = "com.meshmind.lumen.ACTION_MIDNIGHT_ROLLOVER";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;

        Log.i(TAG, "⏰ Exact midnight alarm triggered! Executing 00:00:00 daily rollover routine...");

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            try {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Lumen:MidnightRolloverWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(15 * 1000L); // 15 seconds to safely perform rollover and re-arm
            } catch (Exception e) {
                Log.w(TAG, "Could not acquire temporary wake lock: " + e.getMessage());
            }
        }

        try {
            // Perform native midnight rollover
            StepCounterService.performNativeMidnightRollover(context);

            // Re-arm the exact alarm for the following midnight
            StepCounterService.scheduleMidnightAlarm(context);
        } catch (Exception e) {
            Log.e(TAG, "Error executing midnight rollover: " + e.getMessage(), e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }
}
