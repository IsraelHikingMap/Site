import { SpatialService } from "./spatial.service";
import { lineString } from "@turf/helpers";
import { Bounds } from "../models/models";
import { LngLatBounds } from "maplibre-gl";

describe("Spatial service", () => {
    it("Should get length in meters for a line string", () => {
        let length = SpatialService.getLengthInMetersForGeometry({ type: "LineString", coordinates: [[0,0], [0,1]]});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should get length in meters for a multi line string", () => {
        let length = SpatialService.getLengthInMetersForGeometry({ type: "MultiLineString", coordinates: [[[0,0], [0,1]]]});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should return 0 for non line geometries", () => {
        let length = SpatialService.getLengthInMetersForGeometry({ type: "Polygon", coordinates: [[[0,0], [0,1]]]});
        expect(length).toBe(0);
    });

    it("Should get length in meters for coordinates", () => {
        let length = SpatialService.getDistanceInMeters({ lat: 0, lng: 0}, { lat: 0, lng: 1});
        expect(length).toBeGreaterThan(100000);
    });

    it("Should not simplify a signle coordinate", () => {
        let simplified = SpatialService.simplify([], 0);
        expect(simplified.length).toBe(0);
    });

    it("Should simplify according to imput", () => {
        let simplified = SpatialService.simplify([[0,0], [0, 0.5], [0, 1]], 0.1);
        expect(simplified.length).toBe(2);
    });

    it("Should get a distance in degrees", () => {
        let distance = SpatialService.getDistance({ lat: 0, lng: 0}, { lat: 0, lng: 1});
        expect(distance).toBeCloseTo(1);
    });

    it("Should get a distance for coordinates", () => {
        let distance = SpatialService.getDistanceForCoordinates([0, 0], [0, 1]);
        expect(distance).toBe(1);
    });

    it("Should get a distance from a lat-lng point to line in meters", () => {
        let distance = SpatialService.getDistanceFromPointToLine({ lat: 0.00001, lng: 0}, [{ lat: 0, lng: 0}, { lat: 0, lng: 1}]);
        expect(distance).toBeGreaterThan(1);
    });

    it("Should not change a line that is within a tile", () => {
        let lines = [lineString([[0.1,0.1], [1,1]])];
        let clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines).toEqual(lines);
    });

    it("Should change a line that is intersect with a tile boundary", () => {
        let lines = [lineString([[-1,-1], [1,1]])];
        let clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines[0].geometry.coordinates[0]).toEqual([0,0]);
    });

    it("Should change a line that is crosses the entire tile boundary", () => {
        let lines = [lineString([[-1,-1], [5,5]])];
        let clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines[0].geometry.coordinates[0]).toEqual([0,0]);
        expect(clippedLines[0].geometry.coordinates[1]).not.toEqual([5,5]);
    });

    it("Should split a line that is crosses the tile boundary multiple times to several lines", () => {
        let lines = [lineString([[-1,-1], [0.5,0.5], [-1, 0.5], [0.5, 0.6], [-1, 0.6], [0.7, 0.7]])];
        let clippedLines = SpatialService.clipLinesToTileBoundary(lines, {x: 128,y: 127}, 8);
        expect(clippedLines.length).toBe(3);
        expect(clippedLines[0].geometry.coordinates[0]).toEqual([0,0]);
        expect(clippedLines[0].geometry.coordinates[2]).toEqual([0,0.5]);
        expect(clippedLines[1].geometry.coordinates[2]).toEqual([0,0.6]);
        expect(clippedLines[2].geometry.coordinates[1]).toEqual([0.7,0.7]);
    });

    it("Should add an intersection point for a T case start of line", () => {
        let lines = [lineString([[-1,0], [1,0]]), lineString([[0,0], [0,1]])];
        SpatialService.addMissinIntersectionPoints(lines);
        expect(lines[0].geometry.coordinates.length).toBe(3);
        expect(lines[0].geometry.coordinates[1][0]).toBeCloseTo(0);
    });

    it("Should add an intersection point for a T case end of line", () => {
        let lines = [lineString([[-1,0], [1,0]]), lineString([[0,1], [0,0]])];
        SpatialService.addMissinIntersectionPoints(lines);
        expect(lines[0].geometry.coordinates.length).toBe(3);
        expect(lines[0].geometry.coordinates[1][0]).toBeCloseTo(0);
    });

    it("Should find the closest point on a line and replace that line", () => {
        let lines = [lineString([[-1,0], [1,0]])];
        let point = SpatialService.insertProjectedPointToClosestLineAndReplaceIt({lat: 1, lng: 0}, lines);
        expect(point.geometry.coordinates[0]).toBeCloseTo(0);
        expect(point.geometry.coordinates[1]).toBeCloseTo(0);
        expect(lines[0].geometry.coordinates.length).toBe(3);
    });

    it("Should find the closest point on a line and replace that line given two lines", () => {
        let lines = [lineString([[-1,0], [1,0]]), lineString([[-1,1], [1,1]])];
        let point = SpatialService.insertProjectedPointToClosestLineAndReplaceIt({lat: 1, lng: 0}, lines);
        expect(point.geometry.coordinates[0]).toBeCloseTo(0);
        expect(point.geometry.coordinates[1]).toBeCloseTo(1);
        expect(lines[1].geometry.coordinates.length).toBe(3);
    });

    it("Should throw a line when it is too short", () => {
        expect(() => SpatialService.splitLine({lat: 0, lng: 0.5}, [])).toThrowError();
    });

    it("Should split a line in the start", () => {
        let split = SpatialService.splitLine({lat: 0, lng: -0.5}, [{lat: 0, lng: 0}, { lat: 0, lng: 1}]);
        expect(split.start.length).toBe(2);
        expect(split.end.length).toBe(3);
    });

    it("Should split a line in the end", () => {
        let split = SpatialService.splitLine({lat: 0, lng: 1.5}, [{lat: 0, lng: 0}, { lat: 0, lng: 1}]);
        expect(split.start.length).toBe(3);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle but not add a new point if the point already exists", () => {
        let split = SpatialService.splitLine({lat: 0, lng: 1}, [{lat: 0, lng: 0}, { lat: 0, lng: 1}, { lat: 0, lng: 2}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(1);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle and add a new projected point", () => {
        let split = SpatialService.splitLine({lat: 0.1, lng: 0.5}, [{lat: 0, lng: 0}, { lat: 0, lng: 1}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(0.5);
        expect(split.start[1].lat).toBe(0);
        expect(split.end.length).toBe(2);
    });

    it("Should split a line in the middle and add a new projected point with altitude", () => {
        let split = SpatialService.splitLine({lat: 0, lng: 0.5, alt: 1}, [{lat: 0, lng: 0, alt: 0}, { lat: 0, lng: 1, alt: 2}]);
        expect(split.start.length).toBe(2);
        expect(split.start[1].lng).toBe(0.5);
        expect(split.start[1].lat).toBe(0);
        expect(split.start[1].alt).toBe(1);
        expect(split.end.length).toBe(2);
    });

    it("Should get interpolated value", () => {
        let interpolated = SpatialService.getLatlngInterpolatedValue({lat: 0, lng: 0}, { lat: 1, lng: 1}, 0.5, 2);
        expect(interpolated.alt).toBe(2);
        expect(interpolated.lat).toBe(0.5);
        expect(interpolated.lng).toBe(0.5);
    });

    it("Should get bounds for a single point to be that point", () => {
        let bounds = SpatialService.getBounds([{lat: 42, lng: 42}]);
        expect(bounds.northEast.lat).toBe(42);
        expect(bounds.northEast.lng).toBe(42);
        expect(bounds.southWest.lat).toBe(42);
        expect(bounds.southWest.lng).toBe(42);
    });

    it("Should get bounds for two points", () => {
        let bounds = SpatialService.getBounds([{lat: 0, lng: 0}, {lat: 1, lng: 1}]);
        expect(bounds.northEast.lat).toBe(1);
        expect(bounds.northEast.lng).toBe(1);
        expect(bounds.southWest.lat).toBe(0);
        expect(bounds.southWest.lng).toBe(0);
    });

    it("Should get bounds for geojson", () => {
        let bounds = SpatialService.getBoundsForFeature({
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
        let center = SpatialService.getCenter([{lat: 42, lng: 42}]);
        expect(center.lat).toBe(42);
        expect(center.lng).toBe(42);
    });

    it("Should get center for a line", () => {
        let center = SpatialService.getCenter([{lat: 0, lng: 0}, {lat: 42, lng: 42}]);
        expect(center.lat).toBe(21);
        expect(center.lng).toBe(21);
    });

    it("Should convert from and to coordinate", () => {
        let coordinate = [1, 2];
        let coordinate2 = SpatialService.toCoordinate(SpatialService.toLatLng(coordinate));
        expect(coordinate2).toEqual(coordinate);
    });

    it("Should convert from and to coordinate", () => {
        let latlng = SpatialService.toLatLng([1,2,3]);
        expect(latlng.lng).toBe(1);
        expect(latlng.lat).toBe(2);
        expect(latlng.alt).toBe(3);
    });

    it("Should convert to maplibre bounds", () => {
        let latlng = {lat: 1, lng: 2};
        let bounds = { northEast: latlng, southWest: latlng } as Bounds;
        let mBounds = SpatialService.boundsToMBBounds(bounds);
        expect(mBounds[0]).toEqual(latlng);
        expect(mBounds[1]).toEqual(latlng);
    });

    it("Should convert to bounds", () => {
        let latlng = {lat: 1, lng: 2};
        let mbBounds = new LngLatBounds([latlng, latlng]);
        let bounds = SpatialService.mBBoundsToBounds(mbBounds);
        let mapBounds = SpatialService.getMapBounds({ getBounds: () => mbBounds } as any);
        expect(bounds.northEast.lat).toBe(latlng.lat);
        expect(bounds.southWest.lng).toBe(latlng.lng);
        expect(bounds).toEqual(mapBounds);
    });

    it("Should calculate bounds from a feature", () => {
        let bounds = SpatialService.getBoundsForFeature({ 
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
        let circle = SpatialService.getCirclePolygonFeature({lat: 0, lng: 0}, 100);
        expect(circle.geometry.coordinates[0].length).toBe(65);
        expect(circle.properties.radius).toBe(100);
    });

    it("Should get line bearing in degrees", () => {
        let bearing = SpatialService.getLineBearingInDegrees({lat: 0, lng: 0}, {lat: -1, lng: 0});
        expect(bearing).toBe(180);
    });

    it("Should convert from and to tile", () => {
        let latlngExpected = {lat: 0, lng: 0};
        let latlng = SpatialService.fromTile(SpatialService.toTile(latlngExpected, 12), 12);
        expect(latlngExpected).toEqual(latlng);
    });

    it("Should get relative pixel location of zero coordinates", () => {
        let latlng = {lat: 0, lng: 0};
        let pixel = SpatialService.toRelativePixel(latlng, 12, 256);
        expect(pixel.pixelX).toBe(0);
        expect(pixel.pixelY).toBe(0);
    });

    it("Should get relative pixel location", () => {
        let latlng = {lat: 0.1, lng: 0.1};
        let pixel = SpatialService.toRelativePixel(latlng, 12, 256);
        expect(pixel.pixelX).toBe(35);
        expect(pixel.pixelY).toBe(220);
    });
});
