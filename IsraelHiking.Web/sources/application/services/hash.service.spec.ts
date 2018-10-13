import { Router } from "@angular/router";
import { TestBed, inject } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs";

import { HashService, RouteStrings } from "./hash.service";
import { MapService } from "./map.service";
import { MapServiceMockCreator } from "./map.service.spec";
import { Urls } from "../urls";

describe("HashService", () => {
    let hashService: HashService;
    let mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
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
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: Router, useValue: routerMock },
                { provide: Window, useValue: windowMock }
            ]
        });
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should initialize location data from hash",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/1/2.2/3";

                hashService = new HashService(router, windowMock, mapService);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_MAP, 1, 2.2, 3], { replaceUrl: true });
            }));

    it("Should handle empty object in hash",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/";

                hashService = new HashService(router, windowMock, mapService);

                expect(hashService.getBaselayer()).toEqual(undefined);
                expect(router.navigate).toHaveBeenCalledWith(["/"], { replaceUrl: true });
            }));

    it("Should inialize share from hash",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/?s=shareUrl";

                hashService = new HashService(router, windowMock, mapService);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_SHARE, "shareUrl"], { replaceUrl: true });
            }));

    it("Should get url for external file",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/?url=external.file&baselayer=www.layer.com";

                hashService = new HashService(router, windowMock, mapService);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_URL, "external.file"],
                    { queryParams: { baselayer: "www.layer.com" }, replaceUrl: true });
            }));

    it("Should allow download parameter in hash",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/?download";

                hashService = new HashService(router, windowMock, mapService);

                expect(router.navigate).toHaveBeenCalledWith([RouteStrings.ROUTE_DOWNLOAD], { replaceUrl: true });
            }));

    it("Should update url with location when panning the map",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/10/20/30.0";

                hashService = new HashService(router, windowMock, mapService);
                mapServiceMock.mapService.map.panTo(LatLngAlt(1, 2));

                expect(JSON.stringify((router.navigate as jasmine.Spy).calls.mostRecent().args))
                    .toBe(JSON.stringify([[RouteStrings.ROUTE_MAP, 13, "1.0000", "2.0000"], { replaceUrl: true }]));
            }));

    it("Should return base url",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "#!/";

                hashService = new HashService(router, windowMock, mapService);
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress);
            }));

    it("Should return share url",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "address";
                hashService = new HashService(router, windowMock, mapService);
                hashService.setApplicationState("share", "share");
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "address");
            }));

    it("Should return external url",
        inject([Router, Window, MapService],
            (router: Router, windowMock: Window, mapService: MapService) => {

                windowMock.location.hash = "/";
                (router as any).createUrlTree = () => "address";
                hashService = new HashService(router, windowMock, mapService);
                hashService.setApplicationState("url", "url");
                let href = hashService.getHref();

                expect(href).toBe(Urls.baseAddress + "address");
            }));
});