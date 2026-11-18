import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

import { DeviceProviderOAuthService } from "./device-provider-oauth.service";
import { RouteStatisticsService } from "../route-statistics.service";
import { SelectedRouteService } from "../selected-route.service";
import { Urls } from "../../urls";
import type { DeviceProvider, DeviceProviderTokenResponse } from "./device-provider";
import type { DeviceProviderConnection, DeviceProviderId, RouteDataWithoutState, RoutingType } from "../../models";

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
 * @remarks Works like the Wahoo provider, except that Garmin's token requests need the client secret and go
 * through the GarminController, which also routes Garmin's single redirect uri to the app or the site.
 */
@Service()
export class GarminDeviceProvider implements DeviceProvider {

    public readonly id: DeviceProviderId = "garmin";
    public readonly displayName = "Garmin";
    public readonly icon = "content/device-providers/garmin.png";

    private static readonly CLIENT_ID = "717bf25f-aafa-4a33-a4ae-b26ac14446f2";

    private readonly deviceProviderOAuthService = inject(DeviceProviderOAuthService);
    private readonly httpClient = inject(HttpClient);
    private readonly routeStatisticsService = inject(RouteStatisticsService);
    private readonly selectedRouteService = inject(SelectedRouteService);

    public async login(): Promise<DeviceProviderConnection> {
        const { verifier, challenge } = await this.deviceProviderOAuthService.generatePkcePair();
        const code = await this.deviceProviderOAuthService.authorize(
            Urls.garminAuthorize, GarminDeviceProvider.CLIENT_ID, null, challenge, Urls.garminCallback);
        const token = await this.deviceProviderOAuthService.exchangeToken(Urls.garminToken, {
            grant_type: "authorization_code",
            code,
            redirect_uri: Urls.garminCallback,
            code_verifier: verifier
        });
        return this.toConnectionInfo(token, verifier);
    }

    public async refresh(connection: DeviceProviderConnection): Promise<DeviceProviderConnection> {
        const token = await this.deviceProviderOAuthService.exchangeToken(Urls.garminToken, {
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

    public async disconnect(accessToken: string): Promise<void> {
        await firstValueFrom(this.httpClient.delete(Urls.garminRegistration, {
            headers: { Authorization: `Bearer ${accessToken}` }
        }));
    }

    private toConnectionInfo(token: DeviceProviderTokenResponse, codeVerifier: string): DeviceProviderConnection {
        return {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            codeVerifier,
            expiresAt: Date.now() + (token.expires_in ?? 86400) * 1000
        };
    }

    private toCourse(route: RouteDataWithoutState): GarminCourse {
        const points = this.selectedRouteService.getLatlngs(route);
        if (points.length < 2) {
            throw new Error("The route has no path to send to the device");
        }
        const statistics = this.routeStatisticsService.getStatisticsForStandAloneRoute(points);
        return {
            courseName: route.name || "Mapeak",
            description: route.description || "",
            distance: statistics.length,
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
