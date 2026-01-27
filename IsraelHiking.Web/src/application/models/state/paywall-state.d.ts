export type PaywallState = {
    lastPaywallShownDate: Date | null;
    appLaunchesSinceLastPaywallShown: number;
    lastOfflineDetectedDate: Date | null;
}