package com.meshmind.lumen;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

/**
 * Boot receiver that restarts the StepCounterService after phone reboots
 * or app package updates.
 */
public class StepBootReceiver extends BroadcastReceiver {

    private static final String TAG = "StepBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "Received broadcast action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            if (StepCounterService.isTrackingEnabled(context)) {
                Log.i(TAG, "Starting StepCounterService on device boot");
                Intent serviceIntent = new Intent(context, StepCounterService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}
