import { inject, TestBed } from "@angular/core/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";
import { Subject } from "rxjs";

import { SelectedRouteService } from "./selected-route.service";
import { ResourcesService } from "./resources.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { RouterService } from "./router.service";
import { RoutesFactory } from "./routes.factory";
import type { ApplicationState } from "../models/models";

export const getSubject = <T>(predecator: (state: ApplicationState) => T): Subject<T> => {
    let predecatorString = predecator.toString().split("=>")[1];
    let selectorKey = Object.keys((MockNgRedux.getSubStore() as MockNgRedux).selections).find(k => k.includes(predecatorString));
    return MockNgRedux.getSelectorStub<ApplicationState, T>(selectorKey);
};

describe("Selected Route Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        toastMock.resourcesService.route = "route";
        let routerServiceMock = {};
        TestBed.configureTestingModule({
            imports: [
                MockNgReduxModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: RouterService, useValue: routerServiceMock },
                RoutesFactory,
                SelectedRouteService,
            ]
        });
        MockNgRedux.reset();
    });

    it("Should get undefined selected route when there're no routes", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            let selectedRoute = selectedRouteService.getSelectedRoute();

            expect(selectedRoute).toBeUndefined();
        }
    ));

    it("Should get selected route when there are routes", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            const routesStub = getSubject((state: ApplicationState) => state.routes.present);

            routesStub.next([{} as any]);

            let selectedRoute = selectedRouteService.getSelectedRoute();

            expect(selectedRoute).not.toBeUndefined();
        }
    ));

    it("Should sync selected route with editing route", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            MockNgRedux.store.dispatch = jasmine.createSpy();
            const routesStub = getSubject((state: ApplicationState) => state.routes.present);
            const selectedRouteIdSubject = getSubject((state: ApplicationState) => state.routeEditingState.selectedRouteId);
            routesStub.next([{ id: "42", state: "Poi" } as any]);
            selectedRouteIdSubject.next("1");

            selectedRouteService.syncSelectedRouteWithEditingRoute();

            expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
        }
    ));

    it("Should select the first route if selected route it null and there are routes", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            const routesStub = getSubject((state: ApplicationState) => state.routes.present);
            const selectedRouteIdSubject = getSubject((state: ApplicationState) => state.routeEditingState.selectedRouteId);
            routesStub.next([{id: "42"} as any]);
            selectedRouteIdSubject.next(null);
            MockNgRedux.store.dispatch = jasmine.createSpy().and.callFake((action) => selectedRouteIdSubject.next(action.payload.routeId));

            const selectedRoute = selectedRouteService.getOrCreateSelectedRoute();

            expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
            expect(selectedRoute.id).toBe("42");
        }
    ));

    it("Should set selected route if there's no selected route", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            const selectedRouteIdSubject = getSubject((state: ApplicationState) => state.routeEditingState.selectedRouteId);
            selectedRouteIdSubject.next(null);
            MockNgRedux.store.dispatch = jasmine.createSpy();

            selectedRouteService.setSelectedRoute("42");

            expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
        }
    ));

    it("Should unselect selected route and selected the given route", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            const selectedRouteIdSubject = getSubject((state: ApplicationState) => state.routeEditingState.selectedRouteId);
            selectedRouteIdSubject.next("1");
            MockNgRedux.store.dispatch = jasmine.createSpy();

            selectedRouteService.setSelectedRoute("42");

            expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
        }
    ));
});
