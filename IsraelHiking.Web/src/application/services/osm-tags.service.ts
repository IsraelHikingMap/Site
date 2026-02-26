import type { LatLngAltTime } from "../models";

export type PoiProperties = {
    poiSource: string;
    poiId: string;
    identifier: string;
    poiGeolocation: LatLngAltTime;
    poiIconColor: string;
    poiIcon: string;
    poiCategory: string;
    "name:he"?: string;
    "name:en"?: string;
}

export class OsmTagsService {
    public static setIconColorCategory(feature: GeoJSON.Feature, poi: GeoJSON.Feature<GeoJSON.Geometry, PoiProperties>) {
        if (poi.properties.poiIconColor && poi.properties.poiIcon && poi.properties.poiCategory) {
            return;
        }
        if (feature.properties.boundary === "protected_area" ||
            feature.properties.boundary === "national_park" ||
            feature.properties.leisure === "nature_reserve") {
            poi.properties.poiIconColor = "#008000";
            poi.properties.poiIcon = "icon-leaf";
            poi.properties.poiCategory = "Other";
            return;
        }
        if (feature.properties.route) {
            switch (feature.properties.route) {
                case "hiking":
                case "foot":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiIcon = "icon-hike";
                    poi.properties.poiCategory = "Hiking";
                    return;
                case "bicycle":
                case "mtb":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiIcon = "icon-bike";
                    poi.properties.poiCategory = "Bicycle";
                    return;
                case "road":
                    if (feature.properties.scenic === "yes") {
                        poi.properties.poiIconColor = "black";
                        poi.properties.poiCategory = "4x4";
                        poi.properties.poiIcon = "icon-four-by-four";
                        return;
                    }
            }
        }
        if (feature.properties.historic) {
            poi.properties.poiIconColor = "#666666";
            poi.properties.poiCategory = "Historic";
            switch (feature.properties.historic) {
                case "ruins":
                    poi.properties.poiIcon = "icon-ruins";
                    return;
                case "archaeological_site":
                    poi.properties.poiIcon = "icon-archaeological";
                    return;
                case "memorial":
                case "monument":
                    poi.properties.poiIcon = "icon-memorial";
                    return;
                case "tomb":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiIcon = "icon-cave";
                    poi.properties.poiCategory = "Natural";
                    return;
            }
        }
        if (feature.properties.leisure === "picnic_table" ||
            feature.properties.tourism === "picnic_site" ||
            feature.properties.amenity === "picnic") {
            poi.properties.poiIconColor = "#734a08";
            poi.properties.poiIcon = "icon-picnic";
            poi.properties.poiCategory = "Camping";
            return;
        }

        if (feature.properties.natural) {
            switch (feature.properties.natural) {
                case "cave_entrance":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiIcon = "icon-cave";
                    poi.properties.poiCategory = "Natural";
                    return;
                case "spring":
                    poi.properties.poiIconColor = "#1e80e3";
                    poi.properties.poiIcon = "icon-tint";
                    poi.properties.poiCategory = "Water";
                    return;
                case "tree":
                    poi.properties.poiIconColor = "#008000";
                    poi.properties.poiIcon = "icon-tree";
                    poi.properties.poiCategory = "Natural";
                    return;
                case "flowers":
                    poi.properties.poiIconColor = "#008000";
                    poi.properties.poiIcon = "icon-flowers";
                    poi.properties.poiCategory = "Natural";
                    return;
                case "waterhole":
                    poi.properties.poiIconColor = "#1e80e3";
                    poi.properties.poiIcon = "icon-waterhole";
                    poi.properties.poiCategory = "Water";
                    return;
            }
        }

        if (feature.properties.water === "reservoir" ||
            feature.properties.water === "pond" ||
            feature.properties.water === "lake" ||
            feature.properties.water === "stream_pool") {
            poi.properties.poiIconColor = "#1e80e3";
            poi.properties.poiIcon = "icon-tint";
            poi.properties.poiCategory = "Water";
            return;
        }

        if (feature.properties.man_made) {
            poi.properties.poiIconColor = "#1e80e3";
            poi.properties.poiCategory = "Water";
            switch (feature.properties.man_made) {
                case "water_well":
                    poi.properties.poiIcon = "icon-water-well";
                    return;
                case "cistern":
                    poi.properties.poiIcon = "icon-cistern";
                    return;
            }
        }

        if (feature.properties.waterway === "waterfall") {
            poi.properties.poiIconColor = "#1e80e3";
            poi.properties.poiIcon = "icon-waterfall";
            poi.properties.poiCategory = "Water";
            return;
        }

        if (feature.properties.waterway || feature.properties.type === "waterway") {
            poi.properties.poiIconColor = "#1e80e3";
            poi.properties.poiIcon = "icon-river";
            poi.properties.poiCategory = "Water";
            return;
        }

        if (feature.properties.place) {
            poi.properties.poiIconColor = "black";
            poi.properties.poiIcon = "icon-home";
            poi.properties.poiCategory = "Wikipedia";
            return;
        }

        if (feature.properties.tourism) {
            switch (feature.properties.tourism) {
                case "viewpoint":
                    poi.properties.poiIconColor = "#008000";
                    poi.properties.poiIcon = "icon-viewpoint";
                    poi.properties.poiCategory = "Viewpoint";
                    return;
                case "camp_site":
                    poi.properties.poiIconColor = "#734a08";
                    poi.properties.poiIcon = "icon-campsite";
                    poi.properties.poiCategory = "Camping";
                    return;
                case "attraction":
                    poi.properties.poiIconColor = "#ffb800";
                    poi.properties.poiIcon = "icon-star";
                    poi.properties.poiCategory = "Other";
                    return;
                case "artwork":
                    poi.properties.poiIconColor = "#ffb800";
                    poi.properties.poiIcon = "icon-artwork";
                    poi.properties.poiCategory = "Other";
                    return;
                case "alpine_hut":
                    poi.properties.poiIconColor = "#734a08";
                    poi.properties.poiIcon = "icon-alpinehut";
                    poi.properties.poiCategory = "Camping";
                    return;
            }
        }

        if (feature.properties["mtb:name"]) {
            poi.properties.poiIconColor = "gray";
            poi.properties.poiIcon = "icon-bike";
            poi.properties.poiCategory = "Bicycle";
            return;
        }

        if (feature.properties.natural === "peak") {
            poi.properties.poiIconColor = "black";
            poi.properties.poiIcon = "icon-peak";
            poi.properties.poiCategory = "Natural";
            return;
        }

        if (feature.properties["ref:IL:inature"]) {
            poi.properties.poiIconColor = "#116C00";
            poi.properties.poiIcon = "icon-inature";
            poi.properties.poiCategory = "iNature";
            return;
        }

        if (feature.properties.highway != null) {
            switch (feature.properties.highway) {
                case "cycleway":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiCategory = "Bicycle";
                    poi.properties.poiIcon = "icon-bike";
                    return;
                case "footway":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiCategory = "Hiking";
                    poi.properties.poiIcon = "icon-hike";
                    return;
                case "path":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiCategory = "Hiking";
                    poi.properties.poiIcon = "icon-hike";
                    return;
                case "track":
                    poi.properties.poiIconColor = "black";
                    poi.properties.poiCategory = "4x4";
                    poi.properties.poiIcon = "icon-four-by-four";
                    return;
            }
        }

        if (feature.properties.wikidata || feature.properties.wikipedia) {
            poi.properties.poiIconColor = "black";
            poi.properties.poiIcon = "icon-wikipedia-w";
            poi.properties.poiCategory = "Wikipedia";
            return;
        }

        poi.properties.poiIconColor = "black";
        poi.properties.poiIcon = "icon-search";
        poi.properties.poiCategory = "Other";

    }

}
