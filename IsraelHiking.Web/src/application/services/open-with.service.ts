import { inject, NgZone, Service } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { App } from "@capacitor/app";
import { CapacitorHttp } from "@capacitor/core";
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { CoordinatesService } from "./coordinates.service";
import { getIdFromLatLng, RouteStrings } from "./hash.service";
import { SpatialService } from "./spatial.service";
import type { LatLngAltTime } from "../models";

/** Hosts used by Google Maps short links, which need to be resolved before coordinates can be read */
const GOOGLE_SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co"];
/**
 * `maps.apple` is the host of Apple's short share links, which hold no coordinates and cannot be
 * resolved into any - their redirect chain ends at `maps.apple.com/unsupported`. They are listed so
 * that they fail with a message rather than being downloaded as a route file. On iOS the share
 * extension sidesteps them entirely by reading the structured map item Apple Maps attaches.
 */
const APPLE_MAPS_HOSTS = ["maps.apple.com", "maps.apple"];
const MAP_SERVICE_HOSTS = ["www.google.com", "google.com", "maps.google.com",
    ...GOOGLE_SHORT_LINK_HOSTS, ...APPLE_MAPS_HOSTS];

const NUMBER = "(-?\\d+(?:\\.\\d+)?)";
/** The place itself, as encoded in the `data=` protobuf of a resolved Google Maps place link */
const PLACE_COORDINATES = new RegExp(`!3d${NUMBER}!4d${NUMBER}`);
/**
 * Parameters that carry an explicit "this is the point" coordinate: `q`, `query`, `daddr` and
 * `destination` from Google, `ll`, `sll`, `near` and `coordinate` from Apple. The ones that may also
 * hold a place name simply do not match unless the value looks like a coordinate pair.
 */
const QUERY_COORDINATES =
    new RegExp(`[?&](?:query|q|daddr|destination|coordinate|sll|ll|near)=${NUMBER},${NUMBER}`);
/** The map viewport centre - only a rough hint, so it is used as a last resort */
const VIEWPORT_COORDINATES = new RegExp(`/@${NUMBER},${NUMBER}`);
/**
 * The first half of a Google feature id is the S2 cell the place sits in, at level 30 - accurate to
 * centimetres. It is the only location some place links carry, see
 * {@link OpenWithService.parseFeatureIdCoordinates}. It appears either as `!1s` inside the `data`
 * protobuf of a place link or as the `ftid` parameter of a search link.
 */
const FEATURE_ID_S2_CELL = /(?:!1s|[?&]ftid=)0x([0-9a-f]+):0x[0-9a-f]+/i;
const URL_IN_TEXT = /https?:\/\/\S+/;

@Service()
export class OpenWithService {
    private readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private readonly matDialog = inject(MatDialog);
    private readonly router = inject(Router);
    private readonly loggingService = inject(LoggingService);
    private readonly coordinatesService = inject(CoordinatesService);
    private readonly ngZone = inject(NgZone);

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        App.addListener("appUrlOpen", async (data) => {
            if (!data || !data.url) {
                return;
            }

            if (data.url.startsWith("mapeak://")) {
                // no need to do anything as this is part of the login flow
                return;
            }

            if (data.url.startsWith("geo")) {
                this.handleGeoUrl(data.url);
                return;
            }
            if (data.url.startsWith("http")) {
                this.handleHttpUrl(data.url);
            } else {
                this.handleFileUrl(data.url);
            }
        });
        CapacitorShareTarget.addListener("shareReceived", (event) => {
            const texts = (event.texts ?? []).filter(t => !!t);
            // iOS hands over the place name and the link as two separate items, and only the link is useful.
            // Android sends them as a single string, which the link lookup below simply finds inside.
            const text = texts.find(t => URL_IN_TEXT.test(t)) ?? texts[0];
            if (text) {
                this.handleSharedText(text);
            }
        });
    }

    /**
     * Handles text shared into the app from another app, most commonly a Google Maps location share.
     * Google shares the place name and a short link as a single blob of text, so the link is pulled
     * out of it, and anything that is not a link is given to the coordinates parser.
     */
    private async handleSharedText(text: string) {
        this.loggingService.info(`[OpenWith] Handling shared text: ${text}`);
        const href = URL_IN_TEXT.exec(text)?.[0];
        if (href != null) {
            this.handleHttpUrl(href);
            return;
        }
        const latLng = await this.coordinatesService.parseCoordinates(text.trim());
        if (latLng != null) {
            this.moveToLatLng(latLng);
            return;
        }
        this.toastService.warning(this.resources.unableToLoadFromUrl);
    }

    /**
     * Resolves a map service link to a coordinate. Google short links carry no coordinates at all, so
     * they are followed first - this needs the native http client since the browser cannot read a
     * cross-origin redirect.
     */
    private async handleMapServiceUrl(href: string) {
        let resolved = href;
        if (GOOGLE_SHORT_LINK_HOSTS.includes(new URL(href).host.toLowerCase())) {
            try {
                const response = await CapacitorHttp.get({ url: href });
                resolved = response.url || href;
                this.loggingService.info(`[OpenWith] Resolved Google short link to: ${resolved}`);
            } catch (ex) {
                this.loggingService.error(`[OpenWith] Unable to resolve Google short link ${href}: ${(ex as Error).message}`);
                this.toastService.warning(this.resources.unableToLoadFromUrl);
                return;
            }
        }
        const latLng = OpenWithService.parseMapUrlCoordinates(resolved)
            ?? await OpenWithService.parseFeatureIdCoordinates(resolved);
        if (latLng != null) {
            this.moveToLatLng(latLng);
            return;
        }
        this.loggingService.warning(`[OpenWith] Unable to extract coordinates from: ${resolved}`);
        this.toastService.warning(this.resources.unableToLoadFromUrl);
    }

    /**
     * Extracts the shared point out of a Google or Apple Maps URL. A single URL can hold several
     * coordinates - the place, the search query and the viewport centre - so they are tried in that
     * order, most specific first.
     */
    public static parseMapUrlCoordinates(href: string): LatLngAltTime | null {
        const decoded = decodeURIComponent(href);
        for (const matcher of [PLACE_COORDINATES, QUERY_COORDINATES, VIEWPORT_COORDINATES]) {
            const match = matcher.exec(decoded);
            if (match != null) {
                return SpatialService.toLatLng([+match[2], +match[1]]);
            }
        }
        return null;
    }

    /**
     * Recovers the place from the S2 cell in a Google feature id. Some shares - areas and addresses
     * rather than businesses - expand to a link holding no coordinates at all, and this is then the
     * only thing pinning the place down. It is used only as a fallback because an explicit coordinate,
     * where one exists, states the place directly rather than the cell that contains it.
     *
     * nodes2ts is only needed for these links and is a sizable dependency, so it is loaded on demand
     * instead of with the app, the same way proj4 is in the coordinates service.
     */
    public static async parseFeatureIdCoordinates(href: string): Promise<LatLngAltTime | null> {
        const cellHex = FEATURE_ID_S2_CELL.exec(href)?.[1];
        if (cellHex == null || /^0+$/.test(cellHex)) {
            return null;
        }
        try {
            const { S2CellId } = await import("nodes2ts");
            const cellId = new S2CellId(BigInt(`0x${cellHex}`));
            if (!cellId.isValid()) {
                return null;
            }
            const latLng = cellId.toLatLng();
            return SpatialService.toLatLng([latLng.lngDegrees, latLng.latDegrees]);
        } catch {
            return null;
        }
    }

    /**
     * Handles a `geo:` intent. Both `geo:lat,lng` and the `geo:0,0?q=lat,lng(Label)` form that Google
     * Maps emits are supported, the latter taking precedence since its `0,0` prefix is a placeholder.
     */
    private handleGeoUrl(href: string) {
        this.loggingService.info(`[OpenWith] Opening a geo url: ${href}`);
        const latLng = OpenWithService.parseGeoUrlCoordinates(href);
        if (latLng != null) {
            this.moveToLatLng(latLng);
            return;
        }
        this.loggingService.warning(`[OpenWith] Unable to extract coordinates from: ${href}`);
        this.toastService.warning(this.resources.unableToLoadFromUrl);
    }

    public static parseGeoUrlCoordinates(href: string): LatLngAltTime | null {
        const decoded = decodeURIComponent(href);
        const queryMatch = QUERY_COORDINATES.exec(decoded);
        if (queryMatch != null) {
            return SpatialService.toLatLng([+queryMatch[2], +queryMatch[1]]);
        }
        const match = new RegExp(`^geo:${NUMBER},${NUMBER}`).exec(decoded);
        // `geo:0,0?q=<address>` is a placeholder for a query the app cannot resolve, not a point in the ocean
        if (match == null || (+match[1] === 0 && +match[2] === 0)) {
            return null;
        }
        return SpatialService.toLatLng([+match[2], +match[1]]);
    }

    private handleMapeakUrl(url: URL) {
        this.logAndCloseDialogs(url);
        const pathname = url.pathname;
        if (pathname.startsWith(RouteStrings.ROUTE_SHARE)) {
            const shareId = pathname.replace(RouteStrings.ROUTE_SHARE + "/", "");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareId]);
            });
        } else if (pathname.startsWith(RouteStrings.ROUTE_POI)) {
            const sourceAndId = pathname.replace(RouteStrings.ROUTE_POI + "/", "");
            const source = sourceAndId.split("/")[0];
            const id = sourceAndId.split("/")[1];
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_POI, source, id]);
            });
        } else if (pathname.startsWith(RouteStrings.ROUTE_URL)) {
            const urlData = pathname.replace(RouteStrings.ROUTE_URL + "/", "");
            const baseLayer = new URLSearchParams(url.search).get("baselayer");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_URL, urlData],
                    { queryParams: { baseLayer } });
            });
        } else if (pathname.startsWith(RouteStrings.ROUTE_MAP)) {
            const mapLocation = pathname.replace(RouteStrings.ROUTE_MAP + "/", "");
            const zoom = mapLocation.split("/")[0];
            const lat = mapLocation.split("/")[1];
            const lng = mapLocation.split("/")[2];
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_MAP, zoom, lat, lng]);
            });
        } else if (pathname.startsWith(RouteStrings.ROUTE_LAYER)) {
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_LAYER], { queryParams: Object.fromEntries(url.searchParams.entries()) });
            });
        } else {
            this.ngZone.run(() => {
                this.router.navigate(["/"]);
            });
        }
    }

    private handleFileUrl(url: string) {
        this.loggingService.info("[OpenWith] Opening a file shared with the app " + url);
        setTimeout(async () => {
            try {
                const file = await this.fileService.getFileFromUrl(url);
                this.fileService.addRoutesFromFile(file);
            } catch (ex) {
                this.toastService.error(ex, this.resources.unableToLoadFromFile);
            }
        }, 0);
    }

    private handleHttpUrl(href: string) {
        let url: URL;
        try {
            url = new URL(href);
        } catch {
            this.loggingService.warning(`[OpenWith] Ignoring a malformed url: ${href}`);
            this.toastService.warning(this.resources.unableToLoadFromUrl);
            return;
        }
        if (url.host.toLocaleLowerCase() === "www.mapeak.com" ||
            url.host.toLocaleLowerCase() === "mapeak.com" ||
            url.host.toLocaleLowerCase() === "israelhiking.osm.org.il") {
            this.handleMapeakUrl(url);
            return;
        }
        this.loggingService.info("[OpenWith] Opening an external url: " + href);
        if (MAP_SERVICE_HOSTS.includes(url.host.toLocaleLowerCase())) {
            this.handleMapServiceUrl(href);
            return;
        }
        this.router.navigate([RouteStrings.ROUTE_URL, href]);
    }

    private logAndCloseDialogs(url: URL) {
        this.loggingService.info("[OpenWith] Opening: " + url.href);
        if (this.matDialog.openDialogs.length > 0) {
            this.matDialog.closeAll();
        }
    }

    private moveToLatLng(latLng: LatLngAltTime) {
        this.ngZone.run(() => {
            this.router.navigate([RouteStrings.ROUTE_POI, RouteStrings.COORDINATES, getIdFromLatLng(latLng)]);
        });
    }
}
