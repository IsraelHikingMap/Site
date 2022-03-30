import { inject, TestBed } from "@angular/core/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";
import { Subject } from "rxjs";

import { SelectedRouteService } from "./selected-route.service";
import { ResourcesService } from "../../../services/resources.service";
import { ToastServiceMockCreator } from "../../../services/toast.service.spec";
import { RoutesFactory } from "./routes.factory";
import { RouterService } from "application/services/router.service";
import type { ApplicationState, RouteData } from "../../../models/models";

describe("Selected Route Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
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
            let predecator = ((state: ApplicationState) => state.routes.present).toString().split("=>")[1];
            let selectorKey = Object.keys(MockNgRedux.getSubStore().selections).find(k => k.includes(predecator));
            const routesStub = MockNgRedux.getSelectorStub<ApplicationState, RouteData[]>(selectorKey);

            routesStub.next([{} as any]);

            let selectedRoute = selectedRouteService.getSelectedRoute();

            expect(selectedRoute).not.toBeUndefined();
        }
    ));
});
