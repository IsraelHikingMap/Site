import { IRouteLayer, IRouteSegment } from "./iroute.layer";

// This is a partial interface used in route popup marker
export interface IRoutesService {
    selectedRoute: IRouteLayer;

    getClosestRoute(isFirst: boolean);
    splitSelectedRouteAt(segmenet: IRouteSegment);
    mergeSelectedRouteToClosest(isFirst: boolean);
}