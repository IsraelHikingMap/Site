import { TestBed, inject } from "@angular/core/testing";

import { SnappingService } from "./snapping.service";
import { LatLngAlt } from "../models/models";

describe("SnappingService", () => {

    let mapMock: any;

    beforeEach(() => {
        mapMock = {
            project: (lngLat) => ({ x: lngLat.lng, y: lngLat.lat })
        };
        TestBed.configureTestingModule({
            providers: [SnappingService]
        });
    });

    it("Should snap to a given point", inject([SnappingService], (snappingService: SnappingService) => {

            snappingService.setMap(mapMock);

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
