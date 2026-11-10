import Foundation
import XCTest
@testable import OfflineDownload

final class TileDownloadCoordinatorTests: XCTestCase {
    private var directories: TestDirectories!
    private var transfers: FakeTransfers!
    private var events: RecordedEvents!
    private var time = Date(timeIntervalSince1970: 0)

    override func setUp() {
        directories = TestDirectories()
        transfers = FakeTransfers()
        events = RecordedEvents()
        time = Date(timeIntervalSince1970: 0)
    }

    override func tearDown() {
        directories.remove()
    }

    func testShouldQueueEveryFileInTheOrderOfTheJobWithItsHeaders() {
        let coordinator = makeCoordinator()

        coordinator.start(directories.jobOf("c.pmtiles", "a.pmtiles", "b.pmtiles", headers: ["Authorization": "Bearer token"]))

        XCTAssertEqual(transfers.enqueuedFileNames, ["c.pmtiles", "a.pmtiles", "b.pmtiles"])
        XCTAssertEqual(transfers.enqueued[0].request.url?.absoluteString, "https://mapeak.test/offline/c.pmtiles")
        XCTAssertTrue(transfers.enqueued.allSatisfy { $0.request.value(forHTTPHeaderField: "Authorization") == "Bearer token" })
    }

    func testShouldNotQueueAFileThatIsAlreadyWholeOnDisk() {
        directories.writeOfflineFile("a.pmtiles", "already here")
        let coordinator = makeCoordinator()

        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))

        XCTAssertEqual(transfers.enqueuedFileNames, ["b.pmtiles"])
    }

    func testShouldCompleteAtOnceAJobWhoseFilesAreAllOnDisk() {
        directories.writeOfflineFile("a.pmtiles", "already here")
        let coordinator = makeCoordinator()

        coordinator.start(directories.jobOf("a.pmtiles"))

        XCTAssertTrue(transfers.enqueued.isEmpty)
        XCTAssertEqual(events.finishedStates, [.completed])
    }

    func testShouldMoveEveryFileUnderItsNameAndCompleteTheJobOnceAllArrived() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))

        finish(coordinator, "a.pmtiles", 200, "a")
        XCTAssertTrue(events.finishedStates.isEmpty)
        finish(coordinator, "b.pmtiles", 200, "b")

        XCTAssertEqual(directories.readOfflineFile("a.pmtiles"), "a")
        XCTAssertEqual(directories.readOfflineFile("b.pmtiles"), "b")
        XCTAssertEqual(events.completedFiles, ["a.pmtiles", "b.pmtiles"])
        XCTAssertEqual(events.finishedStates, [.completed])
        XCTAssertEqual(directories.store.load()?.state, .completed)
    }

    func testShouldFailAFileOnAnHttpErrorWithoutTryingItAgainAndStillDownloadTheOthers() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))

        finish(coordinator, "a.pmtiles", 404, "not found")
        finish(coordinator, "b.pmtiles", 200, "b")

        let job = directories.store.load()!
        XCTAssertEqual(transfers.enqueuedFileNames, ["a.pmtiles", "b.pmtiles"])
        XCTAssertEqual(job.files[0].state, .failed)
        XCTAssertEqual(job.files[0].reason, "HTTP 404")
        XCTAssertEqual(job.files[1].state, .completed)
        XCTAssertNil(directories.readOfflineFile("a.pmtiles"))
        XCTAssertEqual(events.finishedStates, [.failed])
    }

    func testShouldFailTheWholeJobAtOnceWhenTheTokenIsNotAccepted() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles", "c.pmtiles"))
        let lateDescription = transfers.description(of: "b.pmtiles")

        finish(coordinator, "a.pmtiles", 401, "")
        coordinator.didFinishDownloading(description: lateDescription, statusCode: 200, location: directories.downloaded("b"))

        let job = directories.store.load()!
        XCTAssertEqual(job.state, .failed)
        XCTAssertTrue(job.files.allSatisfy { $0.state == .failed && $0.reason == "HTTP 401" })
        XCTAssertEqual(transfers.cancelledJobs, [job.id])
        XCTAssertNil(directories.readOfflineFile("b.pmtiles"))
        XCTAssertEqual(events.finishedStates, [.failed])
    }

    func testShouldTryAFileTwiceMoreOnANetworkErrorAndThenFailIt() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        for _ in 0..<3 {
            coordinator.didFail(description: transfers.description(of: "a.pmtiles"), failure: .network("connection lost"))
        }

        XCTAssertEqual(transfers.enqueuedFileNames, ["a.pmtiles", "a.pmtiles", "a.pmtiles"])
        let job = directories.store.load()!
        XCTAssertEqual(job.files[0].state, .failed)
        XCTAssertEqual(job.files[0].reason, "network error: connection lost")
        XCTAssertEqual(events.finishedStates, [.failed])
    }

    func testShouldCompleteAFileThatIsDownloadedOnItsRetry() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        coordinator.didFail(description: transfers.description(of: "a.pmtiles"), failure: .timeout("timed out"))
        finish(coordinator, "a.pmtiles", 200, "whole")

        XCTAssertEqual(transfers.enqueuedFileNames, ["a.pmtiles", "a.pmtiles"])
        XCTAssertEqual(directories.readOfflineFile("a.pmtiles"), "whole")
        XCTAssertEqual(events.finishedStates, [.completed])
    }

    func testShouldReportTheProgressOfAFileAtMostOnceEveryInterval() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))
        let description = transfers.description(of: "a.pmtiles")

        coordinator.didWriteData(description: description, totalBytesWritten: 25, totalBytesExpected: 100)
        time = time.addingTimeInterval(0.1)
        coordinator.didWriteData(description: description, totalBytesWritten: 50, totalBytesExpected: 100)
        time = time.addingTimeInterval(0.2)
        coordinator.didWriteData(description: description, totalBytesWritten: 75, totalBytesExpected: 100)

        XCTAssertEqual(events.progress.map { $0.fraction }, [0.25, 0.75])
    }

    func testShouldReportNoFractionForAFileWithoutAContentLength() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        coordinator.didWriteData(description: transfers.description(of: "a.pmtiles"), totalBytesWritten: 50, totalBytesExpected: -1)

        XCTAssertEqual(events.progress.map { $0.fraction }, [0])
    }

    func testShouldReportADiskErrorForAFileThatCanNotBeMovedToItsPlace() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        let missingLocation = directories.root.appendingPathComponent("no-such-file")
        coordinator.didFinishDownloading(description: transfers.description(of: "a.pmtiles"), statusCode: 200, location: missingLocation)

        let job = directories.store.load()!
        XCTAssertEqual(job.files[0].state, .failed)
        XCTAssertTrue(job.files[0].reason!.hasPrefix("disk error"))
    }

    func testShouldEndACancelledJobAsCancelledKeepingItsCompletedFilesAndIgnoringItsLateTransfers() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))
        finish(coordinator, "a.pmtiles", 200, "a")
        let lateDescription = transfers.description(of: "b.pmtiles")

        coordinator.cancel(tileKey: "7-76-51")
        coordinator.didFinishDownloading(description: lateDescription, statusCode: 200, location: directories.downloaded("b"))

        let job = directories.store.load()!
        XCTAssertEqual(job.state, .cancelled)
        XCTAssertEqual(transfers.cancelledJobs, [job.id])
        XCTAssertEqual(directories.readOfflineFile("a.pmtiles"), "a")
        XCTAssertNil(directories.readOfflineFile("b.pmtiles"))
        XCTAssertEqual(events.finishedStates, [.cancelled])
    }

    func testShouldLeaveTheDownloadOfAnotherTileAsItIsWhenCancelling() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        coordinator.cancel(tileKey: "7-76-52")

        XCTAssertEqual(directories.store.load()?.state, .running)
        XCTAssertTrue(transfers.cancelledJobs.isEmpty)
        XCTAssertTrue(events.finishedStates.isEmpty)
    }

    func testShouldCancelTheCurrentJobWhenAnotherOneStartsAndIgnoreItsTransfers() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))
        let firstDescription = transfers.description(of: "a.pmtiles")
        let firstJobId = TransferDescription(parsing: firstDescription)!.jobId

        coordinator.start(directories.jobOf("a.pmtiles", tileKey: "7-76-52"))
        coordinator.didFinishDownloading(description: firstDescription, statusCode: 200, location: directories.downloaded("old"))

        XCTAssertEqual(transfers.cancelledJobs, [firstJobId])
        XCTAssertEqual(events.finishedStates, [.cancelled])
        XCTAssertNil(directories.readOfflineFile("a.pmtiles"))
        XCTAssertEqual(directories.store.load()?.tileKey, "7-76-52")
    }

    func testShouldLeaveAFileTheSystemInterruptedPendingForTheNextRun() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        coordinator.didFail(description: transfers.description(of: "a.pmtiles"), failure: .interrupted)

        let job = directories.store.load()!
        XCTAssertEqual(job.state, .running)
        XCTAssertEqual(job.files[0].state, .pending)
        XCTAssertEqual(transfers.enqueuedFileNames, ["a.pmtiles"])
        XCTAssertTrue(events.finishedStates.isEmpty)
    }

    func testShouldQueueOnlyTheMissingFilesOfARunningJobThatLostItsTransfersWhenAskedAboutIt() {
        makeCoordinator().start(directories.jobOf("a.pmtiles", "b.pmtiles"))
        directories.writeOfflineFile("a.pmtiles", "a")
        transfers = FakeTransfers()
        let restarted = makeCoordinator()

        let job = get(restarted, "7-76-51")

        XCTAssertEqual(job?.state, .running)
        XCTAssertEqual(job?.files.map { $0.state }, [.completed, .pending])
        XCTAssertEqual(transfers.enqueuedFileNames, ["b.pmtiles"])
    }

    func testShouldCompleteARunningJobWhoseFilesAreAllOnDiskWhenAskedAboutIt() {
        makeCoordinator().start(directories.jobOf("a.pmtiles", "b.pmtiles"))
        directories.writeOfflineFile("a.pmtiles", "a")
        directories.writeOfflineFile("b.pmtiles", "b")
        transfers = FakeTransfers()

        let job = get(makeCoordinator(), "7-76-51")

        XCTAssertEqual(job?.state, .completed)
        XCTAssertTrue(transfers.enqueued.isEmpty)
        XCTAssertEqual(directories.store.load()?.state, .completed)
    }

    func testShouldLeaveARunningJobWhoseTransfersAreStillGoingAsItIs() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))

        let job = get(coordinator, "7-76-51")

        XCTAssertEqual(job?.state, .running)
        XCTAssertEqual(transfers.enqueuedFileNames, ["a.pmtiles", "b.pmtiles"])
    }

    func testShouldReportTheFilesOfAnEndedJobThatAreOnDiskAsCompleted() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"))
        finish(coordinator, "b.pmtiles", 500, "")
        finish(coordinator, "a.pmtiles", 200, "a")

        let job = get(coordinator, "7-76-51")

        XCTAssertEqual(job?.state, .failed)
        XCTAssertEqual(job?.files.map { $0.state }, [.completed, .failed])
    }

    func testShouldReportNoDownloadForATileThatIsNotTheOneSaved() {
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles"))

        XCTAssertNil(get(coordinator, "7-76-52"))
    }

    func testShouldHandGivenTransfersAtMostTheConcurrencyOfTheJobAndTheNextFileOnceOneEnds() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles", "c.pmtiles", "d.pmtiles", "e.pmtiles"), in: inProcess)

        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles", "c.pmtiles"])
        finish(coordinator, "b.pmtiles", 200, "b", in: inProcess)
        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles", "c.pmtiles", "d.pmtiles"])
        finish(coordinator, "a.pmtiles", 404, "not found", in: inProcess)

        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles", "c.pmtiles", "d.pmtiles", "e.pmtiles"])
        XCTAssertTrue(transfers.enqueued.isEmpty)
    }

    func testShouldRetryAFileInTheGivenTransfersWithoutHandingOverAnotherOne() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles", "c.pmtiles", "d.pmtiles"), in: inProcess)

        coordinator.didFail(description: inProcess.description(of: "b.pmtiles"), failure: .network("offline"))

        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles", "c.pmtiles", "b.pmtiles"])
        XCTAssertTrue(transfers.enqueued.isEmpty)
    }

    func testShouldCompleteAJobInTheGivenTransfersOnceAllItsFilesArrived() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        directories.writeOfflineFile("a.pmtiles", "already here")

        let started = coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"), in: inProcess)
        finish(coordinator, "b.pmtiles", 200, "b", in: inProcess)

        XCTAssertEqual(started.files.map { $0.state }, [.completed, .pending])
        XCTAssertEqual(events.finishedStates, [.completed])
    }

    func testShouldCancelTheTransfersOfAJobInTheTransfersItRunsIn() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        let started = coordinator.start(directories.jobOf("a.pmtiles"), in: inProcess)

        coordinator.cancel(tileKey: started.tileKey)

        XCTAssertEqual(inProcess.cancelledJobs, [started.id])
        XCTAssertTrue(transfers.cancelledJobs.isEmpty)
        XCTAssertEqual(events.finishedStates, [.cancelled])
    }

    func testShouldAskTheTransfersAJobRunsInWhetherItStillHasTransfers() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        let started = coordinator.start(directories.jobOf("a.pmtiles", "b.pmtiles"), in: inProcess)

        let job = get(coordinator, started.tileKey)

        XCTAssertEqual(job?.state, .running)
        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles"])
        XCTAssertTrue(transfers.enqueued.isEmpty)
    }

    func testShouldRunTheNextJobInItsOwnTransfersWhenNoneAreGiven() {
        let inProcess = FakeTransfers()
        let coordinator = makeCoordinator()
        let first = coordinator.start(directories.jobOf("a.pmtiles"), in: inProcess)

        coordinator.start(directories.jobOf("b.pmtiles", "c.pmtiles", "d.pmtiles", "e.pmtiles", tileKey: "7-76-52"))

        XCTAssertEqual(inProcess.cancelledJobs, [first.id])
        XCTAssertEqual(transfers.enqueuedFileNames, ["b.pmtiles", "c.pmtiles", "d.pmtiles", "e.pmtiles"])
    }

    private func makeCoordinator() -> TileDownloadCoordinator {
        let coordinator = TileDownloadCoordinator(store: directories.store, transfers: transfers, now: { self.time })
        coordinator.addListener(events)
        return coordinator
    }

    /// Plays the URL session finishing the last transfer of a file with the given status and body
    private func finish(_ coordinator: TileDownloadCoordinator, _ fileName: String, _ statusCode: Int, _ content: String,
                        in fake: FakeTransfers? = nil) {
        coordinator.didFinishDownloading(description: (fake ?? transfers).description(of: fileName), statusCode: statusCode,
                                         location: directories.downloaded(content))
    }

    private func get(_ coordinator: TileDownloadCoordinator, _ tileKey: String) -> TileDownloadJob? {
        var result: TileDownloadJob?
        coordinator.get(tileKey: tileKey) { result = $0 }
        return result
    }
}
