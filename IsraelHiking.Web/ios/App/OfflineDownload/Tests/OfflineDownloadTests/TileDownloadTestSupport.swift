import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import OfflineDownload

/// The transfers as a test runs them: it records what it was asked, and the test plays the URL session's part.
final class FakeTransfers: TileTransfers {
    var enqueued: [(request: URLRequest, description: String)] = []
    var cancelledJobs: [String] = []
    var active: [String] = []

    func enqueue(_ request: URLRequest, description: String) {
        enqueued.append((request, description))
        active.append(description)
    }

    func cancelTransfers(ofJob jobId: String) {
        cancelledJobs.append(jobId)
        active.removeAll { $0.hasPrefix("\(jobId)/") }
    }

    func activeDescriptions(_ completion: @escaping ([String]) -> Void) {
        completion(active)
    }

    /// The names of the files that were queued, in the order they were
    var enqueuedFileNames: [String] {
        enqueued.compactMap { TransferDescription(parsing: $0.description)?.fileName }
    }

    /// The description of the last transfer of a file, the one whose events a test sends
    func description(of fileName: String) -> String {
        enqueued.last { TransferDescription(parsing: $0.description)?.fileName == fileName }!.description
    }
}

/// Records what the coordinator reports, the way the plugin hears it
final class RecordedEvents: TileDownloadListener {
    var progress: [(fileName: String, fraction: Double)] = []
    var completedFiles: [String] = []
    var finishedStates: [TileDownloadState] = []

    func fileProgress(tileKey: String, fileName: String, fraction: Double) {
        progress.append((fileName, fraction))
    }

    func fileCompleted(tileKey: String, fileName: String) {
        completedFiles.append(fileName)
    }

    func tileFinished(_ job: TileDownloadJob) {
        finishedStates.append(job.state)
    }
}

/// A directory of its own for every test, holding both the downloaded files and the saved job
final class TestDirectories {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    var offlineFiles: URL { root.appendingPathComponent("offline-files", isDirectory: true) }
    var store: TileDownloadJobStore { TileDownloadJobStore(directory: root.appendingPathComponent("store", isDirectory: true)) }

    func remove() {
        try? FileManager.default.removeItem(at: root)
    }

    /// A file the URL session downloaded to a temporary location of its own
    func downloaded(_ content: String) -> URL {
        let location = root.appendingPathComponent("tmp-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        _ = FileManager.default.createFile(atPath: location.path, contents: Data(content.utf8))
        return location
    }

    func writeOfflineFile(_ fileName: String, _ content: String) {
        try? FileManager.default.createDirectory(at: offlineFiles, withIntermediateDirectories: true)
        _ = FileManager.default.createFile(atPath: offlineFiles.appendingPathComponent(fileName).path, contents: Data(content.utf8))
    }

    func readOfflineFile(_ fileName: String) -> String? {
        guard let data = FileManager.default.contents(atPath: offlineFiles.appendingPathComponent(fileName).path) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func jobOf(_ fileNames: String..., tileKey: String = "7-76-51", headers: [String: String] = [:]) -> TileDownloadJob {
        TileDownloadJob(
            tileKey: tileKey,
            files: fileNames.map { TileDownloadFile(fileName: $0, url: "https://mapeak.test/offline/\($0)") },
            headers: headers,
            concurrency: 3,
            directory: offlineFiles
        )
    }
}
