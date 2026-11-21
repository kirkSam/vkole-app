/**
 * Android 13+ can bias on-device recognition toward the expected word.
 * The published plugin does not pass that hint. This adds it, and does nothing if it is already there.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(
  process.cwd(),
  "node_modules/@capgo/capacitor-speech-recognition/android/src/main/java/app/capgo/speechrecognition/SpeechRecognitionPlugin.java",
);
const marker = "VEKOLE biasing strings";
const source = readFileSync(file, "utf8");
if (source.includes(marker)) {
  process.stdout.write("speech bias patch already present\n");
  process.exit(0);
}

let next = source.replace(
  "    private int lastMaxResults = MAX_RESULTS;\n",
  "    private int lastMaxResults = MAX_RESULTS;\n    private String[] lastBiasingStrings = new String[0];\n",
);
next = next.replace(
  `        int maxResults = call.getInt("maxResults", MAX_RESULTS);
        String prompt = call.getString("prompt", null);`,
  `        int maxResults = call.getInt("maxResults", MAX_RESULTS);
        String[] biasingStrings = readBiasingStrings(call);
        String prompt = call.getString("prompt", null);`,
);
next = next.replace(
  `            lastMaxResults = maxResults;
            lastPrompt = prompt;`,
  `            lastMaxResults = maxResults;
            lastBiasingStrings = biasingStrings;
            lastPrompt = prompt;`,
);
next = next.replace(
  `        beginListening(
            language,
            maxResults,
            prompt,
            partialResults,
            popup,
            call,
            allowForSilence,
            useOnDeviceRecognition,
            currentSessionId,
            false
        );`,
  `        beginListening(
            language,
            maxResults,
            prompt,
            partialResults,
            popup,
            call,
            allowForSilence,
            useOnDeviceRecognition,
            biasingStrings,
            currentSessionId,
            false
        );`,
);
next = next.replace(
  `    private void beginListening(
        String language,
        int maxResults,
        String prompt,
        boolean partialResults,
        boolean showPopup,
        PluginCall call,
        int allowForSilence,
        boolean useOnDeviceRecognition,
        long currentSessionId,
        boolean restarting
    ) {
        Intent intent = buildRecognizerIntent(language, maxResults, prompt, partialResults, allowForSilence, useOnDeviceRecognition);`,
  `    private void beginListening(
        String language,
        int maxResults,
        String prompt,
        boolean partialResults,
        boolean showPopup,
        PluginCall call,
        int allowForSilence,
        boolean useOnDeviceRecognition,
        String[] biasingStrings,
        long currentSessionId,
        boolean restarting
    ) {
        Intent intent = buildRecognizerIntent(
            language,
            maxResults,
            prompt,
            partialResults,
            allowForSilence,
            useOnDeviceRecognition,
            biasingStrings
        );`,
);
next = next.replace(
  `                beginListening(
                    lastLanguage,
                    lastMaxResults,
                    lastPrompt,
                    lastPartialResults,
                    false,
                    null,
                    lastAllowForSilence,
                    lastUseOnDeviceRecognition,
                    currentSessionId,
                    true
                );`,
  `                beginListening(
                    lastLanguage,
                    lastMaxResults,
                    lastPrompt,
                    lastPartialResults,
                    false,
                    null,
                    lastAllowForSilence,
                    lastUseOnDeviceRecognition,
                    lastBiasingStrings,
                    currentSessionId,
                    true
                );`,
);
next = next.replace(
  `    private Intent buildRecognizerIntent(
        String language,
        int maxResults,
        String prompt,
        boolean partialResults,
        int allowForSilence,
        boolean useOnDeviceRecognition
    ) {`,
  `    private String[] readBiasingStrings(PluginCall call) {
        JSArray bias = call.getArray("biasingStrings");
        if (bias == null || bias.length() == 0) return new String[0];
        String[] words = new String[bias.length()];
        for (int i = 0; i < bias.length(); i++) words[i] = bias.optString(i, "");
        return words;
    }

    private Intent buildRecognizerIntent(
        String language,
        int maxResults,
        String prompt,
        boolean partialResults,
        int allowForSilence,
        boolean useOnDeviceRecognition,
        String[] biasingStrings
    ) {`,
);
next = next.replace(
  `        if (useOnDeviceRecognition) {
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        }`,
  `        if (useOnDeviceRecognition) {
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        }

        // VEKOLE biasing strings: Android 13+ on-device recognition only.
        if (
            useOnDeviceRecognition &&
            biasingStrings != null &&
            biasingStrings.length > 0 &&
            Build.VERSION.SDK_INT >= 33
        ) {
            intent.putExtra("android.speech.extra.BIASING_STRINGS", biasingStrings);
        }`,
);

if (next === source || !next.includes(marker)) {
  throw new Error("Could not patch speech recognition for the expected-word hint.");
}
writeFileSync(file, next);
process.stdout.write("speech bias patch applied\n");
