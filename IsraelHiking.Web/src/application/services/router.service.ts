import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { VectorTile } from "@mapbox/vector-tile";
import { NgRedux } from "@angular-redux2/store";
import PathFinder from "geojson-path-finder";
import Protobuf from "pbf";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt, RoutingType } from "../models/models";

@Injectable()
export class RouterService {
    private featuresCache: Map<string, GeoJSON.FeatureCollection<GeoJSON.LineString>>;

    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly databaseService: DatabaseService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.featuresCache = new Map<string, GeoJSON.FeatureCollection<GeoJSON.LineString>>();
    }

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        let address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            let geojson = await firstValueFrom(this.httpClient.get(address).pipe(timeout(4500)));
            let data = geojson as GeoJSON.FeatureCollection<GeoJSON.LineString>;
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            try {
                return await this.getOffineRoute(latlngStart, latlngEnd, routinType);
            } catch (ex2) {
                // HM TODO: consider adding message about offline routing
                this.toastService.error({
                    message: (ex as Error).message + ", " + (ex2 as Error).message
                }, this.resources.routingFailed);
                return [latlngStart, latlngEnd];
            }
        }
    }

    private async getOffineRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        if (routinType === "None") {
            return [latlngStart, latlngEnd];
        }
        let offlineState = this.ngRedux.getState().offlineState;
        if (!offlineState.isOfflineAvailable || offlineState.lastModifiedDate == null) {
            throw new Error("[Routing] Offline routing is only supported after downloading offline data");
        }
        const zoom = 14; // this is the max zoom for these tiles
        let tiles = [latlngStart, latlngEnd].map(latlng => SpatialService.toTile(latlng, zoom));
        const tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        const tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        if (tileXmax - tileXmin > 2 || tileYmax - tileYmin > 2) {
            throw new Error("[Routing] Offline routing is only supported for adjecent tiles maximum...");
        }
        let features = await this.updateCacheAndGetFeatures(tileXmin, tileXmax, tileYmin, tileYmax, zoom);
        if (routinType === "4WD") {
            features = features.filter(f =>
                f.properties.ihm_class !== "footway" &&
                f.properties.ihm_class !== "pedestrian" &&
                f.properties.ihm_class !== "path" &&
                f.properties.ihm_class !== "cycleway" &&
                f.properties.ihm_class !== "steps");
        } else if (routinType === "Bike") {
            features = features.filter(
                f => f.properties.ihm_class !== "footway" &&
                f.properties.ihm_class !== "pedestrian" &&
                f.properties.ihm_class !== "steps");
        }
        let startFeature = SpatialService.insertProjectedPointToClosestLineAndReplaceIt(latlngStart, features);
        let endFeature = SpatialService.insertProjectedPointToClosestLineAndReplaceIt(latlngEnd, features);

        let collection = {
            type: "FeatureCollection",
            features
        } as GeoJSON.FeatureCollection<GeoJSON.LineString>;
        let pathFinder = new PathFinder(collection);
        let route = pathFinder.findPath(startFeature, endFeature);
        if (!route) {
            throw new Error("[Routing] No route found... :-(");
        }

        return route.path.map(c => SpatialService.toLatLng(c));
    }

    private async updateCacheAndGetFeatures(
        tileXmin: number,
        tileXmax: number,
        tileYmin: number,
        tileYmax: number,
        zoom: number): Promise<GeoJSON.Feature<GeoJSON.LineString>[]> {
        let allCollection = [];
        for (let tileX = tileXmin; tileX <= tileXmax; tileX++) {
            for (let tileY = tileYmin; tileY <= tileYmax; tileY++) {
                let key = `${tileX}/${tileY}`;
                if (this.featuresCache.has(key)) {
                    allCollection.push(this.featuresCache.get(key));
                    continue;
                }
                let collection = {
                    type: "FeatureCollection",
                    features: []
                } as GeoJSON.FeatureCollection<GeoJSON.LineString>;
                let arrayBuffer = await this.databaseService.getTile(`custom://IHM/${zoom}/${tileX}/${tileY}.pbf`);
                let tile = new VectorTile(new Protobuf(arrayBuffer));
                for (let layerKey of Object.keys(tile.layers)) {
                    let layer = tile.layers[layerKey];
                    for (let featureIndex=0; featureIndex < layer.length; featureIndex++) {
                        let feature = layer.feature(featureIndex);
                        let isHighway = Object.keys(feature.properties).find(k => k === "ihm_class") != null;
                        if (!isHighway) {
                            continue;
                        }
                        let geojsonFeature = feature.toGeoJSON(tileX, tileY, zoom);
                        if (geojsonFeature.geometry.type !== "LineString") {
                            continue;
                        }
                        collection.features.push(geojsonFeature as GeoJSON.Feature<GeoJSON.LineString>);
                    }
                }
                collection.features = SpatialService.clipLinesToTileBoundary(collection.features, { x: tileX, y: tileY}, zoom);
                SpatialService.addMissinIntersectionPoints(collection.features);
                this.featuresCache.set(key, collection);
                allCollection.push(collection);
            }
        }

        return allCollection.map(c => c.features).flat();
    }
}
