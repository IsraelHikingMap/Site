import { OsmTagsService, PoiProperties } from "./osm-tags.service";

function createFeature(properties: any): GeoJSON.Feature {
    return {
        type: "Feature",
        properties: properties,
        geometry: {
            type: "Point",
            coordinates: [0 ,0]
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
        const feature = createFeature({boundary: "protected_area" });
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
        const feature = createFeature({route: "hiking" });
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
        const feature = createFeature({route: "bicycle" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set icon color category for historic ruins", () => {
        // Arrange
        const feature = createFeature({historic: "ruins" });
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
        const feature = createFeature({historic: "archaeological_site" });
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
        const feature = createFeature({historic: "memorial" });
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
        const feature = createFeature({historic: "tomb" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for picnic table", () => {
        // Arrange
        const feature = createFeature({leisure: "picnic_table" });
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
        const feature = createFeature({natural: "cave_entrance" });
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
        const feature = createFeature({natural: "spring" });
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
        const feature = createFeature({natural: "tree" });
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
        const feature = createFeature({natural: "flowers" });
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
        const feature = createFeature({natural: "waterhole" });
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
        const feature = createFeature({water: "pond" });
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
        const feature = createFeature({water: "stream_pool" });
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
        const feature = createFeature({water: "reservoir" });
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
        const feature = createFeature({water: "lake" });
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
        expect(poi.properties.poiCategory).toBe("Wikipedia");
    });

    it("Should set icon color category for viewpoint", () => {
        // Arrange
        const feature = createFeature({tourism: "viewpoint" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-viewpoint");
        expect(poi.properties.poiCategory).toBe("Viewpoint");
    });

    it("Should set icon color category for picnic_site", () => {
        // Arrange
        const feature = createFeature({tourism: "camp_site" });
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
        const feature = createFeature({tourism: "attraction" });
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
        const feature = createFeature({tourism: "artwork" });
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
        const feature = createFeature({tourism: "alpine_hut" });
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
        const feature = createFeature({natural: "peak" });
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
        const feature = createFeature({highway: "cycleway" });
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
        const feature = createFeature({highway: "path" });
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
        const feature = createFeature({highway: "footway" });
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
        const feature = createFeature({highway: "track" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("4x4");
        expect(poi.properties.poiIcon).toBe("icon-four-by-four");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for wikipedia", () => {
        // Arrange
        const feature = createFeature({ wikipedia: "page" });
        const poi = createPoi();
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Wikipedia");
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
        expect(poi.properties.poiCategory).toBe("iNature");
        expect(poi.properties.poiIcon).toBe("icon-inature");
        expect(poi.properties.poiIconColor).toBe("#116C00");
    });
});
