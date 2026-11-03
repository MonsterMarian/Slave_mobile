/**
 * Hlas v telefonu: diktování (rozpoznávání řeči Androidu) a předčítání.
 *
 * Obojí jen v nativní appce. V prohlížeči při vývoji mikrofon nic nedělá
 * a předčítání mlčí - nic nespadne.
 */
import { registerPlugin } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { isNative } from "./native";

export const LANGUAGE = "cs-CZ";

/**
 * Předčítání se registruje ručně jako v mpL (`lib/speech.ts`): balíček
 * `@capacitor-community/text-to-speech` si při importu sahá na `window`
 * a tím shodí prerender stránky v `next build`.
 */
interface TextToSpeechPlugin {
  speak(options: { text: string; lang?: string; rate?: number }): Promise<void>;
  stop(): Promise<void>;
}

const TextToSpeech = registerPlugin<TextToSpeechPlugin>("TextToSpeech");

export class VoiceError extends Error {}

/**
 * Jedno nadiktování. Vrací rozpoznaný text, `null` když člověk nic neřekl.
 *
 * Bez systémového okna (`popup: false`) a bez průběžných výsledků: plugin
 * pak `start()` vyřeší až s hotovou větou, takže není co skládat z událostí.
 */
export async function listen(): Promise<string | null> {
  if (!isNative()) throw new VoiceError("Diktování jde jen v appce v telefonu.");

  const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
  if (!available) throw new VoiceError("Telefon nemá rozpoznávání řeči (chybí aplikace Google).");

  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== "granted") perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== "granted") {
    throw new VoiceError("Bez povolení mikrofonu diktovat nejde. Povol ho v nastavení telefonu.");
  }

  try {
    const result = await SpeechRecognition.start({
      language: LANGUAGE,
      maxResults: 1,
      popup: false,
      partialResults: false,
    });
    const text = result.matches?.[0]?.trim();
    return text ? text : null;
  } catch (e) {
    // "No match" a "No speech input" = ticho, ne chyba.
    if (/no match|no speech/i.test(String(e))) return null;
    throw new VoiceError(`Rozpoznávání řeči selhalo: ${String(e).slice(0, 120)}`);
  }
}

export async function stopListening(): Promise<void> {
  if (!isNative()) return;
  await SpeechRecognition.stop().catch(() => {});
}

export async function speak(text: string): Promise<void> {
  if (!isNative() || !text.trim()) return;
  try {
    await TextToSpeech.speak({ text, lang: LANGUAGE, rate: 1 });
  } catch {
    // chybí český hlas nebo hlasový modul - odpověď je pořád vidět v chatu
  }
}

export async function stopSpeaking(): Promise<void> {
  if (!isNative()) return;
  await TextToSpeech.stop().catch(() => {});
}
