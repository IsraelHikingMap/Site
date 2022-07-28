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

    public create(relativePath: string): IAudioPlayer {
        let fullUrl = this.fileService.getFullUrl(relativePath);
        return (this.runningContextService.isCapacitor)
            ? this.media.create(fullUrl)
            : new Audio(fullUrl);
    }
}
