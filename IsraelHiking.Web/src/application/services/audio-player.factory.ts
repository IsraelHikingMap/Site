import { Injectable } from "@angular/core";
import { Media } from "@ionic-native/media/ngx";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    constructor(private readonly runningContextService: RunningContextService,
                private readonly fileService: FileService,
                private readonly media: Media) {
    }

    public async create(relativePath: string): Promise<IAudioPlayer> {
        if (this.runningContextService.isCordova) {
            let audioFilePath = await this.fileService.getLocalFileUrl(relativePath);
            return this.media.create(audioFilePath);
        }
        return new Audio(await this.fileService.getFullFilePath(relativePath));
    }
}
