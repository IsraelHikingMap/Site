import { describe, beforeEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";

import { TextToSpeechService } from "./text-to-speech.service";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";

describe("TextToSpeechService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: ResourcesService, useValue: {} },
                { provide: RunningContextService, useValue: { isCapacitor: true } },
                { provide: LoggingService, useValue: {} },
                { provide: ToastService, useValue: {} },
                TextToSpeechService
            ]
        });
    });

    it("should use the language tag of the device when it is the same as the language of the app", inject([TextToSpeechService],
        (service: TextToSpeechService) => {
            const language = service.getBestSupportedLanguage(["he-IL", "en-US", "ru-RU"], "en-US");

            expect(language).toBe("en-US");
        }
    ));

    it("should use the language tag of the device that has the country the app language does not have", inject([TextToSpeechService],
        (service: TextToSpeechService) => {
            const language = service.getBestSupportedLanguage(["he-IL", "en-US", "ru-RU"], "he");

            expect(language).toBe("he-IL");
        }
    ));

    it("should ignore the case the device lists its language tags in", inject([TextToSpeechService],
        (service: TextToSpeechService) => {
            const language = service.getBestSupportedLanguage(["he-IL", "EN-us"], "en-US");

            expect(language).toBe("EN-us");
        }
    ));

    it("should fall back to the language of the app when the device supports nothing like it", inject([TextToSpeechService],
        (service: TextToSpeechService) => {
            const language = service.getBestSupportedLanguage(["en-US"], "he");

            expect(language).toBe("he");
        }
    ));
});
