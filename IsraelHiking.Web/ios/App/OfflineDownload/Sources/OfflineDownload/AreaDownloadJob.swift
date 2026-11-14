import Foundation

/// Where an area download got to, named the way the app reads it.
public enum AreaDownloadState: String, Codable {
    case running
    case completed
    case failed
    case cancelled
}

/// Where a single file of an area download got to.
public enum AreaDownloadFileState: String, Codable {
    case pending
    case completed
    case failed
}

/// A file of an area download and how far it got, the reason is set only once the file failed.
public struct AreaDownloadFile: Codable, Equatable {
    public let fileName: String
    public let url: String
    public var state: AreaDownloadFileState
    public var reason: String?
    /// How many times the file was tried again after a network error
    public var retries: Int

    public init(fileName: String, url: String, state: AreaDownloadFileState = .pending, reason: String? = nil, retries: Int = 0) {
        self.fileName = fileName
        self.url = url
        self.state = state
        self.reason = reason
        self.retries = retries
    }
}

/// The download of the files of one area, as one job. It is kept in a file of its own so that an app that
/// was relaunched or restarted can still report it and continue the files that are still missing - it is the
/// source of truth, while whatever is held in memory is only a copy of it.
/// Every job has an id of its own, so that the events of the transfers of a job that was replaced, even one
/// of the same area, are told apart from those of the job that took its place.
public struct AreaDownloadJob: Codable {
    public let id: String
    public let areaId: String
    public var files: [AreaDownloadFile]
    public let headers: [String: String]
    public let concurrency: Int
    /// Where the files are written, the directory the app reads them from
    public let directory: URL
    public var state: AreaDownloadState

    public init(id: String = UUID().uuidString, areaId: String, files: [AreaDownloadFile], headers: [String: String],
                concurrency: Int, directory: URL, state: AreaDownloadState = .running) {
        self.id = id
        self.areaId = areaId
        self.files = files
        self.headers = headers
        self.concurrency = concurrency
        self.directory = directory
        self.state = state
    }

    /// Marks the files that are already whole in the directory as completed, they are only given their name
    /// once they were downloaded to their end.
    mutating func markFilesFoundOnDisk(_ fileManager: FileManager) {
        for index in files.indices where files[index].state != .completed {
            if fileManager.fileExists(atPath: directory.appendingPathComponent(files[index].fileName).path) {
                files[index].state = .completed
                files[index].reason = nil
            }
        }
    }

    /// The job with its directory under the given home instead of the one it was saved under, since iOS may move
    /// the app's container to another path between runs.
    func moved(from savedHome: String, to home: String) -> AreaDownloadJob {
        let path = directory.path
        guard savedHome != home, path.hasPrefix(savedHome + "/") else {
            return self
        }
        return AreaDownloadJob(id: id, areaId: areaId, files: files, headers: headers, concurrency: concurrency,
                               directory: URL(fileURLWithPath: home + path.dropFirst(savedHome.count), isDirectory: true),
                               state: state)
    }
}

/// Keeps the one area download there is in a json file, written atomically so that an app that is killed
/// while writing it never leaves a file that can not be read. The app's home directory is saved with the job,
/// so that a job saved before iOS moved the app's container still writes its files to where the app reads them.
public final class AreaDownloadJobStore {
    private let fileURL: URL
    private let home: String

    /// The store of the app, in Application Support where the system neither purges nor shows it
    public static func applicationSupport() -> AreaDownloadJobStore {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OfflineDownload", isDirectory: true)
        return AreaDownloadJobStore(directory: directory)
    }

    public init(directory: URL, home: String = NSHomeDirectory()) {
        fileURL = directory.appendingPathComponent("offline-download-job.json")
        self.home = home
    }

    public func load() -> AreaDownloadJob? {
        guard let data = try? Data(contentsOf: fileURL), let stored = try? JSONDecoder().decode(StoredJob.self, from: data) else {
            return nil
        }
        return stored.job.moved(from: stored.home, to: home)
    }

    public func save(_ job: AreaDownloadJob) throws {
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(StoredJob(job: job, home: home)).write(to: fileURL, options: .atomic)
    }
}

/// A job as it is saved, with the home directory of the app at the time
private struct StoredJob: Codable {
    let job: AreaDownloadJob
    let home: String
}
