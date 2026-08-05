package com.mapeak.car

import org.maplibre.android.geometry.LatLng

/** A single search result returned by the backend search API, reduced to what the car UI needs. */
data class CarSearchResult(
        val title: String,
        val subtitle: String,
        val location: LatLng
)
