package sk.x704.aiassistant;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.hardware.camera2.*;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.*;
import android.util.Size;
import android.widget.*;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** One JPEG frame per camera, retained only in memory long enough to validate
 * its dimensions. No image files, preview, network, microphone or account use. */
public final class RuntimeCameraActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private TextView output;
    private boolean started;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        output=new TextView(this); output.setTextSize(16); output.setPadding(24,24,24,24);
        output.setText("X704 – kontrola jednej snímky z každej kamery.\nFotografie sa neukladajú ani neodosielajú.\nDo výsledku patria iba rozmery, veľkosť a stav prenosu.");
        ScrollView scroll=new ScrollView(this); scroll.addView(output); setContentView(scroll);
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if(!focused||started)return;
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED) {
            output.setText("Test kamery vyžaduje povolenie CAMERA. Test sa nespustil."); return;
        }
        started=true;
        worker.submit(()->{
            try {
                CameraManager manager=(CameraManager)getSystemService(CAMERA_SERVICE);
                JSONObject report=new JSONObject(); report.put("schemaVersion",1); report.put("capturedEpochMs",System.currentTimeMillis());
                report.put("scope","One JPEG transfer per camera; image bytes discarded after dimension parsing; no stored photo, network, video, autofocus-quality or long-run test");
                JSONArray tests=new JSONArray();
                for(String id:manager.getCameraIdList())tests.put(probe(manager,id));
                report.put("tests",tests); String text=report.toString(2); File directory=getExternalFilesDir(null);
                if(directory==null)throw new IOException("Report directory unavailable");
                try(FileOutputStream stream=new FileOutputStream(new File(directory,"runtime-camera-report.json"))){stream.write(text.getBytes(StandardCharsets.UTF_8));}
                runOnUiThread(()->{if(!isDestroyed())output.setText("X704 – výsledok prenosu snímok\nŽiadne fotografie neboli uložené.\n\n"+text);});
            } catch(Exception e){runOnUiThread(()->{if(!isDestroyed())output.setText("Test sa nedokončil: "+e.getClass().getSimpleName());});}
        });
    }
    private static JSONObject probe(CameraManager manager,String id) throws Exception {
        JSONObject result=new JSONObject(); result.put("cameraId",id);
        HandlerThread callbacks=new HandlerThread("x704-camera-test"); callbacks.start(); Handler handler=new Handler(callbacks.getLooper());
        AtomicReference<CameraDevice> device=new AtomicReference<>(); AtomicReference<CameraCaptureSession> session=new AtomicReference<>();
        AtomicReference<Exception> failure=new AtomicReference<>(); AtomicReference<long[]> dimensions=new AtomicReference<>();
        AtomicBoolean cancelled=new AtomicBoolean(false);
        CountDownLatch opened=new CountDownLatch(1),configured=new CountDownLatch(1),imageReady=new CountDownLatch(1);
        ImageReader reader=null;
        try {
            CameraCharacteristics characteristics=manager.getCameraCharacteristics(id);
            Integer facing=characteristics.get(CameraCharacteristics.LENS_FACING);result.put("lensFacingCode",facing);
            StreamConfigurationMap map=characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            if(map==null)throw new IOException("No stream configuration");
            Size[] sizes=map.getOutputSizes(ImageFormat.JPEG);
            if(sizes==null||sizes.length==0)throw new IOException("No JPEG size advertised");
            Size selected=sizes[0]; long best=Long.MAX_VALUE;
            for(Size size:sizes){long distance=Math.abs((long)size.getWidth()*size.getHeight()-640L*480);if(distance<best){selected=size;best=distance;}}
            result.put("requestedWidth",selected.getWidth());result.put("requestedHeight",selected.getHeight());
            reader=ImageReader.newInstance(selected.getWidth(),selected.getHeight(),ImageFormat.JPEG,2);
            reader.setOnImageAvailableListener(source->{
                try(Image image=source.acquireNextImage()) {
                    if(image==null)return;
                    ByteBuffer data=image.getPlanes()[0].getBuffer();byte[] jpeg=new byte[data.remaining()];
                    try {
                        data.get(jpeg);BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
                        BitmapFactory.decodeByteArray(jpeg,0,jpeg.length,bounds);
                        if(bounds.outWidth<=0||bounds.outHeight<=0)throw new IOException("Received invalid JPEG");
                        dimensions.compareAndSet(null,new long[]{bounds.outWidth,bounds.outHeight,jpeg.length});
                    } finally {Arrays.fill(jpeg,(byte)0);}
                } catch(Exception e){failure.compareAndSet(null,e);}
                finally {imageReady.countDown();}
            },handler);
            manager.openCamera(id,new CameraDevice.StateCallback(){
                @Override public void onOpened(CameraDevice camera){if(cancelled.get())camera.close();else device.set(camera);opened.countDown();}
                @Override public void onDisconnected(CameraDevice camera){camera.close();failure.compareAndSet(null,new IOException("Camera disconnected"));opened.countDown();imageReady.countDown();}
                @Override public void onError(CameraDevice camera,int error){camera.close();failure.compareAndSet(null,new IOException("Camera error "+error));opened.countDown();imageReady.countDown();}
            },handler);
            if(!opened.await(8,TimeUnit.SECONDS)||device.get()==null)throw new IOException("Camera open failed or timed out",failure.get());
            result.put("opened",true);
            final ImageReader target=reader;
            device.get().createCaptureSession(Collections.singletonList(reader.getSurface()),new CameraCaptureSession.StateCallback(){
                @Override public void onConfigured(CameraCaptureSession value){if(cancelled.get())value.close();else session.set(value);configured.countDown();}
                @Override public void onConfigureFailed(CameraCaptureSession value){failure.compareAndSet(null,new IOException("Capture session configuration failed"));configured.countDown();}
            },handler);
            if(!configured.await(8,TimeUnit.SECONDS)||session.get()==null)throw new IOException("Camera session failed or timed out",failure.get());
            result.put("sessionConfigured",true);
            CaptureRequest.Builder request=device.get().createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
            request.addTarget(target.getSurface());request.set(CaptureRequest.CONTROL_MODE,CaptureRequest.CONTROL_MODE_AUTO);
            request.set(CaptureRequest.JPEG_ORIENTATION,0);
            session.get().capture(request.build(),new CameraCaptureSession.CaptureCallback(){
                @Override public void onCaptureFailed(CameraCaptureSession value,CaptureRequest req,CaptureFailure reason){failure.compareAndSet(null,new IOException("Capture failed: "+reason.getReason()));imageReady.countDown();}
            },handler);
            if(!imageReady.await(12,TimeUnit.SECONDS)||dimensions.get()==null)throw new IOException("No valid JPEG frame received",failure.get());
            long[] frame=dimensions.get();result.put("jpegWidth",frame[0]);result.put("jpegHeight",frame[1]);result.put("jpegBytes",frame[2]);
            result.put("imageStored",false);result.put("result","PASS_SINGLE_FRAME");
        } catch(Exception e) {result.put("result","FAIL");result.put("errorClass",e.getClass().getSimpleName());result.put("error",String.valueOf(e.getMessage()));if(failure.get()!=null)result.put("callbackError",failure.get().getMessage());}
        finally {
            cancelled.set(true);
            if(session.get()!=null)session.get().close();if(device.get()!=null)device.get().close();if(reader!=null)reader.close();
            callbacks.quitSafely();callbacks.join(2000);
        }
        return result;
    }
    @Override public void onDestroy(){worker.shutdownNow();super.onDestroy();}
}
