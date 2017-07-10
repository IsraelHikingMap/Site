import { TestBed, async, inject } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs/Subject";
import { Router, NavigationEnd } from "@angular/router";
import { HashService } from "./hash.service";
import { MapService } from "./map.service";
import { MapServiceMockCreator } from "./map.service.spec";

describe("HashService", () => {
    var hashService: HashService;
    var mapServiceMock: MapServiceMockCreator;
    //var routerMock: any;
    //var windowMock: any;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        var routerMock = {
            navigateByUrl: jasmine.createSpy("navigateByUrl"),
            events: new Subject<any>()
        }
        var windowMock = {
            location: {
                href: "href",
                reload: jasmine.createSpy("reload"),
            }
        }
        TestBed.configureTestingModule({
            imports: [RouterTestingModule],
            providers: [
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: Router, useValue: routerMock },
                { provide: Window, useValue: windowMock },
            ]
        });
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should initialize location data from hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/1/2/3";

        hashService = new HashService(router, windowMock, mapService);
        
        expect(mapServiceMock.mapService.map.getCenter().lat).toBe(2);
        expect(mapServiceMock.mapService.map.getCenter().lng).toBe(3);
        expect(mapServiceMock.mapService.map.getZoom()).toBe(1);
    }));
    

    it("Should initialize a baselayer address from hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/?baselayer=www.layer.com";

        hashService = new HashService(router, windowMock, mapService);

        let baseLayer = hashService.getBaseLayer();
        expect(baseLayer.address).toBe("www.layer.com");
        expect(baseLayer.key).toBe("");
    }));

    

    it("Should initialize a baselayer key from hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/?baselayer=Israel_Hiking_Map";

        hashService = new HashService(router, windowMock, mapService);

        let baseLayer = hashService.getBaseLayer();
        expect(baseLayer.key).toBe("Israel Hiking Map");
        expect(baseLayer.address).toBe("");
    }));

    

    it("Should handle empty object in hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.getBaseLayer().key).toEqual("");
        expect(hashService.getBaseLayer().address).toEqual("");
    }));

    it("Should inialize siteUrl from hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/?s=siteUrl";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.siteUrl).toBe("siteUrl");
    }));

    it("Should get url for external file", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/?url=external.file";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.externalUrl).toBe("external.file");
    }));

    it("Should allow download parameter in hash", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "#!/?download";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.download).toBeTruthy();
    }));

    it("Should update url with location", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        //spyOn($rootScope, "$$phase").and.returnValue(false);
        //spyOn($location, "path").and.returnValue("#/10/20/30");
        windowMock.location.hash = "#!/10/20/30";

        hashService = new HashService(router, windowMock, mapService);
        mapServiceMock.mapService.map.panTo(L.latLng(1, 2));

        expect(router.navigateByUrl).toHaveBeenCalledWith("/#!/10/1.0000/2.0000", { replaceUrl: true });
        expect(windowMock.location.hash)
    }));

    it("changes the map location when addressbar changes to another geolocation", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "/#!/";
        hashService = new HashService(router, windowMock, mapService);
        windowMock.location.hash = "#!/1/2/3";

        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(mapServiceMock.mapService.map.getZoom()).toBe(1);
        expect(mapServiceMock.mapService.map.getCenter().lat).toBe(2);
        expect(mapServiceMock.mapService.map.getCenter().lng).toBe(3);
    }));

    it("reload page when address is not a geolocation", inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {
        windowMock.location.hash = "/#!/";
        hashService = new HashService(router, windowMock, mapService);
        windowMock.location.hash = "#!/42";

        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(windowMock.location.reload).toHaveBeenCalled();
    }));
});