package com.mapeak.car

import com.getcapacitor.JSObject
import org.json.JSONException
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng

data class CarRouteData(
        val lngLats: List<LatLng> = emptyList(),
        val weight: Double = 0.0,
        val color: String? = null,
        val opacity: Double = 0.0,
        val name: String? = null
) {
    companion object {
        @Throws(JSONException::class)
        fun fromJson(json: JSONObject): CarRouteData {
            val points = json.getJSONArray("points")
            val lngLats =
                    List(points.length()) { i ->
                        val point = points.getJSONArray(i)
                        LatLng(point.getDouble(1), point.getDouble(0))
                    }
            return CarRouteData(
                    lngLats = lngLats,
                    weight = json.getDouble("weight"),
                    color = json.getString("color"),
                    opacity = json.getDouble("opacity"),
                    name = json.optString("name").ifEmpty { null }
            )
        }

        @Throws(JSONException::class)
        fun listFromJson(json: JSObject?): List<CarRouteData> {
            val routes = json?.getJSONArray("routes") ?: return emptyList()
            return List(routes.length()) { i -> fromJson(routes.getJSONObject(i)) }
        }
    }
}
