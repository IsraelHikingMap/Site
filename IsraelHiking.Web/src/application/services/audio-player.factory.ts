import { inject, Injectable } from "@angular/core";
import { NativeAudio } from "@capgo/native-audio";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    private readonly runningContext = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);

    public async create(): Promise<IAudioPlayer> {
        if (!this.runningContext.isCapacitor) {
            return new Audio("content/uh-oh.mp3");
        }

        this.loggingService.info("[Audio] Initializing audio file");

        await NativeAudio.configure({focus: false});
        const options = {
            assetId: "uh-oh",
            assetPath: "public/content/uh-oh.mp3",
            audioChannelNum: 1,
            isUrl: false
        };
        if ((await NativeAudio.isPreloaded(options)).found === false) {
            await NativeAudio.preload(options);
        }
        
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
