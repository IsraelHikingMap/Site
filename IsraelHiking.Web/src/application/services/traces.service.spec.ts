import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { TracesService } from "./traces.service";
import { LoggingService } from "./logging.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import { AddTraceAction, RemoveTraceAction, UpdateTraceAction } from "../reducers/traces.reducer";
import type { Trace } from "../models/models";

describe("Traces Service", () => {
    beforeEach(() => {
        const mock = new ToastServiceMockCreator();
        const loggignMock = {
            info: () => { },
            error: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                NgxsModule.forRoot([])
            ],
            providers: [
                TracesService,
                { provide: ResourcesService, useValue: mock.resourcesService },
                { provide: LoggingService, useValue: loggignMock },
                { provide: RunningContextService, useValue: {} },
                { provide: DatabaseService, useValue: {
                    deleteTraceById: () => {}
                } }
            ]
        });
    });

    it("Should get missing parts", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {

            const trace = { id: "123" } as Trace;

            const promise = tracesService.getMissingParts(trace.id).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.osm + "?traceId=" + trace.id).flush({});
            return promise;
    }));

    it("Should not upload local traces if configured not to", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: false
                } 
            });

            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.osmTraceRoute)).not.toThrow();
    }));

    it("Should not upload local traces if offline", inject([TracesService, HttpTestingController, Store, RunningContextService],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store, runningContextService: RunningContextService) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                } 
            });
            runningContextService.isOnline = false;
            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.osmTraceRoute)).not.toThrow();
    }));

    it("Should not upload local traces if user is logged out", inject([TracesService, HttpTestingController, Store, RunningContextService],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store, runningContextService: RunningContextService) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: null
                }
            });
            runningContextService.isOnline = true;
            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.osmTraceRoute)).not.toThrow();
    }));

    it("Should not upload local traces if there are no local traces", inject([TracesService, HttpTestingController, Store, RunningContextService],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store, runningContextService: RunningContextService) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [{visibility: "private"}]
                }
            });
            runningContextService.isOnline = true;
            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.osmTraceRoute)).not.toThrow();
    }));

    it("Should upload local traces and run sync with no traces", inject([TracesService, HttpTestingController, Store, RunningContextService],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store, runningContextService: RunningContextService) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [{
                        id: "42",
                        visibility: "local",
                        dataContainer: {
                            routes: [{}]
                        }
                    }]
                }
            });
            runningContextService.isOnline = true;
            const promise = tracesService.initialize();

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmTraceRoute)).flush({});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmTrace)).flush([]);

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(RemoveTraceAction);
            return promise;
    }));

    it("Should upload local traces and run sync with traces", inject([TracesService, HttpTestingController, Store, RunningContextService],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store, runningContextService: RunningContextService) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [{
                        id: "42",
                        visibility: "local",
                        dataContainer: {
                            routes: [{}]
                        }
                    }, {
                        id: "1",
                        visibility: "private",
                    }]
                }
            });
            runningContextService.isOnline = true;
            const promise = tracesService.initialize();

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmTraceRoute)).flush({});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmTrace)).flush([{
                id: "1",
                visibility: "public"
            }, {
                id: "2",
                visibility: "private"
            }]);

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(RemoveTraceAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(UpdateTraceAction);
            expect(spy.calls.all()[2].args[0]).toBeInstanceOf(AddTraceAction);

            const req = mockBackend.match(u => u.url.startsWith(Urls.osmTrace));
            expect(req.length).toBe(2);
            req[0].flush({});
            req[1].flush({});
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(spy.calls.all()[3].args[0]).toBeInstanceOf(UpdateTraceAction);
            expect(spy.calls.all()[4].args[0]).toBeInstanceOf(UpdateTraceAction);

            return promise;
    }));
});
