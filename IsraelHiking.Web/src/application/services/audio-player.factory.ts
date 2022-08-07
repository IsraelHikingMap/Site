import { Injectable } from "@angular/core";
import { NativeAudio } from "@capacitor-community/native-audio";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    constructor() { }

    public async create(): Promise<IAudioPlayer> {
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
