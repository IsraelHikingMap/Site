import { Router } from "@angular/router";
import { NgxsModule, Store } from "@ngxs/store";
import { TestBed, inject } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs";

import { HashService } from "./hash.service";
import { Urls } from "../urls";
import { MapService } from "./map.service";

describe("HashService", () => {
    beforeEach(() => {
        let routerMock = {
            navigate: jasmine.createSpy("navigate"),
            events: new Subject<any>(),
            createUrlTree: () => { }
        };
        TestBed.configureTestingModule({
            imports: [RouterTestingModule, NgxsModule.forRoot([])],
            providers: [
                { provide: Router, useValue: routerMock },
                { provide: MapService, useValue: null },
                HashService
            ]
        });
    });

    it("Should return map address",
        inject([HashService, Router, Store], (hashService: HashService, routerMock: any, store: Store) => {
            routerMock.createUrlTree = (arr: []) => arr.join("/");
            store.reset({
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress + "map/2.00/2.000000/3.000000");
        }));

    it("Should return share url",
        inject([HashService, Router, Store], (hashService: HashService, routerMock: any, store: Store) => {

            routerMock.createUrlTree = () => "share-address";
            store.reset({
                inMemoryState: {
                    shareUrl: { id: "1" }
                }
            });

            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress + "share-address");
        }));

    it("Should return external url",
        inject([HashService, Router, Store], (hashService: HashService, routerMock: any, store: Store) => {
            routerMock.createUrlTree = (array: [], options: any) => "file-address?" + options.queryParams.baselayer;
            store.reset({
                inMemoryState: {
                    fileUrl: "fileUrl"
                },
                layersState: { 
                    selectedBaseLayerKey: "base-layer"
                }
            });
            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress + "file-address?base-layer");
        }));
});
