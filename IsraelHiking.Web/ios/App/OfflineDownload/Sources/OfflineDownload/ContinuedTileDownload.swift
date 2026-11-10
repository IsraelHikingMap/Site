import Foundation

/// The task that keeps the app running in the background while a download goes on and shows its progress to the
/// user, which is a BGContinuedProcessingTask in the app and one a test runs itself.
public protocol ContinuedTask: AnyObject {
    var progress: Progress { get }
    /// Sets what is done when the system or the user stops the task before the download ended
    func setExpirationHandler(_ handler: @escaping () -> Void)
    func setTaskCompleted(success: Bool)
}

/// Starts a tile download in a continued task, where it runs in transfers of the app's own process, and in the
/// coordinator's background session when the system does not launch the task within the timeout. The task follows
/// the job: it shows how much of the files arrived, ends with the job, and cancels the job when it is stopped.
public final class ContinuedTileDownload: TileDownloadListener {
    /// How many units of the task's progress a file is, so that a file that is part way through moves it
    public static let unitsPerFile: Int64 = 1000

    /// Registers the launch handler and submits the task, returning whether the submission succeeded
    public typealias Submit = (_ launchHandler: @escaping (ContinuedTask) -> Void) -> Bool
    /// Runs the given block once the given number of seconds passed
    public typealias Schedule = (_ delay: TimeInterval, _ block: @escaping () -> Void) -> Void

    private let coordinator: TileDownloadCoordinator
    private let transfers: TileTransfers
    private let timeout: TimeInterval
    private let now: () -> Date
    private let schedule: Schedule
    private let lock = NSLock()
    private var active: ActiveTask?

    /// The clock and the scheduling are only given by tests, which decide when time passes themselves.
    public init(coordinator: TileDownloadCoordinator, transfers: TileTransfers, timeout: TimeInterval = 3,
                now: @escaping () -> Date = Date.init,
                schedule: @escaping Schedule = { DispatchQueue.global().asyncAfter(deadline: .now() + $0, execute: DispatchWorkItem(block: $1)) }) {
        self.coordinator = coordinator
        self.transfers = transfers
        self.timeout = timeout
        self.now = now
        self.schedule = schedule
        coordinator.addListener(self)
    }

    /// Submits a continued task for the job and starts the job once the system launched it, or in the background
    /// session once the submission failed or the timeout passed. The completion tells whether the job runs in the
    /// task, and how long the system took to launch it. A task launched after the timeout is ended at once.
    public func start(_ job: TileDownloadJob, submit: Submit, completion: @escaping (_ background: Bool, _ launchDelay: TimeInterval?) -> Void) {
        let decision = Decision()
        let submittedAt = now()
        let submitted = submit { task in
            guard decision.take(self.lock) else {
                task.setTaskCompleted(success: false)
                return
            }
            self.run(job, in: task)
            completion(true, self.now().timeIntervalSince(submittedAt))
        }
        let fallBack = {
            guard decision.take(self.lock) else {
                return
            }
            self.coordinator.start(job)
            completion(false, nil)
        }
        guard submitted else {
            fallBack()
            return
        }
        schedule(timeout, fallBack)
    }

    private func run(_ job: TileDownloadJob, in task: ContinuedTask) {
        task.progress.totalUnitCount = Int64(job.files.count) * ContinuedTileDownload.unitsPerFile
        task.setExpirationHandler { [weak self] in
            self?.coordinator.cancel(tileKey: job.tileKey)
        }
        let previous = withLock { () -> ContinuedTask? in
            let previous = active?.task
            active = ActiveTask(task: task, jobId: job.id, tileKey: job.tileKey)
            return previous
        }
        previous?.setTaskCompleted(success: false)
        let started = coordinator.start(job, in: transfers)
        withLock {
            guard active?.jobId == job.id else {
                return
            }
            started.files.filter { $0.state == .completed }.forEach { active?.completedFiles.insert($0.fileName) }
            updateProgress()
        }
    }

    public func fileProgress(tileKey: String, fileName: String, fraction: Double) {
        withLock {
            guard active?.tileKey == tileKey else {
                return
            }
            active?.fractions[fileName] = fraction
            updateProgress()
        }
    }

    public func fileCompleted(tileKey: String, fileName: String) {
        withLock {
            guard active?.tileKey == tileKey else {
                return
            }
            active?.fractions.removeValue(forKey: fileName)
            active?.completedFiles.insert(fileName)
            updateProgress()
        }
    }

    public func tileFinished(_ job: TileDownloadJob) {
        let task = withLock { () -> ContinuedTask? in
            guard let current = active, current.jobId == job.id else {
                return nil
            }
            active = nil
            return current.task
        }
        task?.setTaskCompleted(success: job.state == .completed)
    }

    private func updateProgress() {
        guard let current = active else {
            return
        }
        let partial = current.fractions.values.reduce(0, +) * Double(ContinuedTileDownload.unitsPerFile)
        current.task.progress.completedUnitCount = Int64(current.completedFiles.count) * ContinuedTileDownload.unitsPerFile + Int64(partial)
    }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}

/// The task a job runs in, with what arrived of its files so far
private struct ActiveTask {
    let task: ContinuedTask
    let jobId: String
    let tileKey: String
    var completedFiles: Set<String> = []
    var fractions: [String: Double] = [:]
}

/// Which of the launch handler and the fallback came first, only that one goes on
private final class Decision {
    private var taken = false

    func take(_ lock: NSLock) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let first = !taken
        taken = true
        return first
    }
}
