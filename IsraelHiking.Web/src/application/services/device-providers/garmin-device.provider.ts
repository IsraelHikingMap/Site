import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

import { DeviceOAuthService } from "./device-oauth.service";
import { getCumulativeDistances, getRoutePoints } from "./device-provider";
import { RouteStatisticsService } from "../route-statistics.service";
import { Urls } from "../../urls";
import type { DeviceConnectionInfo, DeviceProvider, DeviceTokenResponse } from "./device-provider";
import type { DeviceServiceId, RouteDataWithoutState, RoutingType } from "../../models";

type GarminActivityType = "HIKING" | "MOUNTAIN_BIKING" | "OTHER";

type GarminCourse = {
    courseName: string;
    description: string;
    distance: number;
    elevationGain: number;
    elevationLoss: number;
    activityType: GarminActivityType;
    coordinateSystem: "WGS84";
    geoPoints: { latitude: number; longitude: number; elevation: number }[];
};

/**
 * Garmin Connect Courses API integration. Pushes a planned route as a Garmin Connect course,
 * which then syncs to the user's watch or bike computer.
 *
 * @remarks Dormant until the Garmin Connect Developer Program issues a client id for {@link CLIENT_ID}.
 */
@Service()
export class GarminDeviceProvider implements DeviceProvider {

    public readonly id: DeviceServiceId = "garmin";
    public readonly displayName = "Garmin";

    private static readonly CLIENT_ID = "";

    public readonly isAvailable = GarminDeviceProvider.CLIENT_ID !== "";

    private readonly deviceOAuthService = inject(DeviceOAuthService);
    private readonly httpClient = inject(HttpClient);
    private readonly routeStatisticsService = inject(RouteStatisticsService);

    public async login(): Promise<DeviceConnectionInfo> {
        const { verifier, challenge } = await this.deviceOAuthService.generatePkcePair();
        const code = await this.deviceOAuthService.authorize(
            Urls.garminAuthorize, GarminDeviceProvider.CLIENT_ID, null, challenge);
        const token = await this.deviceOAuthService.exchangeToken(Urls.garminToken, {
            client_id: GarminDeviceProvider.CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: this.deviceOAuthService.getRedirectUri(),
            code_verifier: verifier
        });
        return this.toConnectionInfo(token, verifier);
    }

    public async refresh(connection: DeviceConnectionInfo): Promise<DeviceConnectionInfo> {
        const token = await this.deviceOAuthService.exchangeToken(Urls.garminToken, {
            client_id: GarminDeviceProvider.CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: connection.refreshToken
        });
        return this.toConnectionInfo(token, connection.codeVerifier);
    }

    public async sendRoute(accessToken: string, route: RouteDataWithoutState): Promise<void> {
        await firstValueFrom(this.httpClient.post(Urls.garminCourses, this.toCourse(route), {
            headers: { Authorization: `Bearer ${accessToken}` }
        }));
    }

    private toConnectionInfo(token: DeviceTokenResponse, codeVerifier: string): DeviceConnectionInfo {
        return {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            codeVerifier,
            expiresAt: Date.now() + (token.expires_in ?? 86400) * 1000
        };
    }

    private toCourse(route: RouteDataWithoutState): GarminCourse {
        const points = getRoutePoints(route);
        if (points.length < 2) {
            throw new Error("The route has no path to send to the device");
        }
        const cumulativeDistance = getCumulativeDistances(points);
        const statistics = this.routeStatisticsService.getStatisticsForStandAloneRoute(points);
        return {
            courseName: route.name || "Mapeak",
            description: route.description || "",
            distance: cumulativeDistance[cumulativeDistance.length - 1],
            elevationGain: statistics.gain,
            elevationLoss: Math.abs(statistics.loss),
            activityType: this.toActivityType(route.segments[route.segments.length - 1]?.routingType),
            coordinateSystem: "WGS84",
            geoPoints: points.map(point => ({ latitude: point.lat, longitude: point.lng, elevation: point.alt ?? 0 }))
        };
    }

    private toActivityType(routingType: RoutingType): GarminActivityType {
        switch (routingType) {
            case "Hike":
                return "HIKING";
            case "Bike":
                return "MOUNTAIN_BIKING";
            default:
                return "OTHER";
        }
    }
}
