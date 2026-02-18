import { inject, Injectable } from "@angular/core";
import { MapService } from "./map.service";
import { SpatialService } from "./spatial.service";

@Injectable()
export class LogReaderService {

    private readonly mapService = inject(MapService);

    public readLogFile(content: string): void {
        const lines = content.split("\n");
        const recordingRelatedLines: string[] = [];
        let foundEndOfRecording = false;
        for (const line of lines) {
            if (!line.includes("[Record] Stop recording") && !foundEndOfRecording) {
                continue;
            }
            if (line.includes("[Record] Stop recording")) {
                foundEndOfRecording = true;
                continue;
            }
            if (line.includes("[Record] Starting recording")) {
                break;
            }
            if (line.includes("[Record]") || line.includes("[GeoLocation]")) {
                recordingRelatedLines.push(line);
            }
        }
        recordingRelatedLines.reverse();
        const pointsGeojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: []
        };
        const accuracyGeojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: []
        };
        for (const line of recordingRelatedLines) {
            if (line.includes("[GeoLocation] Received position")) {
                const timeString = line.split("time: ")[1].split(",")[0];
                const foreground = line.split("background: ")[1] === "false";
                const accuracy = parseFloat(line.split("accuracy: ")[1].split(",")[0]);
                const lat = parseFloat(line.split("lat: ")[1].split(",")[0]);
                const lng = parseFloat(line.split("lng: ")[1].split(",")[0]);
                pointsGeojson.features.push({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    properties: {
                        time: new Date(timeString).toISOString(),
                        label: (foreground ? "fg " : "bg ") + "acc: " + accuracy + "m\n" + timeString.split("T")[1].replace("Z", ""),
                        foreground,
                        accuracy,
                        color: foreground ? "#00FF00" : "#0000FF",
                    }
                });
                accuracyGeojson.features.push(SpatialService.getCirclePolygonFeature({ lng, lat }, accuracy));
                continue;
            }
            if (line.includes("[Record] Rejecting position")) {
                const time = new Date(line.split("timestamp\":\"")[1].split("\"")[0]).toISOString();
                const feature = pointsGeojson.features.find(f => f.properties.time === time);
                if (feature) {
                    feature.properties.color = "#FF0000";
                }
                continue;
            }
        }

        this.mapService.addSource("log-points-geojson", {
            type: "geojson",
            data: pointsGeojson,
        });

        this.mapService.addSource("log-accuracy-geojson", {
            type: "geojson",
            data: accuracyGeojson,
        });

        this.mapService.addSource("log-record-line-geojson", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: recordingRelatedLines.filter(l => l.includes("[Record] Valid position")).map(line => {
                            return [
                                parseFloat(line.split("lng\":")[1].split(",")[0]),
                                parseFloat(line.split("lat\":")[1].split(",")[0])
                            ]
                        }),
                    },
                    properties: {}
                }]
            }
        });

        this.mapService.addLayer({
            id: "log-accuracy-geojson-layer",
            type: "fill",
            source: "log-accuracy-geojson",
            paint: {
                "fill-color": "#0000FF",
                "fill-opacity": 0.2
            }
        });

        this.mapService.addLayer({
            id: "log-points-geojson-layer",
            type: "circle",
            source: "log-points-geojson",
            paint: {
                "circle-radius": 5,
                "circle-color": ["get", "color"],
                "circle-opacity": 0.8,
                "circle-stroke-width": 2,
                "circle-stroke-color": "white"
            }
        });
        this.mapService.addLayer({
            id: "log-points-geojson-labels",
            type: "symbol",
            source: "log-points-geojson",
            layout: {
                "text-field": ["get", "label"],
                "text-font": ["Open Sans Regular"],
                "text-size": 14,
                "text-offset": [0, 1.5],
                "text-anchor": "top",
            },
            paint: {
                "text-color": "#000000",
                "text-opacity": 0.8
            }
        });
        this.mapService.addLayer({
            id: "log-record-line-geojson-layer",
            type: "line",
            source: "log-record-line-geojson",
            paint: {
                "line-color": "#0000FF",
                "line-width": 2,
                "line-opacity": 0.8
            }
        });
        this.mapService.fitBounds(SpatialService.getBoundsForFeatureCollection(pointsGeojson));
    }
}