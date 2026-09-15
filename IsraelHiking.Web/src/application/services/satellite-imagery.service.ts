import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import type { GetResourceResponse } from "maplibre-gl";

import { Urls } from "../urls";

@Service()
export class SatelliteImageryService {
    private static readonly TILE_TIMEOUT = 30000;

    private readonly httpClient = inject(HttpClient);

    /**
     * Handles the "satellite" protocol, registered by the map service.
     * The imagery is proxied by our server, which holds the provider's key and only serves it to a
     * subscribed user, so the tiles go through the http client in order to be sent with the user's token.
     */
    public async getTile(url: string): Promise<GetResourceResponse<ArrayBuffer>> {
        const [z, x, y] = url.replace("satellite://", "").split("/");
        const response = await firstValueFrom(this.httpClient
            .get(`${Urls.satelliteTilesApi}${z}/${x}/${y}`, { observe: "response", responseType: "arraybuffer" })
            .pipe(timeout(SatelliteImageryService.TILE_TIMEOUT)));
        return {
            data: response.body ?? new ArrayBuffer(0),
            cacheControl: response.headers.get("Cache-Control"),
            expires: response.headers.get("Expires")
        };
    }
}
