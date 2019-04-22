import { Injectable } from "@angular/core";
import { LatLngAlt, Bounds } from "../models/models";
import { Map, LngLatBoundsLike, LngLatBounds } from "mapbox-gl";
import simplify from "@turf/simplify";
import { lineString, featureCollection } from "@turf/helpers";
import distance from "@turf/distance";
import center from "@turf/center";
import bbox from "@turf/bbox";
import circle from "@turf/circle";
import nearestPointOnLine from "@turf/nearest-point-on-line";

@Injectable()
export class SpatialService {

    public static getDistanceInMeters(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        return distance(SpatialService.toCoordinate(latlng1),
            SpatialService.toCoordinate(latlng2), { units: "meters" });
    }

    public static simplify(coordinates: [number, number][]): [number, number][] {
        if (coordinates.length <= 1) {
            return coordinates;
        }
        let simplified = simplify(lineString(coordinates), { tolerance: 1 });
        return simplified.geometry.coordinates as [number, number][];
    }

    public static getDistance(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        return distance(SpatialService.toCoordinate(latlng1),
            SpatialService.toCoordinate(latlng2), { units: "degrees" });
    }

    public static getDistanceForCoordinates(coordinate1: [number, number], coordinate2: [number, number]) {
        return Math.sqrt(Math.pow(coordinate1[0] - coordinate2[0], 2) + Math.pow(coordinate1[1] - coordinate2[1], 2));
    }

    public static getDistanceFromPointToLine(coordinate: [number, number], coordinates: [number, number][]) {
        let lineStringObject = lineString(coordinates);
        let closestPointFeature = nearestPointOnLine(lineStringObject, coordinate);
        return SpatialService.getDistanceForCoordinates(closestPointFeature.geometry.coordinates as [number, number], coordinate);
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
            alt: alt
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

    public static mBBoundsToBounds(bounds: LngLatBounds):  Bounds {
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

    public static getCirclePolygon(centerPoint: LatLngAlt, radius: number): GeoJSON.Feature<GeoJSON.Polygon> {
        let options = { steps: 64, units: "meters", properties: { } };
        return circle(SpatialService.toCoordinate(centerPoint), radius, options);
    }
}