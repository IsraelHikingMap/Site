import { Injectable } from "@angular/core";
import { NativeAudio } from "@capacitor-community/native-audio";

import { RunningContextService } from "./running-context.service";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    constructor(private readonly runningContext: RunningContextService) { }

    public async create(): Promise<IAudioPlayer> {
        if (!this.runningContext.isCapacitor) {
            return new Audio("content/uh-oh.mp3");
        }

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
