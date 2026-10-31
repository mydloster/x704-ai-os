package sk.x704.aiassistant;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraManager;
import android.media.MediaCodecInfo;
import android.media.MediaCodecList;
import android.media.MediaDrm;
import android.os.Build;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Read-only capability probe. Does not request DRM licenses, capture audio/video or send data. */
public final class DiagnosticsActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextView output;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        output = new TextView(this);
        output.setTextSize(16);
        output.setPadding(24, 24, 24, 24);
        output.setTextIsSelectable(true);
        output.setText("X704 diagnostika – zisťujem schopnosti. Toto nie je test prehrávania.");
        ScrollView scroll = new ScrollView(this);
        scroll.addView(output);
        setContentView(scroll);
        worker.submit(() -> {
            try {
                JSONObject report = collect();
                String text = report.toString(2);
                File directory = getExternalFilesDir(null);
                if (directory == null) throw new IllegalStateException("External app directory unavailable");
                File file = new File(directory, "hardware-report.json");
                try (FileOutputStream stream = new FileOutputStream(file)) {
                    stream.write(text.getBytes(StandardCharsets.UTF_8));
                }
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) output.setText("X704 – schopnosti zariadenia\nBez DRM licencie a bez testu streamovania.\n\n" + text); });
            } catch (Exception e) {
                runOnUiThread(() -> { if (!isDestroyed()) output.setText("Diagnostika sa nedokončila: " + e.getClass().getSimpleName()); });
            }
        });
    }

    private JSONObject collect() throws Exception {
        JSONObject result = new JSONObject();
        result.put("schemaVersion", 1);
        result.put("capturedEpochMs", System.currentTimeMillis());
        result.put("android", Build.VERSION.RELEASE);
        result.put("api", Build.VERSION.SDK_INT);
        result.put("scope", "Capability enumeration only; no accounts, device identifiers, microphone, camera capture or network requests");
        UUID widevine = UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed");
        JSONObject drmInfo = new JSONObject();
        boolean supported = MediaDrm.isCryptoSchemeSupported(widevine);
        drmInfo.put("supported", supported);
        if (supported) {
            try (MediaDrm drm = new MediaDrm(widevine)) {
                for (String property : new String[]{"securityLevel", "vendor", "version", "description"}) {
                    try { drmInfo.put(property, drm.getPropertyString(property)); }
                    catch (Exception e) { drmInfo.put(property, "UNAVAILABLE"); }
                }
                drmInfo.put("maxHdcpLevelCode", drm.getMaxHdcpLevel());
                drmInfo.put("connectedHdcpLevelCode", drm.getConnectedHdcpLevel());
            } catch (Exception e) { drmInfo.put("probeError", e.getClass().getSimpleName()); }
        }
        drmInfo.put("protectedPlayback", "NOT_TESTED");
        drmInfo.put("streamingResolution", "NOT_TESTED");
        result.put("widevine", drmInfo);

        JSONArray codecs = new JSONArray();
        for (MediaCodecInfo codec : new MediaCodecList(MediaCodecList.ALL_CODECS).getCodecInfos()) {
            if (codec.isEncoder()) continue;
            for (String mime : codec.getSupportedTypes()) {
                if (!(mime.equals("video/avc") || mime.equals("video/hevc") || mime.equals("video/x-vnd.on2.vp9") || mime.equals("video/av01"))) continue;
                JSONObject item = new JSONObject();
                item.put("name", codec.getName());
                item.put("mime", mime);
                item.put("hardwareAccelerated", codec.isHardwareAccelerated());
                try {
                    MediaCodecInfo.CodecCapabilities caps = codec.getCapabilitiesForType(mime);
                    item.put("securePlaybackAdvertised", caps.isFeatureSupported(MediaCodecInfo.CodecCapabilities.FEATURE_SecurePlayback));
                    item.put("fhdAdvertised", caps.getVideoCapabilities().isSizeSupported(1920, 1080));
                } catch (Exception e) { item.put("capabilityError", e.getClass().getSimpleName()); }
                codecs.put(item);
            }
        }
        result.put("videoDecoders", codecs);
        try { result.put("cameraCount", ((CameraManager)getSystemService(CAMERA_SERVICE)).getCameraIdList().length); }
        catch (Exception e) { result.put("cameraCount", "UNAVAILABLE"); }
        result.put("sensorCount", ((SensorManager)getSystemService(SENSOR_SERVICE)).getSensorList(android.hardware.Sensor.TYPE_ALL).size());
        JSONObject packages = new JSONObject();
        for (String name : new String[]{"com.google.android.gms", "com.android.vending", "com.google.android.gsf", "com.google.android.youtube", "com.google.android.gm", "com.google.android.apps.maps", "com.android.chrome", "com.netflix.mediaclient", "com.disney.disneyplus", "com.amazon.avod.thirdpartyclient", "com.wbd.stream"}) {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(name, 0);
                JSONObject pkg = new JSONObject();
                pkg.put("installed", true);
                pkg.put("versionName", info.versionName);
                pkg.put("versionCode", info.getLongVersionCode());
                pkg.put("functionalTest", "NOT_TESTED");
                packages.put(name, pkg);
            } catch (PackageManager.NameNotFoundException e) { packages.put(name, "NOT_INSTALLED_OR_NOT_VISIBLE"); }
        }
        result.put("packages", packages);
        result.put("playProtectCertification", "USER_CHECK_REQUIRED");
        result.put("playIntegrity", "NOT_TESTED_NO_ATTESTATION_REQUEST");
        return result;
    }

    @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }
}
