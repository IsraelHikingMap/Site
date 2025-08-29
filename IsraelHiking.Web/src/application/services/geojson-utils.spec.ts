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
        expect(GeoJSONUtils.hasExtraData({properties: { image: "File:valid-image.png"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });

    it("should return has extra data for feature with mtb:name", () => {
        expect(GeoJSONUtils.hasExtraData({properties: { "mtb:name": "mtb:name" }} as any as GeoJSON.Feature, "he")).toBeTruthy();
    });
    
    it("should return only valid image urls", () => {
        const feature = {
            properties: {
                image: "File:123.jpg",
                image1: "www.wikimedia.org/Building_no_free_image_yet",
                image2: "www.wikimedia.org/svg.png",
                image3: "www.wikimedia.org/svg",
                image4: "www.wikimedia.org/good-image.png",
                image5: "inature.info/image.jpg",
                image6: "nakeb.co.il/image.jpg",
                image7: "jeepolog.com/image.jpg",
                image8: "invalid-url",
                image9: "https://example.com/image4.gif"
            }
        } as any as GeoJSON.Feature;
        const validUrls = GeoJSONUtils.getValidImageUrls(feature);
        expect(validUrls).toEqual([
            "File:123.jpg",
            "www.wikimedia.org/good-image.png",
            "inature.info/image.jpg",
            "nakeb.co.il/image.jpg",
            "jeepolog.com/image.jpg"
        ]);
    });
});