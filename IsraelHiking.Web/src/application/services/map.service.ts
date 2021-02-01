import { Injectable } from "@angular/core";
import { Map } from "mapbox-gl";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { ApplicationState } from "../models/models";
import { SetPannedAction, SetPannedPayload } from "../reducres/in-memory.reducer";

@Injectable()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    public map: Map;
    public initializationPromise: Promise<void>;

    private resolve: (value?: void | PromiseLike<void>) => void;

    @select((state: ApplicationState) => state.inMemoryState.pannedTimestamp)
    public pannedTimestamp$: Observable<Date>;

    constructor(private readonly cancelableTimeoutService: CancelableTimeoutService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.initializationPromise = new Promise((resolve) => { this.resolve = resolve; });
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
    }
}