package org.nandhaengg.leetcodesync;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Authoritative Android Firebase Cloud Messaging Service.
 * Guarantees reliable notification delivery, heads-up presentation,
 * audio chimes, and deep linking EVEN WHEN THE APP IS COMPLETELY CLOSED OR
 * KILLED.
 */
public class FCMService extends FirebaseMessagingService {
    private static final String TAG = "FCMService";
    private static final String DEFAULT_CHANNEL_ID = "messages_channel";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token generated: " + token);
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception e) {
            Log.w(TAG, "PushNotificationsPlugin onNewToken forward note: " + e.getMessage());
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        // 1. Forward to Capacitor plugin for foreground app listeners
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception e) {
            Log.w(TAG, "PushNotificationsPlugin sendRemoteMessage forward note: " + e.getMessage());
        }

        // 2. Check if Capacitor Push Notifications Plugin instance is alive (App is in
        // foreground)
        try {
            PushNotificationsPlugin pushPlugin = PushNotificationsPlugin.getPushNotificationsInstance();
            if (pushPlugin != null) {
                Log.d(TAG, "App is OPEN in foreground. Handled by Capacitor in-app listeners.");
                return;
            }
        } catch (Exception ignored) {
        }

        // 3. APP IS CLOSED / KILLED!
        // When app is closed, Capacitor does NOT show any notification.
        // We build and display an authoritative native heads-up notification banner
        // with sound and vibration.
        Log.d(TAG, "App is CLOSED / KILLED. Triggering native Android system notification banner.");
        showNativeNotification(remoteMessage);
    }

    private void showNativeNotification(RemoteMessage remoteMessage) {
        try {
            ensureNotificationChannels();

            Map<String, String> data = remoteMessage.getData();
            RemoteMessage.Notification notif = remoteMessage.getNotification();

            String title = null;
            String body = null;
            String channelId = DEFAULT_CHANNEL_ID;

            if (notif != null) {
                title = notif.getTitle();
                body = notif.getBody();
                if (notif.getChannelId() != null && !notif.getChannelId().isEmpty()) {
                    channelId = notif.getChannelId();
                }
            }

            if (title == null || title.isEmpty()) {
                title = data.get("title");
            }
            if (title == null || title.isEmpty()) {
                title = "New Message";
            }

            if (body == null || body.isEmpty()) {
                body = data.get("body");
            }
            if (body == null || body.isEmpty()) {
                body = data.get("content");
            }
            if (body == null || body.isEmpty()) {
                body = "You received a new message.";
            }

            if (data.containsKey("channel_id") && data.get("channel_id") != null && !data.get("channel_id").isEmpty()) {
                channelId = data.get("channel_id");
            } else if (data.containsKey("channelId") && data.get("channelId") != null
                    && !data.get("channelId").isEmpty()) {
                channelId = data.get("channelId");
            } else if (data.containsKey("category") && data.get("category") != null) {
                String cat = data.get("category").toLowerCase();
                if (cat.contains("message")) {
                    channelId = "messages_channel";
                } else if (cat.contains("security") || cat.contains("account")) {
                    channelId = "account_security";
                } else if (cat.contains("contest")) {
                    channelId = "contest_updates";
                } else if (cat.contains("report")) {
                    channelId = "weekly_reports";
                } else {
                    channelId = "academic_announcements";
                }
            }

            // Target Activity when notification is tapped
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            // Pass all data attributes for deep-linking into chat
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }

            String actionRoute = data.get("actionRoute");
            if (actionRoute == null)
                actionRoute = data.get("route");
            if (actionRoute != null) {
                intent.putExtra("actionRoute", actionRoute);
            }

            int requestCode = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                    .setSmallIcon(R.drawable.ic_stat_notification)
                    .setColor(Color.parseColor("#3b82f6"))
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setSound(defaultSoundUri)
                    .setVibrate(new long[] { 0, 250, 150, 250 })
                    .setContentIntent(pendingIntent);

            int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            String notifIdStr = data.get("notificationId");
            if (notifIdStr != null) {
                notificationId = Math.abs(notifIdStr.hashCode());
            }

            NotificationManagerCompat manager = NotificationManagerCompat.from(this);
            manager.notify(notificationId, builder.build());
            Log.d(TAG,
                    "Authoritative native notification successfully posted while app was closed. ID=" + notificationId);

        } catch (SecurityException se) {
            Log.e(TAG, "Notification permission missing on Android 13+: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Failed to display native system notification: " + e.getMessage(), e);
        }
    }

    private void ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null)
                return;

            String[][] channels = {
                    { "messages_channel", "Messages & Chat",
                            "Real-time direct messages, staff discussions, and student chat alerts" },
                    { "account_security", "Account & Security",
                            "Critical security alerts, password changes, and account activity" },
                    { "contest_updates", "Contest Updates",
                            "Live contest alerts, reminders, and contest result announcements" },
                    { "weekly_reports", "Weekly Performance Reports",
                            "Weekly student performance reports and analytical summaries" },
                    { "performance_updates", "Performance Milestones",
                            "Rating changes, milestones, and performance velocity updates" },
                    { "academic_announcements", "Academic Announcements",
                            "Institutional, department, and academic announcements" },
                    { "system_status", "System Status", "Maintenance schedules and system status updates" },
                    { "leetcode_intelligence_channel", "LeetCode General Alerts",
                            "General system alerts, role updates, and real-time announcements" }
            };

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            for (String[] ch : channels) {
                NotificationChannel channel = new NotificationChannel(
                        ch[0],
                        ch[1],
                        NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription(ch[2]);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[] { 0, 250, 150, 250 });
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#3b82f6"));
                channel.setSound(defaultSoundUri, audioAttributes);
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
