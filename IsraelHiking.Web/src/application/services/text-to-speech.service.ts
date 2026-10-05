import { inject, signal, Service } from "@angular/core";
import { SpeechSynthesis, type ErrorEvent as SpeechSynthesisErrorEvent } from "@capgo/capacitor-speech-synthesis";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";

/**
 * Reads a text out loud using the speech engine of the device, which needs no network of its own
 * once the voice of the language is installed there.
 */
@Service()
export class TextToSpeechService {

    /** How many times a text is handed to the speech engine before the user is told that it failed. */
    private static readonly ATTEMPTS = 2;

    /**
     * The text that is being read out loud right now, empty when nothing is. It is the text itself
     * and not a flag, since a screen can show several texts and only the one being read should
     * offer to stop it.
     */
    public readonly speakingText = signal("");

    /**
     * The utterance the speech engine is reading, which is what tells its events apart from those of
     * an utterance that was already stopped or replaced - both of which still report themselves as
     * cancelled. Null when nothing is being read.
     */
    private utteranceId: string = null;
    private attempts = 0;
    private isEngineAwake = false;

    private readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);

    /**
     * Whether a text can be read out loud here at all. The app always can, while a browser only can
     * when it has the web speech api, which the web view of android notably does not have - which is
     * why the app needs the plugin in the first place.
     */
    public get isSupported(): boolean {
        return this.runningContextService.isCapacitor || (typeof window !== "undefined" && "speechSynthesis" in window);
    }

    /** Reads the given text out loud in the language of the app, stopping whatever is being read. */
    public async speak(text: string): Promise<void> {
        this.attempts = 0;
        this.speakingText.set(text);
        await this.readOutLoud(text);
    }

    public async stop(): Promise<void> {
        this.finishReading();
        await SpeechSynthesis.cancel();
    }

    /**
     * Hands the text to the speech engine, which reads it out loud on its own from there on and says
     * how it went in the events that wakeTheEngineUp listens to.
     * @remarks The audio session is activated for playback so that a phone on silent, which is how a
     * phone spends a hike, does not swallow a text the user has just asked to hear. Only iOS has a
     * session to activate, on the other platforms this does nothing.
     */
    private async readOutLoud(text: string): Promise<void> {
        this.attempts++;
        this.utteranceId = null;
        try {
            await this.wakeTheEngineUp();
            const languages = (await SpeechSynthesis.getLanguages()).languages;
            const language = this.getBestSupportedLanguage(languages, this.resources.getCurrentLanguageCode());
            this.loggingService.info(`[TextToSpeech] Reading ${text.length} characters out loud in ${language}`);
            await SpeechSynthesis.activateAudioSession({ category: "Playback" });
            const { utteranceId } = await SpeechSynthesis.speak({ text, language, queueStrategy: "Flush" });
            this.utteranceId = utteranceId;
        } catch (ex) {
            this.failReading((ex as Error).message);
        }
    }

    /**
     * Starts the speech engine and listens to what it does with the texts it is given, once per run
     * of the app, since a request made before the engine is up is refused.
     */
    private async wakeTheEngineUp(): Promise<void> {
        if (this.isEngineAwake) {
            return;
        }
        this.isEngineAwake = true;
        await SpeechSynthesis.initialize();
        await SpeechSynthesis.addListener("end", event => {
            if (event.utteranceId === this.utteranceId) {
                this.finishReading();
            }
        });
        await SpeechSynthesis.addListener("error", event => this.retryOrFailReading(event));
    }

    /**
     * Reads the text once more when the engine failed to read it, since the speech engine of android
     * fails the first request it gets after it wakes up, while it is still loading the voice it was
     * asked for. The user is only told of a failure that a second reading did not solve.
     */
    private retryOrFailReading(event: SpeechSynthesisErrorEvent): void {
        if (event.utteranceId !== this.utteranceId) {
            return;
        }
        this.loggingService.warning(`[TextToSpeech] Reading failed: ${event.error}`);
        if (this.attempts < TextToSpeechService.ATTEMPTS) {
            this.readOutLoud(this.speakingText());
            return;
        }
        this.failReading(event.error);
    }

    private failReading(error: string): void {
        this.finishReading();
        this.toastService.error(new Error(error), this.resources.unableToReadOutLoud);
    }

    /** Forgets what was being read and gives the audio session back to whatever else wants to play. */
    private finishReading(): void {
        this.utteranceId = null;
        this.speakingText.set("");
        SpeechSynthesis.deactivateAudioSession().catch((ex: Error) =>
            this.loggingService.warning(`[TextToSpeech] Unable to release the audio session: ${ex.message}`));
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
