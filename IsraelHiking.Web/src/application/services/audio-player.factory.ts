import { Injectable } from "@angular/core";
import { NativeAudio } from "@forgr/native-audio";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    constructor(private readonly runningContext: RunningContextService,
        private readonly loggingService: LoggingService) { }

    public async create(): Promise<IAudioPlayer> {
        if (!this.runningContext.isCapacitor) {
            return new Audio("content/uh-oh.mp3");
        }

        this.loggingService.info("[Audio] Initializing audio file");

        await NativeAudio.configure({focus: false});

        await NativeAudio.preload({
            assetId: "uh-oh",
            assetPath: "public/content/uh-oh.mp3",
            audioChannelNum: 1,
            isUrl: false
        });
        return {
            play: () => {
                NativeAudio.play({
                    assetId: "uh-oh",
                    time: 0
                });
            }
        };
    }
}
