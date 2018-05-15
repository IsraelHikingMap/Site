import { Router, NavigationEnd } from "@angular/router";
import { TestBed, inject } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs/Subject";
import * as L from "leaflet";

import { HashService } from "./hash.service";
import { MapService } from "./map.service";
import { MapServiceMockCreator } from "./map.service.spec";
import { Urls } from "../common/Urls";

describe("HashService", () => {
    let hashService: HashService;
    let mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let routerMock = {
            navigateByUrl: jasmine.createSpy("navigateByUrl"),
            events: new Subject<any>()
        }
        let windowMock = {
            location: {
                href: "href",
                reload: jasmine.createSpy("reload"),
            },
            open: () => { }
        }
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
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/1/2.2/3";

        hashService = new HashService(router, windowMock, mapService);

        expect(mapServiceMock.mapService.map.getCenter().lat).toBe(2.2);
        expect(mapServiceMock.mapService.map.getCenter().lng).toBe(3);
        expect(mapServiceMock.mapService.map.getZoom()).toBe(1);
    }));

    it("Should initialize a baselayer address from hash",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?baselayer=www.layer.com";

        hashService = new HashService(router, windowMock, mapService);

        let baseLayer = hashService.getBaseLayer();
        expect(baseLayer.address).toBe("www.layer.com");
        expect(baseLayer.key).toBe("");
    }));

    it("Should initialize a baselayer key from hash",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?baselayer=Israel_Hiking_Map";

        hashService = new HashService(router, windowMock, mapService);

        let baseLayer = hashService.getBaseLayer();
        expect(baseLayer.key).toBe("Israel Hiking Map");
        expect(baseLayer.address).toBe("");
    }));

    it("Should handle empty object in hash",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.getBaseLayer().key).toEqual("");
        expect(hashService.getBaseLayer().address).toEqual("");
    }));

    it("Should inialize share from hash",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?s=shareUrl";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.getShareUrlId()).toBe("shareUrl");
    }));

    it("Should get url for external file",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?url=external.file";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.externalUrl).toBe("external.file");
    }));

    it("Should allow download parameter in hash",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?download";

        hashService = new HashService(router, windowMock, mapService);

        expect(hashService.download).toBeTruthy();
    }));

    it("Should update url with location when panning the map",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/10/20/30.0";

        hashService = new HashService(router, windowMock, mapService);
        mapServiceMock.mapService.map.panTo(L.latLng(1, 2));

        expect(router.navigateByUrl).toHaveBeenCalledWith("/#!/10/1.0000/2.0000", { replaceUrl: true });
        expect(windowMock.location.hash);
    }));

    it("Should changes to another geolocation when user changes the addressbar",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/";
        hashService = new HashService(router, windowMock, mapService);
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));
        let flyTo = spyOn(mapServiceMock.mapService.map, "flyTo");

        windowMock.location.hash = "#!/1/2.2/3.3";
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(flyTo).toHaveBeenCalled();
        expect(windowMock.location.reload).not.toHaveBeenCalled();
    }));

    it("Should remove share url if deleted from addressbar",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?s=1234";
        hashService = new HashService(router, windowMock, mapService);
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        windowMock.location.hash = "#!/1/2.2/3.3";
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(hashService.getShareUrlId()).toBe("");
    }));

    it("Should reload page when user changes the addressbar to an invalid geolocation",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/1/2/3";
        hashService = new HashService(router, windowMock, mapService);
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        windowMock.location.hash = "#!/42";
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(windowMock.location.reload).toHaveBeenCalled();
    }));

    it("Should reload page when user changes share url in addressbar",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?s=1234";
        hashService = new HashService(router, windowMock, mapService);
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        windowMock.location.hash = "#!/?s=5678";
        (router.events as Subject<any>).next(new NavigationEnd(1, "", ""));

        expect(windowMock.location.reload).toHaveBeenCalled();
    }));

    it("Should return base url",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/";

        hashService = new HashService(router, windowMock, mapService);
        let href = hashService.getHref();

        expect(href).toBe(Urls.baseAddress);
    }));

    it("Should return share url",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?s=1234";

        hashService = new HashService(router, windowMock, mapService);
        let href = hashService.getHref();

        expect(href).toBe(Urls.baseAddress + "/" + windowMock.location.hash);
    }));

    it("Should return external url",
        inject([Router, Window, MapService], (router: Router, windowMock: Window, mapService: MapService) => {

        windowMock.location.hash = "#!/?url=1234";

        hashService = new HashService(router, windowMock, mapService);
        let href = hashService.getHref();

        expect(href).toBe(Urls.baseAddress + "/" + windowMock.location.hash);
    }));
});