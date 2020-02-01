import { Router } from "@angular/router";
import { NgRedux } from "@angular-redux/store";
import { MockNgRedux, NgReduxTestingModule } from "@angular-redux/store/testing";
import { TestBed, inject } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs";

import { HashService, RouteStrings } from "./hash.service";
import { Urls } from "../urls";
import { ApplicationState } from "../models/models";

describe("HashService", () => {
    let hashService: HashService;

    beforeEach(() => {
        let routerMock = {
            navigate: jasmine.createSpy("navigate"),
            events: new Subject<any>(),
            createUrlTree: () => { }
        };
        let windowMock = {
            location: {
                href: "href",
                reload: jasmine.createSpy("reload"),
            },
            open: () => { }
        };
        TestBed.configureTestingModule({
            imports: [RouterTestingModule, NgReduxTestingModule],
            providers: [
                { provide: Router, useValue: routerMock },
                { provide: Window, useValue: windowMock }
            ]
        });

        MockNgRedux.reset();
    });

    it("Should initialize location data from hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/1/2.2/3";

                hashService = new HashService(router, windowMock, null, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_MAP, 1, 2.2, 3], { replaceUrl: true });
            }));

    it("Should handle empty object in hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/";

                hashService = new HashService(router, windowMock, null, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith(["/"], { replaceUrl: true });
            }));

    it("Should inialize share from hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?s=shareUrl";

                hashService = new HashService(router, windowMock, null, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_SHARE, "shareUrl"], { replaceUrl: true });
            }));

    it("Should get url for external file",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?url=external.file&baselayer=www.layer.com";

                hashService = new HashService(router, windowMock, null, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_URL, "external.file"],
                    { queryParams: { baselayer: "www.layer.com" }, replaceUrl: true });
            }));

    it("Should allow download parameter in hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?download";

                hashService = new HashService(router, windowMock, null, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_DOWNLOAD], { replaceUrl: true });
            }));

    it("Should return base url",
        inject([Router, Window],
            (router: Router, windowMock: Window) => {

                windowMock.location.hash = "#!/";
                MockNgRedux.getInstance().getState = () => ({
                    inMemoryState: {}
                });
                hashService = new HashService(router, windowMock, null, MockNgRedux.getInstance());

                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress);
            }));

    it("Should return share url",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "share-address";
                MockNgRedux.getInstance().getState = () => ({
                    inMemoryState: {
                        shareUrl: { id: "1" }
                    }
                });
                hashService = new HashService(router, windowMock, null, MockNgRedux.getInstance());

                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "share-address");
            }));

    it("Should return external url",
        inject([Router, Window],
            (router: Router, windowMock: Window) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "file-address";
                MockNgRedux.getInstance().getState = () => ({
                    inMemoryState: {
                        fileUrl: "fileUrl"
                    }
                });
                hashService = new HashService(router, windowMock, null, MockNgRedux.getInstance());
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "file-address");
            }));
});
