package org.nandhaengg.leetcodesync;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DocumentOpenerPlugin.class);
        super.onCreate(savedInstanceState);
        configureEdgeToEdgeStatusBar();
        configureWebViewPerformance();
        createNotificationChannels();
        handleNotificationAction(getIntent());
    }

    private void configureWebViewPerformance() {
        try {
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DISPLAY);
            if (getBridge() != null && getBridge().getWebView() != null) {
                android.webkit.WebView webView = getBridge().getWebView();
                android.webkit.WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
                // Hardware accelerated layer for 120Hz smooth scrolling
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(android.view.View.OVER_SCROLL_IF_CONTENT_SCROLLS);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "WebView performance configuration note: " + e.getMessage());
        }
    }

    private void configureEdgeToEdgeStatusBar() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            android.view.Window window = getWindow();
            window.setFlags(
                android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            
            // Seamless OLED dark theme match (#060813)
            int darkThemeColor = android.graphics.Color.parseColor("#060813");
            window.setStatusBarColor(darkThemeColor);
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                window.setNavigationBarColor(darkThemeColor);
            }
        }
    }

    private void createNotificationChannels() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationManager notificationManager = getSystemService(android.app.NotificationManager.class);
            if (notificationManager == null) return;

            String[][] channels = {
                {"messages_channel", "Messages & Chat", "Real-time direct messages, staff discussions, and student chat alerts"},
                {"account_security", "Account & Security", "Critical security alerts, password changes, and account activity"},
                {"contest_updates", "Contest Updates", "Live contest alerts, reminders, and contest result announcements"},
                {"weekly_reports", "Weekly Performance Reports", "Weekly student performance reports and analytical summaries"},
                {"performance_updates", "Performance Milestones", "Rating changes, milestones, and performance velocity updates"},
                {"academic_announcements", "Academic Announcements", "Institutional, department, and academic announcements"},
                {"system_status", "System Status", "Maintenance schedules and system status updates"},
                {"leetcode_intelligence_channel", "LeetCode General Alerts", "General system alerts, role updates, and real-time announcements"}
            };

            android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            android.net.Uri defaultSoundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);

            for (String[] ch : channels) {
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    ch[0],
                    ch[1],
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(ch[2]);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 150, 250});
                channel.enableLights(true);
                channel.setLightColor(android.graphics.Color.parseColor("#3b82f6"));
                channel.setSound(defaultSoundUri, audioAttributes);
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationAction(intent);
    }

    private void handleNotificationAction(Intent intent) {
        if (intent == null) return;

        // 1. Handle Deep Linking / Route Navigation from FCM Push Notifications
        String actionRoute = intent.getStringExtra("actionRoute");
        if (actionRoute == null || actionRoute.isEmpty()) {
            actionRoute = intent.getStringExtra("route");
        }
        if (actionRoute != null && !actionRoute.isEmpty()) {
            final String targetRoute = actionRoute;
            Log.d(TAG, "Navigating to deep link route from notification: " + targetRoute);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = "window.location.hash = ''; " +
                                    "window.history.pushState({}, '', '" + targetRoute + "'); " +
                                    "window.dispatchEvent(new CustomEvent('nec_deep_link_navigate', { detail: { route: '" + targetRoute + "' } }));";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to navigate to deep link: " + e.getMessage());
                }
            }, 1200);
        }

        // 2. Resolve Action ID from all possible Intent extras
        String action = intent.getStringExtra("LocalNotificationUserAction");
        if (action == null || action.isEmpty()) {
            action = intent.getStringExtra("actionId");
        }
        if (action == null || action.isEmpty()) {
            action = intent.getStringExtra("action");
        }
        if (action == null || action.isEmpty()) {
            return;
        }

        Log.d(TAG, "Notification action received: " + action);

        // 2. Resolve Notification JSON
        // IMPORTANT: Capacitor's LocalNotificationManager has an internal typo in its key:
        // public static final String NOTIFICATION_OBJ_INTENT_KEY = "LocalNotficationObject";
        String notifObj = intent.getStringExtra("LocalNotficationObject");
        if (notifObj == null || notifObj.isEmpty()) {
            notifObj = intent.getStringExtra("LocalNotificationObject");
        }
        if (notifObj == null || notifObj.isEmpty()) {
            notifObj = intent.getStringExtra("notification");
        }

        String filename = "";
        String filePath = "";
        String mimeType = "";

        if (notifObj != null && !notifObj.isEmpty()) {
            try {
                JSONObject json = new JSONObject(notifObj);
                JSONObject extra = json.optJSONObject("extra");
                if (extra == null) {
                    extra = json.optJSONObject("data");
                }
                if (extra != null) {
                    filename = extra.optString("filename", "");
                    filePath = extra.optString("filePath", extra.optString("localFileUri", ""));
                    mimeType = extra.optString("mimeType", "");
                }
                if (filename.isEmpty()) {
                    filename = json.optString("body", json.optString("title", ""));
                }
                if (filePath.isEmpty()) {
                    filePath = json.optString("filePath", json.optString("localFileUri", ""));
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to parse notification JSON: " + e.getMessage());
            }
        }

        // Direct intent extra fallbacks
        if (filename.isEmpty()) {
            filename = intent.getStringExtra("filename");
        }
        if (filePath.isEmpty()) {
            filePath = intent.getStringExtra("filePath");
            if (filePath == null || filePath.isEmpty()) {
                filePath = intent.getStringExtra("localFileUri");
            }
        }
        if (mimeType.isEmpty()) {
            mimeType = intent.getStringExtra("mimeType");
        }

        final String finalFilePath = filePath;
        final String finalFilename = filename != null ? filename : "";
        final String finalMimeType = mimeType != null ? mimeType : "";
        final String lowerAction = action.toLowerCase();

        Log.d(TAG, "Handling notification action: action=" + action + ", filename=" + finalFilename + ", filePath=" + finalFilePath);

        // Post to main looper to ensure activity window is attached and ready
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (lowerAction.contains("share")) {
                    Log.d(TAG, "Triggering DocumentOpenerPlugin.nativeShareFile");
                    DocumentOpenerPlugin.nativeShareFile(MainActivity.this, finalFilePath, finalFilename, finalMimeType);
                } else if (lowerAction.contains("open") || lowerAction.equals("tap")) {
                    Log.d(TAG, "Triggering DocumentOpenerPlugin.nativeOpenFile");
                    DocumentOpenerPlugin.nativeOpenFile(MainActivity.this, finalFilePath, finalFilename, finalMimeType);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error executing notification action", e);
            }
        });
    }
}
