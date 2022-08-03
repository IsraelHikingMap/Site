import { Injectable } from "@angular/core";
//import { Media } from "@awesome-cordova-plugins/media/ngx";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";

export interface IAudioPlayer {
    play(): void;
}

@Injectable()
export class AudioPlayerFactory {
    constructor(private readonly fileService: FileService) {
    }

    public create(relativePath: string): IAudioPlayer {
        let fullUrl = this.fileService.getFullUrl(relativePath);
        return new Audio(fullUrl);
    }
}
