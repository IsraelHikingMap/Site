import { describe, it, expect } from "vitest";
import { GeoJSONUtils } from "./geojson-utils";

describe("GeoJsonUtils", () => {
    it("should set a property", () => {
        const feature = { properties: {} } as unknown as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name");
        expect(feature.properties.name).toBe("name");
    });

    it("should set a property that already exists", () => {
        const feature = { properties: { name: "name" } } as unknown as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name1");
        expect(feature.properties.name1).toBe("name1");
    });

    it("should set a property that already exists", () => {
        const feature = { properties: { name: "name", name1: "name1" } } as unknown as GeoJSON.Feature;
        GeoJSONUtils.setProperty(feature, "name", "name2");
        expect(feature.properties.name2).toBe("name2");
    });

    it("should not set a value when unique is requested", () => {
        const feature = { properties: { name: "name1" } } as unknown as GeoJSON.Feature;
        GeoJSONUtils.setPropertyUnique(feature, "name", "name1");
        expect(feature.properties.name1).toBeUndefined()
    });

    it("should get title when there's mtb name with language", () => {
        const results = GeoJSONUtils.getTitle({ properties: { "mtb:name:he": "name" } } as unknown as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get title when there's mtb name without language", () => {
        const results = GeoJSONUtils.getTitle({ properties: { "mtb:name": "name" } } as unknown as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get English title when there's mtb name without language", () => {
        const results = GeoJSONUtils.getTitle({ properties: { "mtb:name:en": "name-en" } } as unknown as GeoJSON.Feature, "he");
        expect(results).toBe("name-en");
    });

    it("should get title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({ properties: { name: "name" } } as unknown as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    });

    it("should get English title even when there's no title for language description", () => {
        const results = GeoJSONUtils.getTitle({ properties: { "name:en": "name-en" } } as unknown as GeoJSON.Feature, "he");
        expect(results).toBe("name-en");
    });

    it("should get urls from the legacy numbered website properties", () => {
        const feature = { properties: { website: "url1", website1: "url2" } } as unknown as GeoJSON.Feature;
        expect(GeoJSONUtils.getUrls(feature)).toEqual(["url1", "url2"]);
    });

    it("should get urls from a semicolon separated website property", () => {
        const feature = { properties: { website: "url1;url2 ; url3;" } } as unknown as GeoJSON.Feature;
        expect(GeoJSONUtils.getUrls(feature)).toEqual(["url1", "url2", "url3"]);
    });

    it("should get urls from both a semicolon separated and the legacy numbered website properties", () => {
        const feature = { properties: { website: "url1;url2", website1: "url3" } } as unknown as GeoJSON.Feature;
        expect(GeoJSONUtils.getUrls(feature)).toEqual(["url1", "url2", "url3"]);
    });

    it("should encode a semicolon inside a url", () => {
        expect(GeoJSONUtils.encodeUrl("https://some.com/a;b")).toBe("https://some.com/a%3Bb");
    });

    it("should not encode an already encoded semicolon inside a url", () => {
        expect(GeoJSONUtils.encodeUrl("https://some.com/a%3Bb")).toBe("https://some.com/a%3Bb");
    });

    it("should split a url with an encoded semicolon as a single url", () => {
        const feature = { properties: { website: "https://some.com/a%3Bb;https://other.com" } } as unknown as GeoJSON.Feature;
        expect(GeoJSONUtils.getUrls(feature)).toEqual(["https://some.com/a%3Bb", "https://other.com"]);
    });

    it("should return color when colour property exists", () => {
        const feature = { properties: { colour: "red" } } as unknown as GeoJSON.Feature;
        const color = GeoJSONUtils.getFeatureColor(feature);
        expect(color).toBe("red");
    });

    it("should return color when osmc:symbol property exists", () => {
        const feature = { properties: { "osmc:symbol": "green:white:green_bar" } } as unknown as GeoJSON.Feature;
        const color = GeoJSONUtils.getFeatureColor(feature);
        expect(color).toBe("green");
    });

    it("should return null when no color properties exist", () => {
        const feature = { properties: { name: "name" } } as unknown as GeoJSON.Feature;
        const color = GeoJSONUtils.getFeatureColor(feature);
        expect(color).toBeNull();
    });
});