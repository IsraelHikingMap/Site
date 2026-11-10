import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The transfers of a tile download, which the background URL session runs in the app and a test runs itself.
/// Every transfer carries a description, which comes back with every event of it.
public protocol TileTransfers: AnyObject {
    func enqueue(_ request: URLRequest, description: String)
    /// Cancels the transfers of a job, whose events are ignored from then on anyway
    func cancelTransfers(ofJob jobId: String)
    /// The descriptions of the transfers the system still has, queued or running
    func activeDescriptions(_ completion: @escaping ([String]) -> Void)
}

/// What a tile download reports, see TileDownloadCoordinator.addListener
public protocol TileDownloadListener: AnyObject {
    func fileProgress(tileKey: String, fileName: String, fraction: Double)
    func fileCompleted(tileKey: String, fileName: String)
    func tileFinished(_ job: TileDownloadJob)
}

/// Why a transfer failed, as the URL session tells it. A transfer the system cancelled since the user force-quit
/// the app fails its file at once, while one it cancelled for any other reason leaves its file pending, which the
/// next time the app asks about the job fails as interrupted unless the system still has transfers of it.
public enum TileTransferFailure {
    case network(String)
    case timeout(String)
    case forceQuit
    case interrupted
}

/// Turns the events of the transfers of a tile download into the state of its files and of the job, and
/// moves every file to its place as soon as it arrives. All its methods run one at a time on a queue of its
/// own, since the session's events and the plugin's calls come from different threads.
public final class TileDownloadCoordinator {
    private static let maxRetries = 2

    private let store: TileDownloadJobStore
    private weak var transfers: TileTransfers?
    private let fileManager: FileManager
    private let now: () -> Date
    private let progressInterval: TimeInterval
    private let queue = DispatchQueue(label: "com.mapeak.offline-download")
    private var job: TileDownloadJob?
    /// The transfers the job runs in when they are not the coordinator's own, see start
    private weak var jobTransfers: TileTransfers?
    /// Whether the app is in the foreground, see appDidBecomeActive
    private var isActive = false
    /// The names of the files whose transfers were handed over and did not end yet
    private var inFlight: Set<String> = []
    private var lastProgress: [String: Date] = [:]
    private var listeners: [WeakListener] = []

    /// The clock and the interval are only given by tests, which decide when time passes themselves.
    public init(store: TileDownloadJobStore, transfers: TileTransfers, fileManager: FileManager = .default,
                now: @escaping () -> Date = Date.init, progressInterval: TimeInterval = 0.25) {
        self.store = store
        self.transfers = transfers
        self.fileManager = fileManager
        self.now = now
        self.progressInterval = progressInterval
        job = store.load()
        if let loaded = job, loaded.state == .running {
            inFlight = Set(loaded.files.filter { $0.state == .pending }.map { $0.fileName })
        }
    }

    public func addListener(_ listener: TileDownloadListener) {
        queue.sync { listeners.append(WeakListener(listener)) }
    }

    /// Saves a new download and queues the files that are still missing, in the order of the job, at most the job's
    /// concurrency of them at a time while the app is in the foreground. A download that is going on is cancelled
    /// first. Transfers that are given run the job instead of the coordinator's own, and get at most the job's
    /// concurrency of files at a time in the background too. Returns the job as it started.
    @discardableResult
    public func start(_ newJob: TileDownloadJob, in transfers: TileTransfers? = nil) -> TileDownloadJob {
        queue.sync {
            if let current = job, current.state == .running {
                end(current, as: .cancelled)
            }
            var started = newJob
            started.markFilesFoundOnDisk(fileManager)
            job = started
            jobTransfers = transfers
            inFlight = []
            save(started)
            if !finishIfDone() {
                enqueuePending()
            }
            return job ?? started
        }
    }

    /// Stops the transfers of a tile and marks it cancelled. The files that already completed are kept, and
    /// there is nothing partial to delete - a file is only moved to its place once all of it arrived.
    public func cancel(tileKey: String) {
        queue.sync {
            guard let current = job, current.tileKey == tileKey, current.state == .running else {
                return
            }
            end(current, as: .cancelled)
        }
    }

    /// The download of a tile as it stands, nil when there is none. A running download that the system has no
    /// transfers of anymore, since the app was force-quit or its process ended, is completed when all its files
    /// are on disk and fails with the files that are still missing as interrupted otherwise, without starting
    /// anything: the user decides whether to download the tile again.
    public func get(tileKey: String, completion: @escaping (TileDownloadJob?) -> Void) {
        guard let transfers = queue.sync(execute: { activeTransfers }) else {
            completion(nil)
            return
        }
        transfers.activeDescriptions { descriptions in
            completion(self.queue.sync { self.resume(tileKey: tileKey, activeDescriptions: descriptions) })
        }
    }

    private func resume(tileKey: String, activeDescriptions: [String]) -> TileDownloadJob? {
        guard var current = job, current.tileKey == tileKey else {
            return nil
        }
        current.markFilesFoundOnDisk(fileManager)
        job = current
        let hasTransfers = activeDescriptions.contains { TransferDescription(parsing: $0)?.jobId == current.id }
        guard current.state == .running, !hasTransfers else {
            return current
        }
        save(current)
        if !finishIfDone() {
            for index in current.files.indices where current.files[index].state == .pending {
                job?.files[index].state = .failed
                job?.files[index].reason = "interrupted"
            }
            if let interrupted = job {
                end(interrupted, as: .failed)
            }
        }
        return job
    }

    /// The app came to the foreground, where the background session starts every transfer it is handed at once,
    /// so the files that have no transfer yet are handed over a few at a time, in the order of the job.
    public func appDidBecomeActive() {
        queue.sync {
            isActive = true
            enqueuePending()
        }
    }

    /// The app is about to leave the foreground: every file that is still queued is handed over at once, so that
    /// the system holds the whole tile before the app is suspended.
    public func appWillResignActive() {
        queue.sync {
            isActive = false
            enqueuePending()
        }
    }

    public func didWriteData(description: String, totalBytesWritten: Int64, totalBytesExpected: Int64) {
        queue.sync {
            guard let (current, index) = runningFile(description) else {
                return
            }
            let fileName = current.files[index].fileName
            let time = now()
            if let last = lastProgress[fileName], time.timeIntervalSince(last) < progressInterval {
                return
            }
            lastProgress[fileName] = time
            let fraction = totalBytesExpected > 0 ? min(1, Double(totalBytesWritten) / Double(totalBytesExpected)) : 0
            notify { $0.fileProgress(tileKey: current.tileKey, fileName: fileName, fraction: fraction) }
        }
    }

    /// Takes a file the session finished downloading. It is moved to its place before this returns, since the
    /// session deletes it once its delegate method returns. A file the server answered with an error status is
    /// not the file, and a rejected token fails the whole job, there is no point asking for any other file with it.
    public func didFinishDownloading(description: String, statusCode: Int?, location: URL) {
        queue.sync {
            guard let (current, index) = runningFile(description) else {
                return
            }
            let status = statusCode ?? 0
            if status == 401 || status == 403 {
                reject(current, reason: "HTTP \(status)")
                return
            }
            guard (200..<300).contains(status) else {
                fail(index, reason: "HTTP \(status)")
                return
            }
            do {
                try place(location, as: current.files[index].fileName, in: current.directory)
            } catch {
                fail(index, reason: TileDownloadCoordinator.diskReason(error))
                return
            }
            job?.files[index].state = .completed
            job?.files[index].reason = nil
            inFlight.remove(current.files[index].fileName)
            saveCurrent()
            notify { $0.fileCompleted(tileKey: current.tileKey, fileName: current.files[index].fileName) }
            if !finishIfDone() {
                enqueuePending()
            }
        }
    }

    /// Takes a transfer that failed, trying it again on a network error up to maxRetries times.
    public func didFail(description: String, failure: TileTransferFailure) {
        queue.sync {
            guard let (current, index) = runningFile(description) else {
                return
            }
            let reason: String
            switch failure {
            case .interrupted:
                return
            case .forceQuit:
                fail(index, reason: "force-quit")
                return
            case .network(let message):
                reason = "network error: \(message)"
            case .timeout(let message):
                reason = "timeout: \(message)"
            }
            guard current.files[index].retries < TileDownloadCoordinator.maxRetries else {
                fail(index, reason: reason)
                return
            }
            job?.files[index].retries += 1
            inFlight.remove(current.files[index].fileName)
            saveCurrent()
            enqueuePending()
        }
    }

    private func place(_ location: URL, as fileName: String, in directory: URL) throws {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let target = directory.appendingPathComponent(fileName)
        if fileManager.fileExists(atPath: target.path) {
            try fileManager.removeItem(at: target)
        }
        try fileManager.moveItem(at: location, to: target)
    }

    private static func diskReason(_ error: Error) -> String {
        if (error as? CocoaError)?.code == .fileWriteOutOfSpace {
            return "disk full: \(error.localizedDescription)"
        }
        return "disk error: \(error.localizedDescription)"
    }

    /// The running job and the index of the file a transfer belongs to, nil for a transfer of any other job
    private func runningFile(_ description: String) -> (TileDownloadJob, Int)? {
        guard let parsed = TransferDescription(parsing: description), let current = job,
              current.state == .running, current.id == parsed.jobId,
              let index = current.files.firstIndex(where: { $0.fileName == parsed.fileName && $0.state == .pending }) else {
            return nil
        }
        return (current, index)
    }

    private var activeTransfers: TileTransfers? {
        jobTransfers ?? transfers
    }

    /// How many files are handed over at a time, nil when all of them are
    private var limit: Int? {
        guard let current = job, jobTransfers != nil || isActive else {
            return nil
        }
        return max(1, current.concurrency)
    }

    /// Hands over the pending files that are not in flight yet, in the order of the job, as many as the limit allows
    private func enqueuePending() {
        guard let current = job, current.state == .running else {
            return
        }
        for file in current.files where file.state == .pending && !inFlight.contains(file.fileName) {
            if let limit = limit, inFlight.count >= limit {
                return
            }
            inFlight.insert(file.fileName)
            enqueue(file, of: current)
        }
    }

    private func enqueue(_ file: TileDownloadFile, of job: TileDownloadJob) {
        guard let url = URL(string: file.url) else {
            return
        }
        var request = URLRequest(url: url)
        job.headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        activeTransfers?.enqueue(request, description: TransferDescription(jobId: job.id, tileKey: job.tileKey, fileName: file.fileName).text)
    }

    private func fail(_ index: Int, reason: String) {
        job?.files[index].state = .failed
        job?.files[index].reason = reason
        if let fileName = job?.files[index].fileName {
            inFlight.remove(fileName)
        }
        saveCurrent()
        if !finishIfDone() {
            enqueuePending()
        }
    }

    /// Fails every file that is not whole yet with the reason the token was rejected, and stops the rest.
    private func reject(_ current: TileDownloadJob, reason: String) {
        for index in current.files.indices where current.files[index].state != .completed {
            job?.files[index].state = .failed
            job?.files[index].reason = reason
        }
        if let rejected = job {
            end(rejected, as: .failed)
        }
    }

    /// Ends the job once no file is pending: completed when every file is whole, and failed otherwise
    private func finishIfDone() -> Bool {
        guard let current = job, current.state == .running, !current.files.contains(where: { $0.state == .pending }) else {
            return false
        }
        end(current, as: current.files.allSatisfy { $0.state == .completed } ? .completed : .failed)
        return true
    }

    private func end(_ ended: TileDownloadJob, as state: TileDownloadState) {
        var finished = ended
        finished.state = state
        job = finished
        save(finished)
        activeTransfers?.cancelTransfers(ofJob: finished.id)
        inFlight = []
        lastProgress = [:]
        notify { $0.tileFinished(finished) }
    }

    private func saveCurrent() {
        if let current = job {
            save(current)
        }
    }

    private func save(_ job: TileDownloadJob) {
        try? store.save(job)
    }

    private func notify(_ event: (TileDownloadListener) -> Void) {
        listeners.removeAll { $0.listener == nil }
        listeners.compactMap { $0.listener }.forEach(event)
    }
}

/// The description a transfer carries: the job, the tile and the file it is of.
struct TransferDescription {
    let jobId: String
    let tileKey: String
    let fileName: String

    init(jobId: String, tileKey: String, fileName: String) {
        self.jobId = jobId
        self.tileKey = tileKey
        self.fileName = fileName
    }

    init?(parsing text: String) {
        let parts = text.split(separator: "/", maxSplits: 2).map(String.init)
        guard parts.count == 3 else {
            return nil
        }
        self.init(jobId: parts[0], tileKey: parts[1], fileName: parts[2])
    }

    var text: String {
        "\(jobId)/\(tileKey)/\(fileName)"
    }
}

private final class WeakListener {
    weak var listener: TileDownloadListener?

    init(_ listener: TileDownloadListener) {
        self.listener = listener
    }
}
