import { Injectable } from "@angular/core";
import { Coordinate, Map, Extent } from "ol";
import { getCenter } from "ol/extent";
import { getDistance } from "ol/sphere";
import { LineString } from "ol/geom";
import { transform, toLonLat, transformExtent } from "ol/proj";
import { LatLngAlt, Bounds } from "../models/models";

@Injectable()
export class SpatialService {

    public static getDistanceInMeters(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        return getDistance(SpatialService.toCoordinate(latlng1),
            SpatialService.toCoordinate(latlng2));
    }

    public static simplify(coordinates: Coordinate[]): Coordinate[] {
        let line = new LineString(coordinates);
        line = line.simplify(1) as LineString;
        return line.getCoordinates();
    }

    public static getDistance(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        let line = SpatialService.getLineString([latlng1, latlng2]);
        return line.getLength();
    }

    public static getDistanceForCoordinates(coordinate1: Coordinate, coordinate2: Coordinate) {
        let line = new LineString([coordinate1, coordinate2]);
        return line.getLength();
    }

    public static getDistanceFromPointToLine(coordinate: Coordinate, coordinates: Coordinate[]) {
        let lineString = new LineString(coordinates);
        let closestPoint = lineString.getClosestPoint(coordinate);
        return SpatialService.getDistanceForCoordinates(closestPoint, coordinate);
    }

    public static getClosestPoint(latlng: LatLngAlt, line: LatLngAlt[]): LatLngAlt {
        let lineString = new LineString(line.map(l => SpatialService.toViewCoordinate(l)));
        let closestPoint = lineString.getClosestPoint(SpatialService.toViewCoordinate(latlng));
        return SpatialService.fromViewCoordinate(closestPoint);
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
        let lineExtent = line.getExtent();
        return SpatialService.extentToBounds(lineExtent);
    }

    public static getGeoJsonBounds(geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>): Bounds {
        let coordinates = [];
        for (let feature of geoJson.features) {
            for (let coordinate of feature.geometry.coordinates) {
                coordinates.push(coordinate);
            }
        }
        let line = new LineString(coordinates);
        return SpatialService.extentToBounds(line.getExtent());
    }

    public static getCenter(latlngs: LatLngAlt[]): LatLngAlt {
        if (latlngs.length === 1) {
            return latlngs[0];
        }
        let line = SpatialService.getLineString(latlngs);
        let center = getCenter(line.getExtent());
        return SpatialService.toLatLng(center);

    }

    public static toViewCoordinate(latlng: LatLngAlt): Coordinate {
        if (latlng == null) {
            return null;
        }
        return transform(SpatialService.toCoordinate(latlng), "EPSG:4326", "EPSG:3857");
    }

    public static fromViewCoordinate(coordinate: Coordinate): LatLngAlt {
        let coordinateLatlng = toLonLat(coordinate);
        return SpatialService.toLatLng(coordinateLatlng);
    }

    public static toCoordinate(latlng: LatLngAlt): Coordinate {
        return [latlng.lng, latlng.lat];
    }

    private static toLatLng(coordinate: Coordinate): LatLngAlt {
        return {
            lat: coordinate[1],
            lng: coordinate[0]
        };
    }

    public static extentToBounds(ext: Extent): Bounds {
        return {
            northEast: {
                lng: ext[2],
                lat: ext[3]
            },
            southWest: {
                lng: ext[0],
                lat: ext[1]
            }
        };
    }

    public static boundsToViewExtent(bounds: Bounds): Extent {
        return [
            ...SpatialService.toViewCoordinate(bounds.southWest), ...SpatialService.toViewCoordinate(bounds.northEast)
        ] as Extent;
    }

    private static getLineString(latlngs: LatLngAlt[]): LineString {
        let olCoordinates = latlngs.map(l => SpatialService.toCoordinate(l));
        return new LineString(olCoordinates);
    }

    public static getMapBounds(map: Map): Bounds {
        let viewExtent = map.getView().calculateExtent(map.getSize());
        viewExtent = transformExtent(viewExtent, "EPSG:3857", "EPSG:4326");
        return SpatialService.extentToBounds(viewExtent);
    }
}