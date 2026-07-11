import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Encoder, Profile } from "@garmin/fitsdk";
import { encode } from "base64-arraybuffer";

import { DeviceOAuthService } from "./device-oauth.service";
import { SpatialService } from "../spatial.service";
import { RouteStatisticsService } from "../route-statistics.service";
import { Urls } from "../../urls";
import type { DeviceConnectionInfo, DeviceProvider, DeviceTokenResponse } from "./device-provider";
import type { DeviceServiceId, LatLngAltTime, RouteDataWithoutState } from "../../models";

/** A route encoded as a FIT course plus the metadata the Wahoo routes API requires. */
type FitCoursePayload = {
    name: string;
    /** Base64 of the FIT course file (no data-uri prefix). */
    base64: string;
    startLat: number;
    startLng: number;
    /** Total distance in meters. */
    distance: number;
    /** Total ascent in meters. */
    ascent: number;
    /** Total descent in meters. */
    descent: number;
};

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

/**
 * Wahoo Cloud API integration. Pushes a planned route as a Wahoo "route"
 * (routes_write scope) which then syncs to the user's ELEMNT bike computer.
 * Docs: https://cloud-api.wahooligan.com/
 */
@Injectable()
export class WahooDeviceProvider implements DeviceProvider {

    public readonly id: DeviceServiceId = "wahoo";
    public readonly displayName = "Wahoo";

    private static readonly CLIENT_ID = "amZH1PBW99VdHFWN6zgzo5953jXPo3Hv8DCTJBnv0CQ";
    private static readonly CYCLING_WORKOUT_TYPE_FAMILY_ID = 0;
    private static readonly SCOPE = "user_read routes_write";

    private readonly deviceOAuthService = inject(DeviceOAuthService);
    private readonly httpClient = inject(HttpClient);
    private readonly routeStatisticsService = inject(RouteStatisticsService);

    public async login(): Promise<DeviceConnectionInfo> {
        const { verifier, challenge } = await this.deviceOAuthService.generatePkcePair();
        const code = await this.deviceOAuthService.authorize(
            Urls.wahooAuthorize, WahooDeviceProvider.CLIENT_ID, WahooDeviceProvider.SCOPE, challenge);
        const token = await this.deviceOAuthService.exchangeToken(Urls.wahooToken, {
            client_id: WahooDeviceProvider.CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: this.deviceOAuthService.getRedirectUri(),
            code_verifier: verifier
        });
        return this.toConnectionInfo(token, verifier);
    }

    public async refresh(connection: DeviceConnectionInfo): Promise<DeviceConnectionInfo> {
        const token = await this.deviceOAuthService.exchangeToken(Urls.wahooToken, {
            client_id: WahooDeviceProvider.CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: connection.refreshToken,
            code_verifier: connection.codeVerifier
        });
        return this.toConnectionInfo(token, connection.codeVerifier);
    }

    public async sendRoute(accessToken: string, route: RouteDataWithoutState): Promise<void> {
        const payload = this.toFitCourse(route);
        const body = new URLSearchParams({
            "route[file]": "data:application/vnd.fit;base64," + payload.base64,
            "route[filename]": payload.name + ".fit",
            "route[name]": payload.name,
            "route[external_id]": "mapeak-" + (route.id || Date.now().toString()),
            "route[provider_updated_at]": new Date().toISOString(),
            "route[workout_type_family_id]": WahooDeviceProvider.CYCLING_WORKOUT_TYPE_FAMILY_ID.toString(),
            "route[start_lat]": payload.startLat.toString(),
            "route[start_lng]": payload.startLng.toString(),
            "route[distance]": payload.distance.toFixed(1),
            "route[ascent]": payload.ascent.toFixed(1),
            "route[descent]": payload.descent.toFixed(1)
        });
        await firstValueFrom(this.httpClient.post(Urls.wahooRoutes, body.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Bearer ${accessToken}`
            }
        }));
    }

    private toConnectionInfo(token: DeviceTokenResponse, codeVerifier: string): DeviceConnectionInfo {
        return {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            codeVerifier,
            expiresAt: Date.now() + (token.expires_in ?? 7200) * 1000
        };
    }

    /** Builds a FIT "course" file from the route's GPS points, as Wahoo's routes API expects. */
    private toFitCourse(route: RouteDataWithoutState): FitCoursePayload {
        const points = this.flattenPoints(route);
        if (points.length < 2) {
            throw new Error("The route has no path to send to the device");
        }
        const name = route.name || "Mapeak";
        const first = points[0];
        const lastPoint = points[points.length - 1];
        const cumulativeDistance = this.cumulativeDistances(points);
        const totalDistance = cumulativeDistance[cumulativeDistance.length - 1];
        const statistics = this.routeStatisticsService.getStatisticsForStandAloneRoute(points);
        const ascent = statistics.gain;
        const descent = Math.abs(statistics.loss);
        // FIT date-times must be after the FIT epoch (1989), so use the current time.
        const created = new Date();

        // A FIT course file: file id, course, lap, then start event, the GPS
        // records and a stop event - written in this order. The @garmin/fitsdk
        // Encoder reads named fields dynamically, so the messages are plain
        // objects cast to the encoder's message type.
        const messages: Record<string, unknown>[] = [
            {
                mesgNum: Profile.MesgNum.FILE_ID,
                type: "course",
                manufacturer: "development",
                product: 0,
                timeCreated: created,
                serialNumber: 0
            },
            {
                mesgNum: Profile.MesgNum.COURSE,
                name,
                sport: "cycling"
            },
            {
                mesgNum: Profile.MesgNum.LAP,
                timestamp: created,
                startTime: created,
                totalElapsedTime: 0,
                totalTimerTime: 0,
                startPositionLat: this.toSemicircles(first.lat),
                startPositionLong: this.toSemicircles(first.lng),
                endPositionLat: this.toSemicircles(lastPoint.lat),
                endPositionLong: this.toSemicircles(lastPoint.lng),
                totalDistance,
                totalAscent: Math.round(ascent),
                totalDescent: Math.round(descent)
            },
            {
                mesgNum: Profile.MesgNum.EVENT,
                timestamp: created,
                event: "timer",
                eventType: "start"
            },
            ...points.map((point, index) => ({
                mesgNum: Profile.MesgNum.RECORD,
                timestamp: new Date(created.getTime() + index * 1000),
                positionLat: this.toSemicircles(point.lat),
                positionLong: this.toSemicircles(point.lng),
                distance: cumulativeDistance[index],
                altitude: point.alt ?? 0
            })),
            {
                mesgNum: Profile.MesgNum.EVENT,
                timestamp: new Date(created.getTime() + points.length * 1000),
                event: "timer",
                eventType: "stopDisableAll"
            }
        ];

        const encoder = new Encoder();
        for (const message of messages) {
            encoder.writeMesg(message as unknown as Parameters<Encoder["writeMesg"]>[0]);
        }
        const bytes = encoder.close();
        return {
            name,
            base64: encode(new Uint8Array(bytes).buffer),
            startLat: first.lat,
            startLng: first.lng,
            distance: totalDistance,
            ascent,
            descent
        };
    }

    private flattenPoints(route: RouteDataWithoutState): LatLngAltTime[] {
        return (route.segments || [])
            .flatMap(segment => segment.latlngs || [])
            .filter(latlng => latlng != null);
    }

    private cumulativeDistances(points: LatLngAltTime[]): number[] {
        const cumulativeDistance = [0];
        for (let i = 1; i < points.length; i++) {
            cumulativeDistance.push(cumulativeDistance[i - 1] + SpatialService.getDistanceInMeters(points[i - 1], points[i]));
        }
        return cumulativeDistance;
    }

    private toSemicircles(degrees: number): number {
        return Math.round(degrees * SEMICIRCLES_PER_DEGREE);
    }
}
