import { Injectable } from "@angular/core";
import { minBy, maxBy, flatten, last } from "lodash";
import { parseString, Builder } from "isomorphic-xml2js";
import { encode } from "base64-arraybuffer";

import { DataContainer, RouteData, RouteSegmentData, ILatLngTime, MarkerData, LinkData } from "../models/models";

interface Link {
    $: { href: string; };
    text: string;
    type: string;
}

interface Wpt {
    $: { lat: string; lon: string; };
    name?: string;
    ele: string;
    time?: string;
    desc?: string;
    type?: string;
    link?: Link[];
}

interface Rte {
   name: string;
   desc: string;
   rtept: Wpt[];
}

interface TrkSegExtension {
    RoutingType: { _: string };
}

interface TrkSeg {
   trkpt: Wpt[];
   extensions?: TrkSegExtension;
}

interface TrkExtension {
    Color: { _: string };
    Opacity: { _: string };
    Weight: { _: string };
}

interface Trk {
   name: string;
   desc: string;
   trkseg: TrkSeg[];
   extensions?: TrkExtension;
}

interface Bounds {
    $: { minlat: string; minlon: string; maxlat: string; maxlon: string; };
}

interface Metadata {
   bounds: Bounds;
}

interface Gpx {
   trk: Trk[];
   rte: Rte[];
   wpt: Wpt[];
    metadata: Metadata;
    $: { version: string, creator: string; xmlns: string; };
}

@Injectable()
export class GpxDataContainerConverterService {
    public canConvert(gpxXmlString: string) {
        let subString = gpxXmlString.substr(0, 400).toLocaleLowerCase();
        return (subString.indexOf("<gpx") !== -1 && subString.indexOf("http://www.topografix.com/GPX/1/1") !== -1);
    }

    public async toGpx(dataContainer: DataContainer): Promise<string> {
        let options = { rootName: "gpx" };

        let builder = new Builder(options);
        let gpx = {
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
        let containerRoutes = dataContainer.routes || [];
        let nonEmptyRoutes = containerRoutes.filter(r => r.segments.find(s => s.latlngs.length > 0) != null);
        for (let route of containerRoutes) {
            gpx.wpt.concat(route.markers.map(m => {
                return {
                    $: {
                        lat: m.latlng.lat.toString(),
                        lon: m.latlng.lng.toString()
                    },
                    ele: m.latlng.alt.toString(),
                    desc: m.description,
                    name: m.title,
                    type: m.type,
                    link: m.urls.map(u => {
                        return {
                            $: {
                                href: u.url
                            },
                            text: u.text,
                            type: u.mimeType
                        } as Link;
                    })
                } as Wpt;
            }));
        }
        for (let route of nonEmptyRoutes) {
            gpx.trk.push({
                desc: route.description,
                name: route.name,
                extensions: {
                    Color: {
                        _: route.color.toString()
                    },
                    Opacity: {
                        _: route.opacity.toString()
                    },
                    Weight: {
                        _: route.weight.toString()
                    }
                },
                trkseg: route.segments.map(s => {
                    return {
                        trkpt: s.latlngs.map(l => {
                            return {
                                $: {
                                    lat: l.lat.toString(),
                                    lon: l.lng.toString()
                                },
                                ele: l.alt.toString(),
                                time: l.timestamp ? l.timestamp.toISOString() : null
                            } as Wpt;
                        }),
                        extensions: {
                            RoutingType: {
                                _: s.routingType
                            }
                        }
                    } as TrkSeg;
                })
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
        return encode(await new Response(builder.buildObject(gpx)).arrayBuffer());
    }

    public async toDataContainer(gpxXmlString: string): Promise<DataContainer> {
        // HM TODO: split route in case this is not an IHM file?
        let gpxJsonObject: Gpx = await new Promise<Gpx>((resolve, reject) => {
            parseString(gpxXmlString, { explicitArray: false }, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res.gpx);
            });
        });
        this.convertToArrays(gpxJsonObject);
        this.updateBoundingBox(gpxJsonObject);
        let dataContainer = {
            overlays: [],
            baseLayer: null,
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0 },
            routes: this.convertRoutesToRoutesData(gpxJsonObject.rte)
        } as DataContainer;
        dataContainer.routes = dataContainer.routes.concat(this.convertTracksToRouteData(gpxJsonObject.trk));
        let markers = gpxJsonObject.wpt.map(p => ({
            description: p.desc,
            latlng: { lat: +p.$.lat, lng: +p.$.lon, alt: +p.ele },
            title: p.name,
            type: p.type || "",
            urls: p.link.map(l => ({ mimeType: l.type, text: l.text, url: l.$.href } as LinkData))
        } as MarkerData));
        if (markers.length > 0) {
            if (dataContainer.routes.length === 0) {
                let name = (markers.length === 1 ? markers[0].title : "Markers") || "Markers";
                dataContainer.routes.push({ name, description: markers[0].description } as RouteData);
            }
            dataContainer.routes[0].markers = markers;
        }

        dataContainer.northEast = { lat: +gpxJsonObject.metadata.bounds.$.maxlat, lng: +gpxJsonObject.metadata.bounds.$.maxlon };
        dataContainer.southWest = { lat: +gpxJsonObject.metadata.bounds.$.minlat, lng: +gpxJsonObject.metadata.bounds.$.minlon };

        return dataContainer;
    }

    private convertToArrays(gpx: Gpx) {
        if (!gpx.rte) {
            gpx.rte = [];
        }
        if (!Array.isArray(gpx.rte)) {
            gpx.rte = [gpx.rte];
        }
        for (let rte of gpx.rte) {
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
        for (let wpt of gpx.wpt) {
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
        for (let trk of gpx.trk) {
            if (trk.trkseg && !Array.isArray(trk.trkseg)) {
                trk.trkseg = [trk.trkseg];
            }
        }
    }

    private updateBoundingBox(gpx: Gpx) {
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
            return gpx;
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
            }]
        } as RouteData));
    }

    private convertTracksToRouteData(trks: Trk[]): RouteData[] {
        return trks.filter(t => t.trkseg != null && t.trkseg.length > 0).map(t => ({
            name: t.name,
            description: t.desc,
            color: (t.extensions || { Color: { _: null } }).Color._,
            opacity: +(t.extensions || { Opacity: { _: null } }).Opacity._,
            weight: +(t.extensions || { Weight: { _: null } }).Weight._,
            segments: t.trkseg.filter(s => s != null && s.trkpt != null && s.trkpt.length > 1).map(s => ({
                latlngs: s.trkpt.map(p => ({ alt: +p.ele, lat: +p.$.lat, lng: +p.$.lon, timestamp: new Date(p.time) } as ILatLngTime)),
                routingType: (s.extensions || { RoutingType: { _: "Hike" } }).RoutingType._,
                routePoint: last(s.trkpt.map(p => ({
                    alt: +p.ele,
                    lat: +p.$.lat,
                    lng: +p.$.lon,
                    timestamp: new Date(p.time)
                } as ILatLngTime)))
            } as RouteSegmentData))
        } as RouteData));
    }
 }
