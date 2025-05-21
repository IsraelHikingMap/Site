import { GeoJSONUtils } from "./geojson-utils";

describe("GeoJsonUtils", () => {
    it("should set a property", () => {
        const feature = {properties: {}} as any as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name");
        expect(feature.properties.name).toBe("name");
    });

    it("should set a property that already exists", () => {
        const feature = {properties: {name: "name"}} as any as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name1");
        expect(feature.properties.name1).toBe("name1");
    });

    it("should set a property that already exists", () => {
        const feature = {properties: {name: "name", name1: "name1"}} as any as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name2");
        expect(feature.properties.name2).toBe("name2");
    });

    it("should not set a value when unique is requested", () => {
        const feature = {properties: {name: "name1"}} as any as GeoJSON.Feature;
        GeoJSONUtils.setPropertyUnique(feature, "name", "name1");
        expect(feature.properties.name1).toBeUndefined()
    });

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

    it("should get English title when there's mtb name without language", () => {
        const results = GeoJSONUtils.getTitle({properties: { "mtb:name:en": "name-en"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name-en");
    });

    it("should get title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({properties: { name: "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get English title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({properties: { "name:en": "name-en"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name-en");
    });
    it("should return has extra data for feature with description", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { "description:he": "desc"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });

    it("should return has extra data for feature with image", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { image: "image-url"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });

    it("should return has extra data for feature with wikipedia", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { wikipedia: "wiki" }} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });

    it("should return has extra data for feature with wikidat", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { wikidata: "wiki" }} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });
});