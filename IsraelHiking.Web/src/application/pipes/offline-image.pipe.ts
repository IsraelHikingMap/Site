import { inject, Pipe, PipeTransform } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { encode } from "base64-arraybuffer";
import { firstValueFrom } from "rxjs";

import { RunningContextService } from "../services/running-context.service";
import { DatabaseService } from "../services/database.service";

@Pipe({
    name: "offlineImage",
    standalone: false
})
export class OfflineImagePipe implements PipeTransform {

    private readonly http = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly databaseService = inject(DatabaseService);

    public async transform(value: string, cache: boolean): Promise<string> {
        if (!this.runningContextService.isOnline) {
            const data = await this.databaseService.getImageByUrl(value);
            if (data != null) {
                return data;
            }
        } else if (cache && value) {
            firstValueFrom(this.http.get(value, { responseType: "blob" }))
                .then(async (res: Blob) => this.databaseService.storeImages([{
                    imageUrl: value,
                    data: `data:${res.type};base64,${encode(await new Response(res).arrayBuffer())}`
                }]));
        }
        return value;
    }
}
