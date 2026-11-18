import { inject, Service } from "@angular/core";
import { MapService } from "./map.service";
import { SpatialHelper } from "./spatial.helper";
import type { LatLngAltTime } from "../models";

/**
 * A position found in the gps log, either reported live by the plugin or judged by the recording.
 */
type LoggedPosition = LatLngAltTime & {
    accuracy?: number;
    /**
     * Whether the app was in the background - a position the recording judged without the plugin reporting it
     * live was taken while the app was suspended.
     */
    background: boolean;
    /**
     * Whether the recording kept the position.
     */
    recorded: boolean;
};

@Service()
export class LogReaderService {

    private static readonly FOREGROUND_COLOR = "#00FF00";
    private static readonly BACKGROUND_COLOR = "#0000FF";
    private static readonly NOT_RECORDED_COLOR = "#FF0000";

    private readonly mapService = inject(MapService);

    /**
     * Draws the last recording of a gps log file on the map - the recorded line, and the positions colored by
     * whether they were taken in the foreground, in the background, or were not part of the recording.
     * Returns false when there is nothing to draw.
     */
    public readLogFile(content: string): boolean {
        const positions = this.getLastRecordingPositions(content);
        const pointsGeojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: []
        };
        const accuracyGeojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: []
        };
        for (const position of positions) {
            pointsGeojson.features.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [position.lng, position.lat]
                },
                properties: {
                    label: (position.accuracy != null ? `acc: ${position.accuracy}m\n` : "") + position.timestamp.split("T")[1].replace("Z", ""),
                    color: this.getColor(position)
                }
            });
            if (position.accuracy != null) {
                accuracyGeojson.features.push(SpatialHelper.getCirclePolygonFeature(position, position.accuracy));
            }
        }
        const validCoordinates = positions.filter(p => p.recorded).map(p => [p.lng, p.lat]);

        if (pointsGeojson.features.length === 0) {
            return false;
        }

        this.mapService.addSource("log-points-geojson", {
            type: "geojson",
            data: pointsGeojson
        });

        this.mapService.addSource("log-accuracy-geojson", {
            type: "geojson",
            data: accuracyGeojson
        });

        this.mapService.addSource("log-record-line-geojson", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: validCoordinates
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
                "text-font": ["Noto Sans Regular"],
                "text-size": 14,
                "text-offset": [0, 1.5],
                "text-anchor": "top"
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
        this.mapService.fitBounds(SpatialHelper.getBoundsForFeatureCollection(pointsGeojson));
        return true;
    }

    private getColor(position: LoggedPosition): string {
        if (!position.recorded) {
            return LogReaderService.NOT_RECORDED_COLOR;
        }
        return position.background ? LogReaderService.BACKGROUND_COLOR : LogReaderService.FOREGROUND_COLOR;
    }

    /**
     * The positions between the last start and stop of a recording, oldest first, merged by their timestamp
     * from the live plugin reports and the recording's judgement of them.
     */
    private getLastRecordingPositions(content: string): LoggedPosition[] {
        const positions = new Map<string, LoggedPosition>();
        for (const line of this.getLastRecordingLines(content)) {
            if (line.includes("[GeoLocation] Received position")) {
                const position = this.getReceivedPosition(line);
                if (!positions.has(position.timestamp)) {
                    positions.set(position.timestamp, position);
                }
                continue;
            }
            const judged = this.getJudgedPosition(line);
            if (judged == null) {
                continue;
            }
            const position = positions.get(judged.timestamp) ?? { ...judged, background: true, recorded: false };
            position.accuracy ??= judged.accuracy;
            position.recorded ||= !line.includes("[Record] Rejecting position");
            positions.set(position.timestamp, position);
        }
        return [...positions.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    /**
     * The lines between the last start and stop of a recording, oldest first - the file is written newest first.
     */
    private getLastRecordingLines(content: string): string[] {
        const lines = content.split("\n");
        const stopIndex = lines.findIndex(l => l.includes("[Record] Stop recording"));
        if (stopIndex === -1) {
            return [];
        }
        const startIndex = lines.findIndex((l, index) => index > stopIndex && l.includes("[Record] Starting recording"));
        return lines.slice(stopIndex + 1, startIndex === -1 ? lines.length : startIndex).reverse();
    }

    private getReceivedPosition(line: string): LoggedPosition {
        return {
            lat: parseFloat(line.split("lat: ")[1]),
            lng: parseFloat(line.split("lng: ")[1]),
            timestamp: line.split("time: ")[1].split(",")[0],
            accuracy: parseFloat(line.split("accuracy: ")[1]),
            background: line.split("background: ")[1].trim() === "true",
            recorded: false
        };
    }

    /**
     * The position at the end of a `[Record]` line, as RecordedRouteService writes it.
     */
    private getJudgedPosition(line: string): LatLngAltTime & { accuracy?: number } {
        const jsonStart = line.indexOf("{");
        if (!line.includes("[Record]") || jsonStart === -1) {
            return null;
        }
        return JSON.parse(line.substring(jsonStart, line.lastIndexOf("}") + 1));
    }
}
