import { TestBed, inject } from "@angular/core/testing";

import { SnappingService } from "./snapping.service";
import { MapService } from "./map.service";
import type { LatLngAltTime } from "../models";

describe("SnappingService", () => {

    beforeEach(() => {
        const mapServiceMock = {
            map: {
                project: (lngLat: LatLngAltTime) => ({ x: lngLat.lng, y: lngLat.lat })
            }
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: MapService, useValue: mapServiceMock },
                SnappingService
            ]
        });
    });

    it("Should snap to a given point", inject([SnappingService], (snappingService: SnappingService) => {

        const snap = snappingService.snapToPoint({ lat: 2, lng: 1 }, [{
            title: "title",
            type: "star",
            description: "",
            id: "id",
            urls: [],
            latlng: {
                lat: 2,
                lng: 1
            } as LatLngAltTime
        }]);
        expect(snap.markerData).not.toBeNull();
    }));
});
