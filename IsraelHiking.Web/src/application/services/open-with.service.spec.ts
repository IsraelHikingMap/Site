import { describe, it, expect } from "vitest";
import { OpenWithService } from "./open-with.service";

describe("Open With Service", () => {
    it("Should prefer the place coordinates over the viewport centre", () => {
        const href = "https://www.google.com/maps/place/Masada/@31.3151,35.3411,17z/data=!3m1!4b1!4m6!3m5!8m2!3d31.3156!4d35.3535";
        expect(OpenWithService.parseMapUrlCoordinates(href)).toEqual({ lat: 31.3156, lng: 35.3535 });
    });

    it("Should parse the query coordinates of a shared point", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.google.com/?q=31.7683,35.2137&z=17"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps/search/?api=1&query=31.7683,35.2137"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should parse the query coordinates without a trailing zoom parameter", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.google.com/?q=31.7683,35.2137"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should fall back to the viewport centre when there is nothing better", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps/@31.7683,35.2137,15z"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should parse negative coordinates", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps/@-33.8688,-151.2093,15z"))
            .toEqual({ lat: -33.8688, lng: -151.2093 });
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.google.com/?q=-33.8688,-151.2093"))
            .toEqual({ lat: -33.8688, lng: -151.2093 });
    });

    it("Should parse whole number coordinates", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.google.com/?q=31,35"))
            .toEqual({ lat: 31, lng: 35 });
    });

    it("Should parse url encoded coordinates", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps/search/?api=1&query=31.7683%2C35.2137"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should return null for a url without coordinates", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.app.goo.gl/abc123")).toBeNull();
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps/place/Masada")).toBeNull();
    });

    it("Should parse an Apple Maps url", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple.com/?ll=31.7683,35.2137&q=Jerusalem"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple.com/?sll=31.7683,35.2137&z=15"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple.com/place?coordinate=31.7683%2C35.2137&name=Old+City"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should not mistake an Apple Maps place name for a coordinate", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple.com/?q=Masada&ll=31.3156,35.3535"))
            .toEqual({ lat: 31.3156, lng: 35.3535 });
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple.com/?address=Jaffa+Street&q=Cafe"))
            .toBeNull();
    });

    it("Should return null for an Apple Maps short link, which holds no coordinates", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://maps.apple/p/abc123")).toBeNull();
    });

    it("Should recover the place from the S2 cell of a feature id", async () => {
        const href = "https://www.google.com/maps/place/Mt+Hood,+Oregon+97041,+United+States/" +
            "data=!4m2!3m1!1s0x54be1c5501719a05:0x831d76c0b7aea9ea!18m1!1e1?utm_source=mstt_1&entry=gps";
        const latLng = await OpenWithService.parseFeatureIdCoordinates(href);
        expect(latLng.lat).toBeCloseTo(45.373444, 5);
        expect(latLng.lng).toBeCloseTo(-121.695662, 5);
    });

    it("Should recover the place from the feature id of a search link", async () => {
        const href = "https://www.google.com/maps?q=108,+Ramot+Menashe&ftid=0x151da83e244b3a6d:0xcaac348095b6c17d" +
            "&entry=gps&shh=CAE&g_st=com.mapeak";
        const latLng = await OpenWithService.parseFeatureIdCoordinates(href);
        expect(latLng.lat).toBeCloseTo(32.595814, 5);
        expect(latLng.lng).toBeCloseTo(35.061285, 5);
    });

    it("Should not mistake a house number in a search query for a coordinate", () => {
        expect(OpenWithService.parseMapUrlCoordinates("https://www.google.com/maps?q=108,+Ramot+Menashe&entry=gps"))
            .toBeNull();
    });

    it("Should return null for a feature id without a usable cell", async () => {
        expect(await OpenWithService.parseFeatureIdCoordinates("https://www.google.com/maps/place/Masada"))
            .toBeNull();
        expect(await OpenWithService.parseFeatureIdCoordinates("https://www.google.com/maps/place/X/data=!1s0x0:0x831d76c0"))
            .toBeNull();
    });

    it("Should parse a plain geo url", () => {
        expect(OpenWithService.parseGeoUrlCoordinates("geo:31.7683,35.2137")).toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseGeoUrlCoordinates("geo:31.7683,35.2137?z=15")).toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseGeoUrlCoordinates("geo:-33.8688,-151.2093")).toEqual({ lat: -33.8688, lng: -151.2093 });
    });

    it("Should prefer the query coordinates of a geo url over its placeholder prefix", () => {
        expect(OpenWithService.parseGeoUrlCoordinates("geo:0,0?q=31.7683,35.2137(Jerusalem)"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(OpenWithService.parseGeoUrlCoordinates("geo:0,0?q=31.7683%2C35.2137"))
            .toEqual({ lat: 31.7683, lng: 35.2137 });
    });

    it("Should not treat a geo url holding a textual query as a point in the ocean", () => {
        expect(OpenWithService.parseGeoUrlCoordinates("geo:0,0?q=Masada+National+Park")).toBeNull();
        expect(OpenWithService.parseGeoUrlCoordinates("geo:0,0")).toBeNull();
    });
});
