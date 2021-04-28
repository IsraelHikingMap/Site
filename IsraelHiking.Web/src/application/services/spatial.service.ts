import { Injectable } from "@angular/core";
import { LatLngAlt, Bounds } from "../models/models";
import { Map, LngLatBoundsLike, LngLatBounds } from "mapbox-gl";
import { lineString, featureCollection, Units } from "@turf/helpers";
import simplify from "@turf/simplify";
import distance from "@turf/distance";
import center from "@turf/center";
import bbox from "@turf/bbox";
import circle from "@turf/circle";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import pointToLineDistance from "@turf/point-to-line-distance";

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

    public static getClosestPoint(latlng: LatLngAlt, line: LatLngAlt[]): LatLngAlt {
        let lineForCheck = SpatialService.getLineString(line);
        let closestPointFeature = nearestPointOnLine(lineForCheck, SpatialService.toCoordinate(latlng));
        return SpatialService.toLatLng(closestPointFeature.geometry.coordinates as [number, number]);
    }

    public static getLatlngInterpolatedValue(latlng1: LatLngAlt, latlng2: LatLngAlt, ratio: number, alt?: number): LatLngAlt {
        let returnValue = {
            lat: (latlng2.lat - latlng1.lat) * ratio + latlng1.lat,
            lng: (latlng2.lng - latlng1.lng) * ratio + latlng1.lng,
            alt
        };
        return returnValue;
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

    public static getGeoJsonBounds(geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>): Bounds {
        return SpatialService.bboxToBounds(bbox(geoJson));
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

    public static toLatLng(coordinate: [number, number]): LatLngAlt {
        return {
            lat: coordinate[1],
            lng: coordinate[0]
        };
    }

    public static boundsToMBBounds(bounds: Bounds): LngLatBoundsLike {
        return [bounds.southWest, bounds.northEast];
    }

    public static mBBoundsToBounds(bounds: LngLatBounds): Bounds {
        return {
            northEast: bounds.getNorthEast(),
            southWest: bounds.getSouthWest()
        };
    }

    public static getBoundsForFeature(feature: GeoJSON.Feature<GeoJSON.Geometry>) {
        return SpatialService.bboxToBounds(bbox(featureCollection([feature])));
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

    public static getCirclePolygonFeature(centerPoint: LatLngAlt, radius: number): GeoJSON.Feature<GeoJSON.Polygon> {
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
}
