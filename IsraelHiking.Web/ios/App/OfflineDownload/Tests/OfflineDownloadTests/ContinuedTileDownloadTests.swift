import Foundation
import XCTest
@testable import OfflineDownload

final class ContinuedTileDownloadTests: XCTestCase {
    private var directories: TestDirectories!
    private var background: FakeTransfers!
    private var inProcess: FakeTransfers!
    private var events: RecordedEvents!
    private var coordinator: TileDownloadCoordinator!
    private var time = Date(timeIntervalSince1970: 0)
    private var scheduled: [(delay: TimeInterval, block: () -> Void)] = []
    private var results: [(background: Bool, launchDelay: TimeInterval?)] = []

    override func setUp() {
        directories = TestDirectories()
        background = FakeTransfers()
        inProcess = FakeTransfers()
        events = RecordedEvents()
        time = Date(timeIntervalSince1970: 0)
        scheduled = []
        results = []
        coordinator = TileDownloadCoordinator(store: directories.store, transfers: background, progressInterval: 0)
        coordinator.addListener(events)
    }

    override func tearDown() {
        directories.remove()
    }

    func testShouldRunTheJobInTheTaskOnceTheSystemLaunchedItWithinTheTimeout() {
        let continued = makeContinued()
        var launch: ((ContinuedTask) -> Void)?
        let task = FakeContinuedTask()

        continued.start(directories.jobOf("a.pmtiles", "b.pmtiles"), submit: { launch = $0; return true }, completion: record)
        time = time.addingTimeInterval(0.4)
        launch?(task)
        scheduled.forEach { $0.block() }

        XCTAssertEqual(scheduled.map { $0.delay }, [3])
        XCTAssertEqual(results.map { $0.background }, [true])
        XCTAssertEqual(results.first?.launchDelay ?? 0, 0.4, accuracy: 0.001)
        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "b.pmtiles"])
        XCTAssertTrue(background.enqueued.isEmpty)
        XCTAssertEqual(task.progress.totalUnitCount, 2000)
        XCTAssertNil(task.completedSuccessfully)
    }

    func testShouldRunTheJobInTheBackgroundSessionWhenTheSubmissionFailed() {
        let continued = makeContinued()

        continued.start(directories.jobOf("a.pmtiles"), submit: { _ in false }, completion: record)

        XCTAssertTrue(scheduled.isEmpty)
        XCTAssertEqual(results.map { $0.background }, [false])
        XCTAssertNil(results.first?.launchDelay)
        XCTAssertEqual(background.enqueuedFileNames, ["a.pmtiles"])
        XCTAssertTrue(inProcess.enqueued.isEmpty)
    }

    func testShouldRunTheJobInTheBackgroundSessionAndEndALateTaskAtOnceWhenTheTimeoutPassedFirst() {
        let continued = makeContinued()
        var launch: ((ContinuedTask) -> Void)?
        let task = FakeContinuedTask()

        continued.start(directories.jobOf("a.pmtiles"), submit: { launch = $0; return true }, completion: record)
        scheduled.forEach { $0.block() }
        launch?(task)

        XCTAssertEqual(results.map { $0.background }, [false])
        XCTAssertEqual(background.enqueuedFileNames, ["a.pmtiles"])
        XCTAssertTrue(inProcess.enqueued.isEmpty)
        XCTAssertEqual(task.completedSuccessfully, false)
    }

    func testShouldCancelTheJobAndEndTheTaskWhenTheTaskExpires() {
        let continued = makeContinued()
        let task = FakeContinuedTask()
        let job = directories.jobOf("a.pmtiles")
        continued.start(job, submit: { $0(task); return true }, completion: record)

        task.expirationHandler?()

        XCTAssertEqual(events.finishedStates, [.cancelled])
        XCTAssertEqual(inProcess.cancelledJobs, [job.id])
        XCTAssertEqual(task.completedSuccessfully, false)
    }

    func testShouldShowWhatArrivedOfTheFilesAsTheProgressOfTheTaskAndEndItOnceTheJobCompleted() {
        directories.writeOfflineFile("a.pmtiles", "already here")
        let continued = makeContinued()
        let task = FakeContinuedTask()
        continued.start(directories.jobOf("a.pmtiles", "b.pmtiles", "c.pmtiles"), submit: { $0(task); return true }, completion: record)

        XCTAssertEqual(task.progress.completedUnitCount, 1000)
        coordinator.didWriteData(description: inProcess.description(of: "b.pmtiles"), totalBytesWritten: 25, totalBytesExpected: 100)
        XCTAssertEqual(task.progress.completedUnitCount, 1250)
        finish("b.pmtiles", 200)
        XCTAssertEqual(task.progress.completedUnitCount, 2000)
        XCTAssertNil(task.completedSuccessfully)
        finish("c.pmtiles", 200)

        XCTAssertEqual(task.progress.completedUnitCount, 3000)
        XCTAssertEqual(task.completedSuccessfully, true)
    }

    func testShouldEndTheTaskUnsuccessfullyWhenTheJobFailed() {
        let continued = makeContinued()
        let task = FakeContinuedTask()
        continued.start(directories.jobOf("a.pmtiles"), submit: { $0(task); return true }, completion: record)

        finish("a.pmtiles", 401)

        XCTAssertEqual(events.finishedStates, [.failed])
        XCTAssertEqual(task.completedSuccessfully, false)
    }

    func testShouldEndTheTaskOfTheCurrentJobWhenAnotherDownloadStarts() {
        let continued = makeContinued()
        let first = FakeContinuedTask()
        let second = FakeContinuedTask()
        continued.start(directories.jobOf("a.pmtiles"), submit: { $0(first); return true }, completion: record)

        continued.start(directories.jobOf("a.pmtiles"), submit: { $0(second); return true }, completion: record)

        XCTAssertEqual(events.finishedStates, [.cancelled])
        XCTAssertEqual(first.completedSuccessfully, false)
        XCTAssertNil(second.completedSuccessfully)
        XCTAssertEqual(inProcess.enqueuedFileNames, ["a.pmtiles", "a.pmtiles"])
    }

    private func makeContinued() -> ContinuedTileDownload {
        ContinuedTileDownload(coordinator: coordinator, transfers: inProcess, now: { self.time },
                              schedule: { self.scheduled.append(($0, $1)) })
    }

    private func record(_ background: Bool, _ launchDelay: TimeInterval?) {
        results.append((background, launchDelay))
    }

    /// Plays the in-process URL session finishing the last transfer of a file with the given status
    private func finish(_ fileName: String, _ statusCode: Int) {
        coordinator.didFinishDownloading(description: inProcess.description(of: fileName), statusCode: statusCode,
                                         location: directories.downloaded(fileName))
    }
}

/// The continued task as a test runs it: it records how it was ended, and the test plays the system's part.
final class FakeContinuedTask: ContinuedTask {
    let progress = Progress(totalUnitCount: 0)
    var expirationHandler: (() -> Void)?
    var completedSuccessfully: Bool?

    func setExpirationHandler(_ handler: @escaping () -> Void) {
        expirationHandler = handler
    }

    func setTaskCompleted(success: Bool) {
        completedSuccessfully = success
    }
}
