import { RecordedRoute } from "..";

export type RecordedRouteState = {
    isRecording: boolean;
    isAddingPoi: boolean;
    route: RecordedRoute;
    pendingProcessing: GeolocationPosition[];
};
