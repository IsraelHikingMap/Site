import { inject, signal, Service } from "@angular/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";

/**
 * Reads a text out loud using the speech engine of the device, which needs no network of its own
 * once the voice of the language is installed there.
 * It is only available in the app since the browser implementation of the plugin is the web speech
 * api, which android's web view does not support.
 */
@Service()
export class TextToSpeechService {

    /**
     * The text that is being read out loud right now, empty when nothing is. It is the text itself
     * and not a flag, since a screen can show several texts and only the one being read should
     * offer to stop it.
     */
    public readonly speakingText = signal("");

    /**
     * The utterance that is currently being read out loud. Every call gets its own number so that a
     * request that was stopped or replaced no longer has a say on what the state is - on android
     * stopping leaves the promise of the request it stopped unresolved forever.
     */
    private currentUtterance = 0;

    private readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);

    public get isSupported(): boolean {
        return this.runningContextService.isCapacitor;
    }

    /**
     * Reads the given text out loud in the language of the app, stopping whatever is being read.
     * @remarks Reading is done in the playback audio category so that a phone on silent, which is how
     * a phone spends a hike, does not swallow a text the user has just asked to hear.
     */
    public async speak(text: string): Promise<void> {
        const utterance = ++this.currentUtterance;
        this.speakingText.set(text);
        try {
            const supportedLanguages = (await TextToSpeech.getSupportedLanguages()).languages;
            const language = this.getBestSupportedLanguage(supportedLanguages, this.resources.getCurrentLanguageCode());
            this.loggingService.info(`[TextToSpeech] Reading ${text.length} characters out loud in ${language}`);
            await TextToSpeech.speak({ text, lang: language, category: "playback" });
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToReadOutLoud);
        } finally {
            if (utterance === this.currentUtterance) {
                this.speakingText.set("");
            }
        }
    }

    public async stop(): Promise<void> {
        this.currentUtterance++;
        this.speakingText.set("");
        await TextToSpeech.stop();
    }

    /**
     * The language tag to speak in out of the tags the device supports, since a device lists a
     * language along with a country, like "he-IL", while the app knows it as "he" or "en-US".
     * @returns The matching tag, or the language as it is when the device lists nothing like it,
     * which leaves it to the speech engine to fall back to a voice of its own choosing.
     */
    public getBestSupportedLanguage(supportedLanguages: string[], language: string): string {
        const exactMatch = supportedLanguages.find(supported => supported.toLowerCase() === language.toLowerCase());
        if (exactMatch) {
            return exactMatch;
        }
        const languageOnly = language.split("-")[0].toLowerCase();
        return supportedLanguages.find(supported => supported.split("-")[0].toLowerCase() === languageOnly) || language;
    }
}
