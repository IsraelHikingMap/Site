import { Injectable } from "@angular/core";
import { Map } from "maplibre-gl";
import { Observable } from "rxjs";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models/models";

@Injectable()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    public map: Map;
    public initializationPromise: Promise<void>;

    private resolve: (value?: void | PromiseLike<void>) => void;

    private missingImagesArray: string[];

    @select((state: ApplicationState) => state.inMemoryState.pannedTimestamp)
    public pannedTimestamp$: Observable<Date>;

    constructor(private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
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
                    this.ngRedux.dispatch(new SetPannedAction({ pannedTimestamp: null }));
                }, MapService.NOT_FOLLOWING_TIMEOUT, "panned");
            }
        });

        this.map.on("dragstart", () => {
            this.ngRedux.dispatch(new SetPannedAction({ pannedTimestamp: new Date() }));
        });

        this.map.on("styleimagemissing", (e: {id: string}) => {
            if (!/^http/.test(e.id)) {
                return;
            }
            if (this.missingImagesArray.includes(e.id)) {
                return;
            }
            this.missingImagesArray.push(e.id);
            this.map.loadImage(e.id, (_: Error, image: HTMLImageElement) => {
                this.map.addImage(e.id, image);
            });
        });
    }
}
