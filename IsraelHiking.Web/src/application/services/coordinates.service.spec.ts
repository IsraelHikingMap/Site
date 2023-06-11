import { inject, TestBed } from "@angular/core/testing";
import { CoordinatesService } from "./coordinates.service";

describe("Coordinates Service", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                CoordinatesService
            ]
        });
    });

    it("Should parse coordinates correctly", inject([CoordinatesService], (service: CoordinatesService) => {
        expect(service.parseCoordinates("-11°, +12.2")).toEqual({lat: -11, lng: 12.2});
        expect(service.parseCoordinates("-90.000/+180")).toEqual({lat: -90, lng: 180});
        expect(service.parseCoordinates("+90.0001,-180")).toBeNull();
        expect(service.parseCoordinates("-90.0001 +180")).toBeNull();
        expect(service.parseCoordinates("+90 -180.0001")).toBeNull();
        expect(service.parseCoordinates("-90 +180.0001")).toBeNull();
        expect(service.parseCoordinates("+32.2")).toBeNull();
        expect(service.parseCoordinates("+32 2 55 16")).toBeNull();
        expect(service.parseCoordinates("11°N 12.2 E")).toEqual({lat: 11, lng: 12.2});
        expect(service.parseCoordinates("11° 6' 36\" S / 012 12 36 W")).toEqual({lat: -11.11, lng: -12.21});
        expect(service.parseCoordinates("11:6\u00b4 36\u02ba S 112° 12\u02b9 54\u201d W")).toEqual({lat: -11.11, lng: -112.215});
        expect(service.parseCoordinates("11° 6\u02bc 36\u2033 S 12° 12\u02ca 54\u275e W")).toEqual({lat: -11.11, lng: -12.215});
        expect(service.parseCoordinates("11° 6\u201d 36\u3003 S 12° 12\u2032 54\u301e W")).toEqual({lat: -11.11, lng: -12.215});
        expect(service.parseCoordinates("11° 6\u275c 36S 12° 12W")).toEqual({lat: -11.11, lng: -12.2});
        expect(service.parseCoordinates("11°6'36\"N ,12 61\u2032 0\u2033 W")).toBeNull();
        expect(service.parseCoordinates("11°6'36\"N ,12 12\u2032 72\u2033 W")).toBeNull();
        expect(service.parseCoordinates("33:05:23N 35:19:10E")).not.toBeNull();
        expect(service.parseCoordinates("33:05S 35:19W")).not.toBeNull();
        expect(service.parseCoordinates("11°6'36\"W ,12 12\u2032 54\u2033 N")).toEqual({lat: 12.215, lng: -11.11});
        expect(service.parseCoordinates("11°6'36\"W ,12 12\u2032 72\u2033 N")).toBeNull();
        expect(service.parseCoordinates("  32°   33'34\"   35°36:37   ")).not.toBeNull();
        expect(service.parseCoordinates("32   33\u00b4 34.1   35° 36: 37.2")).not.toBeNull();
        expect(service.parseCoordinates("32 33 34 35 36 37")).not.toBeNull();
        expect(service.parseCoordinates("-32 33 34 +35 36 37")).not.toBeNull();
        expect(service.parseCoordinates("32 33 34 35 36")).toBeNull();
        expect(service.parseCoordinates("32 33.2 34 35 36.3 37")).toBeNull();
        expect(service.parseCoordinates("200000 600000")).not.toBeNull();
        expect(service.parseCoordinates("200000,600000")).not.toBeNull();
        expect(service.parseCoordinates("200000/600000")).not.toBeNull();
        expect(service.parseCoordinates("120000 900000")).not.toBeNull();
        expect(service.parseCoordinates("120000,200000").lng).toBeCloseTo(34.6788, 6);
        expect(service.parseCoordinates("120000,200000").lat).toBeCloseTo(32.3928, 4);
        expect(service.parseCoordinates("120000 1349999")).not.toBeNull();
        expect(service.parseCoordinates("   100000  600000   ")).not.toBeNull();
        expect(service.parseCoordinates("   100000 , 600000   ")).not.toBeNull();
        expect(service.parseCoordinates("300000 600000")).not.toBeNull();
        expect(service.parseCoordinates("1200001100000")).toBeNull();
        expect(service.parseCoordinates("200000600000")).toBeNull();
        expect(service.parseCoordinates("300001,600000")).toBeNull();
        expect(service.parseCoordinates("99999,600000")).toBeNull();
        expect(service.parseCoordinates("300001,100000")).toBeNull();
        expect(service.parseCoordinates("200000,1350000")).toBeNull();
    }));

    it("Should round trip coordinates conversion", inject([CoordinatesService], (service: CoordinatesService) => {
        const expected = {lat: 32, lng: 35};
        const roundTrip = service.fromItm(service.toItm(expected));
        expect(roundTrip.lat).toBeCloseTo(expected.lat, 8);
        expect(roundTrip.lng).toBeCloseTo(expected.lng, 9);
    }));
});
