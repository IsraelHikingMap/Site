import { Injectable } from "@angular/core";
import { minBy, maxBy, flatten, last, escape } from "lodash-es";
import { parseString, Builder } from "isomorphic-xml2js";
import { encode } from "base64-arraybuffer";
import XmlBeautify from "xml-beautify";
import { v4 as uuidv4 } from "uuid";
import type { Immutable } from "immer";

import type {
    DataContainer,
    RouteData,
    RouteSegmentData,
    LatLngAltTime,
    MarkerData,
    LinkData,
    LatLngAlt,
    RoutingType
} from "../models";

type Link = {
    $: { href: string };
    text: string;
    type: string;
}

type Wpt = {
    $: { lat: string; lon: string };
    name?: string;
    ele: string;
    time?: string;
    desc?: string;
    type?: string;
    link?: Link[];
}

type Rte = {
    name: string;
    desc: string;
    rtept: Wpt[];
}

type TrkSegExtension = {
    RoutingType: { _: string };
}

type TrkSeg = {
    trkpt: Wpt[];
    extensions?: TrkSegExtension;
}

type TrkExtension = {
    Color: { _: string };
    Opacity: { _: string };
    Weight: { _: string };
}

type Trk = {
    name: string;
    desc: string;
    trkseg: TrkSeg[];
    extensions?: TrkExtension;
}

type Bounds = {
    $: { minlat: string; minlon: string; maxlat: string; maxlon: string };
}

type Metadata = {
    bounds: Bounds;
}

type Gpx = {
    trk: Trk[];
    rte: Rte[];
    wpt: Wpt[];
    metadata: Metadata;
    $: { version: string; creator: string; xmlns: string };
}

@Injectable()
export class GpxDataContainerConverterService {
    public static getSegmentsFromLatlngs(latlngs: Immutable<LatLngAltTime[]>, routingType: RoutingType): RouteSegmentData[] {
        const segments = [];
        const firstLatlng = latlngs[0];
        segments.push({
            latlngs: [firstLatlng, firstLatlng],
            routePoint: firstLatlng,
            routingType
        });
        segments.push({
            latlngs: [...latlngs],
            routePoint: latlngs[latlngs.length - 1],
            routingType
        });
        return GpxDataContainerConverterService.splitRouteSegments(segments);
    }

    private static splitRouteSegments(segments: RouteSegmentData[]): RouteSegmentData[] {
        if (segments.length > 2) {
            return segments;
        }
        const newSegments = [];
        for (const segment of segments) {
            if (segment.latlngs.length < 3) {
                newSegments.push(segment);
                continue;
            }
            let pointsInSegment = Math.max(Math.floor(segment.latlngs.length / 10), 4);
            let latlngs = [...segment.latlngs];
            while (latlngs.length > 1) {
                if (pointsInSegment >= latlngs.length) {
                    pointsInSegment = latlngs.length - 1;
                }
                const segmentEndLatLng = latlngs[pointsInSegment];
                const start = latlngs.slice(0, pointsInSegment + 1);
                latlngs = latlngs.slice(pointsInSegment);
                const routeSegment = {
                    routePoint: segmentEndLatLng,
                    latlngs: start,
                    routingType: segments[0].routingType
                };
                newSegments.push(routeSegment);
            }
        }
        return newSegments;
    }

    public canConvert(gpxXmlString: string) {
        const subString = gpxXmlString.substring(0, 200).toLocaleLowerCase();
        return (subString.indexOf("<gpx") !== -1);
    }

    /**
     * This method converts a datacontainer to gpx base64 sting
     *
     * @param dataContainer a data container object
     * @returns a base64 encoded gpx xml string
     */
    public async toGpx(dataContainer: DataContainer): Promise<string> {
        const options = { rootName: "gpx" };

        const builder = new Builder(options);
        const gpx = {
            $: {
                version: "1.1",
                creator: "IsraelHikingMap",
                xmlns: "http://www.topografix.com/GPX/1/1",
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xsi:schemaLocation": "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
            },
            metadata: null,
            wpt: [],
            rte: [],
            trk: []
        } as Gpx;
        const containerRoutes = dataContainer.routes || [];
        const nonEmptyRoutes = containerRoutes.filter(r => r.segments.find(s => s.latlngs.length > 0) != null);
        for (const route of containerRoutes) {
            gpx.wpt = gpx.wpt.concat(route.markers.map(m => {
                const wpt = {
                    $: {
                        lat: m.latlng.lat.toString(),
                        lon: m.latlng.lng.toString()
                    },
                    name: escape(m.title),
                    desc: escape(m.description),
                    type: m.type,
                    link: m.urls.map(u => ({
                        $: {
                            href: u.url
                        },
                        text: escape(u.text),
                        type: u.mimeType
                    } as Link))
                } as Wpt;
                if (m.latlng.alt && !isNaN(m.latlng.alt)) {
                    wpt.ele = m.latlng.alt.toString();
                }
                return wpt;
            }));
        }
        for (const route of nonEmptyRoutes) {
            gpx.trk.push({
                name: escape(route.name),
                desc: escape(route.description),
                extensions: {
                    Color: {
                        $: {
                            xmlns: ""
                        },
                        _: route.color.toString()
                    },
                    Opacity: {
                        $: {
                            xmlns: ""
                        },
                        _: route.opacity.toString()
                    },
                    Weight: {
                        $: {
                            xmlns: ""
                        },
                        _: route.weight.toString()
                    }
                },
                trkseg: route.segments.map(s => ({
                    trkpt: s.latlngs.map(l => {
                        const wpt = {
                            $: {
                                lat: l.lat.toString(),
                                lon: l.lng.toString()
                            }
                        } as Wpt;
                        if (l.alt && !isNaN(l.alt)) {
                            wpt.ele = l.alt.toString();
                        }
                        if (l.timestamp) {
                            wpt.time = new Date(l.timestamp).toISOString().split(".").shift() + "Z"; // remove milliseconds
                        }

                        return wpt;
                    }),
                    extensions: {
                        RoutingType: {
                            $: {
                                xmlns: ""
                            },
                            _: s.routingType
                        }
                    }
                } as TrkSeg))
            } as Trk);
        }
        if (dataContainer.northEast && dataContainer.southWest) {
            gpx.metadata = {
                bounds: {
                    $: {
                        maxlat: dataContainer.northEast.lat.toString(),
                        maxlon: dataContainer.northEast.lng.toString(),
                        minlat: dataContainer.southWest.lat.toString(),
                        minlon: dataContainer.southWest.lng.toString(),
                    }
                }
            };
        }
        this.updateBoundingBox(gpx);
        let gpxString = builder.buildObject(gpx);
        gpxString = "\uFEFF" + new XmlBeautify().beautify(gpxString);
        return encode(await new Response(gpxString).arrayBuffer());
    }

    public async toDataContainer(gpxXmlString: string): Promise<DataContainer> {
        const gpxJsonObject: Gpx = await new Promise<Gpx>((resolve, reject) => {
            // removing namespace since they can be invalid
            gpxXmlString = gpxXmlString.replace(/xmlns="(.*?)"/g, "");
            parseString(gpxXmlString, { explicitArray: false, }, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res.gpx);
            });
        });
        this.convertToArrays(gpxJsonObject);
        this.updateBoundingBox(gpxJsonObject);
        const dataContainer = {
            overlays: [],
            baseLayer: null,
            routes: this.convertRoutesToRoutesData(gpxJsonObject.rte)
        } as DataContainer;
        dataContainer.routes = dataContainer.routes.concat(this.convertTracksToRouteData(gpxJsonObject.trk));
        const markers = gpxJsonObject.wpt.map(p => ({
            id: uuidv4(),
            description: typeof p.desc === "string" ? p.desc : JSON.stringify(p.desc),
            latlng: { lat: +p.$.lat, lng: +p.$.lon, alt: +p.ele },
            title: p.name,
            type: p.type || "",
            urls: p.link.map(l => ({ mimeType: l.type || "text/html", text: l.text, url: l.$.href } as LinkData))
        } as MarkerData));
        if (markers.length > 0) {
            if (dataContainer.routes.length === 0) {
                const name = (markers.length === 1 ? markers[0].title : "Markers") || "Markers";
                dataContainer.routes.push({ name, description: markers[0].description, segments: [] } as RouteData);
            }
            dataContainer.routes[0].markers = markers;
        }

        dataContainer.northEast = { lat: +gpxJsonObject.metadata.bounds.$.maxlat, lng: +gpxJsonObject.metadata.bounds.$.maxlon };
        dataContainer.southWest = { lat: +gpxJsonObject.metadata.bounds.$.minlat, lng: +gpxJsonObject.metadata.bounds.$.minlon };

        if (gpxJsonObject.$?.creator === "IsraelHikingMap") {
            return dataContainer;
        }
        for (const route of dataContainer.routes) {
            if (route.segments.length === 0 || route.segments[0].latlngs.length === 0) {
                continue;
            }
            const firstLatlng = route.segments[0].latlngs[0];
            route.segments.splice(0, 0, {
                latlngs: [firstLatlng, firstLatlng],
                routePoint: firstLatlng as LatLngAlt,
                routingType: "Hike"
            } as RouteSegmentData);
            route.segments = GpxDataContainerConverterService.splitRouteSegments(route.segments);
        }

        return dataContainer;
    }

    private convertToArrays(gpx: Gpx) {
        if (!gpx.rte) {
            gpx.rte = [];
        }
        if (!Array.isArray(gpx.rte)) {
            gpx.rte = [gpx.rte];
        }
        for (const rte of gpx.rte) {
            if (rte.rtept && !Array.isArray(rte.rtept)) {
                rte.rtept = [rte.rtept];
            }
        }
        if (!gpx.wpt) {
            gpx.wpt = [];
        }
        if (!Array.isArray(gpx.wpt)) {
            gpx.wpt = [gpx.wpt];
        }
        for (const wpt of gpx.wpt) {
            if (!wpt.link) {
                wpt.link = [];
            }
            if (!Array.isArray(wpt.link)) {
                wpt.link = [wpt.link];
            }
        }
        if (!gpx.trk) {
            gpx.trk = [];
        }
        if (!Array.isArray(gpx.trk)) {
            gpx.trk = [gpx.trk];
        }
        for (const trk of gpx.trk) {
            if (trk.trkseg && !Array.isArray(trk.trkseg)) {
                trk.trkseg = [trk.trkseg];
            }
        }
    }

    private updateBoundingBox(gpx: Gpx): void {
        if (gpx.metadata != null && gpx.metadata.bounds != null &&
            +gpx.metadata.bounds.$.minlat !== 0.0 &&
            +gpx.metadata.bounds.$.maxlat !== 0.0 &&
            +gpx.metadata.bounds.$.minlon !== 0.0 &&
            +gpx.metadata.bounds.$.maxlon !== 0.0) {
            return;
        }
        let points = flatten((gpx.rte || []).filter(r => r.rtept != null).map(r => r.rtept));
        points = points.concat(gpx.wpt || []);
        points = points.concat(
            flatten(flatten((gpx.trk || []).filter(t => t != null && t.trkseg != null).map(t => t.trkseg)).map(s => s.trkpt))
        );
        if (points.length === 0) {
            return;
        }
        if (gpx.metadata == null || gpx.metadata.bounds == null) {
            gpx.metadata = {
                bounds: {} as Bounds
            };
        }
        gpx.metadata.bounds = {
            $: {
                maxlat: maxBy(points, p => + p.$.lat).$.lat.toString(),
                maxlon: maxBy(points, p => +p.$.lon).$.lon.toString(),
                minlat: minBy(points, p => +p.$.lat).$.lat.toString(),
                minlon: minBy(points, p => +p.$.lon).$.lon.toString()
            }
        };
    }

    private convertRoutesToRoutesData(routes: Rte[]): RouteData[] {
        return routes.filter(r => r.rtept != null && r.rtept.length > 0).map(r => ({
            name: r.name,
            description: r.desc,
            segments: [{
                latlngs: r.rtept.map(p => ({ lat: +p.$.lat, lng: +p.$.lon, alt: +p.ele })),
                routePoint: last(r.rtept.map(p => ({ lat: +p.$.lat, lng: +p.$.lon, alt: +p.ele })))
            }],
            markers: []
        } as RouteData));
    }

    private convertTracksToRouteData(trks: Trk[]): RouteData[] {
        return trks.filter(t => t.trkseg != null && t.trkseg.length > 0).map(t => {
            const extensions = this.convertExtensionAfterXmlnsRemoval(t.extensions, {
                Color: { _: null },
                Opacity: { _: null },
                Weight: { _: null }
            });
            return {
                name: t.name,
                description: typeof t.desc === "string" ? t.desc : JSON.stringify(t.desc),
                color: extensions.Color._,
                opacity: +extensions.Opacity._,
                weight: +extensions.Weight._,
                segments: t.trkseg.filter(s => s != null && s.trkpt != null && s.trkpt.length > 1).map(s => ({
                    latlngs: s.trkpt.map(p => ({
                        alt: +p.ele,
                        lat: +p.$.lat,
                        lng: +p.$.lon,
                        timestamp: p.time ? new Date(p.time) : undefined
                    } as LatLngAltTime)),
                    routingType: this.convertExtensionAfterXmlnsRemoval(s.extensions, { RoutingType: { _: "Hike" } }).RoutingType._,
                    routePoint: last(s.trkpt.map(p => ({
                        alt: +p.ele,
                        lat: +p.$.lat,
                        lng: +p.$.lon,
                        timestamp: p.time ? new Date(p.time) : undefined
                    } as LatLngAltTime)))
                } as RouteSegmentData)),
                markers: []
            } as RouteData;
        });
    }

    private convertExtensionAfterXmlnsRemoval<T>(extensions: any, defaultValue: T): T {
        extensions = Object.assign(defaultValue, extensions);
        for (const key in extensions) {
            if (typeof extensions[key] === "string") {
                extensions[key] = { _: extensions[key] };
            }
        }
        return extensions;
    }
}
