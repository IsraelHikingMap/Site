import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import { WahooDeviceProvider } from "./wahoo-device.provider";
import { LoggingService } from "../logging.service";
import { ToastService } from "../toast.service";
import { ResourcesService } from "../resources.service";
import { RunningContextService } from "../running-context.service";
import { PurchaseService } from "../purchase.service";
import { RemoveDeviceServiceAction, SetDeviceServiceTokenAction } from "../../reducers/user.reducer";
import type { DeviceProvider } from "./device-provider";
import type { ApplicationState, DeviceServiceId, RouteDataWithoutState } from "../../models";

/** Token is considered expired this many ms before its real expiry, to be safe. */
const TOKEN_EXPIRY_MARGIN = 60000;

/**
 * Registry and orchestration for the external device services. The settings UI
 * and the send-to-device flows talk only to this service, never to a specific
 * provider, so adding another provider later requires no UI changes.
 */
@Injectable()
export class DeviceServicesService {

    private readonly store = inject(Store);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly purchaseService = inject(PurchaseService);
    private readonly providers: DeviceProvider[] = [
        inject(WahooDeviceProvider)
    ];

    public getProviders(): DeviceProvider[] {
        return this.providers;
    }

    public getProvider(id: DeviceServiceId): DeviceProvider {
        return this.providers.find(provider => provider.id === id);
    }

    public isConnected(id: DeviceServiceId): boolean {
        const services = this.store.selectSnapshot((state: ApplicationState) => state.userState.connectedDeviceServices);
        return services?.[id] != null;
    }

    /** Returns providers the user can currently send routes to. */
    public getConnectedProviders(): DeviceProvider[] {
        return this.providers.filter(provider => this.isConnected(provider.id));
    }

    public async connect(id: DeviceServiceId): Promise<void> {
        const connection = await this.getProvider(id).login();
        this.store.dispatch(new SetDeviceServiceTokenAction(id, connection));
        this.loggingService.info(`[DeviceServices] Connected to ${id}`);
    }

    public disconnect(id: DeviceServiceId): void {
        this.store.dispatch(new RemoveDeviceServiceAction(id));
        this.loggingService.info(`[DeviceServices] Disconnected from ${id}`);
    }

    public async sendRouteToDevice(id: DeviceServiceId, route: RouteDataWithoutState): Promise<void> {
        const provider = this.getProvider(id);
        const accessToken = await this.getValidAccessToken(id, provider);
        await provider.sendRoute(accessToken, route);
        this.loggingService.info(`[DeviceServices] Sent route to ${id}`);
    }

    public isSubscribed(): boolean {
        return this.store.selectSnapshot((state: ApplicationState) => state.offlineState.isSubscribed);
    }

    /**
     * Sends one or more routes to a device, applying the subscription gate once
     * and surfacing the outcome via toasts. This is the single entry point used
     * by the export dialog and the cloud-saves menu so both stay in sync.
     */
    public async sendRouteGated(id: DeviceServiceId, routes: RouteDataWithoutState[]): Promise<void> {
        if (!this.isSubscribed()) {
            if (this.runningContextService.isCapacitor) {
                await this.purchaseService.showPaywall();
            } else {
                // Web purchases are not available yet - point the user to the app.
                this.toastService.info(this.resources.subscribeToSendToDevice);
            }
            return;
        }
        if (!this.isConnected(id)) {
            this.toastService.info(this.resources.connectDeviceFirst);
            return;
        }
        try {
            for (const route of routes) {
                await this.sendRouteToDevice(id, route);
            }
            this.toastService.success(this.resources.routeSentToDevice);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSendToDevice);
        }
    }

    private async getValidAccessToken(id: DeviceServiceId, provider: DeviceProvider): Promise<string> {
        const services = this.store.selectSnapshot((state: ApplicationState) => state.userState.connectedDeviceServices);
        let connection = services?.[id];
        if (connection == null) {
            throw new Error(`Not connected to ${id}`);
        }
        if (Date.now() >= connection.expiresAt - TOKEN_EXPIRY_MARGIN) {
            connection = await provider.refresh({ ...connection });
            this.store.dispatch(new SetDeviceServiceTokenAction(id, connection));
        }
        return connection.accessToken;
    }
}
