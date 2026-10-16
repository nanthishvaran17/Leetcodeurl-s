package org.nandhaengg.leetcodesync;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
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
        String action = intent.getStringExtra("LocalNotificationUserAction");
        if (action == null || action.isEmpty()) return;

        String notifObj = intent.getStringExtra("LocalNotificationObject");
        if (notifObj == null || notifObj.isEmpty()) return;

        try {
            JSONObject json = new JSONObject(notifObj);
            JSONObject extra = json.optJSONObject("extra");
            String filename = extra != null ? extra.optString("filename", "") : json.optString("body", "");
            String filePath = extra != null ? extra.optString("filePath", extra.optString("localFileUri", "")) : "";
            String mimeType = extra != null ? extra.optString("mimeType", "") : "";

            if (filePath.isEmpty() && filename.isEmpty()) return;

            String lowerAction = action.toLowerCase();
            if (lowerAction.contains("share")) {
                DocumentOpenerPlugin.nativeShareFile(this, filePath, filename, mimeType);
            } else if (lowerAction.contains("open") || lowerAction.equals("tap")) {
                DocumentOpenerPlugin.nativeOpenFile(this, filePath, filename, mimeType);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
