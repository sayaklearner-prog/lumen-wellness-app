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
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOAuthIntent(intent);
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

