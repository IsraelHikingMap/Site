import { RecordedRoute } from "../models";

export type RecordedRouteState = {
    isRecording: boolean;
    isAddingPoi: boolean;
    route: RecordedRoute;
    pendingProcessing: GeolocationPosition[];
};
