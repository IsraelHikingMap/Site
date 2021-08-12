import { Injectable } from "@angular/core";

import { LatLngAlt, DataContainer, MarkerData, RouteData, RouteSegmentData } from "../models/models";
import { SpatialService } from "./spatial.service";

@Injectable()
export class GeoJsonParser {
    private static MARKERS = "markers";

    private getPropertyValue(properties: Record<string, string>, key: string, language?: string): string {
        let value = "";
        if (language) {
            value = properties[key + ":" + language];
        }
        return value || properties[key];
    }

    private createLatlng(coordinates: GeoJSON.Position): LatLngAlt {
        return {
            lat: coordinates[1],
            lng: coordinates[0],
            alt: coordinates[2] || 0
        };
    }

    private addRouteDataToDataContainer(routeData: RouteData, data: DataContainer) {
        if (routeData && routeData.segments.length > 0) {
            routeData.markers = routeData.markers || [];
            data.routes.push(routeData);
        }
    }

    public toDataContainer(geoJson: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>, language?: string): DataContainer {
        let markers = [] as MarkerData[];
        let data = {
            routes: [] as RouteData[]
        } as DataContainer;
        for (let feature of geoJson.features) {
            let routeData = null;
            let name = this.getPropertyValue(feature.properties, "name", language);
            let description = this.getPropertyValue(feature.properties, "description", language);
            let icon = feature.properties.icon;
            let id = feature.properties.identifier;
            let website = feature.properties.website;
            let image = feature.properties.image;
            switch (feature.geometry.type) {
                case "Point":
                    let point = feature.geometry as GeoJSON.Point;
                    let marker = this.createMarker(point.coordinates, id, name, icon, description);
                    if (website) {
                        marker.urls.push({ mimeType: "text/html", text: marker.title, url: website });
                    }
                    if (image) {
                        marker.urls.push({
                            mimeType: `image/${image.split(".").pop()}`,
                            text: "",
                            url: image
                        });
                    }
                    markers.push(marker);
                    break;
                case "MultiPoint":
                    let points = feature.geometry as GeoJSON.MultiPoint;
                    for (let coordinates of points.coordinates) {
                        let multiMarker = this.createMarker(coordinates, id, name, null, description);
                        markers.push(multiMarker);
                    }
                    break;
                case "LineString":
                    let lineString = feature.geometry as GeoJSON.LineString;
                    routeData = this.positionsToData(lineString.coordinates, name, description);
                    this.addRouteDataToDataContainer(routeData, data);
                    break;
                case "MultiLineString":
                    let multiLineString = feature.geometry as GeoJSON.MultiLineString;
                    for (let i = 0; i < multiLineString.coordinates.length; i++) {
                        let prefix = i > 0 ? " " + i : "";
                        routeData = this.positionsToData(multiLineString.coordinates[i], `${name}${prefix}` , description);
                        this.addRouteDataToDataContainer(routeData, data);
                    }
                    break;
                case "Polygon":
                    let polygone = feature.geometry as GeoJSON.Polygon;
                    for (let i = 0; i < polygone.coordinates.length; i++) {
                        let prefix = i > 0 ? " " + i : "";
                        routeData = this.positionsToData(polygone.coordinates[i], `${name}${prefix}` , description);
                        this.addRouteDataToDataContainer(routeData, data);
                    }
                    break;
                case "MultiPolygon":
                    let multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                    let i = 0;
                    for (let polygoneCoordinates of multiPolygone.coordinates) {
                        for (let ringCoordinates of polygoneCoordinates) {
                            let prefix = i > 0 ? " " + i : "";
                            routeData = this.positionsToData(ringCoordinates, `${name}${prefix}` , description);
                            this.addRouteDataToDataContainer(routeData, data);
                            i++;
                        }
                    }
                    break;
            }
        }
        if (markers.length > 0) {
            if (data.routes.length === 0) {
                let name = markers.length === 1 ? markers[0].title || GeoJsonParser.MARKERS : GeoJsonParser.MARKERS;
                data.routes.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name,
                    description: "",
                    state: "ReadOnly",
                    segments: [],
                    markers: []
                });
            }
            data.routes[0].markers = markers;
        }
        let latLngs = [] as LatLngAlt[];
        for (let route of data.routes) {
            for (let segment of route.segments) {
                latLngs = latLngs.concat(segment.latlngs);
            }
            for (let marker of route.markers) {
                latLngs.push(marker.latlng);
            }
        }
        if (latLngs.length > 0) {
            let bounds = SpatialService.getBounds(latLngs);
            data.northEast = bounds.northEast;
            data.southWest = bounds.southWest;
        }
        return data;
    }

    private createMarker(coordinates: GeoJSON.Position, id: string, message: string, icon: string, description: string): MarkerData {
        return {
            id,
            latlng: this.createLatlng(coordinates),
            title: message,
            type: icon ? icon.replace("icon-", "") : "",
            description,
            urls: []
        };
    }

    private createLatlngArray(coordinates: GeoJSON.Position[]): LatLngAlt[] {
        let latlngs = [] as LatLngAlt[];
        for (let pointCoordinates of coordinates) {
            latlngs.push(this.createLatlng(pointCoordinates));
        }
        return latlngs;
    }

    private positionsToData(positions: GeoJSON.Position[], name: string, description: string): RouteData {

        let routeData = { name: name || "", description: description || "", segments: [], markers: [] } as RouteData;
        let latlngs = this.createLatlngArray(positions);
        if (latlngs.length < 2) {
            return routeData;
        }
        routeData.segments.push({
            routePoint: latlngs[0],
            latlngs: [latlngs[0], latlngs[0]],
            routingType: "Hike"
        } as RouteSegmentData);
        routeData.segments.push({
            routePoint: latlngs[latlngs.length - 1],
            latlngs,
            routingType: "Hike"
        } as RouteSegmentData);
        return routeData;
    }

    public toGeoJson(data: DataContainer): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> {
        let geoJson = {
            type: "FeatureCollection",
            features: [] as GeoJSON.Feature<GeoJSON.GeometryObject>[]
        } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

        for (let routeData of data.routes) {
            for (let marker of routeData.markers) {
                geoJson.features.push({
                    type: "Feature",
                    properties: {
                        name: marker.title
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [marker.latlng.lng, marker.latlng.lat]
                    } as GeoJSON.Point
                } as GeoJSON.Feature<GeoJSON.GeometryObject>);
            }

            let multiLineStringCoordinates = [] as GeoJSON.Position[][];

            for (let segment of routeData.segments) {
                let lineStringCoordinates = [] as GeoJSON.Position[];
                for (let latlng of segment.latlngs) {
                    lineStringCoordinates.push([latlng.lng, latlng.lat, latlng.alt] as GeoJSON.Position);
                }
                multiLineStringCoordinates.push(lineStringCoordinates);
            }
            if (multiLineStringCoordinates.length > 0) {
                let multiLineStringFeature = {
                    type: "Feature",
                    properties: {
                        name: routeData.name,
                        description: routeData.description,
                        creator: "IsraelHikingMap"
                    },
                    geometry: {
                        type: "MultiLineString",
                        coordinates: multiLineStringCoordinates
                    } as GeoJSON.MultiLineString
                } as GeoJSON.Feature<GeoJSON.GeometryObject>;
                geoJson.features.push(multiLineStringFeature);
            }
        }
        return geoJson;
    }

    public toLatLngsArray(feature: GeoJSON.Feature<GeoJSON.GeometryObject>): LatLngAlt[][] {
        let latlngsArray = [] as LatLngAlt[][];
        switch (feature.geometry.type) {
            case "Point":
                let point = feature.geometry as GeoJSON.Point;
                latlngsArray.push([this.createLatlng(point.coordinates)]);
                break;
            case "LineString":
                let lineString = feature.geometry as GeoJSON.LineString;
                latlngsArray.push(this.createLatlngArray(lineString.coordinates));
                break;
            case "MultiLineString":
                let multiLineString = feature.geometry as GeoJSON.MultiLineString;
                for (let currentCoordinatesArray of multiLineString.coordinates) {
                    latlngsArray.push(this.createLatlngArray(currentCoordinatesArray));
                }
                break;
            case "Polygon":
                let polygone = feature.geometry as GeoJSON.Polygon;
                for (let currentCoordinatesArray of polygone.coordinates) {
                    latlngsArray.push(this.createLatlngArray(currentCoordinatesArray));
                }
                break;
            case "MultiPolygon":
                let multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                for (let currentPolygoneCoordinates of multiPolygone.coordinates) {
                    for (let currentCoordinatesArray of currentPolygoneCoordinates) {
                        latlngsArray.push(this.createLatlngArray(currentCoordinatesArray));
                    }
                }
        }
        return latlngsArray;
    }
}
