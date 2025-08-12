import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { VectorTile } from "@mapbox/vector-tile";
import { Store } from "@ngxs/store";
import PathFinder from "geojson-path-finder";
import Protobuf from "pbf";
import polyline from "@mapbox/polyline";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { PmTilesService } from "./pmtiles.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt, RoutingType } from "../models";

@Injectable()
export class RoutingProvider {
    private featuresCache = new Map<string, GeoJSON.FeatureCollection<GeoJSON.LineString>>();

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly pmTilesService = inject(PmTilesService);
    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {

        if (routinType !== "None" && (!SpatialService.isInIsrael(latlngStart) || !SpatialService.isInIsrael(latlngEnd))) {
            return this.getRouteOutsideIsrael(latlngStart, latlngEnd, routinType);
        }
        const address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            const geojson = await firstValueFrom(this.httpClient.get(address).pipe(timeout(4500)));
            const data = geojson as GeoJSON.FeatureCollection<GeoJSON.LineString>;
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            try {
                return await this.getOffineRoute(latlngStart, latlngEnd, routinType);
            } catch (ex2) {
                this.loggingService.error(`[Routing] failed: ${(ex as Error).message}, ${(ex2 as Error).message}`);
                const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
                this.toastService.warning(offlineState.isOfflineAvailable || !this.runningContextService.isCapacitor
                    ? this.resources.routingFailedTryShorterRoute
                    : this.resources.routingFailedBuySubscription
                );
                return [latlngStart, latlngEnd];
            }
        }
    }

    private async getRouteOutsideIsrael(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        const json = {
            directions_options: {
                directions_type: "none"
            },
            locations:[
                {
                    lon: latlngStart.lng,
                    lat: latlngStart.lat,
                    type: "break"
                },
                {
                    lon: latlngEnd.lng,
                    lat: latlngEnd.lat,
                    type: "break"
                }
            ],
        } as any;
        switch (routinType) {
            case "Hike":
                json.costing = "pedestrian";
                json.costing_options = {
                    pedestrian: {
                        "use_ferry": 1,
                        "use_living_streets": 0.5,
                        "use_tracks": 0,
                        "service_penalty": 15,
                        "service_factor": 1,
                        "shortest": true,
                        "use_hills": 0.5,
                        "walking_speed": 5.1,
                        "walkway_factor": 1,
                        "sidewalk_factor": 1,
                        "alley_factor": 2,
                        "driveway_factor": 5,
                        "step_penalty": 0,
                        "max_hiking_difficulty": 6,
                        "use_lit": 0,
                        "transit_start_end_max_distance": 2145,
                        "transit_transfer_max_distance": 800
                    }
                };
                break;
            case "Bike":
                json.costing = "bicycle";
                json.costing_options = {
                    bicycle: {
                        "maneuver_penalty": 5,
                        "country_crossing_cost": 600,
                        "use_ferry": 1,
                        "shortest": true,
                        "bicycle_type": "Hybrid",
                        "cycling_speed": 20,
                        "use_roads": 0.5,
                        "use_hills": 0.5,
                        "avoid_bad_surfaces": 0.25,
                        "gate_penalty": 300,
                        "gate_cost": 30
                    }
                };
                break;
            case "4WD":
                json.costing = "auto"; 
                json.costing_options = {
                    auto: {
                        "maneuver_penalty": 5,
                        "country_crossing_penalty": 0,
                        "country_crossing_cost": 600,
                        "width": 1.6,
                        "height": 1.9,
                        "use_highways": 1,
                        "use_tolls": 1,
                        "use_ferry": 1,
                        "ferry_cost": 300,
                        "use_living_streets": 0.5,
                        "use_tracks": 1,
                        "private_access_penalty": 450,
                        "ignore_closures": false,
                        "closure_factor": 9,
                        "service_penalty": 15,
                        "service_factor": 1,
                        "exclude_unpaved": 0,
                        "shortest": true,
                        "exclude_cash_only_tolls": false,
                        "top_speed": 140,
                        "fixed_speed": 0,
                        "toll_booth_penalty": 0,
                        "toll_booth_cost": 15,
                        "gate_penalty": 300,
                        "gate_cost": 30,
                        "include_hov2": false,
                        "include_hov3": false,
                        "include_hot": false
                    }
                };
                break;
        }
        const response = await firstValueFrom(this.httpClient.get(`https://valhalla1.openstreetmap.de/route?json=${JSON.stringify(json)}`)) as any;
        const linestring = polyline.toGeoJSON(response.trip.legs[0].shape, 6);
        return linestring.coordinates.map((c: GeoJSON.Position) => SpatialService.toLatLng(c));
    }

    private async getOffineRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        if (routinType === "None") {
            return [latlngStart, latlngEnd];
        }
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        if (!offlineState.isOfflineAvailable || offlineState.lastModifiedDate == null) {
            throw new Error("Offline routing is only supported after downloading offline data");
        }
        const zoom = 14; // this is the max zoom for these tiles
        const tiles = [latlngStart, latlngEnd].map(latlng => SpatialService.toTile(latlng, zoom));
        let tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        let tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        if (tileXmax - tileXmin > 2 || tileYmax - tileYmin > 2) {
            throw new Error("Offline routing is only supported for adjecent tiles maximum...");
        }
        // increase the chance of getting a route by adding more tiles
        if (tileXmax === tileXmin) {
            tileXmax += 1;
        }
        if (tileYmax === tileYmin) {
            tileYmax += 1;
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
        const startFeature = SpatialService.insertProjectedPointToClosestLineAndReplaceIt(latlngStart, features);
        const endFeature = SpatialService.insertProjectedPointToClosestLineAndReplaceIt(latlngEnd, features);

        const collection = {
            type: "FeatureCollection",
            features
        } as GeoJSON.FeatureCollection<GeoJSON.LineString>;
        const pathFinder = new PathFinder(collection, {tolerance: 2e-5});
        const route = pathFinder.findPath(startFeature, endFeature);
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
        const allCollection = [];
        for (let tileX = tileXmin; tileX <= tileXmax; tileX++) {
            for (let tileY = tileYmin; tileY <= tileYmax; tileY++) {
                const key = `${tileX}/${tileY}`;
                if (this.featuresCache.has(key)) {
                    allCollection.push(this.featuresCache.get(key));
                    continue;
                }
                const collection = {
                    type: "FeatureCollection",
                    features: []
                } as GeoJSON.FeatureCollection<GeoJSON.LineString>;
                const arrayBuffer = await this.pmTilesService.getTile(`custom://IHM/${zoom}/${tileX}/${tileY}.pbf`);
                const tile = new VectorTile(new Protobuf(arrayBuffer));
                for (const layerKey of Object.keys(tile.layers)) {
                    const layer = tile.layers[layerKey];
                    for (let featureIndex=0; featureIndex < layer.length; featureIndex++) {
                        const feature = layer.feature(featureIndex);
                        const isHighway = Object.keys(feature.properties).find(k => k === "ihm_class") != null;
                        if (!isHighway) {
                            continue;
                        }
                        const geojsonFeature = feature.toGeoJSON(tileX, tileY, zoom);
                        if (geojsonFeature.geometry.type === "LineString") {
                            collection.features.push(geojsonFeature as GeoJSON.Feature<GeoJSON.LineString>);
                        } else if (geojsonFeature.geometry.type === "MultiLineString") {
                            const multiLines = geojsonFeature.geometry.coordinates.map(coordinates => ({
                                type: "Feature",
                                geometry: {
                                    type: "LineString",
                                    coordinates
                                },
                                properties: {...geojsonFeature.properties}
                            } as GeoJSON.Feature<GeoJSON.LineString>));
                            collection.features.push(...multiLines);
                        }
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
