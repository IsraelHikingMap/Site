package com.mapeak.car

import com.getcapacitor.JSObject
import org.json.JSONException
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng

data class CarRouteData(
    val lngLats: MutableList<LatLng> = ArrayList(),
    val weight: Double = 0.0,
    val color: String? = null,
    val opacity: Double = 0.0
) {
    companion object {
        @Throws(JSONException::class)
        fun fromJson(json: JSONObject): CarRouteData {
            val points = json.getJSONArray("points")
            val lngLats = ArrayList<LatLng>(points.length())
            for (i in 0..<points.length()) {
                val point = points.getJSONArray(i)
                lngLats.add(LatLng(point.getDouble(1), point.getDouble(0)))
            }
            return CarRouteData(
                lngLats = lngLats,
                weight = json.getDouble("weight"),
                color = json.getString("color"),
                opacity = json.getDouble("opacity")
            )
        }

        @Throws(JSONException::class)
        fun listFromJson(json: JSObject?): List<CarRouteData> {
            if (json == null) {
                return ArrayList()
            }
            val routes = json.getJSONArray("routes")
            val result = ArrayList<CarRouteData>(routes.length())
            for (i in 0..<routes.length()) {
                result.add(fromJson(routes.getJSONObject(i)))
            }
            return result
        }
    }
}