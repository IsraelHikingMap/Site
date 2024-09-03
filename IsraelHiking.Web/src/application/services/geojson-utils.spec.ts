import { GeoJSONUtils } from "./geojson-utils";

describe("GeoJsonUtils", () => {
    it("should get extenal description for hebrew", () => {
        const results = GeoJSONUtils.getExternalDescription(
            {properties: { "poiExternalDescription:he": "desc"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("desc");
    });

    it("should get extenal description for language independant", () => {
        const results = GeoJSONUtils.getExternalDescription(
            {properties: { poiExternalDescription: "desc"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("desc");
    });

    it("should get title when there's mtb name with language", () => {
        const results = GeoJSONUtils.getTitle({properties: { "mtb:name:he": "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get title when there's mtb name without language", () => {
        const results = GeoJSONUtils.getTitle({properties: { "mtb:name": "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({properties: { name: "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({properties: { name: "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });
    it("should return has extra data for feature with description", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { "description:he": "desc"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });

    it("should return has extra data for feature with image", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { image: "image-url"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });
});