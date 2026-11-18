import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";

import { TracesService } from "./traces.service";
import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import { BulkReplaceTracesAction, RemoveTraceAction, UpdateTraceAction, TracesReducer } from "../reducers/traces.reducer";
import type { Trace } from "../models";

describe("Traces Service", () => {
    beforeEach(() => {
        const loggignMock = {
            info: () => { },
            error: () => { }
        };
        TestBed.configureTestingModule({
            providers: [
                provideStore([TracesReducer]),
                TracesService,
                {
                    provide: ResourcesService,
                    useValue: {
                        getCurrentLanguageCodeSimplified: () => "he"
                    }
                },
                { provide: LoggingService, useValue: loggignMock },
                {
                    provide: DatabaseService,
                    useValue: {
                        deleteTraceById: () => { }
                    }
                },
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
        }
    ));

    it("Should not upload local traces if configured not to", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: false
                }
            });

            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
        }
    ));

    it("Should not upload local traces if user is logged out", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: null
                }
            });
            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
        }
    ));

    it("Should not upload local traces if there are no local traces", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [{ visibility: "private" }]
                }
            });
            await tracesService.initialize();

            expect(() => mockBackend.expectNone(Urls.uploadDataContainer)).not.toThrow();
        }
    ));

    it("Should upload local traces and run sync with no traces", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            const spy = vi.fn();
            store.dispatch = spy;
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [
                        {
                            id: "42",
                            visibility: "local",
                            dataContainer: {
                                routes: [{}]
                            }
                        }
                    ]
                }
            });
            const promise = tracesService.initialize();

            mockBackend.expectOne(u => u.url.startsWith(Urls.uploadDataContainer)).flush({});

            (await vi.waitFor(() => mockBackend.expectOne(u => u.url.startsWith(Urls.osmGpxFiles)))).flush({ traces: [] });

            await vi.waitFor(() => expect(vi.mocked(spy).mock.calls[0][0]).toBeInstanceOf(RemoveTraceAction));
            return promise;
        }
    ));

    it("Should upload a local trace once when uploading is requested again before the first upload ends", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [{ id: "42", visibility: "local", dataContainer: { routes: [{}] } }]
                }
            });
            // This is what happens at startup when an interrupted recording is stopped while initialize runs.
            const first = tracesService.uploadLocalTracesIfNeeded();
            const second = tracesService.initialize();

            mockBackend.expectOne(u => u.url.startsWith(Urls.uploadDataContainer)).flush({});
            (await vi.waitFor(() => mockBackend.expectOne(u => u.url.startsWith(Urls.osmGpxFiles)))).flush({ traces: [] });
            await Promise.all([first, second]);

            mockBackend.expectNone(u => u.url.startsWith(Urls.uploadDataContainer));
        }
    ));

    it("Should upload local traces and run sync with traces", inject([TracesService, HttpTestingController, Store],
        async (tracesService: TracesService, mockBackend: HttpTestingController, store: Store) => {
            const spy = vi.fn();
            store.dispatch = spy;
            store.reset({
                configuration: {
                    isAutomaticRecordingUpload: true
                },
                userState: {
                    userInfo: {}
                },
                tracesState: {
                    traces: [
                        {
                            id: "42",
                            visibility: "local",
                            dataContainer: {
                                routes: [{}]
                            }
                        },
                        {
                            id: "1",
                            visibility: "private"
                        }
                    ]
                }
            });
            const promise = tracesService.initialize();

            mockBackend.expectOne(u => u.url.startsWith(Urls.uploadDataContainer)).flush({});

            (await vi.waitFor(() => mockBackend.expectOne(u => u.url.startsWith(Urls.osmGpxFiles)))).flush({
                traces: [
                    {
                        id: 1,
                        visibility: "public"
                    },
                    {
                        id: 2,
                        visibility: "private"
                    }
                ]
            });

            await vi.waitFor(() => expect(vi.mocked(spy).mock.calls[1][0]).toBeInstanceOf(BulkReplaceTracesAction));
            expect(vi.mocked(spy).mock.calls[0][0]).toBeInstanceOf(RemoveTraceAction);

            const req = mockBackend.match(u => u.url.startsWith(Urls.osmGpx));
            expect(req.length).toBe(2);
            req[0].flush({});
            req[1].flush({});
            await vi.waitFor(() => expect(vi.mocked(spy).mock.calls[3][0]).toBeInstanceOf(UpdateTraceAction));
            expect(vi.mocked(spy).mock.calls[2][0]).toBeInstanceOf(UpdateTraceAction);

            return promise;
        }
    ));

    it("Should return null get a trace by id when there's no trace", inject([TracesService, Store],
        async (tracesService: TracesService, store: Store) => {
            store.reset({
                tracesState: {
                    traces: []
                }
            });
            const trace = await tracesService.getTraceById("42");

            expect(trace).toBeNull();
        }
    ));

    it("Should return a trace store in DB", inject([TracesService, Store, DatabaseService],
        async (tracesService: TracesService, store: Store, databaseService: DatabaseService) => {
            databaseService.getTraceById = () => Promise.resolve({} as Trace);

            store.reset({
                tracesState: {
                    traces: [
                        {
                            id: "1"
                        }
                    ]
                }
            });
            const trace = await tracesService.getTraceById("1");

            expect(trace.id).toBe("1");
        }
    ));

    it("Should return a trace stored in the state in case of a local recording and not in database", inject([TracesService, Store, DatabaseService],
        async (tracesService: TracesService, store: Store, databaseService: DatabaseService) => {
            databaseService.getTraceById = () => Promise.resolve(null as Trace);

            store.reset({
                tracesState: {
                    traces: [
                        {
                            id: "1",
                            visibility: "local",
                            dataContainer: {
                                routes: [{}]
                            }
                        }
                    ]
                }
            });
            const trace = await tracesService.getTraceById("1");

            expect(trace.id).toBe("1");
            expect(trace.dataContainer).not.toBeNull();
        }
    ));

    it("Should get a trace from server when it's not in the DB", inject([TracesService, Store, DatabaseService, HttpTestingController],
        async (tracesService: TracesService, store: Store, databaseService: DatabaseService, mockBackend: HttpTestingController) => {
            databaseService.getTraceById = () => Promise.resolve(null as Trace);
            databaseService.storeTrace = () => Promise.resolve();

            store.reset({
                tracesState: {
                    traces: [
                        {
                            id: "1"
                        }
                    ]
                }
            });
            const promise = tracesService.getTraceById("1");

            (await vi.waitFor(() => mockBackend.expectOne(Urls.traceAsDataContainer + "1"))).flush({ id: "1" });

            const trace = await promise;
            expect(trace.id).toBe("1");
        }
    ));

    it("Should upload a trace", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {
            const file = new File([""], "file.txt");
            const promise = tracesService.uploadTrace(file);

            (await vi.waitFor(() => mockBackend.expectOne(Urls.osmGpx))).flush({ id: "1" });

            const trace = await promise;
            expect(trace.id).toBe("1");
        }
    ));

    it("Should update a trace without an empty tag", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {
            const trace = {
                id: "1",
                visibility: "private",
                tagsString: "",
                timeStamp: new Date()
            } as Trace;
            const promise = tracesService.updateTrace(trace);

            mockBackend.expectOne(request =>
                !request.body.includes("<tag></tag>") && request.method === "PUT").flush({ id: "1" });

            await expect(promise).resolves.not.toThrow();
        }
    ));

    it("Should update a trace", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {
            const trace = {
                id: "1",
                visibility: "private",
                tagsString: "tag1,tag2",
                description: "description",
                timeStamp: new Date()
            } as Trace;
            const promise = tracesService.updateTrace(trace);

            mockBackend.expectOne(request =>
                request.body.includes("<tag>tag1</tag>") &&
                request.body.includes("<tag>tag2</tag>") &&
                request.body.includes("<description>description</description>") &&
                request.method === "PUT"
            ).flush({ id: "1" });

            await expect(promise).resolves.not.toThrow();
        }
    ));
});
