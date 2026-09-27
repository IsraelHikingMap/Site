import Foundation
import UIKit

/// The maneuver artwork SF Symbols has no glyph for. Ported from `ic_maneuver_roundabout.xml` so the
/// two platforms draw the same roundabout, on the same 24pt grid, and the exit number goes into the
/// hollow middle the way `CarNavigation.roundaboutIcon` puts it there on Android.
enum CarManeuverIcons {

    private static let sidePixels = 96.0
    private static let viewportPoints = 24.0
    private static let strokeWidth = 2.0
    private static let exitTextRatio = 0.40

    /// A direction-neutral roundabout: a hollow ring with the road entering from the bottom and exits
    /// to the left, top and right, carrying `exitNumber` in the middle when there is one to show.
    /// Comes back already white, so the dark guidance card must not tint it again.
    static func roundabout(exitNumber: Int?) -> UIImage? {
        let scale = sidePixels / viewportPoints
        let size = CGSize(width: sidePixels, height: sidePixels)
        let image = UIGraphicsImageRenderer(size: size).image { context in
            let canvas = context.cgContext
            canvas.scaleBy(x: scale, y: scale)
            UIColor.white.setStroke()
            UIColor.white.setFill()

            let ring = UIBezierPath(arcCenter: CGPoint(x: 12, y: 12), radius: 7,
                                    startAngle: 0, endAngle: .pi * 2, clockwise: true)
            ring.lineWidth = strokeWidth
            ring.stroke()

            stroke(from: CGPoint(x: 12, y: 23), to: CGPoint(x: 12, y: 19.5), rounded: true)
            stroke(from: CGPoint(x: 12, y: 4.5), to: CGPoint(x: 12, y: 2.4))
            fill([CGPoint(x: 12, y: 0.8), CGPoint(x: 14.4, y: 3.2), CGPoint(x: 9.6, y: 3.2)])
            stroke(from: CGPoint(x: 4.5, y: 12), to: CGPoint(x: 2.4, y: 12))
            fill([CGPoint(x: 0.8, y: 12), CGPoint(x: 3.2, y: 9.6), CGPoint(x: 3.2, y: 14.4)])
            stroke(from: CGPoint(x: 19.5, y: 12), to: CGPoint(x: 21.6, y: 12))
            fill([CGPoint(x: 23.2, y: 12), CGPoint(x: 20.8, y: 9.6), CGPoint(x: 20.8, y: 14.4)])

            canvas.scaleBy(x: 1 / scale, y: 1 / scale)
            if let exitNumber = exitNumber {
                draw("\(exitNumber)", in: size)
            }
        }
        return image.withRenderingMode(.alwaysOriginal)
    }

    private static func stroke(from: CGPoint, to: CGPoint, rounded: Bool = false) {
        let line = UIBezierPath()
        line.move(to: from)
        line.addLine(to: to)
        line.lineWidth = strokeWidth
        line.lineCapStyle = rounded ? .round : .butt
        line.stroke()
    }

    private static func fill(_ corners: [CGPoint]) {
        let triangle = UIBezierPath()
        triangle.move(to: corners[0])
        corners.dropFirst().forEach { triangle.addLine(to: $0) }
        triangle.close()
        triangle.fill()
    }

    private static func draw(_ text: String, in size: CGSize) {
        let font = UIFont.systemFont(ofSize: size.height * exitTextRatio, weight: .bold)
        let attributed = NSAttributedString(string: text, attributes: [
            .font: font, .foregroundColor: UIColor.white
        ])
        let bounds = attributed.size()
        attributed.draw(at: CGPoint(x: (size.width - bounds.width) / 2,
                                    y: (size.height - bounds.height) / 2))
    }
}
