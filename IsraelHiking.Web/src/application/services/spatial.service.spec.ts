import { lineString } from "@turf/helpers";
import { LngLatBounds } from "maplibre-gl";

import { SpatialService } from "./spatial.service";
import { Bounds } from "../models";

describe("Spatial service", () => {
    it("Should get length in meters for a line string", () => {
        const length = SpatialService.getLengthInMetersForGeometry({ type: "LineString", coordinates: [[0,0], [0,1]]});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should get length in meters for a multi line string", () => {
        const length = SpatialService.getLengthInMetersForGeometry({ type: "MultiLineString", coordinates: [[[0,0], [0,1]]]});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should return 0 for non line geometries", () => {
        const length = SpatialService.getLengthInMetersForGeometry({ type: "Polygon", coordinates: [[[0,0], [0,1]]]});
        expect(length).toBe(0);
    });

    it("Should get length in meters for coordinates", () => {
        const length = SpatialService.getDistanceInMeters({ lat: 0, lng: 0}, { lat: 0, lng: 1});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should not simplify a signle coordinate", () => {
        const simplified = SpatialService.simplify([], 0);
        expect(simplified.length).toBe(0);
    });

    it("Should simplify according to imput", () => {
        const simplified = SpatialService.simplify([[0,0], [0, 0.5], [0, 1]], 0.1);
        expect(simplified.length).toBe(2);
    });

    it("Should get a distance in degrees", () => {
        const distance = SpatialService.getDistance({ lat: 0, lng: 0}, { lat: 0, lng: 1});
        expect(distance).toBeCloseTo(1);
    });

    it("Should get a distance for coordinates", () => {
        const distance = SpatialService.getDistanceForCoordinates([0, 0], [0, 1]);
        expect(distance).toBe(1);
    });

    it("Should get a distance from a lat-lng point to line in meters", () => {
        const distance = SpatialService.getDistanceFromPointToLine({ lat: 0.00001, lng: 0}, [{ lat: 0, lng: 0}, { lat: 0, lng: 1}]);
        expect(distance).toBeGreaterThan(1);
    });

    it("Should not change a line that is within a tile", () => {
        const lines = [lineString([[0.1,0.1], [1,1]])];
        const clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines).toEqual(lines);
    });

    it("Should change a line that is intersect with a tile boundary", () => {
        const lines = [lineString([[-1,-1], [1,1]])];
        const clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines[0].geometry.coordinates[0]).toEqual([0,0]);
    });

    it("Should change a line that crosses the entire tile boundary", () => {
        const lines = [lineString([[-1,-1], [5,5]])];
        const clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines[0].geometry.coordinates[0]).toEqual([0,0]);
        expect(clippedLines[0].geometry.coordinates[1]).not.toEqual([5,5]);
    });

    it("Should split a line that crosses the tile boundary multiple times to several lines", () => {
        const lines = [lineString([[-1,-1], [0.5,0.5], [-1, 0.5], [0.5, 0.6], [-1, 0.6], [0.7, 0.7]])];
        const clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines.length).toBe(3);
        expect(clippedLines[1].geometry.coordinates[0]).toEqual([0,0]);
        expect(clippedLines[1].geometry.coordinates[2]).toEqual([0,0.5]);
        expect(clippedLines[0].geometry.coordinates[2]).toEqual([0,0.6]);
        expect(clippedLines[2].geometry.coordinates[1]).toEqual([0.7,0.7]);
    });

    it("Should add an intersection point for a T case start of line", () => {
        const lines = [lineString([[-1,0], [1,0]]), lineString([[0,0], [0,1]])];
        SpatialService.addMissinIntersectionPoints(lines);
        expect(lines[0].geometry.coordinates.length).toBe(3);
        expect(lines[0].geometry.coordinates[1][0]).toBeCloseTo(0);
    });

    it("Should add an intersection point for a T case end of line", () => {
        const lines = [lineString([[-1,0], [1,0]]), lineString([[0,1], [0,0]])];
        SpatialService.addMissinIntersectionPoints(lines);
        expect(lines[0].geometry.coordinates.length).toBe(3);
        expect(lines[0].geometry.coordinates[1][0]).toBeCloseTo(0);
    });

    it("Should find the closest point on a line and replace that line", () => {
        const lines = [lineString([[-1,0], [1,0]])];
        const point = SpatialService.insertProjectedPointToClosestLineAndReplaceIt({lat: 1, lng: 0}, lines);
        expect(point.geometry.coordinates[0]).toBeCloseTo(0);
        expect(point.geometry.coordinates[1]).toBeCloseTo(0);
        expect(lines[0].geometry.coordinates.length).toBe(3);
    });

    it("Should find the closest point on a line and replace that line given two lines", () => {
        const lines = [lineString([[-1,0], [1,0]]), lineString([[-1,1], [1,1]])];
        const point = SpatialService.insertProjectedPointToClosestLineAndReplaceIt({lat: 1, lng: 0}, lines);
        expect(point.geometry.coordinates[0]).toBeCloseTo(0);
        expect(point.geometry.coordinates[1]).toBeCloseTo(1);
        expect(lines[1].geometry.coordinates.length).toBe(3);
    });

    it("Should throw a line when it is too short", () => {
        expect(() => SpatialService.splitLine({lat: 0, lng: 0.5}, [])).toThrowError();
    });

    it("Should split a line in the start when point is before the start", () => {
        const split = SpatialService.splitLine({lat: 0, lng: -0.5}, [{lat: 0, lng: 0, alt: 0, timestamp: null}, { lat: 0, lng: 1, alt: 2, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[0].alt).toBe(0);
        expect(split.start[0].lng).toBe(0);
        expect(split.end.length).toBe(2);
        expect(split.end[0].lng).toBe(0);
        expect(split.end[1].lng).toBe(1);
        expect(split.end[1].alt).toBe(2);
    });

    it("Should split a line in the end when point is after the end", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 1.5}, [{lat: 0, lng: 0, alt: 0, timestamp: null}, { lat: 0, lng: 1, alt: 2, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[0].alt).toBe(0);
        expect(split.start[0].lng).toBe(0);
        expect(split.end.length).toBe(2);
        expect(split.end[0].lng).toBe(1);
        expect(split.end[1].lng).toBe(1);
        expect(split.end[1].alt).toBe(2);
    });

    it("Should split a line in the middle but not add a new point if the point already exists", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 1}, [{lat: 0, lng: 0, timestamp: null}, { lat: 0, lng: 1, timestamp: null}, { lat: 0, lng: 2, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(1);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle and add a new projected point", () => {
        const split = SpatialService.splitLine({lat: 0.1, lng: 0.5}, [{lat: 0, lng: 0, timestamp: null}, { lat: 0, lng: 1, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(0.5);
        expect(split.start[1].lat).toBe(0);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle and add a new projected point when new point is just after the middle point", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 1.1}, [{lat: 0, lng: 0, timestamp: null}, { lat: 0, lng: 1, timestamp: null}, {lat: 0, lng: 2, timestamp: null}]);
        expect(split.start.length).toBe(3);
        expect(split.start[2].lng).toBe(1.1);
        expect(split.start[2].lat).toBe(0);
        expect(split.start[1].lng).toBe(1);
        expect(split.start[1].lat).toBe(0);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle and add a new projected point when new point is just before the middle point", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 0.9}, [{lat: 0, lng: 0, timestamp: null}, { lat: 0, lng: 1, timestamp: null}, {lat: 0, lng: 2, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(0.9);
        expect(split.start[1].lat).toBe(0);
        expect(split.end.length).toBe(3);
        expect(split.end[0].lng).toBe(0.9);
        expect(split.end[0].lat).toBe(0);
    });

    it("Should split a line in the middle and don't add a projected point since the new point is exatly on the middle point", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 1}, [{lat: 0, lng: 0, timestamp: null}, { lat: 0, lng: 1, timestamp: null}, {lat: 0, lng: 2, timestamp: null}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(1.0);
        expect(split.start[1].lat).toBe(0);
        expect(split.end.length).toBe(2);
        expect(split.end[0].lng).toBe(1.0);
        expect(split.end[0].lat).toBe(0);
    });

    it("Should split a line in the middle and add a new projected point with altitude and time", () => {
        const split = SpatialService.splitLine({lat: 0, lng: 0.5}, [{lat: 0, lng: 0, alt: 0, timestamp: new Date(0)}, { lat: 0, lng: 1, alt: 2, timestamp: new Date(4)}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(0.5);
        expect(split.start[1].lat).toBe(0);
        expect(split.start[1].alt).toBe(1);
        expect(new Date(split.start[1].timestamp).getTime()).toBe(2);
        expect(split.end.length).toBe(2);
    });

    it("Should get interpolated value", () => {
        const interpolated = SpatialService.getLatlngInterpolatedValue({lat: 0, lng: 0}, { lat: 1, lng: 1}, 0.5);
        expect(interpolated.lat).toBe(0.5);
        expect(interpolated.lng).toBe(0.5);
    });

    it("Should get bounds for a single point to be that point", () => {
        const bounds = SpatialService.getBounds([{lat: 42, lng: 42}]);
        expect(bounds.northEast.lat).toBe(42);
        expect(bounds.northEast.lng).toBe(42);
        expect(bounds.southWest.lat).toBe(42);
        expect(bounds.southWest.lng).toBe(42);
    });

    it("Should get bounds for two points", () => {
        const bounds = SpatialService.getBounds([{lat: 0, lng: 0}, {lat: 1, lng: 1}]);
        expect(bounds.northEast.lat).toBe(1);
        expect(bounds.northEast.lng).toBe(1);
        expect(bounds.southWest.lat).toBe(0);
        expect(bounds.southWest.lng).toBe(0);
    });

    it("Should get bounds for geojson", () => {
        const bounds = SpatialService.getBoundsForFeature({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [[0,0], [1,1]]
            },
            properties: {}
        });
        expect(bounds.northEast.lat).toBe(1);
        expect(bounds.northEast.lng).toBe(1);
        expect(bounds.southWest.lat).toBe(0);
        expect(bounds.southWest.lng).toBe(0);
    });

    it("Should get center for single point as that point", () => {
        const center = SpatialService.getCenter([{lat: 42, lng: 42}]);
        expect(center.lat).toBe(42);
        expect(center.lng).toBe(42);
    });

    it("Should get center for a line", () => {
        const center = SpatialService.getCenter([{lat: 0, lng: 0}, {lat: 42, lng: 42}]);
        expect(center.lat).toBe(21);
        expect(center.lng).toBe(21);
    });

    it("Should convert from and to coordinate", () => {
        const coordinate = [1, 2];
        const coordinate2 = SpatialService.toCoordinate(SpatialService.toLatLng(coordinate));
        expect(coordinate2).toEqual(coordinate);
    });

    it("Should convert from and to coordinate", () => {
        const latlng = SpatialService.toLatLng([1,2,3]);
        expect(latlng.lng).toBe(1);
        expect(latlng.lat).toBe(2);
        expect(latlng.alt).toBe(3);
    });

    it("Should convert to maplibre bounds", () => {
        const latlng = {lat: 1, lng: 2};
        const bounds = { northEast: latlng, southWest: latlng } as Bounds;
        const mBounds = SpatialService.boundsToMBBounds(bounds);
        expect(mBounds[0]).toEqual(latlng);
        expect(mBounds[1]).toEqual(latlng);
    });

    it("Should convert to bounds", () => {
        const latlng = {lat: 1, lng: 2};
        const mbBounds = new LngLatBounds([latlng, latlng]);
        const bounds = SpatialService.mBBoundsToBounds(mbBounds);
        const mapBounds = SpatialService.getMapBounds({ getBounds: () => mbBounds } as any);
        expect(bounds.northEast.lat).toBe(latlng.lat);
        expect(bounds.southWest.lng).toBe(latlng.lng);
        expect(bounds).toEqual(mapBounds);
    });

    it("Should calculate bounds from a feature", () => {
        const bounds = SpatialService.getBoundsForFeature({
            type: "Feature", geometry: {
                type:"LineString",
                coordinates: [[1,1], [2,2]]
            },
            properties: {}
        });
        expect(bounds.northEast.lat).toBe(2);
        expect(bounds.northEast.lng).toBe(2);
        expect(bounds.southWest.lat).toBe(1);
        expect(bounds.southWest.lng).toBe(1);
    });

    it("Should get a circle feature", () => {
        const circle = SpatialService.getCirclePolygonFeature({lat: 0, lng: 0}, 100);
        expect(circle.geometry.coordinates[0].length).toBe(65);
        expect(circle.properties.radius).toBe(100);
    });

    it("Should get line bearing in degrees", () => {
        const bearing = SpatialService.getLineBearingInDegrees({lat: 0, lng: 0}, {lat: -1, lng: 0});
        expect(bearing).toBe(180);
    });

    it("Should convert from and to tile", () => {
        const latlngExpected = {lat: 0, lng: 0};
        const latlng = SpatialService.fromTile(SpatialService.toTile(latlngExpected, 12), 12);
        expect(latlngExpected).toEqual(latlng);
    });

    it("Should get relative pixel location of zero coordinates", () => {
        const latlng = {lat: 0, lng: 0};
        const pixel = SpatialService.toRelativePixel(latlng, 12, 256);
        expect(pixel.pixelX).toBe(0);
        expect(pixel.pixelY).toBe(0);
    });

    it("Should get relative pixel location", () => {
        const latlng = {lat: 0.1, lng: 0.1};
        const pixel = SpatialService.toRelativePixel(latlng, 12, 256);
        expect(pixel.pixelX).toBe(35);
        expect(pixel.pixelY).toBe(220);
    });

    it("Should merge lines", () => {
        const lines = [
            lineString([[0,0], [1,1]]),
            lineString([[1,1], [2,2]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(3);
    });

    it("Should merge opposite lines", () => {
        const lines = [
            lineString([[0,0], [1,1]]),
            lineString([[2,2], [1,1]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(3);
    });

    it("Should merge reverse opposite lines", () => {
        const lines = [
            lineString([[1,1], [0,0]]),
            lineString([[1,1], [2,2]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(3);
        expect(merged.coordinates[0]).toEqual([2,2]);
        expect(merged.coordinates[2]).toEqual([0,0]);
    });

    it("Should merge unordered lines", () => {
        const lines = [
            lineString([[1,1], [2,2]]),
            lineString([[0,0], [1,1]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(3);
    });

    it("Should merge complicated unordered lines", () => {
        const lines = [
            lineString([[1,1], [2,2]]),
            lineString([[0,0], [1,1]]),
            lineString([[3,3], [2,2]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(4);
    });

    it("Should merge complicated unordered lines with gap", () => {
        const lines = [
            lineString([[0,0], [1,1]]),
            lineString([[2,2], [3,3]]),
            lineString([[1,1], [2,2]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(4);
    });

    it("Should try to merge and make the fisrt coordinate the same", () => {
        const lines = [
            lineString([[0,0], [1,1]]),
            lineString([[2,2], [1,1]]),            
            lineString([[2,2], [3,3]])
        ];
        const merged = SpatialService.mergeLines(lines.map(l => l.geometry));
        expect(merged.coordinates.length).toBe(4);
        expect(merged.coordinates[0]).toEqual([0,0]);
    });
});
