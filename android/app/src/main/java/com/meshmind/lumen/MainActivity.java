package com.meshmind.lumen;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WearableBlePlugin.class);
        registerPlugin(DigitalWellbeingPlugin.class);
        registerPlugin(StepCounterPlugin.class);
        registerPlugin(LumenNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        handleOAuthIntent(getIntent());
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOAuthIntent(intent);
        handleAlarmIntent(intent);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null) return;
        final int alarmId = intent.getIntExtra("alarm_id", 0);
        final boolean isRinging = intent.getBooleanExtra("is_ringing", false);
        final String channel = intent.getStringExtra("notification_channel");
        if (alarmId > 0 || isRinging || "lumen_alarms".equals(channel)) {
            String title = intent.getStringExtra("alarm_title");
            if (title == null || title.isEmpty()) {
                title = "Lumen Health Alarm";
            }
            final String safeTitle = title.replace("\\", "\\\\").replace("'", "\\'");
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        String js = "window.dispatchEvent(new CustomEvent('lumenAlarmRinging', { detail: { id: " + alarmId + ", title: '" + safeTitle + "' } }));";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                });
            }
        }
    }

    private void handleOAuthIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null) {
            final String uriStr = data.toString();
            if (uriStr.contains("access_token") || uriStr.contains("id_token") || uriStr.startsWith("lumen://")) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(new Runnable() {
                        @Override
                        public void run() {
                            String escaped = uriStr.replace("\\", "\\\\").replace("'", "\\'");
                            String js = "window.dispatchEvent(new CustomEvent('googleOAuthRedirect', { detail: '" + escaped + "' }));";
                            getBridge().getWebView().evaluateJavascript(js, null);
                        }
                    });
                }
            }
        }
    }
}
