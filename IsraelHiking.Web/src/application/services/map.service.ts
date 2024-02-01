import { Injectable } from "@angular/core";
import { Map } from "maplibre-gl";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models/models";

@Injectable()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    public map: Map;
    public initializationPromise: Promise<void>;

    private resolve: (value?: void | PromiseLike<void>) => void;

    private missingImagesArray: string[];

    @Select((state: ApplicationState) => state.inMemoryState.pannedTimestamp)
    public pannedTimestamp$: Observable<Date>;

    constructor(private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly store: Store) {
        this.initializationPromise = new Promise((resolve) => { this.resolve = resolve; });
        this.missingImagesArray = [];
    }

    public setMap(map: Map) {
        this.map = map;
        this.resolve();
        this.pannedTimestamp$.subscribe(pannedTimestamp => {
            this.cancelableTimeoutService.clearTimeoutByGroup("panned");
            if (pannedTimestamp) {
                this.cancelableTimeoutService.setTimeoutByGroup(() => {
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
