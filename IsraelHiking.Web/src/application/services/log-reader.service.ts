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
        for (let line of lines) {
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
        for (const line of recordingRelatedLines) {
            if (line.includes("[GeoLocation] Received position")) {
                let timeString = line.split('time: ')[1].split(',')[0];
                let foreground = line.split('background: ')[1] === "false";
                pointsGeojson.features.push({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [
                            parseFloat(line.split("lng: ")[1].split(",")[0]),
                            parseFloat(line.split("lat: ")[1].split(",")[0])
                        ]
                    },
                    properties: {
                        time: new Date(timeString).toISOString(),
                        displayTime: (foreground ? "fg " : "bg ") + timeString.split("T")[1],
                        foreground,
                        accuracy: parseFloat(line.split("accuracy: ")[1].split(",")[0])
                    }
                });
                continue;
            }
            if (line.includes("[Record] Valid position")) {
                const time = new Date(line.split('timestamp":"')[1].split('"')[0]).toISOString();
                if (pointsGeojson.features.length !== 0 && pointsGeojson.features[pointsGeojson.features.length - 1].properties.time === time) {
                    pointsGeojson.features[pointsGeojson.features.length - 1].properties.valid = true;
                }
                continue;
            }
            if (line.includes("[Record] Rejecting position")) {
                const time = new Date(line.split('timestamp":"')[1].split('"')[0]).toISOString();
                const feature = pointsGeojson.features.find(f => f.properties.time === time);
                if (feature) {
                    feature.properties.valid = false;
                }
                continue;
            }
        }

        this.mapService.map.addSource("log-points-geojson", {
            type: "geojson",
            data: pointsGeojson,
        });

        this.mapService.map.addSource("log-record-line-geojson", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: recordingRelatedLines.filter(l => l.includes("[Record] Valid position")).map(line => {
                            return [
                                parseFloat(line.split('lng":')[1].split(",")[0]),
                                parseFloat(line.split('lat":')[1].split(",")[0])
                            ]
                        }),
                    },
                    properties: {}
                }]
            }
        });

        this.mapService.map.addLayer({
            id: "log-points-geojson-layer",
            type: "circle",
            source: "log-points-geojson",
            paint: {
                "circle-radius": 3,
                "circle-color": [
                    "case",
                    ["==", ["get", "valid"], true],
                    "#00FF00",
                    "#FF0000"
                ],
                "circle-opacity": 0.8
            }
        });
        this.mapService.map.addLayer({
            id: "log-points-geojson-labels",
            type: "symbol",
            source: "log-points-geojson",
            layout: {
                "text-field": ["get", "displayTime"],
                "text-font": ["Open Sans Regular"],
                "text-size": 12,
                "text-offset": [0, 1.5],
                "text-anchor": "top",
            },
            paint: {
                "text-color": "#000000",
                "text-opacity": 0.8
            }
        });
        this.mapService.map.addLayer({
            id: "log-record-line-geojson-layer",
            type: "line",
            source: "log-record-line-geojson",
            paint: {
                "line-color": "#0000FF",
                "line-width": 2,
                "line-opacity": 0.8
            }
        });
        this.mapService.map.fitBounds(SpatialService.boundsToMBBounds(SpatialService.getBoundsForFeatureCollection(pointsGeojson)));
    }
}