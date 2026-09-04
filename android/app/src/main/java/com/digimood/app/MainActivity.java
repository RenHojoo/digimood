package com.digimood.app;

import android.os.Bundle;
import android.graphics.Color;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins before the bridge loads
        registerPlugin(FileExportPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(30, 30, 30));
        getWindow().setNavigationBarColor(Color.rgb(30, 30, 30));
    }
}
