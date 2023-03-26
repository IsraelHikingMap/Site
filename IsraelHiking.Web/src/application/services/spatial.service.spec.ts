import { SpatialService } from "./spatial.service";
import { lineString } from "@turf/helpers";

describe("Spatial service", () => {
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
});
