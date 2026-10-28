package com.meshmind.lumen;

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
    }
}

