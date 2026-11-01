package sk.x704.aiassistant;

import android.app.Activity;
import android.hardware.*;
import android.os.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Sample delivery test only: no location, microphone, camera or network. */
public final class RuntimeSensorsActivity extends Activity implements SensorEventListener {
    private final Map<Integer,SampleState> states=new LinkedHashMap<>();
    private SensorManager manager; private HandlerThread thread; private Handler handler; private TextView output;
    private static final class SampleState {
        final Sensor sensor; int samples,invalidValues,timeReversals,accuracy; long timestamp;
        boolean registered;
        SampleState(Sensor value){sensor=value;}
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        output=new TextView(this); output.setTextSize(16); output.setPadding(24,24,24,24);
        output.setText("X704 – príjem vzoriek senzorov počas 8 sekúnd.\nBez snímania obrazu, zvuku, polohy a bez siete.");
        ScrollView scroll=new ScrollView(this); scroll.addView(output); setContentView(scroll);
        manager=(SensorManager)getSystemService(SENSOR_SERVICE);
        thread=new HandlerThread("x704-sensor-test"); thread.start(); handler=new Handler(thread.getLooper());
        handler.post(()->{
            for(int type:new int[]{Sensor.TYPE_ACCELEROMETER,Sensor.TYPE_GYROSCOPE,Sensor.TYPE_MAGNETIC_FIELD,Sensor.TYPE_LIGHT,Sensor.TYPE_PROXIMITY,Sensor.TYPE_PRESSURE,Sensor.TYPE_ROTATION_VECTOR}) {
                SampleState state=new SampleState(manager.getDefaultSensor(type)); states.put(type,state);
                if(state.sensor!=null) state.registered=manager.registerListener(this,state.sensor,SensorManager.SENSOR_DELAY_NORMAL,handler);
            }
            handler.postDelayed(this::finishReport,8000);
        });
    }
    @Override public void onSensorChanged(SensorEvent event) {
        SampleState state=states.get(event.sensor.getType()); if(state==null)return;
        state.samples++; if(event.timestamp<state.timestamp)state.timeReversals++;
        state.timestamp=event.timestamp;
        for(float value:event.values)if(!Float.isFinite(value))state.invalidValues++;
        state.accuracy=event.accuracy;
    }
    @Override public void onAccuracyChanged(Sensor sensor,int accuracy) {
        SampleState state=states.get(sensor.getType()); if(state!=null)state.accuracy=accuracy;
    }
    private void finishReport() {
        manager.unregisterListener(this);
        try {
            JSONObject report=new JSONObject(); report.put("schemaVersion",1); report.put("capturedEpochMs",System.currentTimeMillis());
            report.put("api",Build.VERSION.SDK_INT); report.put("durationMs",8000);
            report.put("scope","Sensor event delivery and finite values only; calibration, physical response and orientation correctness NOT_TESTED; no sample values or device identifiers recorded");
            JSONArray tests=new JSONArray();
            for(Map.Entry<Integer,SampleState> entry:states.entrySet()) {
                SampleState state=entry.getValue(); JSONObject item=new JSONObject(); item.put("type",entry.getKey());
                if(state.sensor==null)item.put("result","NOT_PRESENT");
                else {
                    item.put("sensorType",state.sensor.getStringType()); item.put("registered",state.registered);
                    item.put("samples",state.samples); item.put("invalidValues",state.invalidValues);
                    item.put("timestampReversals",state.timeReversals); item.put("lastAccuracyCode",state.accuracy);
                    item.put("result",!state.registered?"REGISTRATION_FAILED":state.samples==0?"NO_SAMPLES_OBSERVED":state.invalidValues!=0||state.timeReversals!=0?"INVALID_SAMPLES":"SAMPLES_RECEIVED");
                }
                tests.put(item);
            }
            report.put("tests",tests); String text=report.toString(2); File directory=getExternalFilesDir(null);
            if(directory==null)throw new IOException("Report directory unavailable");
            try(FileOutputStream stream=new FileOutputStream(new File(directory,"runtime-sensors-report.json"))){stream.write(text.getBytes(StandardCharsets.UTF_8));}
            runOnUiThread(()->{if(!isDestroyed())output.setText("X704 – príjem dát zo senzorov\nNie je to test kalibrácie ani fyzickej odozvy.\n\n"+text);});
        } catch(Exception e) {runOnUiThread(()->{if(!isDestroyed())output.setText("Test sa nedokončil: "+e.getClass().getSimpleName());});}
        finally {thread.quitSafely();}
    }
    @Override public void onDestroy(){if(manager!=null)manager.unregisterListener(this);if(thread!=null)thread.quitSafely();super.onDestroy();}
}
