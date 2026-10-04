# Raahi - R8 / ProGuard rules for release builds.
# The Capacitor runtime ships its own consumer rules (plugin annotations, Cordova
# bridges); the rules below cover everything the app itself relies on.

# Keep debugging information useful for crash reports without exposing file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# --- Capacitor core & plugins ------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }

# Official Capacitor plugins used by Raahi.
-keep class com.capacitorjs.plugins.** { *; }
# Community background geolocation plugin (foreground service + broadcast receiver).
-keep class com.equimaps.capacitor_background_geolocation.** { *; }

# The app's own activity and anything Capacitor instantiates reflectively.
-keep class pk.raahi.app.** { *; }

# --- WebView JavaScript interfaces --------------------------------------------
# Capacitor exposes native bridges to the web layer via @JavascriptInterface;
# their method names must survive obfuscation.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.getcapacitor.MessageHandler { public *; }
-keepclassmembers class com.getcapacitor.plugin.CapacitorHttp { public *; }
-keepclassmembers class com.getcapacitor.plugin.CapacitorCookies { public *; }
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }

# --- Android components ---------------------------------------------------------
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends androidx.core.content.FileProvider

# Cordova compatibility layer bundled by Capacitor.
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}
-dontwarn org.apache.cordova.**

# Keep enum helpers that Capacitor's JSON bridge relies on.
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Suppress noise from optional transitive dependencies that are not bundled.
-dontwarn com.google.android.material.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
