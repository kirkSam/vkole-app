package com.dotheimpossible.vkole;

import android.content.Context;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Zeros the music stream for the instant the recognizer starts.
 * The speech plugin already zeros the system and notification streams.
 * Music is the stream Android 12 often uses for the recognizer beep.
 * The VEKOLE chime plays before this hold, so the hold does not mute it.
 * The volume is restored without waiting for JavaScript: on pause, on
 * destroy, and by a native timer about one second after the hold.
 */
@CapacitorPlugin(name = "BeepMute")
public class BeepMutePlugin extends Plugin {
    static final long NATIVE_RESTORE_MS = 1000;

    private final Object gate = new Object();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable restoreLater = this::restoreMusic;
    private Integer savedMusic;

    @PluginMethod
    public void canMute(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", probe());
        call.resolve(result);
    }

    @PluginMethod
    public void hold(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", holdMusic());
        call.resolve(result);
    }

    @PluginMethod
    public void release(PluginCall call) {
        restoreMusic();
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        restoreMusic();
    }

    @Override
    protected void handleOnDestroy() {
        restoreMusic();
    }

    private AudioManager manager() {
        Context context = getContext();
        if (context == null) return null;
        return (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }

    private boolean probe() {
        AudioManager audio = manager();
        if (audio == null) return false;
        try {
            int current = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, current, 0);
            return true;
        } catch (SecurityException ex) {
            return false;
        }
    }

    private boolean holdMusic() {
        AudioManager audio = manager();
        if (audio == null) return false;
        try {
            synchronized (gate) {
                if (savedMusic == null) {
                    savedMusic = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
                }
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0);
                handler.removeCallbacks(restoreLater);
                handler.postDelayed(restoreLater, NATIVE_RESTORE_MS);
            }
            return true;
        } catch (SecurityException ex) {
            synchronized (gate) {
                savedMusic = null;
                handler.removeCallbacks(restoreLater);
            }
            return false;
        }
    }

    private void restoreMusic() {
        Integer saved;
        synchronized (gate) {
            handler.removeCallbacks(restoreLater);
            saved = savedMusic;
            savedMusic = null;
        }
        if (saved == null) return;
        AudioManager audio = manager();
        if (audio == null) return;
        try {
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, saved, 0);
        } catch (SecurityException ignored) {
            /* The next hold will try again. */
        }
    }
}
