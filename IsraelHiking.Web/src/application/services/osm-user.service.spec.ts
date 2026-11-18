import { describe, beforeEach, it, expect } from "vitest";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";

import { OsmUserService } from "./osm-user.service";
import { NakebService } from "./nakeb.service";
import { Urls } from "../urls";

describe("OsmUserService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                OsmUserService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("should return a OSM user display name when sending a osm id and cache it", inject([OsmUserService, HttpTestingController], async (service: OsmUserService, mockBackend: HttpTestingController) => {
        let promise = service.getUserName("12");
        mockBackend.match(r => r.url.startsWith(`${Urls.osmApi}user/12`))[0].flush({
            user: {
                display_name: "Osm User Name"
            }
        });

        const response = await promise;
        expect(response).toBe("Osm User Name");

        promise = service.getUserName("12");
        mockBackend.expectNone(r => r.url.startsWith(`${Urls.osmApi}user`));
        const response2 = await promise;
        expect(response2).toBe("Osm User Name");
    }));

    it("should return nakeb's name without asking OSM when sending nakeb's user id", inject([OsmUserService, HttpTestingController], async (service: OsmUserService, mockBackend: HttpTestingController) => {
        const response = await service.getUserName(NakebService.USER_ID);
        mockBackend.expectNone(r => r.url.startsWith(`${Urls.osmApi}user`));
        expect(response).toBe(NakebService.USER_NAME);
    }));

    it("should get the details of the logged-in user and cache their name", inject([OsmUserService, HttpTestingController], async (service: OsmUserService, mockBackend: HttpTestingController) => {
        const promise = service.getLoggedInUserInfo();
        mockBackend.expectOne(Urls.osmUserDetails).flush({
            user: {
                id: 12,
                display_name: "Osm User Name",
                changesets: { count: 42 },
                img: { href: "https://osm.org/user-image.png" }
            }
        });

        const userInfo = await promise;
        expect(userInfo.id).toBe("12");
        expect(userInfo.displayName).toBe("Osm User Name");
        expect(userInfo.changeSets).toBe(42);
        expect(userInfo.imageUrl).toBe("https://osm.org/user-image.png");

        expect(await service.getUserName("12")).toBe("Osm User Name");
        mockBackend.expectNone(r => r.url.startsWith(Urls.osmUser + "12"));
    }));
});
