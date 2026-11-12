import Capacitor
import Foundation
import OfflineDownload

/// Downloads the offline files of an area to completion while the app is in the background, mirroring
/// `OfflineDownloadPlugin.kt`. The files are written to the directory the app passes, where it already reads
/// them from, and the app moves them once the whole area arrived.
///
/// The saved job is the source of truth for whatever the app missed while it was not listening, the events
/// are only what it hears while it is.
@objc(OfflineDownloadPlugin)
public class OfflineDownloadPlugin: CAPPlugin, CAPBridgedPlugin, AreaDownloadListener {
    public let identifier = "OfflineDownloadPlugin"
    public let jsName = "OfflineDownload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startAreaDownload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAreaDownload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAreaDownload", returnType: CAPPluginReturnPromise)
    ]

    private static let defaultConcurrency = 3

    private var coordinator: AreaDownloadCoordinator {
        OfflineDownloadManager.shared.coordinator
    }

    override public func load() {
        coordinator.addListener(self)
        OfflineDownloadManager.shared.log = { [weak self] message in
            self?.notify("diagnostic", ["message": message])
        }
    }

    @objc func startAreaDownload(_ call: CAPPluginCall) {
        guard let areaId = call.getString("areaId"), !areaId.isEmpty else {
            call.reject("areaId is required")
            return
        }
        guard let files = call.getArray("files", JSObject.self) else {
            call.reject("files is required")
            return
        }
        guard let directoryUri = call.getString("directory"), let directory = URL(string: directoryUri), directory.isFileURL else {
            call.reject("directory is required, as a file URI")
            return
        }
        let downloadFiles = files.compactMap { file -> AreaDownloadFile? in
            guard let fileName = file["fileName"] as? String, let url = file["url"] as? String else {
                return nil
            }
            return AreaDownloadFile(fileName: fileName, url: url)
        }
        guard downloadFiles.count == files.count,
              !downloadFiles.contains(where: { $0.fileName.isEmpty || $0.fileName.contains("/") || $0.fileName.hasPrefix(".") }) else {
            call.reject("Every file needs a plain file name and a url")
            return
        }
        let headers = (call.getObject("headers") ?? [:]).compactMapValues { $0 as? String }
        let job = AreaDownloadJob(
            areaId: areaId,
            files: downloadFiles,
            headers: headers,
            concurrency: call.getInt("concurrency") ?? OfflineDownloadPlugin.defaultConcurrency,
            directory: directory
        )
        if #available(iOS 26.0, *), let title = call.getString("title"), let subtitle = call.getString("subtitle") {
            OfflineDownloadManager.shared.startContinued(job, title: title, subtitle: subtitle) { background, launchDelay in
                var result: JSObject = ["background": background]
                if let launchDelay = launchDelay {
                    result["launchDelay"] = Int((launchDelay * 1000).rounded())
                }
                call.resolve(result)
            }
            return
        }
        coordinator.start(job)
        call.resolve(["background": false])
    }

    @objc func cancelAreaDownload(_ call: CAPPluginCall) {
        guard let areaId = call.getString("areaId"), !areaId.isEmpty else {
            call.reject("areaId is required")
            return
        }
        coordinator.cancel(areaId: areaId)
        call.resolve()
    }

    @objc func getAreaDownload(_ call: CAPPluginCall) {
        guard let areaId = call.getString("areaId"), !areaId.isEmpty else {
            call.reject("areaId is required")
            return
        }
        coordinator.get(areaId: areaId) { job in
            guard let job = job else {
                call.resolve(["state": "none", "completedFiles": [String](), "failedFiles": [[String: Any]]()])
                return
            }
            call.resolve(OfflineDownloadPlugin.result(of: job))
        }
    }

    public func fileProgress(areaId: String, fileName: String, fraction: Double) {
        notify("fileProgress", ["areaId": areaId, "fileName": fileName, "fraction": fraction])
    }

    public func fileCompleted(areaId: String, fileName: String) {
        notify("fileCompleted", ["areaId": areaId, "fileName": fileName])
    }

    public func areaFinished(_ job: AreaDownloadJob) {
        var data = OfflineDownloadPlugin.result(of: job)
        data["areaId"] = job.areaId
        data.removeValue(forKey: "completedFiles")
        notify("areaFinished", data)
    }

    private func notify(_ eventName: String, _ data: [String: Any]) {
        DispatchQueue.main.async {
            self.notifyListeners(eventName, data: data)
        }
    }

    private static func result(of job: AreaDownloadJob) -> [String: Any] {
        [
            "state": job.state.rawValue,
            "completedFiles": job.files.filter { $0.state == .completed }.map { $0.fileName },
            "failedFiles": job.files.filter { $0.state == .failed }.map { ["fileName": $0.fileName, "reason": $0.reason ?? ""] }
        ]
    }
}
