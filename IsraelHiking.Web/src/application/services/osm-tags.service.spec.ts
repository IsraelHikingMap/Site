import { describe, it, expect } from "vitest";
import { OsmTagsService, PoiProperties } from "./osm-tags.service";

function createFeature(properties: any): GeoJSON.Feature {
    return {
        type: "Feature",
        properties: properties,
        geometry: {
            type: "Point",
            coordinates: [0, 0]
        }
    };
}

function createPoi(properties: any = {}): GeoJSON.Feature<GeoJSON.Geometry, PoiProperties> {
    return {
        properties
    } as any;
}

describe("OsmTagsService", () => {
    it("Should not set icon color category if already set", () => {
        // Arrange
        const feature = createFeature({ boundary: "protected_area" });
        const poi = createPoi({
            poiIconColor: "black",
            poiIcon: "icon-bike",
            poiCategory: "Bicycle"
        });
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set§ icon color category for protected_area", () => {
        // Arrange
        const feature = createFeature({ boundary: "protected_area" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-leaf");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for route hiking", () => {
        // Arrange
        const feature = createFeature({ route: "hiking" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiCategory).toBe("Hiking");
    });

    it("Should set icon color category for route bicycle", () => {
        // Arrange
        const feature = createFeature({ route: "bicycle" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set icon color category for scenic route bicycle", () => {
        // Arrange
        const feature = createFeature({ route: "road", scenic: "yes" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-four-by-four");
        expect(poi.properties.poiCategory).toBe("4x4");
    });

    it("Should set icon color category for historic ruins", () => {
        // Arrange
        const feature = createFeature({ historic: "ruins" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-ruins");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic archaeological_site", () => {
        // Arrange
        const feature = createFeature({ historic: "archaeological_site" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-archaeological");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic memorial", () => {
        // Arrange
        const feature = createFeature({ historic: "memorial" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-memorial");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic tomb", () => {
        // Arrange
        const feature = createFeature({ historic: "tomb" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for picnic table", () => {
        // Arrange
        const feature = createFeature({ leisure: "picnic_table" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-picnic");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for cave entrance", () => {
        // Arrange
        const feature = createFeature({ natural: "cave_entrance" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-cave");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for spring", () => {
        // Arrange
        const feature = createFeature({ natural: "spring" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for water", () => {
        // Arrange
        const feature = createFeature({ natural: "water" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for tree", () => {
        // Arrange
        const feature = createFeature({ natural: "tree" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-tree");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for flowers", () => {
        // Arrange
        const feature = createFeature({ natural: "flowers" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-flowers");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for waterhole", () => {
        // Arrange
        const feature = createFeature({ natural: "waterhole" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-waterhole");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for pond", () => {
        // Arrange
        const feature = createFeature({ water: "pond" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for stream_pool", () => {
        // Arrange
        const feature = createFeature({ water: "stream_pool" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for reservoir", () => {
        // Arrange
        const feature = createFeature({ water: "reservoir" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for lake", () => {
        // Arrange
        const feature = createFeature({ water: "lake" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for water_well", () => {
        // Arrange
        const feature = createFeature({ man_made: "water_well" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-water-well");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for cistern", () => {
        // Arrange
        const feature = createFeature({ man_made: "cistern" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-cistern");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for waterfall", () => {
        // Arrange
        const feature = createFeature({ waterway: "waterfall" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-waterfall");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for a generic waterway", () => {
        // Arrange
        const feature = createFeature({ waterway: "stream" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-river");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for waterway", () => {
        // Arrange
        const feature = createFeature({ type: "waterway" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#1e80e3");
        expect(poi.properties.poiIcon).toBe("icon-river");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for place", () => {
        // Arrange
        const feature = createFeature({ place: "village" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-home");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for viewpoint", () => {
        // Arrange
        const feature = createFeature({ tourism: "viewpoint" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-viewpoint");
        expect(poi.properties.poiCategory).toBe("Viewpoint");
    });

    it("Should set icon color category for camp_site", () => {
        // Arrange
        const feature = createFeature({ tourism: "camp_site" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-campsite");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for attraction", () => {
        // Arrange
        const feature = createFeature({ tourism: "attraction" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#ffb800");
        expect(poi.properties.poiIcon).toBe("icon-star");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for artwork", () => {
        // Arrange
        const feature = createFeature({ tourism: "artwork" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#ffb800");
        expect(poi.properties.poiIcon).toBe("icon-artwork");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for alpine hut", () => {
        // Arrange
        const feature = createFeature({ tourism: "alpine_hut" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-alpinehut");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for mtb route", () => {
        // Arrange
        const feature = createFeature({ "mtb:name": "route" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
        expect(poi.properties.poiIconColor).toBe("gray");
    });

    it("Should set icon color category for natural peak", () => {
        // Arrange
        const feature = createFeature({ natural: "peak" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Natural");
        expect(poi.properties.poiIcon).toBe("icon-peak");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for natural volcano", () => {
        // Arrange
        const feature = createFeature({ natural: "volcano" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Natural");
        expect(poi.properties.poiIcon).toBe("icon-peak");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for cycleway", () => {
        // Arrange
        const feature = createFeature({ highway: "cycleway" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Bicycle");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for path", () => {
        // Arrange
        const feature = createFeature({ highway: "path" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Hiking");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for footway", () => {
        // Arrange
        const feature = createFeature({ highway: "footway" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Hiking");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for track", () => {
        // Arrange
        const feature = createFeature({ highway: "track" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("4x4");
        expect(poi.properties.poiIcon).toBe("icon-four-by-four");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for synagogue", () => {
        // Arrange
        const feature = createFeature({ amenity: "place_of_worship", religion: "jewish" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-synagogue");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for church", () => {
        // Arrange
        const feature = createFeature({ amenity: "monastery", religion: "christian" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-church");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for mosque", () => {
        // Arrange
        const feature = createFeature({ amenity: "place_of_worship", religion: "muslim" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-mosque");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for holy place", () => {
        // Arrange
        const feature = createFeature({ amenity: "place_of_worship", religion: "other" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-holy-place");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for hotel", () => {
        // Arrange
        const feature = createFeature({ tourism: "hotel" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-bed");
        expect(poi.properties.poiIconColor).toBe("#734a08");
    });

    it("Should set icon color category for motel", () => {
        // Arrange
        const feature = createFeature({ tourism: "motel" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-bed");
        expect(poi.properties.poiIconColor).toBe("#734a08");
    });

    it("Should set icon color category for hostel", () => {
        // Arrange
        const feature = createFeature({ tourism: "hostel" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-bed");
        expect(poi.properties.poiIconColor).toBe("#734a08");
    });

    it("Should set icon color category for wikipedia", () => {
        // Arrange
        const feature = createFeature({ wikipedia: "page" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-wikipedia-w");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for inature and wikidata and prefer inture", () => {
        // Arrange
        const feature = createFeature({ wikipedia: "page", "ref:IL:inature": "inature" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-inature");
        expect(poi.properties.poiIconColor).toBe("#116C00");
    });

    it("Should set icon color category for national_park", () => {
        // Arrange
        const feature = createFeature({ boundary: "national_park" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-leaf");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for nature_reserve", () => {
        // Arrange
        const feature = createFeature({ leisure: "nature_reserve" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-leaf");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for route foot", () => {
        // Arrange
        const feature = createFeature({ route: "foot" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiCategory).toBe("Hiking");
    });

    it("Should set icon color category for route mtb", () => {
        // Arrange
        const feature = createFeature({ route: "mtb" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should fall through to the default when route is road without scenic", () => {
        // Arrange
        const feature = createFeature({ route: "road" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-search");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for historic monument", () => {
        // Arrange
        const feature = createFeature({ historic: "monument" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-memorial");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for picnic_site", () => {
        // Arrange
        const feature = createFeature({ tourism: "picnic_site" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-picnic");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for amenity picnic", () => {
        // Arrange
        const feature = createFeature({ amenity: "picnic" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-picnic");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for natural ridge", () => {
        // Arrange
        const feature = createFeature({ natural: "ridge" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-peak");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for natural valley", () => {
        // Arrange
        const feature = createFeature({ natural: "valley" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-peak");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for recreation_ground mtb", () => {
        // Arrange
        const feature = createFeature({ landuse: "recreation_ground", sport: "mtb" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("green");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set icon color category for landuse forest", () => {
        // Arrange
        const feature = createFeature({ landuse: "forest" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-tree");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for wikidata", () => {
        // Arrange
        const feature = createFeature({ wikidata: "Q12345" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-wikipedia-w");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set the default icon color category for unrecognized tags", () => {
        // Arrange
        const feature = createFeature({ amenity: "bench" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-search");
        expect(poi.properties.poiCategory).toBe("Other");
    });
});
