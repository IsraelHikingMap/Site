package com.mapeak.car

import org.json.JSONException
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng

/** A private route point (POI), as fed from JS: `{ latlng: [lng, lat], title }`. */
data class CarMarkerData(
        val lngLat: LatLng,
        val title: String = ""
) {
    companion object {
        @Throws(JSONException::class)
        fun fromJson(json: JSONObject): CarMarkerData {
            val latlng = json.getJSONArray("latlng")
            return CarMarkerData(
                    lngLat = LatLng(latlng.getDouble(1), latlng.getDouble(0)),
                    title = json.optString("title")
            )
        }
    }
}
