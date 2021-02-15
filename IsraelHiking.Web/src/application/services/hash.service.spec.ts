import { Router } from "@angular/router";
import { MockNgRedux, NgReduxTestingModule } from "../reducers/infra/ng-redux-testing.module";
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
            imports: [RouterTestingModule, NgReduxTestingModule],
            providers: [
                { provide: Router, useValue: routerMock },
                { provide: MapService, useValue: null },
                HashService
            ]
        });

        MockNgRedux.reset();
    });

    it("Should return base url",
        inject([HashService], (hashService: HashService) => {

            MockNgRedux.getInstance().getState = () => ({
                inMemoryState: {}
            });

            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress);
        }));

    it("Should return share url",
        inject([HashService, Router], (hashService: HashService, routerMock: any) => {

            routerMock.createUrlTree = () => "share-address";
            MockNgRedux.getInstance().getState = () => ({
                inMemoryState: {
                    shareUrl: { id: "1" }
                }
            });

            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress + "share-address");
        }));

    it("Should return external url",
        inject([HashService, Router], (hashService: HashService, routerMock: any) => {
            routerMock.createUrlTree = () => "file-address";
            MockNgRedux.getInstance().getState = () => ({
                inMemoryState: {
                    fileUrl: "fileUrl"
                }
            });
            let href = hashService.getHref();

            expect(href).toBe(Urls.baseAddress + "file-address");
        }));
});
