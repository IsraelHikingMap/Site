import { inject, Injectable } from "@angular/core";
import { Map } from "maplibre-gl";
import { Store } from "@ngxs/store";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

@Injectable()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    private resolve: (value?: void | PromiseLike<void>) => void;
    private missingImagesArray: string[] = [];

    private readonly cancelableTimeoutService = inject(CancelableTimeoutService);
    private readonly store = inject(Store);

    public map: Map;
    public initializationPromise = new Promise<void>((resolve) => { this.resolve = resolve; });

    public setMap(map: Map) {
        this.map = map;
        this.resolve();
        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            this.cancelableTimeoutService.clearTimeoutByName("panned");
            if (pannedTimestamp) {
                this.cancelableTimeoutService.setTimeoutByName(() => {
                    this.store.dispatch(new SetPannedAction(null));
                }, MapService.NOT_FOLLOWING_TIMEOUT, "panned");
            }
        });

        this.map.on("dragstart", () => {
            this.store.dispatch(new SetPannedAction(new Date()));
        });

        this.map.on("styleimagemissing", async (e: {id: string}) => {
            if (!/^http/.test(e.id)) {
                return;
            }
            if (this.missingImagesArray.includes(e.id)) {
                return;
            }
            this.missingImagesArray.push(e.id);
            const image = await this.map.loadImage(e.id);
            this.map.addImage(e.id, image.data);
        });
    }
}
