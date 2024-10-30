import { OsmTagsService } from "./osm-tags.service";

describe("OsmTagsService", () => {
    it("Should not set icon color category if already set", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                boundary: "protected_area"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {
                poiIconColor: "black",
                poiIcon: "icon-bike",
                poiCategory: "Bicycle"
            }
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set§ icon color category for protected_area", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                boundary: "protected_area"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-nature-reserve");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for network lcn", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                network: "lcn"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set icon color category for network lwn", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                network: "lwn"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiCategory).toBe("Hiking");
    });

    it("Should set icon color category for route hiking", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                route: "hiking"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-hike");
        expect(poi.properties.poiCategory).toBe("Hiking");
    });

    it("Should set icon color category for route bicycle", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                route: "bicycle"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
    });

    it("Should set icon color category for historic ruins", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                historic: "ruins"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-ruins");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic archaeological_site", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                historic: "archaeological_site"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-archaeological");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic memorial", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                historic: "memorial"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#666666");
        expect(poi.properties.poiIcon).toBe("icon-memorial");
        expect(poi.properties.poiCategory).toBe("Historic");
    });

    it("Should set icon color category for historic tomb", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                historic: "tomb"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for picnic table", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                leisure: "picnic_table"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-picnic");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for cave entrance", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "cave_entrance"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-cave");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for spring", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "spring"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for tree", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "tree"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-tree");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for flowers", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "flowers"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-flowers");
        expect(poi.properties.poiCategory).toBe("Natural");
    });

    it("Should set icon color category for waterhole", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "waterhole"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-waterhole");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for reservoir", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                water: "reservoir"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-tint");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for water_well", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                man_made: "water_well"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-water-well");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for cistern", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                man_made: "cistern"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-cistern");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for waterfall", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                waterway: "waterfall"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("blue");
        expect(poi.properties.poiIcon).toBe("icon-waterfall");
        expect(poi.properties.poiCategory).toBe("Water");
    });

    it("Should set icon color category for place", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                place: "village"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("black");
        expect(poi.properties.poiIcon).toBe("icon-home");
        expect(poi.properties.poiCategory).toBe("Wikipedia");
    });

    it("Should set icon color category for viewpoint", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                tourism: "viewpoint"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#008000");
        expect(poi.properties.poiIcon).toBe("icon-viewpoint");
        expect(poi.properties.poiCategory).toBe("Viewpoint");
    });

    it("Should set icon color category for picnic_site", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                tourism: "camp_site"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#734a08");
        expect(poi.properties.poiIcon).toBe("icon-campsite");
        expect(poi.properties.poiCategory).toBe("Camping");
    });

    it("Should set icon color category for attraction", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                tourism: "attraction"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIconColor).toBe("#ffb800");
        expect(poi.properties.poiIcon).toBe("icon-star");
        expect(poi.properties.poiCategory).toBe("Other");
    });

    it("Should set icon color category for mtb route", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                "mtb:name": "route"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiIcon).toBe("icon-bike");
        expect(poi.properties.poiCategory).toBe("Bicycle");
        expect(poi.properties.poiIconColor).toBe("gray");
    });

    it("Should set icon color category for natural peak", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                natural: "peak"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Other");
        expect(poi.properties.poiIcon).toBe("icon-peak");
        expect(poi.properties.poiIconColor).toBe("black");
    });

    it("Should set icon color category for wikipedia", () => {
        // Arrange
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                wikipedia: "page"
            },
            geometry: {
                type: "Point",
                coordinates: [0 ,0]
            }
        };
        const poi = {
            properties: {}
        } as any;
        // Act
        OsmTagsService.setIconColorCategory(feature, poi);
        // Assert
        expect(poi.properties.poiCategory).toBe("Wikipedia");
        expect(poi.properties.poiIcon).toBe("icon-wikipedia-w");
        expect(poi.properties.poiIconColor).toBe("black");
    });
});