import { computed, inject, Service } from "@angular/core";
import { Store } from "@ngxs/store";

import { WahooDeviceProvider } from "./wahoo.device-provider";
import { GarminDeviceProvider } from "./garmin.device-provider";
import { LoggingService } from "../logging.service";
import { ToastService } from "../toast.service";
import { ResourcesService } from "../resources.service";
import { RemoveDeviceProviderConnectionAction, SetDeviceProviderConnectionAction } from "../../reducers/user.reducer";
import type { DeviceProvider } from "./device-provider";
import type { ApplicationState, DeviceProviderId, RouteDataWithoutState } from "../../models";

/** Token is considered expired this many ms before its real expiry, the margin Garmin recommends. */
const TOKEN_EXPIRY_MARGIN = 600000;

/**
 * Registry and orchestration for the device providers. The settings UI
 * and the send-to-device flows talk only to this service, never to a specific
 * provider, so adding another provider later requires no UI changes.
 *
 * @remarks Sending a route to a device is offered to subscribed users only, so no provider is listed to anyone else.
 */
@Service()
export class DeviceProvidersService {

    private readonly store = inject(Store);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly resources = inject(ResourcesService);
    private readonly providers: DeviceProvider[] = [
        inject(WahooDeviceProvider),
        inject(GarminDeviceProvider)
    ];

    private readonly isSubscribed = this.store.selectSignal((state: ApplicationState) => state.offlineState.isSubscribed);

    public readonly availableProviders = computed(() => this.isSubscribed() ? this.providers : []);

    public getProvider(id: DeviceProviderId): DeviceProvider {
        return this.providers.find(provider => provider.id === id);
    }

    public isConnected(id: DeviceProviderId): boolean {
        const services = this.store.selectSnapshot((state: ApplicationState) => state.userState.connectedDeviceProviders);
        return services?.[id] != null;
    }

    public async connect(id: DeviceProviderId): Promise<void> {
        const connection = await this.getProvider(id).login();
        this.store.dispatch(new SetDeviceProviderConnectionAction(id, connection));
        this.loggingService.info(`[DeviceProviders] Connected to ${id}`);
    }

    /**
     * Forgets the connection on this device even when the provider can not be told about it, so that a user
     * is never stuck connected to a service they want to leave.
     */
    public async disconnect(id: DeviceProviderId): Promise<void> {
        const provider = this.getProvider(id);
        if (provider.disconnect != null) {
            try {
                await provider.disconnect(await this.getValidAccessToken(id, provider));
            } catch (ex) {
                this.loggingService.warning(`[DeviceProviders] Unable to disconnect from ${id}: ${(ex as Error).message}`);
            }
        }
        this.store.dispatch(new RemoveDeviceProviderConnectionAction(id));
        this.loggingService.info(`[DeviceProviders] Disconnected from ${id}`);
    }

    /**
     * Sends one or more routes to a connected provider and surfaces the outcome via toasts.
     */
    public async sendRoutes(id: DeviceProviderId, routes: RouteDataWithoutState[]): Promise<void> {
        try {
            const provider = this.getProvider(id);
            const accessToken = await this.getValidAccessToken(id, provider);
            for (const route of routes) {
                await provider.sendRoute(accessToken, route);
                this.loggingService.info(`[DeviceProviders] Sent route to ${id}`);
            }
            this.toastService.success(this.resources.routeSentToDevice);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToSendToDevice);
        }
    }

    private async getValidAccessToken(id: DeviceProviderId, provider: DeviceProvider): Promise<string> {
        const services = this.store.selectSnapshot((state: ApplicationState) => state.userState.connectedDeviceProviders);
        let connection = services?.[id];
        if (connection == null) {
            throw new Error(`Not connected to ${id}`);
        }
        if (Date.now() >= connection.expiresAt - TOKEN_EXPIRY_MARGIN) {
            connection = await provider.refresh({ ...connection });
            this.store.dispatch(new SetDeviceProviderConnectionAction(id, connection));
        }
        return connection.accessToken;
    }
}
