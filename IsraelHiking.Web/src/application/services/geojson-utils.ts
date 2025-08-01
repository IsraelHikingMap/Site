import { Immutable } from "immer";
import { LatLngAlt } from "../models/models";

export class GeoJSONUtils {
    public static setPropertyUnique(feature: GeoJSON.Feature, key: string, value: string) {
        const hasValue = Object.keys(feature.properties).filter(k => k.includes(key)).some(k => feature.properties[k] === value);
        if (!hasValue) {
            GeoJSONUtils.setProperty(feature, key, value);
        }
    }

    public static setProperty(feature: GeoJSON.Feature, key: string, value: string): string {
        if (!feature.properties[key]) {
            feature.properties[key] = value;
            return "";
        }
        let index = 1;
        while (feature.properties[key + index]) {
            index++;
        }
        feature.properties[key + index] = value;
        return `${index}`;
    }
    
    public static setLocation(feature: GeoJSON.Feature, value: LatLngAlt) {
        feature.properties.poiGeolocation = {
            lat: value.lat,
            lon: value.lng
        };
    }
    
    public static setDescription(feature: GeoJSON.Feature, value: string, language: string) {
        feature.properties["description:" + language] = value;
    }
    
    public static setTitle(feature: GeoJSON.Feature, value: string, language: string) {
        feature.properties["name:" + language] = value;
    }

    public static getTitle(feature: Immutable<GeoJSON.Feature>, language: string): string {
        if (feature.properties["name:" + language]) {
            return feature.properties["name:" + language];
        }
        if (feature.properties["name:en"]) {
            return feature.properties["name:en"];
        }
        if (feature.properties.name) {
            return feature.properties.name;
        }
        if (feature.properties["mtb:name:"+ language]) {
            return feature.properties["mtb:name:"+ language];
        }
        if (feature.properties["mtb:name:en"]) {
            return feature.properties["mtb:name:en"];
        }
        if (feature.properties["mtb:name"]) {
            return feature.properties["mtb:name"];
        }
        return "";
    }

    public static getDescription(feature: Immutable<GeoJSON.Feature>, language: string): string {
        return feature.properties["description:" + language] || feature.properties.description;
    }

    public static getExternalDescription(feature: GeoJSON.Feature, language: string): string {
        return feature.properties["poiExternalDescription:" + language] || feature.properties.poiExternalDescription;
    }

    public static getLocation(feature: GeoJSON.Feature): LatLngAlt {
        return {
            lat: feature.properties.poiGeolocation.lat,
            lng: feature.properties.poiGeolocation.lon,
            alt: feature.properties.poiAlt
        };
    }

    public static hasExtraData(feature: GeoJSON.Feature, language: string): boolean {
        return feature.properties["description:" + language] != null || 
            GeoJSONUtils.getValidImageUrls(feature).length > 0 ||
            Object.keys(feature.properties).find(k => k.startsWith("wikipedia")) != null ||
            Object.keys(feature.properties).find(k => k.startsWith("wikidata")) != null;
    }

    public static getValidImageUrls(feature: Immutable<GeoJSON.Feature>): string[] {
        return Object.keys(feature.properties)
            .filter(k => k.startsWith("image"))
            .map(k => feature.properties[k])
            .filter(u => this.isValidImageUrl(u));
    }

    private static isValidImageUrl(url: string): boolean {
            if (url.startsWith("File:")) {
                return true;
            }
            if (url.includes("wikimedia.org") && 
                !url.includes("Building_no_free_image_yet") && 
                !url.endsWith("svg.png") &&
                !url.endsWith("svg")) {
                return true;
            }
            if (url.includes("inature.info"))
            {
                return true;
            }
            if (url.includes("nakeb.co.il")) {
                return true;
            }
            if (url.includes("jeepolog.com")) {
                return true;
            }
            return false;
        }
}