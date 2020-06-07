import { Pipe, PipeTransform } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { encode } from "base64-arraybuffer";

import { RunningContextService } from "../services/running-context.service";
import { DatabaseService } from "../services/database.service";
import { LoggingService } from "../services/logging.service";

@Pipe({ name: "offlineImage" })
export class OfflineImagePipe implements PipeTransform {
    constructor(private readonly http: HttpClient,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly databaseService: DatabaseService) {
    }

    public async transform(value: string, cache: boolean): Promise<string> {
        // HM TODO: remove this when issue is resolved!
        this.loggingService.debug("Showing image: " + value + ", isOnline: " + this.runningContextService.isOnline + ", cache: " + cache);
        if (!this.runningContextService.isOnline) {
            let data = await this.databaseService.getImageByUrl(value);
            if (data != null) {
                return data;
            }
        } else if (cache && value) {
            this.http.get(value, { responseType: "blob" }).toPromise()
                .then(async (res: Blob) => this.databaseService.storeImages([{
                    imageUrl: value,
                    data: `data:${res.type};base64,${encode(await new Response(res).arrayBuffer())}`
                }]));
        }
        return value;
    }
}
