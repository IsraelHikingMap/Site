package com.mapeak.car

import android.location.Location

/** A position in the trail: when it arrived, and the distance in meters counted up to it. */
private data class PacePoint(val time: Long, val distance: Double)

/**
 * How fast the car is going, measured from the positions of the last [PACE_WINDOW_MILLISECONDS]
 * rather than read off [Location.getSpeed]. A remaining time taken off a single reading jumps
 * between fixes and drops to nothing at every red light, while a trail of positions gives one that
 * is steady enough to show and holds still while the car is stopped. Mirrors the way the app
 * measures the pace behind its own ETA, in LocationService.
 *
 * One instance follows one stream of locations, so every consumer keeps its own.
 */
class CarPaceCalculator {

    private val trail = ArrayDeque<PacePoint>()
    private var lastCountedLocation: Location? = null
    private var countedDistance = 0.0

    /**
     * The speed, in meters per second, measured the last time the car was moving, or null before it
     * moved at all. A stop is not allowed to overwrite it, so waiting at a light holds the arrival
     * time where it is instead of pushing it towards never. Until the trail is long enough to
     * measure a speed, the one the location reported.
     */
    var speed: Float? = null
        private set

    /**
     * Adds a position to the trail the [speed] is measured from. A position that did not move counts
     * towards the time but not the distance, so that a stop is measured as a stop, and a position
     * that arrived after a gap starts a new trail - where the speed it reports carries the estimate
     * until that trail has one of its own.
     */
    fun updatePace(location: Location) {
        if (isAfterGap(location.time)) {
            clear()
        }
        val lastCounted = lastCountedLocation
        val distance = if (lastCounted == null) 0.0 else lastCounted.distanceTo(location).toDouble()
        if (lastCounted == null || distance >= MINIMAL_MOVEMENT_METERS) {
            countedDistance += distance
            lastCountedLocation = location
        }
        trail.addLast(PacePoint(location.time, countedDistance))
        while (trail.size > 2 && location.time - trail[1].time >= PACE_WINDOW_MILLISECONDS) {
            trail.removeFirst()
        }
        val first = trail.first()
        val latest = trail.last()
        val duration = (latest.time - first.time) / 1000.0
        val measured =
                if (duration > 0) ((latest.distance - first.distance) / duration).toFloat() else 0f
        if (measured > MINIMAL_MOVING_SPEED) {
            speed = measured
        } else if (speed == null && location.hasSpeed() && location.speed > MINIMAL_MOVING_SPEED) {
            speed = location.speed
        }
    }

    /**
     * Whether the given position arrived too long after the last one for the two to be part of the
     * same trail - see [MAXIMAL_GAP_MILLISECONDS].
     */
    private fun isAfterGap(time: Long): Boolean {
        val lastInTrail = trail.lastOrNull() ?: return false
        return time - lastInTrail.time > MAXIMAL_GAP_MILLISECONDS
    }

    private fun clear() {
        trail.clear()
        lastCountedLocation = null
        countedDistance = 0.0
        speed = null
    }

    companion object {
        /** The length of the trail of positions the speed is measured over. */
        private const val PACE_WINDOW_MILLISECONDS = 15 * 60 * 1000L

        /**
         * How far a position has to be from the last counted one to count, so GPS wander is not
         * movement.
         */
        private const val MINIMAL_MOVEMENT_METERS = 10.0

        /** Below this speed, in meters per second, the car is stopped rather than moving slowly. */
        private const val MINIMAL_MOVING_SPEED = 0.5f

        /** A gap in the positions longer than this ends the trail instead of extending it. */
        private const val MAXIMAL_GAP_MILLISECONDS = 2 * 60 * 1000L
    }
}
