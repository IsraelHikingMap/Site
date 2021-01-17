import { TestBed, inject } from "@angular/core/testing";

import { SnappingService } from "./snapping.service";
import { LatLngAlt } from "../models/models";
import { MapService } from "./map.service";

describe("SnappingService", () => {

    beforeEach(() => {
        let mapServiceMock = {
            map: {
                project: (lngLat) => ({ x: lngLat.lng, y: lngLat.lat })
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

            let snap = snappingService.snapToPoint({ lat: 2, lng: 1 }, [{
                title: "title",
                type: "star",
                description: "",
                id: "id",
                urls: [],
                latlng: {
                    lat: 2,
                    lng: 1
                } as LatLngAlt
            }]);
            expect(snap.markerData).not.toBeNull();
        }));
});
