import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { TracesService } from "./traces.service";
import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import { BulkReplaceTracesAction, RemoveTraceAction, UpdateTraceAction } from "../reducers/traces.reducer";
import type { Trace } from "../models/models";

describe("Traces Service", () => {
    beforeEach(() => {
        const loggignMock = {
            info: () => { },
            error: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([])],
            providers: [
                TracesService,
                { provide: ResourcesService, useValue: {
                    getCurrentLanguageCodeSimplified: () => "he"
                } },
                { provide: LoggingService, useValue: loggignMock },
                { provide: RunningContextService, useValue: {} },
                { provide: DatabaseService, useValue: {
                        deleteTraceById: () => { }
                } },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get missing parts", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {

            const trace = { id: "123" } as Trace;

            const promise = tracesService.getMissingParts(trace.id).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.missingParts + "?traceId=" + trace.id).flush({});
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

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
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

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
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

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
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

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
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

            mockBackend.expectOne(u => u.url.startsWith(Urls.uploadDataContainer)).flush({});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmGpxFiles)).flush({traces: []});

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

            mockBackend.expectOne(u => u.url.startsWith(Urls.uploadDataContainer)).flush({});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(u => u.url.startsWith(Urls.osmGpxFiles)).flush({ traces: [{
                id: 1,
                visibility: "public"
            }, {
                id: 2,
                visibility: "private"
            }]});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(RemoveTraceAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(BulkReplaceTracesAction);

            const req = mockBackend.match(u => u.url.startsWith(Urls.osmGpx));
            expect(req.length).toBe(2);
            req[0].flush({});
            req[1].flush({});
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(spy.calls.all()[2].args[0]).toBeInstanceOf(UpdateTraceAction);
            expect(spy.calls.all()[3].args[0]).toBeInstanceOf(UpdateTraceAction);

            return promise;
    }));

    it("Should return null get a trace by id when there's no trace", inject([TracesService, Store],
        async (tracesService: TracesService, store: Store) => {
            store.reset({
                tracesState: {
                    traces: []
                }
            });
            const trace = await tracesService.getTraceById("42");

            expect(trace).toBeNull();
    }));

    it("Should return a trace store in DB", inject([TracesService, Store, DatabaseService],
        async (tracesService: TracesService, store: Store, databaseService: DatabaseService) => {
            databaseService.getTraceById = () => { return Promise.resolve({} as Trace) };

            store.reset({
                tracesState: {
                    traces: [{
                        id: "1"
                    }]
                }
            });
            const trace = await tracesService.getTraceById("1");

            expect(trace.id).toBe("1");
    }));

    it("Should get a trace from server when it's not in the DB", inject([TracesService, Store, DatabaseService, HttpTestingController],
        async (tracesService: TracesService, store: Store, databaseService: DatabaseService, mockBackend: HttpTestingController) => {
            databaseService.getTraceById = () => { return Promise.resolve(null as Trace) };
            databaseService.storeTrace = () => { return Promise.resolve() };

            store.reset({
                tracesState: {
                    traces: [{
                        id: "1"
                    }]
                }
            });
            const promise = tracesService.getTraceById("1");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.traceAsDataContainer + "1").flush({id: "1"});

            const trace = await promise;
            expect(trace.id).toBe("1");
    }));

    it("Should upload a trace", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {
            const file = new File([""], "file.txt");
            const promise = tracesService.uploadTrace(file);

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.osmGpx).flush({ id: "1"});

            const trace = await promise;
            expect(trace.id).toBe("1");
    }));
});
