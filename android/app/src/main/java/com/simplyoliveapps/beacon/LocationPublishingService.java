package com.simplyoliveapps.beacon;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Foreground Android location listener and encrypted location publisher. */
public class LocationPublishingService extends Service implements LocationListener {
    static final String ACTION_START = "com.simplyoliveapps.beacon.location.START";

    private static final String CHANNEL_ID = "background_location_status";
    private static final int NOTIFICATION_ID = 6104;
    private static final String LAST_PUBLISH_KEY = "beacon__device_last_publish";
    private static final String SESSION_KEY = "beacon__device_session_token";
    private static final String CREDENTIALS_KEY = "beacon__device_credentials";
    private static final String LINKED_DEVICES_KEY = "beacon__linked_devices";
    private static final long MOVEMENT_TRIGGER_RADIUS_M = 50L;
    private static final long MIN_PUBLISH_INTERVAL_MS = 60_000L;
    private static final long REGULAR_PUBLISH_INTERVAL_MS = 600_000L;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private LocationManager locationManager;
    private String apiBaseUrl;
    private String deviceId;
    private volatile boolean stopping;
    private boolean locationUpdatesActive;
    private final Runnable reconcileRunnable = new Runnable() {
        @Override
        public void run() {
            worker.execute(() -> {
                boolean shouldListen = isSharingConfigured();
                if (shouldListen) requestLocationUpdates();
                else removeLocationUpdates();
            });
            mainHandler.postDelayed(this, 60_000L);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        createNotificationChannel();
        startInForeground();
        mainHandler.post(reconcileRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        apiBaseUrl = BuildConfig.API_BASE_URL;
        stopping = false;
        return START_STICKY;
    }

    @Override
    public void onLocationChanged(Location location) {
        processLocation(location);
    }

    private void processLocation(Location location) {
        worker.execute(() -> {
            if (stopping) return;
            try {
                publishIfNeeded(location);
            } catch (Exception ignored) {
                // Do not log location, credentials, or key material. A later fix retries publishing.
            }
        });
    }

    private void publishIfNeeded(Location location) throws Exception {
        try (NativeStorage storage = new NativeStorage(this)) {
            JSONObject last = storage.getJson(LAST_PUBLISH_KEY);
            boolean shouldPublish = last == null;
            if (last != null) {
                JSONObject lastCoords = last.optJSONObject("coords");
                if (lastCoords == null) return;
                double distance = distanceInMeters(
                    location.getLatitude(), location.getLongitude(),
                    lastCoords.getDouble("latitude"), lastCoords.getDouble("longitude")
                );
                long elapsed = location.getTime() - last.optLong("timestamp", 0L);
                shouldPublish = (distance >= MOVEMENT_TRIGGER_RADIUS_M && elapsed >= MIN_PUBLISH_INTERVAL_MS)
                    || elapsed >= REGULAR_PUBLISH_INTERVAL_MS;
            }
            if (!shouldPublish) return;

            JSONObject credentials = storage.getJson(CREDENTIALS_KEY);
            deviceId = credentials == null ? null : credentials.optString("device_id", null);
            JSONObject session = getValidSession(storage);
            String accessToken = session == null ? null : session.optString("access_token", null);
            if (deviceId == null || deviceId.isEmpty() || accessToken == null || accessToken.isEmpty()) return;

            JSONArray linkedIds = storage.getJsonArray(LINKED_DEVICES_KEY);
            boolean publishedAll = true;
            for (int i = 0; i < linkedIds.length(); i++) {
                String linkedDeviceId = linkedIds.optString(i, null);
                if (linkedDeviceId == null) continue;
                JSONObject linked = storage.getJson("beacon__linked_device_data__" + linkedDeviceId);
                if (linked == null || !linked.optBoolean("sharingMine", false)) continue;
                JSONObject config = linked.optJSONObject("config");
                String groupKey64 = config == null ? null : config.optString("groupKey", null);
                if (groupKey64 == null || groupKey64.isEmpty()) {
                    publishedAll = false;
                    continue;
                }

                JSONObject body = new JSONObject();
                body.put("acting_device_id", deviceId);
                body.put("to_device_id", linkedDeviceId);
                body.put("location", LocationCrypto.encrypt(LocationCrypto.fromBase64Url(groupKey64), buildTimelineNode(location)));
                int statusCode = postLocation(body, accessToken);
                if (statusCode == HttpURLConnection.HTTP_UNAUTHORIZED) {
                    JSONObject refreshed = refreshSession(storage);
                    String refreshedToken = refreshed == null ? null : refreshed.optString("access_token", null);
                    if (refreshedToken == null || refreshedToken.isEmpty()) return;
                    statusCode = postLocation(body, refreshedToken);
                }
                if (statusCode < 200 || statusCode >= 300) publishedAll = false;
            }

            if (publishedAll) storage.setJson(LAST_PUBLISH_KEY, buildStoredPosition(location));
        }
    }

    private void requestLocationUpdates() {
        if (locationManager == null || locationUpdatesActive) return;
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            removeLocationUpdates();
            return;
        }
        try {
            List<String> providers = locationManager.getProviders(true);
            for (String provider : providers) {
                if (!fine && !LocationManager.NETWORK_PROVIDER.equals(provider)) continue;
                if (!LocationManager.GPS_PROVIDER.equals(provider) && !LocationManager.NETWORK_PROVIDER.equals(provider)) continue;
                locationManager.requestLocationUpdates(provider, 60_000L, 0f, this, Looper.getMainLooper());
                locationUpdatesActive = true;
            }
        } catch (SecurityException ignored) {
            removeLocationUpdates();
        }
    }

    private boolean isSharingConfigured() {
        try (NativeStorage storage = new NativeStorage(this)) {
            JSONObject credentials = storage.getJson(CREDENTIALS_KEY);
            if (credentials == null || credentials.optString("device_id", "").isEmpty()) return false;
            JSONObject session = getValidSession(storage);
            if (session == null || session.optString("access_token", "").isEmpty()) return false;
            JSONArray linkedIds = storage.getJsonArray(LINKED_DEVICES_KEY);
            for (int i = 0; i < linkedIds.length(); i++) {
                JSONObject linked = storage.getJson("beacon__linked_device_data__" + linkedIds.optString(i));
                JSONObject config = linked == null ? null : linked.optJSONObject("config");
                if (linked != null && linked.optBoolean("sharingMine", false)
                    && config != null && !config.optString("groupKey", "").isEmpty()) return true;
            }
            return false;
        } catch (Exception ignored) {
            // SQLite may not have been initialized yet; check again after a later timer tick.
            return false;
        }
    }

    private void removeLocationUpdates() {
        if (locationManager == null || !locationUpdatesActive) return;
        locationManager.removeUpdates(this);
        locationUpdatesActive = false;
    }

    private JSONObject getValidSession(NativeStorage storage) throws Exception {
        JSONObject session = storage.getJson(SESSION_KEY);
        if (session == null) return null;
        if (session.optLong("expires_at_ms", 0L) > System.currentTimeMillis()) return session;
        return refreshSession(storage);
    }

    private JSONObject refreshSession(NativeStorage storage) throws Exception {
        JSONObject session = storage.getJson(SESSION_KEY);
        if (session == null) return null;
        String refreshToken = session.optString("refresh_token", null);
        if (refreshToken == null || refreshToken.isEmpty()
            || session.optLong("refresh_token_expires_at", 0L) <= System.currentTimeMillis()) return null;
        JSONObject credentials = storage.getJson(CREDENTIALS_KEY);
        String id = credentials == null ? null : credentials.optString("device_id", null);
        if (id == null || id.isEmpty()) return null;

        JSONObject body = new JSONObject();
        body.put("device_id", id);
        body.put("refresh_token_hash", base64Url(MessageDigest.getInstance("SHA-256").digest(refreshToken.getBytes(StandardCharsets.UTF_8))));
        JSONObject result = postJson(apiBaseUrl.replaceAll("/+$", "") + "/auth/session-refresh", body, null);
        JSONObject renewed = result == null ? null : result.optJSONObject("data");
        if (renewed == null || !result.optBoolean("success", false)) return null;
        storage.setJson(SESSION_KEY, renewed);
        return renewed;
    }

    private int postLocation(JSONObject body, String accessToken) throws Exception {
        JSONObject result = postJson(apiBaseUrl.replaceAll("/+$", "") + "/shares/location", body, accessToken);
        return result == null ? HttpURLConnection.HTTP_INTERNAL_ERROR : result.optInt("_httpStatus", HttpURLConnection.HTTP_INTERNAL_ERROR);
    }

    private JSONObject postJson(String endpoint, JSONObject body, String accessToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(15_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (accessToken != null) {
                connection.setRequestProperty("Authorization", base64Url(MessageDigest.getInstance("SHA-256").digest(accessToken.getBytes(StandardCharsets.UTF_8))));
            }
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (BufferedOutputStream output = new BufferedOutputStream(connection.getOutputStream())) {
                output.write(bytes);
            }
            int status = connection.getResponseCode();
            InputStream response = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            JSONObject parsed = null;
            if (response != null) {
                try (InputStream input = response; java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
                    byte[] buffer = new byte[2048];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    if (output.size() > 0) parsed = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
                }
            }
            if (parsed == null) parsed = new JSONObject();
            parsed.put("_httpStatus", status);
            return parsed;
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject buildTimelineNode(Location location) throws Exception {
        JSONObject node = new JSONObject();
        node.put("timestamp", location.getTime());
        node.put("latitude", location.getLatitude());
        node.put("longitude", location.getLongitude());
        node.put("speed", location.hasSpeed() ? (double) location.getSpeed() : JSONObject.NULL);
        node.put("accuracy", location.hasAccuracy() ? (double) location.getAccuracy() : JSONObject.NULL);
        return node;
    }

    private JSONObject buildStoredPosition(Location location) throws Exception {
        JSONObject coords = new JSONObject();
        coords.put("latitude", location.getLatitude());
        coords.put("longitude", location.getLongitude());
        coords.put("accuracy", location.hasAccuracy() ? (double) location.getAccuracy() : JSONObject.NULL);
        coords.put("speed", location.hasSpeed() ? (double) location.getSpeed() : JSONObject.NULL);
        JSONObject position = new JSONObject();
        position.put("coords", coords);
        position.put("timestamp", location.getTime());
        return position;
    }

    private static double distanceInMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return 6_371_000d * 2d * Math.asin(Math.sqrt(a));
    }

    private void startInForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent activityIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(R.drawable.ic_location_notification)
            .setContentTitle("Location sharing is active")
            .setContentText("Beacon is securely sharing updates with linked devices")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Background location sharing",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Shows when Beacon's background location service is running");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.enableLights(false);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        stopping = true;
        mainHandler.removeCallbacks(reconcileRunnable);
        removeLocationUpdates();
        worker.shutdownNow();
        stopForeground(true);
        super.onDestroy();
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public IBinder onBind(Intent intent) { return null; }

    private static String base64Url(byte[] value) {
        return android.util.Base64.encodeToString(value, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP | android.util.Base64.NO_PADDING);
    }
}