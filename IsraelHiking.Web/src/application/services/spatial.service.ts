import { Injectable } from "@angular/core";
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

import type { LatLngAlt, Bounds } from "../models/models";

@Injectable()
export class SpatialService {

    public static getLengthInMetersForGeometry(geometry: GeoJSON.Geometry) {
        if (geometry.type === "LineString") {
            return SpatialService.getLengthInMetersForCoordinates(geometry.coordinates);
        }
        if (geometry.type === "MultiLineString") {
            let totalDistance = 0;
            for (let coordinates of geometry.coordinates) {
                totalDistance += SpatialService.getLengthInMetersForCoordinates(coordinates);
            }
            return totalDistance;
        }
        return 0;
    }

    private static getLengthInMetersForCoordinates(coordinates: number[][]) {
        let totalDistance = 0;
        for (let coordinateIndex = 1; coordinateIndex < coordinates.length; coordinateIndex++) {
            totalDistance += distance(coordinates[coordinateIndex - 1], coordinates[coordinateIndex], { units: "meters" });
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
        let simplified = simplify(lineString(coordinates), { tolerance });
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
        let coordinates = SpatialService.toCoordinate(latlng);
        for (let line of lines) {
            let currentNearestPoint = nearestPointOnLine(line, coordinates);
            if (currentNearestPoint.properties.dist < minimalDistance) {
                minimalDistance = currentNearestPoint.properties.dist;
                closetLine = line;
                nearestPoint = currentNearestPoint;
            }
        }
        let newCoordinates = [...closetLine.geometry.coordinates];
        newCoordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
        lines.splice(lines.indexOf(closetLine), 1);
        lines.push(lineString(newCoordinates, closetLine.properties));
        return point(nearestPoint.geometry.coordinates);
    }

    public static clipLinesToTileBoundary(lines: GeoJSON.Feature<GeoJSON.LineString>[],
        tile: { x: number; y: number},
        zoom: number): GeoJSON.Feature<GeoJSON.LineString>[] {
        let northEast = SpatialService.fromTile(tile, zoom);
        let southWest = SpatialService.fromTile({x: tile.x + 1, y: tile.y + 1}, zoom);
        let tilePolygon = bboxPolygon([northEast.lng, southWest.lat, southWest.lng, northEast.lat]);
        // This is to overcome accuracy issues...
        let tilePolygonTest = bboxPolygon([northEast.lng - 1e-6, southWest.lat - 1e-6, southWest.lng + 1e-6, northEast.lat + 1e-6]);
        let clippedLines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (let line of lines) {
            let intersectionPoints = lineIntersect(line, tilePolygon);
            if (intersectionPoints.features.length === 0) {
                clippedLines.push(line);
                continue;
            }
            let splitLines = lineSplit(line, tilePolygon);
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
        for (let lineForPoints of lines) {
            let start = lineForPoints.geometry.coordinates[0];
            let end = lineForPoints.geometry.coordinates[lineForPoints.geometry.coordinates.length - 1];
            for (let lineToCheck of lines) {
                if (lineToCheck === lineForPoints) {
                    continue;
                }
                if (!lineToCheck.bbox) {
                    lineToCheck.bbox = bbox(lineToCheck);
                }
                if (start[0] >= lineToCheck.bbox[0] && start[0] <= lineToCheck.bbox[2] &&
                    start[1] >= lineToCheck.bbox[1] && start[1] <= lineToCheck.bbox[3]) {
                    let nearestPoint = nearestPointOnLine(lineToCheck, start);
                    if (nearestPoint.properties.dist < 1e-5) {
                        lineToCheck.geometry.coordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
                        continue;
                    }
                }
                if (end[0] >= lineToCheck.bbox[0] && end[0] <= lineToCheck.bbox[2] &&
                    end[1] >= lineToCheck.bbox[1] && end[1] <= lineToCheck.bbox[3]) {
                    let nearestPoint = nearestPointOnLine(lineToCheck, end);
                    if (nearestPoint.properties.dist < 1e-5) {
                        lineToCheck.geometry.coordinates.splice(nearestPoint.properties.index + 1, 0, nearestPoint.geometry.coordinates);
                        continue;
                    }
                }
            }
        }
    }

    public static splitLine(newLatlng: LatLngAlt, line: LatLngAlt[]): { start: LatLngAlt[]; end: LatLngAlt[] } {
        if (line.length < 2 ) {
            throw new Error("Line length should be at least 2");
        }
        let closestPointOnSegment = line[0];
        for (let currentLatLng of line) {
            if (SpatialService.getDistance(currentLatLng, newLatlng) <
                SpatialService.getDistance(closestPointOnSegment, newLatlng)) {
                closestPointOnSegment = currentLatLng;
            }
        }
        let indexOfClosestPoint = line.indexOf(closestPointOnSegment);
        let indexToInsert = SpatialService.getIndexToInsertForSplit(indexOfClosestPoint, line, newLatlng);
        if (indexToInsert >= line.length) {
            return { start: [...line, newLatlng], end: [newLatlng, newLatlng] };
        }
        if (indexToInsert === 0) {
            return { start: [newLatlng, newLatlng], end: [newLatlng, ...line] };
        }
        let start = line.slice(0, indexToInsert);
        let end = line.slice(indexToInsert);
        let projected = SpatialService.project(newLatlng, line[indexToInsert - 1], line[indexToInsert]);
        if (projected.projectionFactor === 0.0) {
            // no need to add a point that already exists, adding a point only to end segment
            return { start, end: [projected.latlng, ...end] };
        }
        return { start: [...start, projected.latlng], end: [projected.latlng, ...end] };
    }

    private static getIndexToInsertForSplit(indexOfClosestPoint: number, line: LatLngAlt[], newLatlng: LatLngAlt): number {
        // Default location is before the closest node
        let indexToInsert = indexOfClosestPoint;

        if (indexOfClosestPoint === 0) {
            let firstSegment = [line[0], line[1]];
            if (SpatialService.getDistanceFromPointToLine(newLatlng, firstSegment) <
                SpatialService.getDistanceInMeters(newLatlng, line[0])) {
                indexToInsert = 1;
            }
        } else if (indexOfClosestPoint === line.length - 1) {
            let lastSegment = [line[indexOfClosestPoint - 1], line[indexOfClosestPoint]];
            if (SpatialService.getDistanceFromPointToLine(newLatlng, lastSegment) >=
                SpatialService.getDistanceInMeters(newLatlng, line[indexOfClosestPoint])) {
                indexToInsert += 1;
            }
        } else {
            // add in between two points:
            let segmentBefore = [line[indexOfClosestPoint - 1], line[indexOfClosestPoint]];
            let segmentAfter = [line[indexOfClosestPoint], line[indexOfClosestPoint + 1]];
            if (SpatialService.getDistanceFromPointToLine(newLatlng, segmentBefore) >=
                SpatialService.getDistanceFromPointToLine(newLatlng, segmentAfter)) {
                indexToInsert += 1;
            }
        }
        return indexToInsert;
    }

    private static project(p: LatLngAlt, a: LatLngAlt, b: LatLngAlt): { latlng: LatLngAlt; projectionFactor: number } {

        let atob = { x: b.lng - a.lng, y: b.lat - a.lat, z: (a.alt != null && b.alt != null) ? b.alt - a.alt : null };
        let atop = { x: p.lng - a.lng, y: p.lat - a.lat };
        let len = atob.x * atob.x + atob.y * atob.y;
        let dot = atop.x * atob.x + atop.y * atob.y;
        let projectionFactor = Math.min(1, Math.max(0, dot / len ));

        return {
            latlng: {
                lng: a.lng + atob.x * projectionFactor,
                lat: a.lat + atob.y * projectionFactor,
                alt: a.alt != null ? a.alt + atob.z * projectionFactor : null
            },
            projectionFactor
        };
    }

    public static getLatlngInterpolatedValue(latlng1: LatLngAlt, latlng2: LatLngAlt, ratio: number, alt?: number): LatLngAlt {
        return {
            lat: (latlng2.lat - latlng1.lat) * ratio + latlng1.lat,
            lng: (latlng2.lng - latlng1.lng) * ratio + latlng1.lng,
            alt
        };
    }

    public static getBounds(latlngs: LatLngAlt[]): Bounds {
        if (latlngs.length === 1) {
            return {
                northEast: latlngs[0],
                southWest: latlngs[0]
            };
        }
        let line = SpatialService.getLineString(latlngs);
        let boundingBox = bbox(line);
        return SpatialService.bboxToBounds(boundingBox);
    }

    public static getCenter(latlngs: LatLngAlt[]): LatLngAlt {
        if (latlngs.length === 1) {
            return latlngs[0];
        }
        let line = SpatialService.getLineString(latlngs);
        let centerPoint = center(line);
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

    private static getLineString(latlngs: LatLngAlt[]): GeoJSON.Feature<GeoJSON.LineString> {
        let coordinates = latlngs.map(l => SpatialService.toCoordinate(l));
        return lineString(coordinates);
    }

    public static getMapBounds(map: Map): Bounds {
        let bounds = map.getBounds();
        return SpatialService.mBBoundsToBounds(bounds);
    }

    public static getCirclePolygonFeature(centerPoint: LatLngAlt, radius: number):
        GeoJSON.Feature<GeoJSON.Polygon> & { properties: { radius: number }} {
        let options = { steps: 64, units: "meters" as Units, properties: { radius } };
        return circle(SpatialService.toCoordinate(centerPoint), radius, options);
    }

    public static getLineBearingInDegrees(latlng1: LatLngAlt, latlng2: LatLngAlt): number {
        let lat1Radians = latlng1.lat * Math.PI / 180;
        let lat2Radians = latlng2.lat * Math.PI / 180;
        let lngDiffRadians = (latlng2.lng - latlng1.lng) * Math.PI / 180;
        let y = Math.sin(lngDiffRadians) * Math.cos(lat2Radians);
        let x = Math.cos(lat1Radians) * Math.sin(lat2Radians) -
                Math.sin(lat1Radians) * Math.cos(lat2Radians) * Math.cos(lngDiffRadians);
        let bearingRadians = Math.atan2(y, x);
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
        let tile = SpatialService.toTile(latlng, zoom);
        return {
            pixelX: Math.floor((tile.x - Math.floor(tile.x)) * tileSize),
            pixelY: Math.floor((tile.y - Math.floor(tile.y)) * tileSize)
        };
    }
}
