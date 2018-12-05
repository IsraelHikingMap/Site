import { Router } from "@angular/router";
import { NgRedux } from "@angular-redux/store";
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
            imports: [RouterTestingModule],
            providers: [
                NgRedux,
                { provide: Router, useValue: routerMock },
                { provide: Window, useValue: windowMock }
            ]
        });
    });

    it("Should initialize location data from hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/1/2.2/3";

                hashService = new HashService(router, windowMock, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_MAP, 1, 2.2, 3], { replaceUrl: true });
            }));

    it("Should handle empty object in hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/";

                hashService = new HashService(router, windowMock, ngRedux);

                expect(hashService.getBaselayer()).toEqual(undefined);
                expect(router.navigate).toHaveBeenCalledWith(["/"], { replaceUrl: true });
            }));

    it("Should inialize share from hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?s=shareUrl";

                hashService = new HashService(router, windowMock, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_SHARE, "shareUrl"], { replaceUrl: true });
            }));

    it("Should get url for external file",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?url=external.file&baselayer=www.layer.com";

                hashService = new HashService(router, windowMock, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_URL, "external.file"],
                    { queryParams: { baselayer: "www.layer.com" }, replaceUrl: true });
            }));

    it("Should allow download parameter in hash",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/?download";

                hashService = new HashService(router, windowMock, ngRedux);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_DOWNLOAD], { replaceUrl: true });
            }));

    it("Should return base url",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "#!/";

                hashService = new HashService(router, windowMock, ngRedux);
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress);
            }));

    it("Should return share url",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "address";
                hashService = new HashService(router, windowMock, ngRedux);
                hashService.setApplicationState("share", "share");
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "address");
            }));

    it("Should return external url",
        inject([Router, Window, NgRedux],
            (router: Router, windowMock: Window, ngRedux: NgRedux<ApplicationState>) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "address";
                hashService = new HashService(router, windowMock, ngRedux);
                hashService.setApplicationState("url", "url");
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "address");
            }));
});