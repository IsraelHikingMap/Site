import Capacitor
import UIKit

/**
 * Window scene delegate for the iPhone UI. Adding any CarPlay scene moves the whole app onto the
 * UIScene lifecycle, so the phone window must be created here instead of by the AppDelegate, and the
 * deep-link / universal-link / file-open callbacks that used to land in AppDelegate must be
 * forwarded to Capacitor's `ApplicationDelegateProxy` from the scene callbacks below.
 */
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    /// Builds the window and registers the app-local bridge plugins in code, the way MainActivity does on
    /// android. They aren't npm packages, so they never land in capacitor.config.json's packageClassList
    /// (which `npx cap sync` regenerates), and Capacitor iOS only registers plugins from that list -
    /// without this, JS sees them as not implemented on ios. They are registered after makeKeyAndVisible(),
    /// which has loaded the bridge view, so its bridge exists.
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let rootViewController = storyboard.instantiateInitialViewController()
        window.rootViewController = rootViewController
        self.window = window
        window.makeKeyAndVisible()

        if let bridgeViewController = rootViewController as? CAPBridgeViewController {
            bridgeViewController.bridge?.registerPluginInstance(ReactivePreferencesPlugin())
            bridgeViewController.bridge?.registerPluginInstance(ValhallaPlugin())
        }

        if let urlContext = connectionOptions.urlContexts.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: urlContext.url, options: [:])
        }
        if let userActivity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, continue: userActivity) { _ in }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let urlContext = URLContexts.first else { return }
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, open: urlContext.url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: userActivity) { _ in }
    }
}
