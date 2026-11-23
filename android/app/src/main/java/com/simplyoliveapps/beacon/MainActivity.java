package com.simplyoliveapps.beacon;

import android.os.Bundle; // Import this
import android.webkit.WebView; // Import this
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for all WebViews in the app
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
