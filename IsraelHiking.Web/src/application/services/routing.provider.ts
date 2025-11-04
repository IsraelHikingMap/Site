import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { VectorTile } from "@mapbox/vector-tile";
import { Store } from "@ngxs/store";
import PathFinder from "geojson-path-finder";
import Protobuf from "pbf";
import QuickLRU from "quick-lru";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { PmTilesService } from "./pmtiles.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt, RoutingType } from "../models";

@Injectable()
export class RoutingProvider {
    private static readonly MAX_ROUTING_ZOOM = 14;
    private static readonly ROUTING_SCHEMA = "IHM-schema";
    private static readonly ROUTING_CLASS_PROPERTY_NAME = "ihm_class";

    private featuresCache = new QuickLRU<string, GeoJSON.FeatureCollection<GeoJSON.LineString>>({ maxSize: 100 });

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly pmTilesService = inject(PmTilesService);
    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly elevationProvider = inject(ElevationProvider);
    private readonly store = inject(Store);

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        if (routinType === "None") {
            const distance = SpatialService.getDistanceInMeters(latlngStart, latlngEnd);
            const pointsCount = Math.min(100, Math.ceil(distance / 100));
            const latlngs = [];
            for (let i = 0; i <= pointsCount; i++) {
                const lat = latlngStart.lat + (latlngEnd.lat - latlngStart.lat) * (i / pointsCount);
                const lng = latlngStart.lng + (latlngEnd.lng - latlngStart.lng) * (i / pointsCount);
                latlngs.push({ lat, lng });
            }
            await this.elevationProvider.updateHeights(latlngs);
            return latlngs;
        }
        const address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            const data = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection<GeoJSON.LineString>>(address).pipe(timeout(4500)));
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            try {
                return await this.getOffineRoute(latlngStart, latlngEnd, routinType);
            } catch (ex2) {
                this.loggingService.error(`[Routing] failed: ${(ex as Error).message}, ${(ex2 as Error).message}`);
                const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
                this.toastService.warning(offlineState.isSubscribed || !this.runningContextService.isCapacitor
                    ? this.resources.routingFailedTryShorterRoute
                    : this.resources.routingFailedBuySubscription
                );
                const lngLat = [latlngStart, latlngEnd];
                this.elevationProvider.updateHeights(lngLat);
                return lngLat;
            }
        }
    }

    private async getOffineRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        const zoom = RoutingProvider.MAX_ROUTING_ZOOM; // this is the max zoom for these tiles
        const tiles = [latlngStart, latlngEnd].map(latlng => SpatialService.toTile(latlng, zoom));
        let tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        let tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        if (tileXmax - tileXmin > 2 || tileYmax - tileYmin > 2) {
            throw new Error("Offline routing is only supported for adjecent tiles maximum...");
        }
        for (const tile of tiles) {
            if (!await this.pmTilesService.isOfflineFileAvailable(zoom, tile.x, tile.y, RoutingProvider.ROUTING_SCHEMA)) {
                throw new Error("Unable to find offline route, some tiles are missing");
            }
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

        const lngLat = route.path.map(c => SpatialService.toLatLng(c));
        await this.elevationProvider.updateHeights(lngLat);
        return lngLat;
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
                const arrayBuffer = await this.pmTilesService.getTileByType(zoom, tileX, tileY, RoutingProvider.ROUTING_SCHEMA);
                const tile = new VectorTile(new Protobuf(arrayBuffer));
                for (const layerKey of Object.keys(tile.layers)) {
                    const layer = tile.layers[layerKey];
                    for (let featureIndex=0; featureIndex < layer.length; featureIndex++) {
                        const feature = layer.feature(featureIndex);
                        const isHighway = Object.keys(feature.properties).find(k => k === RoutingProvider.ROUTING_CLASS_PROPERTY_NAME) != null;
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
