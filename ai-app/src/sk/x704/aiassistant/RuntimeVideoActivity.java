package sk.x704.aiassistant;

import android.app.Activity;
import android.media.*;
import android.os.Bundle;
import android.os.SystemClock;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.CRC32;
import org.json.*;

/** Generates grayscale frames locally, hardware-encodes and decodes them.
 * No network, accounts, camera, microphone, DRM or audible output is used.
 * This is a buffer decode test, not screen rendering or protected playback. */
public final class RuntimeVideoActivity extends Activity {
    private static final int WIDTH=1920, HEIGHT=1080, FRAMES=30, FPS=30;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private TextView output;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        output=new TextView(this); output.setTextSize(16); output.setPadding(24,24,24,24);
        output.setText("X704 – test syntetického FHD videa.\nBez kamery, mikrofónu, siete a DRM.\nTestujem hardvérové kódovanie a dekódovanie…");
        ScrollView scroll=new ScrollView(this); scroll.addView(output); setContentView(scroll);
        worker.submit(()->{
            try {
                JSONObject report=new JSONObject();
                report.put("schemaVersion",1); report.put("capturedEpochMs",System.currentTimeMillis());
                report.put("api",android.os.Build.VERSION.SDK_INT);
                report.put("scope","Synthetic non-DRM hardware encode/decode to buffers; no Surface rendering, audio, network or real streaming");
                JSONArray tests=new JSONArray();
                for(String mime:new String[]{"video/avc","video/hevc"}) {
                    JSONObject result=new JSONObject(); result.put("mime",mime);
                    result.put("width",WIDTH); result.put("height",HEIGHT); result.put("expectedFrames",FRAMES);
                    File clip=File.createTempFile("x704-synthetic-", ".mp4", getCacheDir());
                    try {
                        MediaCodecInfo encoder=selectCodec(mime,true), decoder=selectCodec(mime,false);
                        if(encoder==null || decoder==null) {
                            result.put("result","BLOCKED");
                            result.put("reason",encoder==null?"No hardware encoder to generate the test clip; decoder functionality remains untested":"No hardware decoder advertised");
                        } else {
                            result.put("encoder",encoder.getName()); result.put("decoder",decoder.getName());
                            encode(clip,mime,encoder);
                            decode(clip,decoder,result);
                            result.put("result","PASS");
                        }
                    } catch(Exception e) {
                        result.put("result","FAIL"); result.put("errorClass",e.getClass().getSimpleName());
                        result.put("error",String.valueOf(e.getMessage()));
                    } finally { if(!clip.delete()) clip.deleteOnExit(); }
                    tests.put(result);
                }
                report.put("tests",tests);
                String text=report.toString(2);
                File directory=getExternalFilesDir(null);
                if(directory==null) throw new IOException("Report directory unavailable");
                try(FileOutputStream stream=new FileOutputStream(new File(directory,"runtime-video-report.json"))) {
                    stream.write(text.getBytes(StandardCharsets.UTF_8));
                }
                runOnUiThread(()->{if(!isDestroyed()) output.setText("X704 – výsledok testu syntetického videa\nNie je to test streamovania ani DRM.\n\n"+text);});
            } catch(Exception e) {
                runOnUiThread(()->{if(!isDestroyed()) output.setText("Test sa nedokončil: "+e.getClass().getSimpleName());});
            }
        });
    }

    private static MediaCodecInfo selectCodec(String mime,boolean encoder) {
        for(MediaCodecInfo info:new MediaCodecList(MediaCodecList.REGULAR_CODECS).getCodecInfos()) {
            if(info.isEncoder()!=encoder || !info.isHardwareAccelerated() || info.isAlias() || info.getName().endsWith(".secure")) continue;
            for(String type:info.getSupportedTypes()) if(type.equalsIgnoreCase(mime)) return info;
        }
        return null;
    }

    private static void checkDeadline(long deadline) throws Exception {
        if(Thread.currentThread().isInterrupted()) throw new InterruptedException("Test interrupted");
        if(SystemClock.elapsedRealtime()>deadline) throw new IOException("Codec test timed out");
    }

    private static void encode(File file,String mime,MediaCodecInfo info) throws Exception {
        int color=0;
        for(int value:info.getCapabilitiesForType(mime).colorFormats)
            if(value==MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar || value==MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar) { color=value; break; }
        if(color==0) throw new IOException("Hardware encoder has no supported linear YUV420 input format");
        MediaCodec codec=MediaCodec.createByCodecName(info.getName());
        MediaMuxer muxer=null; boolean started=false, muxStarted=false;
        try {
            MediaFormat format=MediaFormat.createVideoFormat(mime,WIDTH,HEIGHT);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT,color); format.setInteger(MediaFormat.KEY_BIT_RATE,4000000);
            format.setInteger(MediaFormat.KEY_FRAME_RATE,FPS); format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,1);
            // Let the hardware choose a supported profile/level pair. A lone
            // forced profile is rejected by some legacy Qualcomm AVC encoders.
            codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE); codec.start(); started=true;
            muxer=new MediaMuxer(file.getAbsolutePath(),MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            byte[] pixels=new byte[WIDTH*HEIGHT*3/2]; Arrays.fill(pixels,WIDTH*HEIGHT,pixels.length,(byte)128);
            int input=0, track=-1; boolean inputDone=false, outputDone=false;
            long deadline=SystemClock.elapsedRealtime()+60000;
            MediaCodec.BufferInfo bufferInfo=new MediaCodec.BufferInfo();
            while(!outputDone) {
                checkDeadline(deadline);
                if(!inputDone) {
                    int index=codec.dequeueInputBuffer(10000);
                    if(index>=0) {
                        if(input==FRAMES) { codec.queueInputBuffer(index,0,0,input*1000000L/FPS,MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone=true; }
                        else {
                            for(int y=0;y<HEIGHT;y++) for(int x=0;x<WIDTH;x++) pixels[y*WIDTH+x]=(byte)(16+((x+input*23)%WIDTH)*219/WIDTH);
                            ByteBuffer buffer=codec.getInputBuffer(index);
                            if(buffer==null || buffer.capacity()<pixels.length) throw new IOException("Encoder input buffer too small");
                            buffer.clear(); buffer.put(pixels); codec.queueInputBuffer(index,0,pixels.length,input*1000000L/FPS,0); input++;
                        }
                    }
                }
                int index=codec.dequeueOutputBuffer(bufferInfo,10000);
                if(index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if(muxStarted) throw new IOException("Repeated encoder format change");
                    track=muxer.addTrack(codec.getOutputFormat()); muxer.start(); muxStarted=true;
                } else if(index>=0) {
                    try {
                        if(bufferInfo.size>0 && (bufferInfo.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)==0) {
                            if(!muxStarted) throw new IOException("Encoded sample before output format");
                            ByteBuffer buffer=codec.getOutputBuffer(index);
                            if(buffer==null) throw new IOException("Missing encoder output buffer");
                            buffer.position(bufferInfo.offset); buffer.limit(bufferInfo.offset+bufferInfo.size);
                            muxer.writeSampleData(track,buffer,bufferInfo);
                        }
                        outputDone=(bufferInfo.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
                    } finally { codec.releaseOutputBuffer(index,false); }
                }
            }
        } finally {
            try { try { if(started) codec.stop(); } finally { codec.release(); } }
            finally { if(muxer!=null) { try { if(muxStarted) muxer.stop(); } finally { muxer.release(); } } }
        }
    }

    private static void decode(File file,MediaCodecInfo info,JSONObject result) throws Exception {
        MediaExtractor extractor=new MediaExtractor(); MediaCodec codec=null; boolean started=false;
        try {
            extractor.setDataSource(file.getAbsolutePath()); extractor.selectTrack(0);
            codec=MediaCodec.createByCodecName(info.getName()); codec.configure(extractor.getTrackFormat(0),null,null,0); codec.start(); started=true;
            int frames=0; long previous=-1, begin=SystemClock.elapsedRealtime(), deadline=begin+60000, bytes=0;
            boolean inputDone=false,outputDone=false; Set<Long> checksums=new HashSet<>();
            MediaCodec.BufferInfo bi=new MediaCodec.BufferInfo();
            while(!outputDone) {
                checkDeadline(deadline);
                if(!inputDone) {
                    int index=codec.dequeueInputBuffer(10000);
                    if(index>=0) {
                        ByteBuffer buffer=codec.getInputBuffer(index);
                        if(buffer==null) throw new IOException("Missing decoder input buffer");
                        buffer.clear(); int size=extractor.readSampleData(buffer,0);
                        if(size<0) {codec.queueInputBuffer(index,0,0,0,MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone=true;}
                        else {codec.queueInputBuffer(index,0,size,extractor.getSampleTime(),0); extractor.advance();}
                    }
                }
                int index=codec.dequeueOutputBuffer(bi,10000);
                if(index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) result.put("outputFormat",codec.getOutputFormat().toString());
                else if(index>=0) {
                    try {
                        if(bi.size>0 && (bi.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)==0) {
                            if(bi.presentationTimeUs<previous) throw new IOException("Decoded timestamps are not monotonic");
                            previous=bi.presentationTimeUs;
                            ByteBuffer buffer=codec.getOutputBuffer(index);
                            if(buffer==null) throw new IOException("Missing decoder output buffer");
                            buffer.position(bi.offset); buffer.limit(bi.offset+bi.size);
                            CRC32 crc=new CRC32(); crc.update(buffer); checksums.add(crc.getValue());
                            bytes+=bi.size; frames++;
                        }
                        outputDone=(bi.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
                    } finally {codec.releaseOutputBuffer(index,false);}
                }
            }
            result.put("decodedFrames",frames); result.put("decodedBytes",bytes); result.put("distinctFrameChecksums",checksums.size());
            result.put("decodeElapsedMs",SystemClock.elapsedRealtime()-begin); result.put("timestampsMonotonic",true);
            if(frames!=FRAMES || bytes==0 || checksums.size()<2) throw new IOException("Decoded frame/content validation failed");
        } finally {
            extractor.release();
            if(codec!=null) {try {if(started) codec.stop();} finally {codec.release();}}
        }
    }

    @Override public void onDestroy() { worker.shutdownNow(); super.onDestroy(); }
}
