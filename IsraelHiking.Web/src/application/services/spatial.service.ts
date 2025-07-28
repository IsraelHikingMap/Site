import { Map, LngLatBounds, LngLatLike } from "maplibre-gl";
import { lineString, featureCollection, point, Units } from "@turf/helpers";
import simplify from "@turf/simplify";
import distance from "@turf/distance";
import center from "@turf/center";
import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import circle from "@turf/circle";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import pointToLineDistance from "@turf/point-to-line-distance";
import lineSplit from "@turf/line-split";
import lineIntersect from "@turf/line-intersect";
import booleanWithin from "@turf/boolean-within";
import type { Immutable } from "immer";

import type { LatLngAlt, Bounds, LatLngAltTime } from "../models/models";

export class SpatialService {

    public static getLengthInMetersForGeometry(geometry: Immutable<GeoJSON.Geometry>) {
        if (geometry.type === "LineString") {
            return SpatialService.getLengthInMetersForCoordinates(geometry.coordinates);
        }
        if (geometry.type === "MultiLineString") {
            let totalDistance = 0;
            for (const coordinates of geometry.coordinates) {
                totalDistance += SpatialService.getLengthInMetersForCoordinates(coordinates);
            }
            return totalDistance;
        }
        return 0;
    }

    private static getLengthInMetersForCoordinates(coordinates: Immutable<number[][]>) {
        let totalDistance = 0;
        for (let coordinateIndex = 1; coordinateIndex < coordinates.length; coordinateIndex++) {
            totalDistance += distance(coordinates[coordinateIndex - 1] as number[], coordinates[coordinateIndex] as number[], { units: "meters" });
        }
        return totalDistance;
    }

    public static getDistanceInMeters(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        return distance(SpatialService.toCoordinate(latlng1),
            SpatialService.toCoordinate(latlng2), { units: "meters" });
    }

    public static simplify(coordinates: [number, number][], tolerance: number): [number, number][] {
        if (coordinates.length <= 1) {
            return coordinates;
        }
        const simplified = simplify(lineString(coordinates), { tolerance });
        return simplified.geometry.coordinates as [number, number][];
    }

    public static getDistance(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        return distance(SpatialService.toCoordinate(latlng1),
            SpatialService.toCoordinate(latlng2), { units: "degrees" });
    }

    public static getDistanceForCoordinates(coordinate1: [number, number], coordinate2: [number, number]) {
        return Math.sqrt(Math.pow(coordinate1[0] - coordinate2[0], 2) + Math.pow(coordinate1[1] - coordinate2[1], 2));
    }

    public static getDistanceFromPointToLine(latlng: LatLngAlt, line: LatLngAlt[]): number {
        return pointToLineDistance(SpatialService.toCoordinate(latlng), SpatialService.getLineString(line), { units: "meters" });
    }

    /**
     * This method will insert a single point to the closest line in the collection and replace that line
     * so that the original is not changed.
     * The point that will be added will be on the closest segment of the closest line.
     *
     * @param latlng the point to add a projected version to the closest line
     * @param collection the collection of all the lines to test against
     * @returns the projected point
     */
    public static insertProjectedPointToClosestLineAndReplaceIt(
        latlng: LatLngAlt,
        lines: GeoJSON.Feature<GeoJSON.LineString>[]): GeoJSON.Feature<GeoJSON.Point> {
        let closetLine = null;
        let nearestPoint = null;
        let minimalDistance = Infinity;
        const coordinates = SpatialService.toCoordinate(latlng);
        for (const line of lines) {
            const currentNearestPoint = nearestPointOnLine(line, coordinates);
            if (currentNearestPoint.properties.dist < minimalDistance) {
                minimalDistance = currentNearestPoint.properties.dist;
                closetLine = line;
                nearestPoint = currentNearestPoint;
            }
        }
        const newCoordinates = [...closetLine.geometry.coordinates];
        newCoordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
        lines.splice(lines.indexOf(closetLine), 1);
        lines.push(lineString(newCoordinates, closetLine.properties));
        return point(nearestPoint.geometry.coordinates);
    }

    public static clipLinesToTileBoundary(lines: GeoJSON.Feature<GeoJSON.LineString>[],
        tile: { x: number; y: number},
        zoom: number): GeoJSON.Feature<GeoJSON.LineString>[] {
        const northEast = SpatialService.fromTile(tile, zoom);
        const southWest = SpatialService.fromTile({x: tile.x + 1, y: tile.y + 1}, zoom);
        const tilePolygon = bboxPolygon([northEast.lng, southWest.lat, southWest.lng, northEast.lat]);
        // This is to overcome accuracy issues...
        const tilePolygonTest = bboxPolygon([northEast.lng - 1e-6, southWest.lat - 1e-6, southWest.lng + 1e-6, northEast.lat + 1e-6]);
        let clippedLines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (const line of lines) {
            const intersectionPoints = lineIntersect(line, tilePolygon);
            if (intersectionPoints.features.length === 0) {
                clippedLines.push(line);
                continue;
            }
            const splitLines = lineSplit(line, tilePolygon);
            clippedLines = clippedLines.concat(splitLines.features.filter(f => booleanWithin(f, tilePolygonTest)));
        }
        return clippedLines;
    }

    /**
     * The lines that are part of the tiles are simplified and might miss juctions points.
     * This methods add these juctions by only looking at the start and end of a line
     * and checking aginast all other lines
     * To improve performance this is done by first checking the bounding box of a line
     * and only after that finding the nearest point.
     *
     * @param lines - The lines to find and add juction points, these lines will be updated as part of this method.
     */
    public static addMissinIntersectionPoints(lines: GeoJSON.Feature<GeoJSON.LineString>[]) {
        for (const lineForPoints of lines) {
            const start = lineForPoints.geometry.coordinates[0];
            const end = lineForPoints.geometry.coordinates[lineForPoints.geometry.coordinates.length - 1];
            for (const lineToCheck of lines) {
                if (lineToCheck === lineForPoints) {
                    continue;
                }
                if (!lineToCheck.bbox) {
                    lineToCheck.bbox = bbox(lineToCheck);
                }
                if (SpatialService.insideBbox(start, lineToCheck.bbox)) {
                    const nearestPoint = nearestPointOnLine(lineToCheck, start, { units: "meters" });
                    if (nearestPoint.properties.dist < 2) {
                        lineToCheck.geometry.coordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
                        continue;
                    }
                }
                if (SpatialService.insideBbox(end, lineToCheck.bbox)) {
                    const nearestPoint = nearestPointOnLine(lineToCheck, end, { units: "meters" });
                    if (nearestPoint.properties.dist < 2) {
                        lineToCheck.geometry.coordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
                        continue;
                    }
                }
            }
        }
    }

    public static splitLine(newLatlng: LatLngAlt, line: LatLngAltTime[]): { start: LatLngAltTime[]; end: LatLngAltTime[] } {
        if (line.length < 2 ) {
            throw new Error("Line length should be at least 2");
        }
        const closestSegmentIndex = SpatialService.getClosestSegmentIndex(newLatlng, line);
        const projected = SpatialService.project(newLatlng, line[closestSegmentIndex], line[closestSegmentIndex + 1]);
        if (projected.projectionFactor === 0.0 && closestSegmentIndex === 0) {
            const firstLngLat = line[0];
            return { start: [firstLngLat, firstLngLat], end: [...line] };
        }
        if (projected.projectionFactor === 1.0 && closestSegmentIndex === line.length - 2) {
            const lastLngLat = line[line.length - 1];
            return { start: [...line], end: [lastLngLat, lastLngLat] };
        }
        const start = line.slice(0, closestSegmentIndex + 1);
        const end = line.slice(closestSegmentIndex + 1);

        if (projected.projectionFactor === 1.0) {
            // No need to add a point that already exists, 
            // Adding the fist point of 'end' segment to 'start' segment
            return { start: [...start, end[0]], end };
        }
        return { start: [...start, projected.latlng], end: [projected.latlng, ...end] };
    }

    private static getClosestSegmentIndex(newLatlng: LatLngAlt, line: LatLngAlt[]): number {
        let closestSegmentIndex = 0;
        let minimalDistance = Infinity;
        for (let segmentIndex = 0; segmentIndex <= line.length - 2; segmentIndex++) {
            const segment = [line[segmentIndex], line[segmentIndex + 1]];
            const distance = SpatialService.getDistanceFromPointToLine(newLatlng, segment);
            if (distance < minimalDistance) {
                closestSegmentIndex = segmentIndex;
                minimalDistance = distance;
            }
        }
        return closestSegmentIndex;
    }

    private static project(p: LatLngAlt, a: LatLngAltTime, b: LatLngAltTime): { latlng: LatLngAltTime; projectionFactor: number } {

        const atob = { 
            x: b.lng - a.lng, 
            y: b.lat - a.lat, 
            z: (a.alt != null && b.alt != null) ? b.alt - a.alt : null,
            t: (a.timestamp != null && b.timestamp != null) ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() : null
        };
        const atop = { x: p.lng - a.lng, y: p.lat - a.lat };
        const len = atob.x * atob.x + atob.y * atob.y;
        const dot = atop.x * atob.x + atop.y * atob.y;
        const projectionFactor = Math.min(1, Math.max(0, dot / len ));

        return {
            latlng: {
                lng: a.lng + atob.x * projectionFactor,
                lat: a.lat + atob.y * projectionFactor,
                alt: atob.z != null ? a.alt + atob.z * projectionFactor : null,
                timestamp: atob.t != null ? new Date(new Date(a.timestamp).getTime() + atob.t * projectionFactor) : null
            },
            projectionFactor
        };
    }

    public static getInterpolatedValue(value1: number, value2: number, ratio: number) {
        return (value2 - value1) * ratio + value1;
    }

    public static getLatlngInterpolatedValue(latlng1: LatLngAlt, latlng2: LatLngAlt, ratio: number): LatLngAlt {
        return {
            lat: SpatialService.getInterpolatedValue(latlng1.lat, latlng2.lat, ratio),
            lng: SpatialService.getInterpolatedValue(latlng1.lng, latlng2.lng, ratio)
        };
    }

    public static getBounds(latlngs: LatLngAlt[]): Bounds {
        if (latlngs.length === 1) {
            return {
                northEast: latlngs[0],
                southWest: latlngs[0]
            };
        }
        const line = SpatialService.getLineString(latlngs);
        const boundingBox = bbox(line);
        return SpatialService.bboxToBounds(boundingBox);
    }

    public static getCenter(latlngs: LatLngAlt[]): LatLngAlt {
        if (latlngs.length === 1) {
            return latlngs[0];
        }
        const line = SpatialService.getLineString(latlngs);
        const centerPoint = center(line);
        return SpatialService.toLatLng(centerPoint.geometry.coordinates as [number, number]);

    }

    public static toCoordinate(latlng: LatLngAlt): [number, number] {
        return [latlng.lng, latlng.lat];
    }

    public static toLatLng(coordinate: [number, number] | [number, number, number] | GeoJSON.Position): LatLngAlt {
        if (coordinate.length === 3) {
            return {
                lat: coordinate[1],
                lng: coordinate[0],
                alt: coordinate[2]
            };
        }
        return {
            lat: coordinate[1],
            lng: coordinate[0]
        };
    }

    public static boundsToMBBounds(bounds: Bounds): [LngLatLike, LngLatLike] {
        return [bounds.southWest, bounds.northEast];
    }

    public static mBBoundsToBounds(bounds: LngLatBounds): Bounds {
        return {
            northEast: bounds.getNorthEast(),
            southWest: bounds.getSouthWest()
        };
    }

    public static getBoundsForFeatureCollection(feature: GeoJSON.FeatureCollection): Bounds {
        return SpatialService.bboxToBounds(bbox(feature));
    }

    public static getBoundsForFeature(feature: GeoJSON.Feature<GeoJSON.Geometry>): Bounds {
        return SpatialService.getBoundsForFeatureCollection(featureCollection([feature]));
    }

    private static bboxToBounds(boundingBox: number[]): Bounds {
        return {
            northEast: {
                lng: boundingBox[2],
                lat: boundingBox[3]
            },
            southWest: {
                lng: boundingBox[0],
                lat: boundingBox[1]
            }
        };
    }

    public static getLineString(latlngs: LatLngAlt[]): GeoJSON.Feature<GeoJSON.LineString> {
        const coordinates = latlngs.map(l => SpatialService.toCoordinate(l));
        return lineString(coordinates);
    }

    public static getPointFeature(latlng: LatLngAlt): GeoJSON.Feature<GeoJSON.Point> {
        return point(SpatialService.toCoordinate(latlng));
    }

    public static getMapBounds(map: Map): Bounds {
        const bounds = map.getBounds();
        return SpatialService.mBBoundsToBounds(bounds);
    }

    public static getCirclePolygonFeature(centerPoint: LatLngAlt, radius: number):
        GeoJSON.Feature<GeoJSON.Polygon> & { properties: { radius: number }} {
        const options = { steps: 64, units: "meters" as Units, properties: { radius } };
        return circle(SpatialService.toCoordinate(centerPoint), radius, options);
    }

    public static getLineBearingInDegrees(latlng1: LatLngAlt, latlng2: LatLngAlt): number {
        const lat1Radians = latlng1.lat * Math.PI / 180;
        const lat2Radians = latlng2.lat * Math.PI / 180;
        const lngDiffRadians = (latlng2.lng - latlng1.lng) * Math.PI / 180;
        const y = Math.sin(lngDiffRadians) * Math.cos(lat2Radians);
        const x = Math.cos(lat1Radians) * Math.sin(lat2Radians) -
                Math.sin(lat1Radians) * Math.cos(lat2Radians) * Math.cos(lngDiffRadians);
        const bearingRadians = Math.atan2(y, x);
        return (bearingRadians * 180 / Math.PI + 360) % 360; // in degrees
    }

    public static toTile(latlng: LatLngAlt, zoom: number) {
        return {
            x: (latlng.lng + 180) / 360 * Math.pow(2, zoom),
            y: (1 - Math.log(Math.tan(latlng.lat * Math.PI / 180) + 1 / Math.cos(latlng.lat * Math.PI / 180)) / Math.PI) /
                2 * Math.pow(2, zoom)
        };
    }

    public static fromTile(tile: {x: number; y: number}, zoom: number): LatLngAlt {
        const n = Math.pow(2, zoom);
        const lng = Math.floor(tile.x) / n * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.floor(tile.y) / n))) * 180 / Math.PI;
        return {lat, lng};
    }

    public static toRelativePixel(latlng: LatLngAlt, zoom: number, tileSize: number) {
        const tile = SpatialService.toTile(latlng, zoom);
        return {
            pixelX: Math.floor((tile.x - Math.floor(tile.x)) * tileSize),
            pixelY: Math.floor((tile.y - Math.floor(tile.y)) * tileSize)
        };
    }

    public static insideBbox(position: GeoJSON.Position, bbox: GeoJSON.BBox): boolean {
        return position[0] >= bbox[0] && position[0] <= bbox[2] &&
            position[1] >= bbox[1] && position[1] <= bbox[3];
    }

    public static isInIsrael(latlng: LatLngAlt): boolean {
        const position = SpatialService.toCoordinate(latlng);
        return SpatialService.insideBbox(position, [34.07929, 29.37711, 35.91531, 33.35091]);
    }

    public static isJammingTarget(latlng: LatLngAlt): boolean {
        const position = SpatialService.toCoordinate(latlng);
        return SpatialService.insideBbox(position, [35.48, 33.811, 35.50, 33.823]) ||
            SpatialService.insideBbox(position, [31.350, 30.0817, 31.355, 30.0860]) ||
            SpatialService.insideBbox(position, [35.98, 31.70, 36.02, 31.73]);
    }

    private static canBeMreged(line1: GeoJSON.Position[], line2: GeoJSON.Position[]): "start-start" | "start-end" | "end-start" | "end-end" | null {
        const start1 = line1[0];
        const end1 = line1[line1.length - 1];
        const start2 = line2[0];
        const end2 = line2[line2.length - 1];
        if (SpatialService.getDistanceForCoordinates(start1 as [number, number], start2 as [number, number]) < 1e-5) {
            return "start-start";
        }
        if (SpatialService.getDistanceForCoordinates(start1 as [number, number], end2 as [number, number]) < 1e-5) {
            return "start-end";
        }
        if (SpatialService.getDistanceForCoordinates(end1 as [number, number], start2 as [number, number]) < 1e-5) {
            return "end-start";
        }
        if (SpatialService.getDistanceForCoordinates(end1 as [number, number], end2 as [number, number]) < 1e-5) {
            return "end-end";
        }
        return null;
    }

    public static mergeLines(lines: GeoJSON.LineString[]): GeoJSON.MultiLineString | GeoJSON.LineString {
        const coordinatesGroups: GeoJSON.Position[][] = [];
        const linesToMerge = lines.filter(l => l.coordinates.length > 0);
        while (linesToMerge.length > 0) {
            let lineIndex = 0;
            let coordinatesGroupIndex = 0;
            let foundType = null;
            for (let i = 0; i < linesToMerge.length; i++) {
                for (let j = 0; j < coordinatesGroups.length; j++) {
                    foundType = SpatialService.canBeMreged(coordinatesGroups[j], linesToMerge[i].coordinates);
                    if (foundType) {
                        lineIndex = i;
                        coordinatesGroupIndex = j;
                        break;
                    }
                }
                if (foundType) {
                    break;
                }
            }
            if (!foundType) {
                coordinatesGroups.push(linesToMerge[0].coordinates);
                linesToMerge.shift();
                continue;
            }

            const line = linesToMerge[lineIndex];
            linesToMerge.splice(lineIndex, 1);
            const coordinateGroup = coordinatesGroups[coordinatesGroupIndex];
            switch (foundType) {
                case "start-start":
                    line.coordinates.reverse();
                    line.coordinates.pop();
                    coordinatesGroups[coordinatesGroupIndex] = line.coordinates.concat(coordinateGroup);
                    break;
                case "start-end":
                    line.coordinates.pop();
                    coordinatesGroups[coordinatesGroupIndex] = line.coordinates.concat(coordinateGroup);
                    break;
                case "end-start":
                    line.coordinates.shift();
                    coordinatesGroups[coordinatesGroupIndex] = coordinateGroup.concat(line.coordinates);
                    break;
                case "end-end":
                    line.coordinates.reverse();
                    line.coordinates.shift();
                    coordinatesGroups[coordinatesGroupIndex] = coordinateGroup.concat(line.coordinates);
                    break;
            }
        }

        if (coordinatesGroups.length === 1) {
            return {
                type: "LineString",
                coordinates: coordinatesGroups[0]
            }
        }

        return {
            type: "MultiLineString",
            coordinates: coordinatesGroups
        };
    }
}
