package com.mapeak.car

import android.location.Location

/**
 * How fast the car is going: the average of the last [MAXIMAL_SPEEDS] speeds the location reported
 * while moving. A single reading jumps between fixes, and readings taken while stopped are left out
 * so that a stop holds the arrival time instead of pushing it towards never. Mirrors the way the app
 * measures the pace behind its own ETA, in PaceCalculatorService.
 *
 * One instance follows one stream of locations, so every consumer keeps its own.
 */
class CarPaceCalculator {

    private val speeds = ArrayDeque<Float>()

    /** The speed, in meters per second, or null before the car moved at all. */
    var speed: Float? = null
        private set

    fun updatePace(location: Location) {
        if (!location.hasSpeed() || location.speed <= MINIMAL_MOVING_SPEED) {
            return
        }
        speeds.addLast(location.speed)
        if (speeds.size > MAXIMAL_SPEEDS) {
            speeds.removeFirst()
        }
        speed = speeds.average().toFloat()
    }

    companion object {
        /** How many of the latest speeds are averaged. */
        private const val MAXIMAL_SPEEDS = 10

        /** Below this speed, in meters per second, the car is stopped rather than moving slowly. */
        private const val MINIMAL_MOVING_SPEED = 0.5f
    }
}
