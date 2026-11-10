import Foundation
import XCTest
@testable import OfflineDownload

final class TileDownloadJobStoreTests: XCTestCase {
    private var directories: TestDirectories!

    override func setUp() {
        directories = TestDirectories()
    }

    override func tearDown() {
        directories.remove()
    }

    func testShouldLoadTheJobAsItWasSaved() throws {
        var job = directories.jobOf("a.pmtiles", "b.pmtiles", headers: ["Authorization": "Bearer token"])
        job.files[1].state = .failed
        job.files[1].reason = "HTTP 500"
        job.files[1].retries = 2
        job.state = .failed

        try directories.store.save(job)
        let loaded = try XCTUnwrap(directories.store.load())

        XCTAssertEqual(loaded.id, job.id)
        XCTAssertEqual(loaded.tileKey, job.tileKey)
        XCTAssertEqual(loaded.files, job.files)
        XCTAssertEqual(loaded.headers, ["Authorization": "Bearer token"])
        XCTAssertEqual(loaded.concurrency, 3)
        XCTAssertEqual(loaded.directory, job.directory)
        XCTAssertEqual(loaded.state, .failed)
    }

    func testShouldMoveTheDirectoryOfASavedJobUnderTheHomeTheAppHasNow() throws {
        let storeDirectory = directories.root.appendingPathComponent("store", isDirectory: true)
        let job = TileDownloadJob(tileKey: "7-76-51", files: [], headers: [:], concurrency: 3,
                                  directory: URL(fileURLWithPath: "/containers/old/Library/Caches/offline-files", isDirectory: true))

        try TileDownloadJobStore(directory: storeDirectory, home: "/containers/old").save(job)
        let loaded = try XCTUnwrap(TileDownloadJobStore(directory: storeDirectory, home: "/containers/new").load())

        XCTAssertEqual(loaded.directory.path, "/containers/new/Library/Caches/offline-files")
        XCTAssertEqual(loaded.id, job.id)
    }

    func testShouldKeepTheDirectoryOfASavedJobThatIsNotUnderTheHomeItWasSavedWith() throws {
        let storeDirectory = directories.root.appendingPathComponent("store", isDirectory: true)
        let job = directories.jobOf("a.pmtiles")

        try TileDownloadJobStore(directory: storeDirectory, home: "/containers/old").save(job)
        let loaded = try XCTUnwrap(TileDownloadJobStore(directory: storeDirectory, home: "/containers/new").load())

        XCTAssertEqual(loaded.directory, job.directory)
    }

    func testShouldLoadNothingWhenNoJobWasSaved() {
        XCTAssertNil(directories.store.load())
    }

    func testShouldLoadNothingFromAFileThatCanNotBeRead() throws {
        let storeDirectory = directories.root.appendingPathComponent("store", isDirectory: true)
        try FileManager.default.createDirectory(at: storeDirectory, withIntermediateDirectories: true)
        try Data("{ not json".utf8).write(to: storeDirectory.appendingPathComponent("offline-download-job.json"))

        XCTAssertNil(directories.store.load())
    }
}
