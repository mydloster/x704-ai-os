package sk.x704.aiassistant;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.util.ArrayList;
import java.util.Locale;

/** Standalone demonstration. No cloud requests, privileged permissions or embedded API keys. */
public final class MainActivity extends Activity {
    private static final int VOICE_REQUEST = 101;
    private LinearLayout messages;
    private EditText input;
    private ScrollView scroll;
    private TextToSpeech speech;
    private boolean speechReady;
    private Button read;
    private String lastReply = "";

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(24), dp(24), dp(16));
        root.setBackgroundColor(Color.rgb(242, 246, 249));
        TextView title = new TextView(this);
        title.setText("X704 AI Assistant");
        title.setTextSize(28);
        title.setTextColor(Color.rgb(20, 47, 63));
        root.addView(title);
        TextView mode = new TextView(this);
        mode.setText("UKÁŽKOVÝ REŽIM · Cloudová AI nie je pripojená");
        mode.setTextSize(15);
        mode.setPadding(0, dp(8), 0, dp(16));
        root.addView(mode);

        scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        messages = new LinearLayout(this);
        messages.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(messages);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        addMessage("Asistent", "Vitaj. Toto je prototyp rozhrania, nie pripojená AI. "
            + "Text zostáva v pamäti aplikácie. Hlasový vstup a čítanie závisia od služieb zariadenia.");

        input = new EditText(this);
        input.setHint("Napíš správu…");
        input.setContentDescription("Správa pre asistenta");
        input.setMaxLines(4);
        input.setTextSize(18);
        root.addView(input, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout buttons = new LinearLayout(this);
        buttons.setGravity(Gravity.CENTER_VERTICAL);
        Button send = new Button(this);
        send.setText("Odoslať");
        send.setOnClickListener(v -> send());
        buttons.addView(send, new LinearLayout.LayoutParams(0, dp(56), 1));
        Button voice = new Button(this);
        voice.setText("Hlas");
        voice.setOnClickListener(v -> startVoice());
        buttons.addView(voice, new LinearLayout.LayoutParams(0, dp(56), 1));
        read = new Button(this);
        read.setText("Prečítať");
        read.setEnabled(false);
        read.setOnClickListener(v -> {
            if (speechReady && !lastReply.isEmpty())
                speech.speak(lastReply, TextToSpeech.QUEUE_FLUSH, null, "x704-reply");
        });
        buttons.addView(read, new LinearLayout.LayoutParams(0, dp(56), 1));
        root.addView(buttons);
        setContentView(root);

        speech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS && speech != null) {
                int language = speech.setLanguage(Locale.forLanguageTag("sk-SK"));
                speechReady = language >= TextToSpeech.LANG_AVAILABLE;
                read.setEnabled(speechReady && !lastReply.isEmpty());
            }
        });
    }

    private void send() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) return;
        if (text.length() > 4000) { input.setError("Najviac 4 000 znakov."); return; }
        addMessage("Ty", text);
        input.setText("");
        lastReply = DemoAssistant.reply(text);
        addMessage("Ukážka asistenta", lastReply);
        read.setEnabled(speechReady);
    }

    private void addMessage(String author, String text) {
        TextView bubble = new TextView(this);
        bubble.setText(author + "\n" + text);
        bubble.setTextSize(18);
        bubble.setPadding(dp(16), dp(12), dp(16), dp(12));
        bubble.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(-1, -2);
        layout.setMargins(0, 0, 0, dp(12));
        messages.addView(bubble, layout);
        // Bound UI memory on older hardware. This prototype has no persistent chat database.
        while (messages.getChildCount() > 40) messages.removeViewAt(0);
        scroll.post(() -> scroll.fullScroll(View.FOCUS_DOWN));
    }

    private void startVoice() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "sk-SK");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Hlas spracuje rozpoznávacia služba zariadenia");
        try { startActivityForResult(intent, VOICE_REQUEST); }
        catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Rozpoznávanie reči nie je dostupné. Použi textový vstup.", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == VOICE_REQUEST && result == RESULT_OK && data != null) {
            ArrayList<String> words = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (words != null && !words.isEmpty()) input.setText(words.get(0));
        }
    }

    @Override protected void onDestroy() {
        if (speech != null) { speech.stop(); speech.shutdown(); }
        super.onDestroy();
    }
}
