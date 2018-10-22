import { Injectable } from "@angular/core";
import { geom, Coordinate, extent, Map, Extent, proj } from "openlayers";

import { LatLngAlt, IBounds } from "../models/models";

@Injectable()
export class SpatialService {

    public static getDistanceInMeters(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        let coordinate1 = proj.transform(SpatialService.toCoordinate(latlng1), "EPSG:4326", "EPSG:3857");
        let coordinate2 = proj.transform(SpatialService.toCoordinate(latlng2), "EPSG:4326", "EPSG:3857");
        return new geom.LineString([coordinate1, coordinate2]).getLength();
    }

    public static getDistance(latlng1: LatLngAlt, latlng2: LatLngAlt) {
        let line = SpatialService.getLineString([latlng1, latlng2]);
        return line.getLength();
    }

    public static getDistanceForCoordinates(coordinate1: Coordinate, coordinate2: Coordinate) {
        let line = new geom.LineString([coordinate1, coordinate2]);
        return line.getLength();
    }

    public static getDistanceFromPointToLine(coordinate: Coordinate, coordinates: Coordinate[]) {
        let lineString = new geom.LineString(coordinates);
        let closestPoint = lineString.getClosestPoint(coordinate);
        return SpatialService.getDistanceForCoordinates(closestPoint, coordinate);
    }

    public static getLatlngInterpolatedValue(latlng1: LatLngAlt, latlng2: LatLngAlt, ratio: number, alt?: number): LatLngAlt {
        let returnValue = {
            lat: (latlng2.lat - latlng1.lat) * ratio + latlng1.lat,
            lng: (latlng2.lng - latlng1.lng) * ratio + latlng1.lng,
            alt: alt
        };
        return returnValue;
    }

    public static getBounds(latlngs: LatLngAlt[]): IBounds {
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

    public static getGeoJsonBounds(geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>): IBounds {
        let coordinates = []
        for (let feature of geoJson.features) {
            for (let coordinate of feature.geometry.coordinates) {
                coordinates.push(coordinate);
            }
        }
        let line = new geom.LineString(coordinates);
        return SpatialService.extentToBounds(line.getExtent());
    }

    public static getCenter(latlngs: LatLngAlt[]): LatLngAlt {
        if (latlngs.length === 1) {
            return latlngs[0];
        }
        let line = SpatialService.getLineString(latlngs);
        let center = extent.getCenter(line.getExtent());
        return SpatialService.toLatLng(center);

    }

    public static toCoordinate(latlng: LatLngAlt): Coordinate {
        return [latlng.lng, latlng.lat];
    }

    public static toViewCoordinate(latlng: LatLngAlt): Coordinate {
        return proj.transform(SpatialService.toCoordinate(latlng), "EPSG:4326", "EPSG:3857");
    }

    public static toLatLng(coordinate: Coordinate): LatLngAlt {
        return {
            lat: coordinate[1],
            lng: coordinate[0]
        };
    }

    private static extentToBounds(ext: Extent): IBounds {
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

    private static getLineString(latlngs: LatLngAlt[]): geom.LineString {
        let olCoordinates = latlngs.map(l => SpatialService.toCoordinate(l));
        return new geom.LineString(olCoordinates);
    }

    public static getMapBounds(map: Map): IBounds {
        let viewExtent = map.getView().calculateExtent(map.getSize());
        viewExtent = proj.transformExtent(viewExtent, "EPSG:3857", "EPSG:4326");
        return SpatialService.extentToBounds(viewExtent);
    }

    public static screenToLatLng(coordinate: Coordinate): LatLngAlt {
        let coordinateLatlng = proj.toLonLat(coordinate);
        return SpatialService.toLatLng(coordinateLatlng);
    }
}