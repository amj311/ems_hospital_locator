package com.simplyoliveapps.beacon;

import android.os.Bundle; // Import this
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebView; // Import this
import com.getcapacitor.BridgeActivity;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {
	@Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for all WebViews in the app
        WebView.setWebContentsDebuggingEnabled(true);
    }

    @Override
    public void onResume() {
        super.onResume();
        startLocationServiceIfPermitted();
    }

    private void startLocationServiceIfPermitted() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) return;

        Intent service = new Intent(this, LocationPublishingService.class)
            .setAction(LocationPublishingService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, service);
        } else {
            startService(service);
        }
    }
}
