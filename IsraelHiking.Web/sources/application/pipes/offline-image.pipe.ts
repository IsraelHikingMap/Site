import { Pipe, PipeTransform  } from "@angular/core";

import { RunningContextService } from "../services/running-context.service";
import { DatabaseService } from "../services/database.service";

@Pipe({ name: "offlineImage" })
export class OfflineImagePipe implements PipeTransform {
    constructor(private readonly runningContextService: RunningContextService,
                private readonly databaseService: DatabaseService) {
    }

    public async transform(value: string): Promise<string> {
        if (!this.runningContextService.isOnline) {
            let data = await this.databaseService.getImageByUrl(value);
            if (data != null) {
                return data;
            }
        }
        return value;
    }
}
