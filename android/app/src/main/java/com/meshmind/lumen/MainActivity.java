package com.meshmind.lumen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WearableBlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

