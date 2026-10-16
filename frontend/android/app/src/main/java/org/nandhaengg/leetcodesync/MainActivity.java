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
        handleNotificationAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationAction(intent);
    }

    private void handleNotificationAction(Intent intent) {
        if (intent == null) return;

        // 1. Resolve Action ID from all possible Intent extras
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
