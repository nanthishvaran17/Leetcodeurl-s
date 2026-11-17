# ============================================================
# NANDHA LEETCODE INTELLIGENCE — ProGuard / R8 Rules
# ============================================================

# Keep line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor & WebView Bridge ──────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class org.nandhaengg.leetcodesync.** { *; }

# ── Firebase Messaging ──────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── AndroidX & Support Libraries ───────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── JSON / Serialization ────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keep class org.json.** { *; }

# ── Cordova/Capacitor Plugin Bridge (required for JS-Java interface) ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── WebView JavaScript Interface ────────────────────────────
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}

# ── Remove logging in release ───────────────────────────────
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
}

# ── OkHttp / Networking ─────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
